/**
 * Integration tests — /api/lab-orders
 */

vi.mock('../../src/config/db.js', () => ({ default: vi.fn().mockReturnValue(new Promise(() => {})) }));
vi.mock('../../src/scripts/seedCronJobs.js', () => ({ registerCronJobs: vi.fn() }));

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import LabOrder from '../../src/models/LabOrder.js';
import Patient from '../../src/models/Patient.js';
import { connect, disconnect, clearDB } from './helpers/db.js';
import { createUser } from './helpers/auth.js';

beforeAll(async () => await connect());
afterAll(async () => await disconnect());
beforeEach(async () => await clearDB());

const makePatient = () =>
  Patient.create({ fullName: 'Lab Patient', dateOfBirth: '1995-07-04', gender: 'male', nhsNumber: `NHS-LO-${Date.now()}` });

const sampleResults = [
  { testName: 'WBC', value: '12.5', unit: '10³/µL', referenceRange: '4.5-11.0', flagged: true },
  { testName: 'Haemoglobin', value: '14.0', unit: 'g/dL', referenceRange: '13.5-17.5', flagged: false },
];

// ── POST /api/lab-orders ──────────────────────────────────────────────────────
describe('POST /api/lab-orders', () => {
  it('returns 201 and stamps doctor from req.user for doctor', async () => {
    const { user: doctor, token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/lab-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ patient: patient._id, tests: ['CBC', 'Lipid Panel'], priority: 'routine' });

    expect(res.status).toBe(201);
    expect(res.body.doctor.toString()).toBe(doctor._id.toString());
    expect(res.body.tests).toEqual(['CBC', 'Lipid Panel']);
  });

  it('returns 403 for receptionist', async () => {
    const { token } = await createUser({ role: 'receptionist' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/lab-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ patient: patient._id, tests: ['CBC'] });

    expect(res.status).toBe(403);
  });

  it('returns 403 for nurse', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/lab-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ patient: patient._id, tests: ['CBC'] });

    expect(res.status).toBe(403);
  });
});

// ── GET /api/lab-orders ───────────────────────────────────────────────────────
describe('GET /api/lab-orders', () => {
  it('returns 200 list for any authenticated user', async () => {
    const { token } = await createUser({ role: 'patient' });
    const res = await request(app)
      .get('/api/lab-orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/lab-orders');
    expect(res.status).toBe(401);
  });

  it('filters by ?patient= query param', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'admin' });
    const patientA = await makePatient();
    const patientB = await makePatient();
    await LabOrder.create({ patient: patientA._id, doctor: doctor._id, tests: ['CBC'] });
    await LabOrder.create({ patient: patientB._id, doctor: doctor._id, tests: ['BMP'] });

    const res = await request(app)
      .get(`/api/lab-orders?patient=${patientA._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('filters by ?status= query param', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'admin' });
    const patient = await makePatient();
    await LabOrder.create({ patient: patient._id, doctor: doctor._id, tests: ['CBC'], status: 'ordered' });
    await LabOrder.create({ patient: patient._id, doctor: doctor._id, tests: ['BMP'], status: 'completed' });

    const res = await request(app)
      .get('/api/lab-orders?status=ordered')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((o) => o.status === 'ordered')).toBe(true);
  });

  it('filters by ?priority= query param', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'lab_tech' });
    const patient = await makePatient();
    await LabOrder.create({ patient: patient._id, doctor: doctor._id, tests: ['CBC'], priority: 'stat' });
    await LabOrder.create({ patient: patient._id, doctor: doctor._id, tests: ['BMP'], priority: 'routine' });

    const res = await request(app)
      .get('/api/lab-orders?priority=stat')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((o) => o.priority === 'stat')).toBe(true);
  });
});

// ── GET /api/lab-orders/:id ───────────────────────────────────────────────────
describe('GET /api/lab-orders/:id', () => {
  it('returns 200 for any authenticated user', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'patient' });
    const patient = await makePatient();
    const order = await LabOrder.create({ patient: patient._id, doctor: doctor._id, tests: ['CBC'] });

    const res = await request(app)
      .get(`/api/lab-orders/${order._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent order', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .get('/api/lab-orders/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── PUT /api/lab-orders/:id ───────────────────────────────────────────────────
describe('PUT /api/lab-orders/:id', () => {
  it('returns 200 updated order for lab_tech', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'lab_tech' });
    const patient = await makePatient();
    const order = await LabOrder.create({ patient: patient._id, doctor: doctor._id, tests: ['CBC'] });

    const res = await request(app)
      .put(`/api/lab-orders/${order._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in-progress' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in-progress');
  });

  it('returns 403 for nurse', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'nurse' });
    const patient = await makePatient();
    const order = await LabOrder.create({ patient: patient._id, doctor: doctor._id, tests: ['CBC'] });

    const res = await request(app)
      .put(`/api/lab-orders/${order._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in-progress' });

    expect(res.status).toBe(403);
  });
});

// ── PATCH /api/lab-orders/:id/results ────────────────────────────────────────
describe('PATCH /api/lab-orders/:id/results', () => {
  it('returns 200 and stamps processedBy and status=completed for lab_tech', async () => {
    const { user: labTech, token } = await createUser({ role: 'lab_tech' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const order = await LabOrder.create({ patient: patient._id, doctor: doctor._id, tests: ['CBC'] });

    const res = await request(app)
      .patch(`/api/lab-orders/${order._id}/results`)
      .set('Authorization', `Bearer ${token}`)
      .send({ results: sampleResults });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.processedBy.toString()).toBe(labTech._id.toString());
    expect(res.body.results.length).toBe(2);
  });

  it('stores flagged results correctly', async () => {
    const { token } = await createUser({ role: 'lab_tech' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const order = await LabOrder.create({ patient: patient._id, doctor: doctor._id, tests: ['CBC'] });

    const res = await request(app)
      .patch(`/api/lab-orders/${order._id}/results`)
      .set('Authorization', `Bearer ${token}`)
      .send({ results: sampleResults });

    expect(res.status).toBe(200);
    expect(res.body.results.some((r) => r.flagged)).toBe(true);
  });

  it('returns 403 for nurse', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const order = await LabOrder.create({ patient: patient._id, doctor: doctor._id, tests: ['CBC'] });

    const res = await request(app)
      .patch(`/api/lab-orders/${order._id}/results`)
      .set('Authorization', `Bearer ${token}`)
      .send({ results: sampleResults });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent order', async () => {
    const { token } = await createUser({ role: 'lab_tech' });
    const res = await request(app)
      .patch('/api/lab-orders/000000000000000000000000/results')
      .set('Authorization', `Bearer ${token}`)
      .send({ results: [] });

    expect(res.status).toBe(404);
  });
});
