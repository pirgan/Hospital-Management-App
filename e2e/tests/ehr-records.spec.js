/**
 * E2E — EHR medical records flows
 *
 * Key UI facts (from MedicalRecordList.jsx and EHRRecord.jsx):
 *   - List page heading: "EHR Records"
 *   - Create button: "+ New Record" (a <button>, not a <link>)
 *   - Create form heading (h1): "New Visit Note"
 *   - Chief Complaint is inside a <Card title="Chief Complaint"> — textarea placeholder: "Reason for visit..."
 *   - Vitals section is inside <Card title="Vitals">
 *   - Treatment Plan textarea placeholder: "Treatment plan, medications, referrals..."
 *   - Submit button: "Save Record"
 *   - After save, navigates to /patients/:id (not /records/:id)
 *   - View heading (h1): "Visit — {date}"
 */

import { test, expect } from '@playwright/test';
import { API_BASE, createUserAndLogin } from '../helpers/auth.js';

async function createPatient(request, token) {
  const ts  = Date.now();
  const res = await request.post(`${API_BASE}/patients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { fullName: `EHR Patient ${ts}`, dateOfBirth: '1980-05-05', gender: 'female', nhsNumber: `NHS-EHR-${ts}` },
  });
  return res.json();
}

async function createRecord(request, token, patientId, doctorId) {
  const res = await request.post(`${API_BASE}/medical-records`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      patient:        patientId,
      doctor:         doctorId,
      visitDate:      new Date().toISOString(),
      chiefComplaint: 'E2E test complaint',
      diagnoses:      [{ code: 'J06.9', description: 'Acute URTI', type: 'primary' }],
      treatmentPlan:  'Rest and fluids',
    },
  });
  return res.json();
}

// ── Medical records list ──────────────────────────────────────────────────────

test.describe('Medical records list page', () => {
  test('loads with heading "EHR Records" for doctor', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/records');
    // h1 text in MedicalRecordList.jsx is exactly "EHR Records"
    await expect(page.getByText('EHR Records')).toBeVisible({ timeout: 15_000 });
  });

  test('loads with heading "EHR Records" for nurse', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'nurse' });
    await page.goto('/records');
    await expect(page.getByText('EHR Records')).toBeVisible({ timeout: 15_000 });
  });

  test('shows a record created via API in the table', async ({ request, page }) => {
    const { token, user } = await createUserAndLogin(request, page, { role: 'doctor' });
    const patient = await createPatient(request, token);
    await createRecord(request, token, patient._id, user._id);

    await page.goto('/records');
    // Wait for table to populate — patient name appears in first column
    await expect(page.getByText(patient.fullName)).toBeVisible({ timeout: 15_000 });
  });

  test('shows "+ New Record" button for doctor', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/records');
    // It is a <button> (onClick navigates), not a <Link>
    await expect(page.getByRole('button', { name: /new record/i })).toBeVisible({ timeout: 15_000 });
  });
});

// ── Create EHR record ─────────────────────────────────────────────────────────

test.describe('Create EHR record form', () => {
  test('heading "New Visit Note" is visible at /records/new for doctor', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/records/new');
    // h1 in EHRRecord create mode: "New Visit Note"
    await expect(page.getByText('New Visit Note')).toBeVisible({ timeout: 15_000 });
  });

  test('shows Chief Complaint textarea and Vitals section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/records/new');
    await expect(page.getByText('New Visit Note')).toBeVisible({ timeout: 15_000 });

    // Card titles rendered as headings inside each section
    await expect(page.getByText('Chief Complaint')).toBeVisible();
    await expect(page.getByText('Vitals')).toBeVisible();
    // Chief Complaint textarea placeholder
    await expect(page.getByPlaceholder('Reason for visit...')).toBeVisible();
  });

  test('submitting a complete record navigates to the patient detail page', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'doctor' });
    const patient = await createPatient(request, token);

    await page.goto('/records/new');
    await expect(page.getByText('New Visit Note')).toBeVisible({ timeout: 15_000 });

    // Patient select — first <select> on the page
    await page.locator('select').first().selectOption({ value: patient._id.toString() });

    // Chief Complaint textarea
    await page.getByPlaceholder('Reason for visit...').fill('E2E test complaint');

    // Treatment Plan textarea
    await page.getByPlaceholder('Treatment plan, medications, referrals...').fill('E2E treatment plan');

    await page.getByRole('button', { name: 'Save Record' }).click();

    // After save, EHRRecord.handleSubmit navigates to /patients/:patientId
    await page.waitForURL(/\/patients\/[a-f0-9]{24}/);
    await expect(page).toHaveURL(/\/patients\/[a-f0-9]{24}/);
  });
});

// ── View EHR record ───────────────────────────────────────────────────────────

test.describe('View EHR record', () => {
  test('displays visit heading and chief complaint for doctor', async ({ request, page }) => {
    const { token, user } = await createUserAndLogin(request, page, { role: 'doctor' });
    const patient = await createPatient(request, token);
    const record  = await createRecord(request, token, patient._id, user._id);

    await page.goto(`/records/${record._id}`);
    await page.waitForLoadState('networkidle');

    // h1 in view mode: "Visit — {date}"
    await expect(page.getByText(/^Visit —/)).toBeVisible({ timeout: 15_000 });
    // Chief complaint is shown in the record body
    await expect(page.getByText('E2E test complaint')).toBeVisible();
  });

  test('displays record for nurse (read-only)', async ({ request, page }) => {
    const { token: doctorToken, user: doctor } = await createUserAndLogin(request, page, { role: 'doctor' });
    const patient = await createPatient(request, doctorToken);
    const record  = await createRecord(request, doctorToken, patient._id, doctor._id);

    // Log in as nurse
    await createUserAndLogin(request, page, { role: 'nurse' });
    await page.goto(`/records/${record._id}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/^Visit —/)).toBeVisible({ timeout: 15_000 });
  });
});
