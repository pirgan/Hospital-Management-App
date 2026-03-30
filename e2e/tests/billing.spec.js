/**
 * E2E — Billing / invoices flows
 *
 * Key UI facts (from BillingPage.jsx):
 *   - Page heading (h1): "Billing"
 *   - New invoice button: "+ New Invoice"
 *   - Status filter tabs: all / draft / sent / paid / overdue  (each is a <button>)
 *   - Invoice amount displayed as: £{totalAmount.toFixed(2)}  e.g. "£200.00"
 *   - Mark Paid button: "Mark Paid"  (shown only for sent/overdue invoices)
 *   - CreateInvoiceModal heading (h2): "New Invoice"
 *   - Modal submit button: "Create Invoice"
 *   - Modal form has no htmlFor-associated labels → use placeholders/type selectors
 */

import { test, expect } from '@playwright/test';
import { API_BASE, createUserAndLogin } from '../helpers/auth.js';

async function createPatient(request, token) {
  const ts  = Date.now();
  const res = await request.post(`${API_BASE}/patients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { fullName: `Billing Patient ${ts}`, dateOfBirth: '1970-04-01', gender: 'male', nhsNumber: `NHS-BL-${ts}` },
  });
  return res.json();
}

async function createInvoice(request, token, patientId, status = 'draft') {
  const res = await request.post(`${API_BASE}/invoices`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      patient:     patientId,
      lineItems:   [{ description: 'E2E Consultation', qty: 1, unitPrice: 200 }],
      totalAmount: 200,
      dueDate:     new Date('2027-01-01').toISOString(),
      status,
    },
  });
  return res.json();
}

// ── Invoice list ──────────────────────────────────────────────────────────────

test.describe('Billing page — invoice list', () => {
  test('loads with heading "Billing" for admin', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/billing');
    await expect(page.getByText('Billing')).toBeVisible({ timeout: 15_000 });
  });

  test('loads with heading "Billing" for receptionist', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'receptionist' });
    await page.goto('/billing');
    await expect(page.getByText('Billing')).toBeVisible({ timeout: 15_000 });
  });

  test('shows patient name for an invoice created via API', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'admin' });
    const patient = await createPatient(request, token);
    await createInvoice(request, token, patient._id, 'sent');

    await page.goto('/billing');
    await expect(page.getByText(patient.fullName)).toBeVisible({ timeout: 15_000 });
  });

  test('shows invoice amount as £200.00', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'admin' });
    const patient = await createPatient(request, token);
    await createInvoice(request, token, patient._id, 'sent');

    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    // BillingPage renders: £{inv.totalAmount?.toFixed(2)} = "£200.00"
    await expect(page.getByText('£200.00')).toBeVisible({ timeout: 15_000 });
  });

  test('shows "overdue" status filter tab', async ({ request, page }) => {
    await createUserAndLogin(request, page, { role: 'admin' });
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    // STATUS_FILTERS = ['all', 'draft', 'sent', 'paid', 'overdue'] — each is a <button>
    await expect(page.getByRole('button', { name: 'overdue' })).toBeVisible({ timeout: 15_000 });
  });
});

// ── Mark invoice as paid ──────────────────────────────────────────────────────

test.describe('Mark invoice as paid', () => {
  test('"Mark Paid" button transitions invoice to paid status', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'admin' });
    const patient = await createPatient(request, token);
    await createInvoice(request, token, patient._id, 'sent'); // only sent/overdue show Mark Paid button

    await page.goto('/billing');
    await page.waitForLoadState('networkidle');

    // "Mark Paid" button is rendered next to each sent/overdue invoice
    await page.getByRole('button', { name: 'Mark Paid' }).first().click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.Toastify')).toContainText(/paid|success/i);
  });
});

// ── Create invoice ────────────────────────────────────────────────────────────

test.describe('Create invoice via modal', () => {
  test('receptionist creates invoice via "+ New Invoice" modal', async ({ request, page }) => {
    const { token } = await createUserAndLogin(request, page, { role: 'receptionist' });
    const patient = await createPatient(request, token);

    await page.goto('/billing');
    await page.waitForLoadState('networkidle');

    // Open create modal
    await page.getByRole('button', { name: /new invoice/i }).click();
    await expect(page.getByText('New Invoice')).toBeVisible({ timeout: 10_000 });

    // Modal form — no htmlFor labels, use placeholders and select by position
    // Patient select (first/only <select> in the modal)
    await page.locator('div.fixed.inset-0').locator('select').selectOption({ value: patient._id.toString() });

    // Description input (placeholder: "Description")
    await page.getByPlaceholder('Description').fill('E2E Procedure Fee');

    // Qty and Price inputs
    await page.getByPlaceholder('Qty').fill('1');
    await page.getByPlaceholder('Price (£)').fill('300');

    // Due date
    await page.locator('div.fixed.inset-0').locator('input[type="date"]').fill('2027-12-31');

    await page.getByRole('button', { name: 'Create Invoice' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.Toastify')).toContainText(/created|success/i);
  });
});
