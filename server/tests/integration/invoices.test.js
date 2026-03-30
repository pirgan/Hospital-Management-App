/**
 * Integration tests — /api/invoices
 */

vi.mock('../../src/config/db.js', () => ({ default: vi.fn().mockReturnValue(new Promise(() => {})) }));
vi.mock('../../src/scripts/seedCronJobs.js', () => ({ registerCronJobs: vi.fn() }));

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import Invoice from '../../src/models/Invoice.js';
import Patient from '../../src/models/Patient.js';
import { connect, disconnect, clearDB } from './helpers/db.js';
import { createUser } from './helpers/auth.js';

beforeAll(async () => await connect());
afterAll(async () => await disconnect());
beforeEach(async () => await clearDB());

const makePatient = () =>
  Patient.create({ fullName: 'Invoice Patient', dateOfBirth: '1988-11-20', gender: 'male', nhsNumber: `NHS-INV-${Date.now()}` });

const validInvoice = (patientId) => ({
  patient: patientId,
  lineItems: [{ description: 'Consultation Fee', qty: 1, unitPrice: 150 }],
  totalAmount: 150,
  dueDate: new Date('2026-12-31'),
});

// ── GET /api/invoices ─────────────────────────────────────────────────────────
describe('GET /api/invoices', () => {
  it('returns 200 list for admin', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 200 list for receptionist', async () => {
    const { token } = await createUser({ role: 'receptionist' });
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 403 for doctor', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for patient role', async () => {
    const { token } = await createUser({ role: 'patient' });
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(401);
  });

  it('filters by ?patient= query param', async () => {
    const { token } = await createUser({ role: 'admin' });
    const patientA = await makePatient();
    const patientB = await makePatient();
    await Invoice.create(validInvoice(patientA._id));
    await Invoice.create(validInvoice(patientB._id));

    const res = await request(app)
      .get(`/api/invoices?patient=${patientA._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('filters by ?status= query param', async () => {
    const { token } = await createUser({ role: 'admin' });
    const patient = await makePatient();
    await Invoice.create({ ...validInvoice(patient._id), status: 'paid' });
    await Invoice.create({ ...validInvoice(patient._id), status: 'overdue' });

    const res = await request(app)
      .get('/api/invoices?status=paid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((i) => i.status === 'paid')).toBe(true);
  });
});

// ── POST /api/invoices ────────────────────────────────────────────────────────
describe('POST /api/invoices', () => {
  it('returns 201 by receptionist', async () => {
    const { token } = await createUser({ role: 'receptionist' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(validInvoice(patient._id));

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(150);
  });

  it('returns 201 by admin', async () => {
    const { token } = await createUser({ role: 'admin' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(validInvoice(patient._id));

    expect(res.status).toBe(201);
  });

  it('returns 403 for doctor', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(validInvoice(patient._id));

    expect(res.status).toBe(403);
  });
});

// ── GET /api/invoices/:id ─────────────────────────────────────────────────────
describe('GET /api/invoices/:id', () => {
  it('returns 200 for admin', async () => {
    const { token } = await createUser({ role: 'admin' });
    const patient = await makePatient();
    const invoice = await Invoice.create(validInvoice(patient._id));

    const res = await request(app)
      .get(`/api/invoices/${invoice._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalAmount).toBe(150);
  });

  it('returns 200 for patient role', async () => {
    const { token } = await createUser({ role: 'patient' });
    const patient = await makePatient();
    const invoice = await Invoice.create(validInvoice(patient._id));

    const res = await request(app)
      .get(`/api/invoices/${invoice._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent invoice', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .get('/api/invoices/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── PUT /api/invoices/:id ─────────────────────────────────────────────────────
describe('PUT /api/invoices/:id', () => {
  it('returns 200 updated invoice for admin', async () => {
    const { token } = await createUser({ role: 'admin' });
    const patient = await makePatient();
    const invoice = await Invoice.create(validInvoice(patient._id));

    const res = await request(app)
      .put(`/api/invoices/${invoice._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'sent' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('sent');
  });

  it('returns 403 for doctor', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const invoice = await Invoice.create(validInvoice(patient._id));

    const res = await request(app)
      .put(`/api/invoices/${invoice._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'paid' });

    expect(res.status).toBe(403);
  });
});

// ── PATCH /api/invoices/:id/pay ───────────────────────────────────────────────
describe('PATCH /api/invoices/:id/pay', () => {
  it('returns 200 and sets status=paid with paidAt timestamp for admin', async () => {
    const { token } = await createUser({ role: 'admin' });
    const patient = await makePatient();
    const invoice = await Invoice.create({ ...validInvoice(patient._id), status: 'sent' });

    const res = await request(app)
      .patch(`/api/invoices/${invoice._id}/pay`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
    expect(res.body.paidAt).toBeDefined();
  });

  it('returns 200 for receptionist', async () => {
    const { token } = await createUser({ role: 'receptionist' });
    const patient = await makePatient();
    const invoice = await Invoice.create({ ...validInvoice(patient._id), status: 'sent' });

    const res = await request(app)
      .patch(`/api/invoices/${invoice._id}/pay`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
  });

  it('returns 403 for patient role', async () => {
    const { token } = await createUser({ role: 'patient' });
    const patient = await makePatient();
    const invoice = await Invoice.create({ ...validInvoice(patient._id), status: 'sent' });

    const res = await request(app)
      .patch(`/api/invoices/${invoice._id}/pay`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent invoice', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .patch('/api/invoices/000000000000000000000000/pay')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
