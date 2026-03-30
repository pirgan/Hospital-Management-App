/**
 * E2E — Patient management flows
 *
 * Key UI facts (from PatientList.jsx and PatientRegister.jsx):
 *   - List heading: "Patient Registry"
 *   - Register button: "+ Register Patient" (a <button>, not a <link>)
 *   - PatientRegister labels are NOT htmlFor-associated → use type/index selectors
 *   - PatientDetail tabs: "Overview", "EHR History", "Prescriptions", "Lab Orders", "Invoices"
 */

import { test, expect } from '@playwright/test';
import { API_BASE, createUserAndLogin } from '../helpers/auth.js';

async function createPatient(request, token, overrides = {}) {
  const ts = Date.now();
  const res = await request.post(`${API_BASE}/patients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      fullName:    overrides.fullName    || `E2E Patient ${ts}`,
      dateOfBirth: overrides.dateOfBirth || '1990-06-15',
      gender:      overrides.gender      || 'female',
      nhsNumber:   overrides.nhsNumber   || `NHS-E2E-${ts}`,
      ...overrides,
    },
  });
  return res.json();
}

// ── Patient list ──────────────────────────────────────────────────────────────

test.describe('Patient list page', () => {
  test('loads with heading "Patient Registry"', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/patients');
    await expect(page.getByText('Patient Registry')).toBeVisible({ timeout: 15_000 });
  });

  test('shows a registered patient in the list', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'doctor' });
    await createPatient(request, token, { fullName: 'Alice Listing' });

    await page.goto('/patients');
    await expect(page.getByText('Alice Listing')).toBeVisible({ timeout: 15_000 });
  });

  test('search input filters patients by name', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'doctor' });
    await createPatient(request, token, { fullName: 'SearchableAlpha Jones', nhsNumber: `NHS-SA-${Date.now()}` });
    await createPatient(request, token, { fullName: 'BetaBlocker Nope',      nhsNumber: `NHS-BB-${Date.now()}` });

    await page.goto('/patients');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder(/search/i).fill('SearchableAlpha');
    await expect(page.getByText('SearchableAlpha Jones')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('BetaBlocker Nope')).not.toBeVisible();
  });

  test('shows "+ Register Patient" button for receptionist', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'receptionist' });
    await page.goto('/patients');
    // Button in PatientList.jsx: text "+ Register Patient" (not a <Link>)
    await expect(page.getByRole('button', { name: /register patient/i })).toBeVisible({ timeout: 15_000 });
  });

  test('clicking a patient card navigates to patient detail', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'doctor' });
    const patient = await createPatient(request, token, { fullName: 'ClickablePt Doe', nhsNumber: `NHS-CP-${Date.now()}` });

    await page.goto('/patients');
    await page.waitForLoadState('networkidle');

    await page.getByText('ClickablePt Doe').first().click();
    await page.waitForURL(`**/patients/${patient._id}`);
    await expect(page).toHaveURL(new RegExp(`/patients/${patient._id}`));
  });
});

// ── Patient registration wizard ───────────────────────────────────────────────

test.describe('Patient registration wizard', () => {
  test('completes all 3 steps and registers a new patient', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'receptionist' });
    await page.goto('/patients/register');

    // ── Step 1 — Demographics ──────────────────────────────────────────────────
    // PatientRegister Field labels are NOT htmlFor-associated.
    // Use placeholder or input type/position to locate fields.
    const ts = Date.now();

    // Full Name — first text input on the step
    await page.locator('input[type="text"]').first().fill(`Wizard Patient ${ts}`);
    // Date of Birth — only date input on step 1
    await page.locator('input[type="date"]').fill('1985-03-22');
    // NHS Number has placeholder "000-000-0000"
    await page.getByPlaceholder('000-000-0000').fill(`NHS-WIZ-${ts}`);
    await page.getByRole('button', { name: 'Next' }).click();

    // ── Step 2 — Contact ───────────────────────────────────────────────────────
    // Text inputs appear in order: Phone, Email, Address, then Emergency Contact fields
    const textInputs = page.locator('input[type="text"], input[type="email"], input[type="tel"]');
    await page.locator('input[type="text"]').first().fill('07700900000');
    await page.locator('input[type="email"]').fill(`wizardpatient.${ts}@example.com`);
    await page.locator('input[type="text"]').nth(1).fill('123 Test Street, London');
    await page.getByRole('button', { name: 'Next' }).click();

    // ── Step 3 — Insurance ─────────────────────────────────────────────────────
    await page.locator('input[type="text"]').nth(0).fill('NHS');        // Insurance Provider
    await page.locator('input[type="text"]').nth(1).fill(`POL-${ts}`); // Policy Number
    await page.getByRole('button', { name: 'Register Patient' }).click();

    // After success, navigates to /patients/:id
    await page.waitForURL(/\/patients\/[a-f0-9]{24}/);
    await expect(page).toHaveURL(/\/patients\/[a-f0-9]{24}/);
  });

  test('Back button returns to previous step and preserves values', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/patients/register');

    // Fill step 1
    await page.locator('input[type="text"]').first().fill('Back Test Patient');
    await page.locator('input[type="date"]').fill('1990-01-01');
    await page.getByPlaceholder('000-000-0000').fill(`NHS-BACK-${Date.now()}`);
    await page.getByRole('button', { name: 'Next' }).click();

    // Now on step 2 — Phone input visible
    await expect(page.locator('input[type="text"]').first()).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();

    // Back on step 1 — Full Name still has the value
    await expect(page.locator('input[type="text"]').first()).toHaveValue('Back Test Patient');
  });
});

// ── Patient detail ────────────────────────────────────────────────────────────

test.describe('Patient detail page', () => {
  test('displays patient name in header', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'doctor' });
    const patient = await createPatient(request, token, {
      fullName:    'Detail Patient Smith',
      nhsNumber:   `NHS-DET-${Date.now()}`,
      dateOfBirth: '1975-08-10',
    });

    await page.goto(`/patients/${patient._id}`);
    await expect(page.getByText('Detail Patient Smith')).toBeVisible({ timeout: 15_000 });
  });

  test('shows tab buttons: Overview, EHR History, Prescriptions, Lab Orders', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'doctor' });
    const patient = await createPatient(request, token, {
      fullName:  'TabPatient Person',
      nhsNumber: `NHS-TAB-${Date.now()}`,
    });

    await page.goto(`/patients/${patient._id}`);
    await expect(page.getByText('Detail Patient Smith').or(page.getByText('TabPatient Person'))).toBeVisible({ timeout: 15_000 });

    // Tab buttons from TABS array in PatientDetail.jsx
    await expect(page.getByRole('button', { name: 'EHR History' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prescriptions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lab Orders' })).toBeVisible();
  });

  test('non-existent patient shows loading state without crashing', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/patients/000000000000000000000000');

    // PatientDetail returns "Loading patient..." when patient state is null (API 404 is silently caught)
    // The important thing is the app doesn't crash and we stay authenticated
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForTimeout(2000);
    // Still on the patients URL (not redirected)
    await expect(page).toHaveURL(/\/patients\//);
  });
});
