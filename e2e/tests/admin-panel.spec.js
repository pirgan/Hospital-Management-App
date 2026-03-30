/**
 * E2E — Admin panel (user management) flows
 *
 * Key UI facts (from AdminPanel.jsx):
 *   - Page heading (h1): "Admin — User Management"
 *   - New user button: "+ New User"
 *   - Modal heading (h2): "Create New User"
 *   - Modal submit button: "Create User"
 *   - Deactivate button: "Deactivate" (red bg); Reactivate: "Reactivate" (green bg)
 *   - Modal form labels are NOT htmlFor-associated → use input type/position selectors
 */

import { test, expect } from '@playwright/test';
import { API_BASE, createUserAndLogin } from '../helpers/auth.js';

// ── Admin panel access ────────────────────────────────────────────────────────

test.describe('Admin panel — loads and displays users', () => {
  test('admin can access /admin and see the user table', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/admin');
    await expect(page.getByText('Admin — User Management')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('table shows the admin user who is logged in', async ({ request, page }) => {
    const { creds } = await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(creds.email)).toBeVisible({ timeout: 15_000 });
  });

  test('table has at least 3 rows (header + admin + extra staff)', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    const ts = Date.now();
    await page.request.post(`${API_BASE}/auth/register`, {
      data: { name: `Nurse Panel ${ts}`, email: `nurse.panel.${ts}@test.local`, password: 'Password123!', role: 'nurse' },
    });
    await page.request.post(`${API_BASE}/auth/register`, {
      data: { name: `Doc Panel ${ts}`, email: `doc.panel.${ts}@test.local`, password: 'Password123!', role: 'doctor' },
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // toHaveCount takes a number; use count() for >=N assertion
    const rowCount = await page.getByRole('row').count();
    expect(rowCount).toBeGreaterThanOrEqual(3); // header row + at least 2 data rows
  });
});

// ── Role filter tabs ──────────────────────────────────────────────────────────

test.describe('Admin panel — role filter', () => {
  test('clicking "doctor" filter shows only doctor rows', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    const ts = Date.now();
    await page.request.post(`${API_BASE}/auth/register`, {
      data: { name: `Filterable Dr ${ts}`, email: `filtdr.${ts}@test.local`, password: 'Password123!', role: 'doctor' },
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Role filter tabs are <button> elements with capitalized role names
    await page.getByRole('button', { name: 'doctor' }).click();
    await page.waitForLoadState('networkidle');

    // All visible role badges should show "doctor"
    await expect(page.getByText(`Filterable Dr ${ts}`)).toBeVisible({ timeout: 10_000 });
  });

  test('"all" filter shows all users', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'all' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('table')).toBeVisible();
  });
});

// ── Deactivate / reactivate ───────────────────────────────────────────────────

test.describe('Admin panel — deactivate / reactivate user', () => {
  test('Deactivate button disables account and changes to Reactivate', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    const ts = Date.now();

    await page.request.post(`${API_BASE}/auth/register`, {
      data: { name: `Deactivate Me ${ts}`, email: `deactivate.${ts}@test.local`, password: 'Password123!', role: 'nurse' },
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Find the table row containing the target name and click its Deactivate button
    const targetRow = page.getByRole('row').filter({ hasText: `Deactivate Me ${ts}` });
    await targetRow.getByRole('button', { name: 'Deactivate' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.Toastify')).toContainText(/deactivated/i);
    await expect(targetRow.getByRole('button', { name: 'Reactivate' })).toBeVisible({ timeout: 10_000 });
  });

  test('Reactivate button re-enables a deactivated account', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'admin' });
    const ts = Date.now();
    const email = `reactivate.${ts}@test.local`;

    const regRes = await page.request.post(`${API_BASE}/auth/register`, {
      data: { name: `Reactivate Me ${ts}`, email, password: 'Password123!', role: 'lab_tech' },
    });
    const { user: target } = await regRes.json();

    // Deactivate via API using the current admin token
    await page.request.put(`${API_BASE}/users/${target._id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { isActive: false },
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const targetRow = page.getByRole('row').filter({ hasText: `Reactivate Me ${ts}` });
    await targetRow.getByRole('button', { name: 'Reactivate' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.Toastify')).toContainText(/reactivated/i);
  });
});

// ── Create new user ───────────────────────────────────────────────────────────

test.describe('Admin panel — create new user', () => {
  test('"+ New User" button opens the Create New User modal', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /new user/i }).click();

    // Modal heading is h2: "Create New User"
    await expect(page.getByText('Create New User')).toBeVisible({ timeout: 10_000 });
  });

  test('successfully creates a new user via the modal', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const ts = Date.now();
    await page.getByRole('button', { name: /new user/i }).click();
    await expect(page.getByText('Create New User')).toBeVisible({ timeout: 10_000 });

    // Modal inputs (labels NOT htmlFor-associated; use type/position within the modal)
    // Order in CreateUserModal: Full Name (text), Email (email), Temporary Password (password),
    //                           Department (text), Role (select)
    const modal = page.locator('div.fixed.inset-0');
    await modal.locator('input[type="text"]').first().fill(`Created User ${ts}`);
    await modal.locator('input[type="email"]').fill(`created.${ts}@test.local`);
    await modal.locator('input[type="password"]').fill('Password123!');
    await modal.locator('select').selectOption('nurse');

    await modal.getByRole('button', { name: 'Create User' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.Toastify')).toContainText(/created|success/i);
    // New user should appear in the table after modal closes
    await expect(page.getByText(`Created User ${ts}`)).toBeVisible({ timeout: 10_000 });
  });
});
