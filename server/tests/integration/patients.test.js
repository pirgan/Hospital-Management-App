/**
 * Integration tests — /api/patients
 */

vi.mock('../../src/config/db.js', () => ({ default: vi.fn().mockReturnValue(new Promise(() => {})) }));
vi.mock('../../src/scripts/seedCronJobs.js', () => ({ registerCronJobs: vi.fn() }));

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import Patient from '../../src/models/Patient.js';
import { connect, disconnect, clearDB } from './helpers/db.js';
import { createUser } from './helpers/auth.js';

beforeAll(async () => await connect());
afterAll(async () => await disconnect());
beforeEach(async () => await clearDB());

const validPatient = {
  fullName: 'Jane Doe',
  dateOfBirth: '1990-05-15',
  gender: 'female',
  nhsNumber: 'NHS-TEST-001',
};

// ── GET /api/patients ─────────────────────────────────────────────────────────
describe('GET /api/patients', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });

  it('returns 200 with paginated result for any authenticated user', async () => {
    const { token } = await createUser({ role: 'nurse' });
    await Patient.create({ ...validPatient, registeredBy: undefined });

    const res = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('patients');
    expect(Array.isArray(res.body.patients)).toBe(true);
  });

  it('filters by search term', async () => {
    const { token } = await createUser({ role: 'receptionist' });
    await Patient.create({ ...validPatient });
    await Patient.create({ fullName: 'John Smith', dateOfBirth: '1985-01-01', gender: 'male', nhsNumber: 'NHS-TEST-002' });

    const res = await request(app)
      .get('/api/patients?search=Jane')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.patients.every((p) => p.fullName.includes('Jane'))).toBe(true);
  });

  it('respects page and limit query params', async () => {
    const { token } = await createUser({ role: 'admin' });
    for (let i = 1; i <= 5; i++) {
      await Patient.create({ fullName: `Patient ${i}`, dateOfBirth: '1990-01-01', gender: 'male', nhsNumber: `NHS-P-00${i}` });
    }

    const res = await request(app)
      .get('/api/patients?page=2&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.patients.length).toBeLessThanOrEqual(2);
    expect(res.body.page).toBe(2);
  });
});

// ── POST /api/patients ────────────────────────────────────────────────────────
describe('POST /api/patients', () => {
  it('returns 201 by receptionist and stamps registeredBy', async () => {
    const { user, token } = await createUser({ role: 'receptionist' });

    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validPatient);

    expect(res.status).toBe(201);
    expect(res.body.fullName).toBe('Jane Doe');
    expect(res.body.registeredBy).toBe(user._id.toString());
  });

  it('returns 201 by doctor', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPatient, nhsNumber: 'NHS-TEST-DR1' });

    expect(res.status).toBe(201);
  });

  it('returns 403 for patient role', async () => {
    const { token } = await createUser({ role: 'patient' });
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validPatient);

    expect(res.status).toBe(403);
  });

  it('returns 403 for lab_tech role', async () => {
    const { token } = await createUser({ role: 'lab_tech' });
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validPatient);

    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Missing Fields' }); // missing dateOfBirth, gender, nhsNumber

    expect(res.status).toBe(400);
  });
});

// ── GET /api/patients/:id ─────────────────────────────────────────────────────
describe('GET /api/patients/:id', () => {
  it('returns 200 with patient for any authenticated user', async () => {
    const { token } = await createUser({ role: 'lab_tech' });
    const patient = await Patient.create(validPatient);

    const res = await request(app)
      .get(`/api/patients/${patient._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nhsNumber).toBe('NHS-TEST-001');
  });

  it('returns 404 for a non-existent patient', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .get('/api/patients/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── PUT /api/patients/:id ─────────────────────────────────────────────────────
describe('PUT /api/patients/:id', () => {
  it('returns 200 updated patient for doctor', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const patient = await Patient.create(validPatient);

    const res = await request(app)
      .put(`/api/patients/${patient._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Jane Updated' });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Jane Updated');
  });

  it('returns 403 for lab_tech', async () => {
    const { token } = await createUser({ role: 'lab_tech' });
    const patient = await Patient.create(validPatient);

    const res = await request(app)
      .put(`/api/patients/${patient._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent patient', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .put('/api/patients/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/patients/:id ──────────────────────────────────────────────────
describe('DELETE /api/patients/:id', () => {
  it('returns 200 and deletes for admin', async () => {
    const { token } = await createUser({ role: 'admin' });
    const patient = await Patient.create(validPatient);

    const res = await request(app)
      .delete(`/api/patients/${patient._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(await Patient.findById(patient._id)).toBeNull();
  });

  it('returns 403 for nurse', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const patient = await Patient.create(validPatient);

    const res = await request(app)
      .delete(`/api/patients/${patient._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent patient', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .delete('/api/patients/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
