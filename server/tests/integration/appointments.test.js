/**
 * Integration tests — /api/appointments
 */

vi.mock('../../src/config/db.js', () => ({ default: vi.fn().mockReturnValue(new Promise(() => {})) }));
vi.mock('../../src/scripts/seedCronJobs.js', () => ({ registerCronJobs: vi.fn() }));

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import Appointment from '../../src/models/Appointment.js';
import Patient from '../../src/models/Patient.js';
import { connect, disconnect, clearDB } from './helpers/db.js';
import { createUser } from './helpers/auth.js';

beforeAll(async () => await connect());
afterAll(async () => await disconnect());
beforeEach(async () => await clearDB());

const makePatient = () =>
  Patient.create({ fullName: 'Test Patient', dateOfBirth: '1990-01-01', gender: 'female', nhsNumber: `NHS-${Date.now()}` });

// ── POST /api/appointments ────────────────────────────────────────────────────
describe('POST /api/appointments', () => {
  it('returns 201 and stamps createdBy for receptionist', async () => {
    const { user, token } = await createUser({ role: 'receptionist' });
    const { token: doctorToken, user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: patient._id,
        doctor: doctor._id,
        scheduledAt: new Date('2026-05-01T10:00:00Z'),
        type: 'consultation',
      });

    expect(res.status).toBe(201);
    expect(res.body.createdBy).toBe(user._id.toString());
  });

  it('returns 403 for patient role', async () => {
    const { token } = await createUser({ role: 'patient' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date(), type: 'consultation' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ scheduledAt: new Date() }); // missing patient, doctor, type

    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/appointments').send({});
    expect(res.status).toBe(401);
  });
});

// ── GET /api/appointments ─────────────────────────────────────────────────────
describe('GET /api/appointments', () => {
  it('returns 200 array for any authenticated user', async () => {
    const { token } = await createUser({ role: 'lab_tech' });
    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/appointments');
    expect(res.status).toBe(401);
  });

  it('filters by doctor id', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();

    await Appointment.create({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date(), type: 'consultation' });

    const res = await request(app)
      .get(`/api/appointments?doctor=${doctor._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].doctor._id ?? res.body[0].doctor).toBe(doctor._id.toString());
  });

  it('filters by patient id', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const otherPatient = await makePatient();

    await Appointment.create({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date(), type: 'follow-up' });
    await Appointment.create({ patient: otherPatient._id, doctor: doctor._id, scheduledAt: new Date(), type: 'consultation' });

    const res = await request(app)
      .get(`/api/appointments?patient=${patient._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((a) => (a.patient._id ?? a.patient) === patient._id.toString())).toBe(true);
  });

  it('applies from/to date range filter', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();

    await Appointment.create({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date('2026-04-01T10:00:00Z'), type: 'consultation' });
    await Appointment.create({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date('2026-06-01T10:00:00Z'), type: 'consultation' });

    const res = await request(app)
      .get('/api/appointments?from=2026-04-01&to=2026-04-30')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('filters by status', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();

    await Appointment.create({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date(), type: 'consultation', status: 'confirmed' });
    await Appointment.create({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date(), type: 'consultation', status: 'cancelled' });

    const res = await request(app)
      .get('/api/appointments?status=confirmed')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((a) => a.status === 'confirmed')).toBe(true);
  });
});

// ── GET /api/appointments/:id ─────────────────────────────────────────────────
describe('GET /api/appointments/:id', () => {
  it('returns 200 with appointment for any authenticated user', async () => {
    const { token } = await createUser({ role: 'patient' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const appt = await Appointment.create({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date(), type: 'consultation' });

    const res = await request(app)
      .get(`/api/appointments/${appt._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent appointment', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .get('/api/appointments/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── PUT /api/appointments/:id ─────────────────────────────────────────────────
describe('PUT /api/appointments/:id', () => {
  it('returns 200 with updated appointment for receptionist', async () => {
    const { token } = await createUser({ role: 'receptionist' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const appt = await Appointment.create({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date(), type: 'consultation' });

    const res = await request(app)
      .put(`/api/appointments/${appt._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
  });

  it('returns 403 for lab_tech', async () => {
    const { token } = await createUser({ role: 'lab_tech' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const appt = await Appointment.create({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date(), type: 'consultation' });

    const res = await request(app)
      .put(`/api/appointments/${appt._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/appointments/:id ──────────────────────────────────────────────
describe('DELETE /api/appointments/:id', () => {
  it('returns 200 and removes appointment for admin', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const appt = await Appointment.create({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date(), type: 'consultation' });

    const res = await request(app)
      .delete(`/api/appointments/${appt._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await Appointment.findById(appt._id)).toBeNull();
  });

  it('returns 403 for lab_tech', async () => {
    const { token } = await createUser({ role: 'lab_tech' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const appt = await Appointment.create({ patient: patient._id, doctor: doctor._id, scheduledAt: new Date(), type: 'consultation' });

    const res = await request(app)
      .delete(`/api/appointments/${appt._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
