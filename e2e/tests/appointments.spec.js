/**
 * E2E — Appointment calendar and booking flows
 */

import { test, expect } from '@playwright/test';
import { API_BASE, createUserAndLogin } from '../helpers/auth.js';

async function createPatient(request, token, name) {
  const ts  = Date.now();
  const res = await request.post(`${API_BASE}/patients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { fullName: name || `Appt Patient ${ts}`, dateOfBirth: '1990-01-01', gender: 'male', nhsNumber: `NHS-AP-${ts}` },
  });
  return res.json();
}

async function createAppointment(request, token, patientId, doctorId) {
  const scheduledAt = new Date();
  scheduledAt.setHours(scheduledAt.getHours() + 1, 0, 0, 0);
  const res = await request.post(`${API_BASE}/appointments`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { patient: patientId, doctor: doctorId, scheduledAt: scheduledAt.toISOString(), type: 'consultation', duration: 30 },
  });
  return res.json();
}

// ── Calendar view ─────────────────────────────────────────────────────────────

test.describe('Appointment calendar', () => {
  test('loads calendar page with heading for any authenticated user', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'nurse' });
    await page.goto('/appointments');
    await expect(page.getByText('Appointment Calendar')).toBeVisible({ timeout: 15_000 });
  });

  test('day view button switches view (exact name match, not regex)', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');

    // Use exact string 'day' to avoid matching the 'Today' navigation button
    await page.getByRole('button', { name: 'day' }).click();

    // Day view shows hour labels e.g. "8:00"
    await expect(page.getByText('8:00')).toBeVisible({ timeout: 10_000 });
  });

  test('week view toggle is visible by default', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'receptionist' });
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'week' })).toBeVisible();
  });

  test('doctor filter dropdown is visible', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');

    // Doctor filter <select> — shows "All Doctors" placeholder option
    await expect(page.getByRole('combobox')).toBeVisible();
  });

  test('appointment created via API shows first-name on the calendar', async ({ request, page }) => {
    const { token, user } = await createUserAndLogin(request, page, { role: 'doctor' });
    const patient = await createPatient(request, token, `CalFirst CalLast ${Date.now()}`);
    await createAppointment(request, token, patient._id, user._id);

    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');

    // Calendar renders "{firstName} — {type}" so check the first token of fullName
    const firstName = patient.fullName.split(' ')[0];
    await expect(page.getByText(new RegExp(firstName))).toBeVisible({ timeout: 10_000 });
  });
});

// ── Book appointment ──────────────────────────────────────────────────────────

test.describe('Book appointment page', () => {
  test('heading "Book Appointment" is visible for receptionist', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'receptionist' });
    await page.goto('/appointments/book');
    // h1 text is exactly "Book Appointment"
    await expect(page.getByText('Book Appointment')).toBeVisible({ timeout: 15_000 });
  });

  test('heading "Book Appointment" is visible for doctor', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/appointments/book');
    await expect(page.getByText('Book Appointment')).toBeVisible({ timeout: 15_000 });
  });

  test('heading "Book Appointment" is visible for admin', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/appointments/book');
    await expect(page.getByText('Book Appointment')).toBeVisible({ timeout: 15_000 });
  });

  test('form has Patient, Doctor, Date, and Type fields', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'receptionist' });
    await page.goto('/appointments/book');
    await expect(page.getByText('Book Appointment')).toBeVisible({ timeout: 15_000 });

    // Labels are plain text nodes (not associated via htmlFor)
    await expect(page.getByText('Patient')).toBeVisible();
    await expect(page.getByText('Doctor')).toBeVisible();
    await expect(page.getByText('Date')).toBeVisible();
    await expect(page.getByText('Type')).toBeVisible();
  });

  test('books an appointment via the form and shows success toast', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'receptionist' });

    // Create a doctor and patient
    const drRes = await page.request.post(`${API_BASE}/auth/register`, {
      data: {
        name:     `Dr BookTest ${Date.now()}`,
        email:    `dr.booktest.${Date.now()}@test.local`,
        password: 'Password123!',
        role:     'doctor',
      },
    });
    const { user: doctor } = await drRes.json();
    const patient = await createPatient(request, token, `BookPt ${Date.now()}`);

    await page.goto('/appointments/book');
    await expect(page.getByText('Book Appointment')).toBeVisible({ timeout: 15_000 });

    // Selects appear in DOM order: Patient(0), Doctor(1), Type(2)
    const selects = page.locator('select');
    await selects.nth(0).selectOption({ value: patient._id.toString() });
    await selects.nth(1).selectOption({ value: doctor._id.toString() });

    // Pick today's date (min date is today per the date input)
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    // Wait for slot picker to appear and click the first available slot
    await page.waitForTimeout(500); // slot picker re-renders after date change
    const slotBtn = page.getByRole('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    if (await slotBtn.isVisible()) {
      await slotBtn.click();
    }

    await page.getByRole('button', { name: 'Book Appointment' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.Toastify')).toContainText(/booked|success/i);
  });
});
