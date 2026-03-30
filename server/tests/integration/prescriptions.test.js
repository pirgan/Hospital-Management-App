/**
 * Integration tests — /api/prescriptions
 */

vi.mock('../../src/config/db.js', () => ({ default: vi.fn().mockReturnValue(new Promise(() => {})) }));
vi.mock('../../src/scripts/seedCronJobs.js', () => ({ registerCronJobs: vi.fn() }));

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import Prescription from '../../src/models/Prescription.js';
import Patient from '../../src/models/Patient.js';
import { connect, disconnect, clearDB } from './helpers/db.js';
import { createUser } from './helpers/auth.js';

beforeAll(async () => await connect());
afterAll(async () => await disconnect());
beforeEach(async () => await clearDB());

const makePatient = () =>
  Patient.create({ fullName: 'Rx Patient', dateOfBirth: '1970-03-10', gender: 'female', nhsNumber: `NHS-RX-${Date.now()}` });

const medications = [{ name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', duration: '30 days' }];

// ── POST /api/prescriptions ───────────────────────────────────────────────────
describe('POST /api/prescriptions', () => {
  it('returns 201 and stamps doctor from req.user for doctor', async () => {
    const { user: doctor, token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({ patient: patient._id, medications });

    expect(res.status).toBe(201);
    expect(res.body.doctor.toString()).toBe(doctor._id.toString());
  });

  it('returns 403 for nurse', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({ patient: patient._id, medications });

    expect(res.status).toBe(403);
  });

  it('returns 403 for receptionist', async () => {
    const { token } = await createUser({ role: 'receptionist' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({ patient: patient._id, medications });

    expect(res.status).toBe(403);
  });
});

// ── GET /api/prescriptions ────────────────────────────────────────────────────
describe('GET /api/prescriptions', () => {
  it('returns 200 list for any authenticated user', async () => {
    const { token } = await createUser({ role: 'lab_tech' });
    const res = await request(app)
      .get('/api/prescriptions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/prescriptions');
    expect(res.status).toBe(401);
  });

  it('filters by ?patient= query param', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'admin' });
    const patientA = await makePatient();
    const patientB = await makePatient();
    await Prescription.create({ patient: patientA._id, doctor: doctor._id, medications });
    await Prescription.create({ patient: patientB._id, doctor: doctor._id, medications });

    const res = await request(app)
      .get(`/api/prescriptions?patient=${patientA._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('filters by ?status= query param', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'admin' });
    const patient = await makePatient();
    await Prescription.create({ patient: patient._id, doctor: doctor._id, medications, status: 'active' });
    await Prescription.create({ patient: patient._id, doctor: doctor._id, medications, status: 'cancelled' });

    const res = await request(app)
      .get('/api/prescriptions?status=active')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((p) => p.status === 'active')).toBe(true);
  });
});

// ── GET /api/prescriptions/:id ────────────────────────────────────────────────
describe('GET /api/prescriptions/:id', () => {
  it('returns 200 with prescription for any authenticated user', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'patient' });
    const patient = await makePatient();
    const rx = await Prescription.create({ patient: patient._id, doctor: doctor._id, medications });

    const res = await request(app)
      .get(`/api/prescriptions/${rx._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent prescription', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .get('/api/prescriptions/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── PUT /api/prescriptions/:id ────────────────────────────────────────────────
describe('PUT /api/prescriptions/:id', () => {
  it('returns 200 updated prescription for doctor', async () => {
    const { user: doctor, token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const rx = await Prescription.create({ patient: patient._id, doctor: doctor._id, medications });

    const res = await request(app)
      .put(`/api/prescriptions/${rx._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('returns 403 for nurse', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'nurse' });
    const patient = await makePatient();
    const rx = await Prescription.create({ patient: patient._id, doctor: doctor._id, medications });

    const res = await request(app)
      .put(`/api/prescriptions/${rx._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(403);
  });
});

// ── PATCH /api/prescriptions/:id/dispense ─────────────────────────────────────
describe('PATCH /api/prescriptions/:id/dispense', () => {
  it('returns 200 and stamps dispensedBy and dispensedAt for nurse', async () => {
    const { user: nurse, token } = await createUser({ role: 'nurse' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const rx = await Prescription.create({ patient: patient._id, doctor: doctor._id, medications });

    const res = await request(app)
      .patch(`/api/prescriptions/${rx._id}/dispense`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('dispensed');
    expect(res.body.dispensedBy.toString()).toBe(nurse._id.toString());
    expect(res.body.dispensedAt).toBeDefined();
  });

  it('returns 200 and stamps dispensedBy for admin', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const rx = await Prescription.create({ patient: patient._id, doctor: doctor._id, medications });

    const res = await request(app)
      .patch(`/api/prescriptions/${rx._id}/dispense`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('dispensed');
  });

  it('returns 403 for lab_tech', async () => {
    const { token } = await createUser({ role: 'lab_tech' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const rx = await Prescription.create({ patient: patient._id, doctor: doctor._id, medications });

    const res = await request(app)
      .patch(`/api/prescriptions/${rx._id}/dispense`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent prescription', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const res = await request(app)
      .patch('/api/prescriptions/000000000000000000000000/dispense')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
