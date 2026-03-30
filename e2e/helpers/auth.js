/**
 * E2E auth helpers
 */

export const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';

let _seq = 0;

/**
 * Registers a new user via POST /auth/register, then injects the returned JWT
 * into localStorage so the client treats the session as authenticated.
 */
export async function createUserAndLogin(request, page, options = {}) {
  _seq += 1;
  const ts = Date.now();
  const role = options.role || 'admin';

  const creds = {
    name:       options.name       || `E2E ${role} ${_seq}`,
    email:      options.email      || `e2e.${role}.${_seq}.${ts}@test.local`,
    password:   options.password   || 'Password123!',
    role,
    department: options.department || '',
  };

  const res = await request.post(`${API_BASE}/auth/register`, { data: creds });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`createUserAndLogin: register failed (${res.status()}): ${body}`);
  }
  const { token, user } = await res.json();

  await page.goto('/login');
  await page.evaluate(
    ({ t, u }) => {
      localStorage.setItem('token', t);
      localStorage.setItem('user', JSON.stringify(u));
    },
    { t: token, u: user }
  );

  return { creds, token, user };
}

/**
 * Fills and submits the login form.
 * Uses attribute/type selectors because Login.jsx labels are not htmlFor-associated.
 */
export async function loginViaUI(page, email, password) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

/**
 * Clicks the Logout button in the Navbar.
 */
export async function logout(page) {
  await page.getByRole('button', { name: /logout/i }).click();
  await page.waitForURL('**/login');
}
