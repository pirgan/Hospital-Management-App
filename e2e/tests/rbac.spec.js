/**
 * E2E — Role-Based Access Control (RBAC) enforcement
 *
 * Verifies that the client-side RoleRoute guard redirects users to /dashboard
 * when they attempt to access a route their role does not permit.
 *
 * Mapping (from App.jsx / CLAUDE.md):
 *
 *  Route                | Allowed roles
 *  ---------------------|-------------------------------
 *  /patients            | admin, doctor, nurse, receptionist
 *  /patients/register   | admin, doctor, receptionist
 *  /appointments/book   | admin, doctor, receptionist
 *  /records             | admin, doctor, nurse
 *  /records/new         | admin, doctor, nurse
 *  /pharmacy            | admin, doctor, nurse
 *  /lab                 | admin, doctor, lab_tech
 *  /billing             | admin, receptionist
 *  /wards               | admin, doctor, nurse
 *  /admin               | admin
 */

import { test, expect } from '@playwright/test';
import { createUserAndLogin } from '../helpers/auth.js';

/**
 * assertRedirected — navigate to a protected path with the given role
 * and expect the browser to end up on /dashboard (or /login if not authenticated).
 */
async function assertRedirected(request, page, role, path) {
  await createUserAndLogin(request, page, { role });
  await page.goto(path);
  await page.waitForURL(/\/(dashboard|login)/);
  const url = page.url();
  expect(url).toMatch(/\/(dashboard|login)/);
}

// ── lab_tech restrictions ─────────────────────────────────────────────────────

test.describe('lab_tech cannot access clinical management routes', () => {
  test('lab_tech → /patients redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'lab_tech', '/patients');
  });

  test('lab_tech → /patients/register redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'lab_tech', '/patients/register');
  });

  test('lab_tech → /billing redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'lab_tech', '/billing');
  });

  test('lab_tech → /wards redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'lab_tech', '/wards');
  });

  test('lab_tech → /admin redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'lab_tech', '/admin');
  });

  test('lab_tech CAN access /lab', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'lab_tech' });
    await page.goto('/lab');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/(dashboard|login)/);
    await expect(page).toHaveURL(/\/lab/);
  });
});

// ── patient restrictions ──────────────────────────────────────────────────────

test.describe('patient role has minimal access', () => {
  test('patient → /patients redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'patient', '/patients');
  });

  test('patient → /records redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'patient', '/records');
  });

  test('patient → /pharmacy redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'patient', '/pharmacy');
  });

  test('patient → /lab redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'patient', '/lab');
  });

  test('patient → /billing redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'patient', '/billing');
  });

  test('patient → /wards redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'patient', '/wards');
  });

  test('patient → /admin redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'patient', '/admin');
  });

  test('patient CAN access /dashboard', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'patient' });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('patient CAN access /appointments', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'patient' });
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/appointments/);
  });
});

// ── receptionist restrictions ─────────────────────────────────────────────────

test.describe('receptionist cannot access clinical routes', () => {
  test('receptionist → /records redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'receptionist', '/records');
  });

  test('receptionist → /records/new redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'receptionist', '/records/new');
  });

  test('receptionist → /lab redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'receptionist', '/lab');
  });

  test('receptionist → /wards redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'receptionist', '/wards');
  });

  test('receptionist → /admin redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'receptionist', '/admin');
  });

  test('receptionist CAN access /billing', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'receptionist' });
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/billing/);
  });
});

// ── doctor restrictions ───────────────────────────────────────────────────────

test.describe('doctor cannot access admin/billing routes', () => {
  test('doctor → /billing redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'doctor', '/billing');
  });

  test('doctor → /admin redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'doctor', '/admin');
  });

  test('doctor CAN access /records', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/records');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/records/);
  });

  test('doctor CAN access /wards', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/wards');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/wards/);
  });
});

// ── nurse restrictions ────────────────────────────────────────────────────────

test.describe('nurse cannot access admin/billing/lab routes', () => {
  test('nurse → /billing redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'nurse', '/billing');
  });

  test('nurse → /lab redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'nurse', '/lab');
  });

  test('nurse → /admin redirects to /dashboard', async ({ request, page }) => {
    await assertRedirected(request, page, 'nurse', '/admin');
  });

  test('nurse CAN access /wards', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'nurse' });
    await page.goto('/wards');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/wards/);
  });

  test('nurse CAN access /pharmacy', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'nurse' });
    await page.goto('/pharmacy');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/pharmacy/);
  });
});

// ── admin full access ─────────────────────────────────────────────────────────

test.describe('admin has access to every route', () => {
  const routes = [
    '/dashboard',
    '/patients',
    '/appointments',
    '/records',
    '/pharmacy',
    '/lab',
    '/billing',
    '/wards',
    '/admin',
  ];

  for (const route of routes) {
    test(`admin CAN access ${route}`, async ({ request, page }) => {
      await createUserAndLogin(request, page, { role: 'admin' });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
    });
  }
});
