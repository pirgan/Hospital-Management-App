/**
 * E2E — Dashboard role-specific rendering
 *
 * Exact section heading text sourced directly from Dashboard.jsx:
 *   Admin:        "Total Patients", "Today's Appointments", "Revenue Collected",
 *                 "Overdue Amount", "Appointments — Last 7 Days", "Bed Occupancy",
 *                 "Overdue Invoices", "Flagged Lab Results", "High-Risk Overdue Follow-ups"
 *   Doctor:       "Today's Appointments", "Pending Lab Orders", "Active Prescriptions",
 *                 "Today's Schedule", "Flagged Lab Results", "Overdue Follow-ups"
 *   Nurse:        "Total Beds", "Occupied", "Available",
 *                 "Active Prescriptions Awaiting Dispensing", "STAT Lab Orders"
 *   Receptionist: "Today's Appointments", "Confirmed", "No-Shows",
 *                 "Today's Check-in List", "Upcoming — Next 7 Days",
 *                 "Recently Registered Patients"
 *   Lab Tech:     "Pending Orders", "In-Progress", "STAT Priority",
 *                 "Pending Order Queue", "Completed Today — Flagged Results"
 *   Patient:      "Next Appointment", "Current Prescriptions", "Recent Lab Results"
 */

import { test, expect } from '@playwright/test';
import { createUserAndLogin } from '../helpers/auth.js';

// ── Admin dashboard ───────────────────────────────────────────────────────────

test.describe('Admin dashboard', () => {
  test('shows all 4 KPI stat cards', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/dashboard');
    await expect(page.getByText('Total Patients')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Today's Appointments")).toBeVisible();
    await expect(page.getByText('Revenue Collected')).toBeVisible();
    await expect(page.getByText('Overdue Amount')).toBeVisible();
  });

  test('shows Appointments bar chart section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/dashboard');
    await expect(page.getByText('Appointments — Last 7 Days')).toBeVisible({ timeout: 15_000 });
  });

  test('shows Bed Occupancy chart section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/dashboard');
    await expect(page.getByText('Bed Occupancy')).toBeVisible({ timeout: 15_000 });
  });

  test('shows Overdue Invoices section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/dashboard');
    await expect(page.getByText('Overdue Invoices')).toBeVisible({ timeout: 15_000 });
  });

  test('shows Flagged Lab Results alert panel', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/dashboard');
    await expect(page.getByText('Flagged Lab Results').first()).toBeVisible({ timeout: 15_000 });
  });

  test('does NOT show doctor-specific schedule section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/dashboard');
    await expect(page.getByText('Total Patients')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Today's Schedule")).not.toBeVisible();
  });

  test('sidebar shows all admin nav items', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /^patients$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /billing/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^admin$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /ward map/i })).toBeVisible();
  });
});

// ── Doctor dashboard ──────────────────────────────────────────────────────────

test.describe('Doctor dashboard', () => {
  test('shows 3 doctor-specific stat cards', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/dashboard');
    await expect(page.getByText("Today's Appointments")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Pending Lab Orders')).toBeVisible();
    await expect(page.getByText('Active Prescriptions')).toBeVisible();
  });

  test("shows Today's Schedule section", async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/dashboard');
    await expect(page.getByText("Today's Schedule")).toBeVisible({ timeout: 15_000 });
  });

  test('shows Flagged Lab Results and Overdue Follow-ups panels', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/dashboard');
    // These headings are always rendered in DoctorView regardless of data
    await expect(page.getByText('Flagged Lab Results')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Overdue Follow-ups')).toBeVisible({ timeout: 15_000 });
  });

  test('does NOT show admin KPI cards', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/dashboard');
    await expect(page.getByText("Today's Schedule")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total Patients')).not.toBeVisible();
    await expect(page.getByText('Revenue Collected')).not.toBeVisible();
  });

  test('sidebar does NOT show Billing or Admin links', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /billing/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /^admin$/i })).not.toBeVisible();
  });
});

// ── Nurse dashboard ───────────────────────────────────────────────────────────

test.describe('Nurse dashboard', () => {
  test('shows bed stat cards (Total Beds, Occupied, Available)', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'nurse' });
    await page.goto('/dashboard');
    await expect(page.getByText('Total Beds')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Occupied')).toBeVisible();
    await expect(page.getByText('Available')).toBeVisible();
  });

  test('shows Active Prescriptions Awaiting Dispensing section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'nurse' });
    await page.goto('/dashboard');
    await expect(page.getByText('Active Prescriptions Awaiting Dispensing')).toBeVisible({ timeout: 15_000 });
  });

  test('shows STAT Lab Orders section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'nurse' });
    await page.goto('/dashboard');
    await expect(page.getByText('STAT Lab Orders')).toBeVisible({ timeout: 15_000 });
  });

  test('sidebar shows Ward Map but not Billing', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'nurse' });
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /ward map/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /billing/i })).not.toBeVisible();
  });
});

// ── Receptionist dashboard ────────────────────────────────────────────────────

test.describe('Receptionist dashboard', () => {
  test("shows Today's Check-in List section", async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'receptionist' });
    await page.goto('/dashboard');
    await expect(page.getByText("Today's Check-in List")).toBeVisible({ timeout: 15_000 });
  });

  test('shows Upcoming — Next 7 Days section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'receptionist' });
    await page.goto('/dashboard');
    await expect(page.getByText('Upcoming — Next 7 Days')).toBeVisible({ timeout: 15_000 });
  });

  test('shows Recently Registered Patients section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'receptionist' });
    await page.goto('/dashboard');
    await expect(page.getByText('Recently Registered Patients')).toBeVisible({ timeout: 15_000 });
  });

  test('sidebar shows Billing but not Ward Map', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'receptionist' });
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /billing/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /ward map/i })).not.toBeVisible();
  });
});

// ── Lab Tech dashboard ────────────────────────────────────────────────────────

test.describe('Lab Tech dashboard', () => {
  test('shows Pending Orders, In-Progress and STAT Priority stat cards', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'lab_tech' });
    await page.goto('/dashboard');
    // Exact labels from LabTechView StatCard components in Dashboard.jsx
    await expect(page.getByText('Pending Orders')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('In-Progress')).toBeVisible();
    await expect(page.getByText('STAT Priority')).toBeVisible();
  });

  test('shows Pending Order Queue section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'lab_tech' });
    await page.goto('/dashboard');
    await expect(page.getByText('Pending Order Queue')).toBeVisible({ timeout: 15_000 });
  });

  test('sidebar shows Lab Results but not Patients', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'lab_tech' });
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /lab results/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^patients$/i })).not.toBeVisible();
  });
});

// ── Patient dashboard ─────────────────────────────────────────────────────────

test.describe('Patient dashboard', () => {
  test('shows Next Appointment section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'patient' });
    await page.goto('/dashboard');
    await expect(page.getByText('Next Appointment')).toBeVisible({ timeout: 15_000 });
  });

  test('shows Current Prescriptions section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'patient' });
    await page.goto('/dashboard');
    // Exact heading from PatientView in Dashboard.jsx
    await expect(page.getByText('Current Prescriptions')).toBeVisible({ timeout: 15_000 });
  });

  test('shows Recent Lab Results section', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'patient' });
    await page.goto('/dashboard');
    // Exact heading from PatientView in Dashboard.jsx
    await expect(page.getByText('Recent Lab Results')).toBeVisible({ timeout: 15_000 });
  });

  test('sidebar only shows Dashboard and Appointments', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'patient' });
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /^dashboard$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /appointments/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^patients$/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /ehr records/i })).not.toBeVisible();
  });
});
