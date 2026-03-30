/**
 * E2E — Authentication flows
 */

import { test, expect } from '@playwright/test';
import { API_BASE, createUserAndLogin, loginViaUI, logout } from '../helpers/auth.js';

// ── Login via UI ──────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test('valid credentials → redirected to /dashboard', async ({ page }) => {
    const ts = Date.now();
    const email    = `e2e.login.${ts}@test.local`;
    const password = 'Password123!';

    await page.request.post(`${API_BASE}/auth/register`, {
      data: { name: 'Login Test', email, password, role: 'nurse' },
    });

    await loginViaUI(page, email, password);
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('wrong password → shows error toast', async ({ page }) => {
    const ts    = Date.now();
    const email = `e2e.badpwd.${ts}@test.local`;

    await page.request.post(`${API_BASE}/auth/register`, {
      data: { name: 'Bad Pwd', email, password: 'Password123!', role: 'nurse' },
    });

    await loginViaUI(page, email, 'WrongPassword!');
    await expect(page.locator('.Toastify')).toContainText(/invalid|credentials|wrong|failed/i);
    await expect(page).toHaveURL(/login/);
  });

  test('unknown email → shows error toast', async ({ page }) => {
    await loginViaUI(page, `nobody.${Date.now()}@nowhere.test`, 'Password123!');
    await expect(page.locator('.Toastify')).toContainText(/invalid|not found|failed/i);
    await expect(page).toHaveURL(/login/);
  });

  test('renders email and password inputs on the login form', async ({ page }) => {
    await page.goto('/login');
    // Check labels are visible as text
    await expect(page.getByText('Email')).toBeVisible();
    await expect(page.getByText('Password')).toBeVisible();
    // Check inputs are present
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('has link to registration page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /request account/i }).click();
    await expect(page).toHaveURL(/register/);
  });
});

// ── Register via UI ───────────────────────────────────────────────────────────

test.describe('Register page', () => {
  test('valid submission → creates account and redirects to /dashboard', async ({ page }) => {
    const ts = Date.now();

    await page.goto('/register');
    await page.getByPlaceholder('Dr. Jane Smith').fill(`E2E Reg ${ts}`);
    await page.getByPlaceholder('jane@medicore.nhs').fill(`e2e.reg.${ts}@test.local`);
    await page.getByPlaceholder('Min 8 characters').fill('Password123!');
    // Role select — only one <select> on the register page
    await page.locator('select').selectOption('nurse');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('duplicate email → shows error toast', async ({ page }) => {
    const ts    = Date.now();
    const email = `e2e.dup.${ts}@test.local`;

    await page.request.post(`${API_BASE}/auth/register`, {
      data: { name: 'First', email, password: 'Password123!', role: 'nurse' },
    });

    await page.goto('/register');
    await page.getByPlaceholder('Dr. Jane Smith').fill('Duplicate User');
    await page.getByPlaceholder('jane@medicore.nhs').fill(email);
    await page.getByPlaceholder('Min 8 characters').fill('Password123!');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.locator('.Toastify')).toContainText(/duplicate|already|exists|failed/i);
    await expect(page).toHaveURL(/register/);
  });

  test('has link back to login page', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/login/);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

test.describe('Logout', () => {
  test('logout button clears session and redirects to /login', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'nurse' });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await logout(page);

    await expect(page).toHaveURL(/login/);
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});

// ── Protected route guard ─────────────────────────────────────────────────────

test.describe('Protected routes', () => {
  test('visiting /dashboard without a token redirects to /login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dashboard');
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/login/);
  });

  test('visiting /patients without a token redirects to /login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/patients');
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/login/);
  });
});

// ── Session persistence ───────────────────────────────────────────────────────

test.describe('Session persistence', () => {
  test('authenticated user stays logged in after page reload', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'doctor' });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
  });
});
