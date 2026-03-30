/**
 * Integration tests — /api/wards
 */

vi.mock('../../src/config/db.js', () => ({ default: vi.fn().mockReturnValue(new Promise(() => {})) }));
vi.mock('../../src/scripts/seedCronJobs.js', () => ({ registerCronJobs: vi.fn() }));

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import Ward from '../../src/models/Ward.js';
import Patient from '../../src/models/Patient.js';
import { connect, disconnect, clearDB } from './helpers/db.js';
import { createUser } from './helpers/auth.js';

beforeAll(async () => await connect());
afterAll(async () => await disconnect());
beforeEach(async () => await clearDB());

const makePatient = () =>
  Patient.create({ fullName: 'Ward Patient', dateOfBirth: '1972-04-01', gender: 'female', nhsNumber: `NHS-WD-${Date.now()}` });

const makeWard = (overrides = {}) =>
  Ward.create({
    name: 'General Ward A',
    type: 'general',
    floor: 2,
    capacity: 3,
    beds: [
      { number: 'G-01', status: 'available', patient: null },
      { number: 'G-02', status: 'available', patient: null },
      { number: 'G-03', status: 'available', patient: null },
    ],
    ...overrides,
  });

// ── GET /api/wards ────────────────────────────────────────────────────────────
describe('GET /api/wards', () => {
  it('returns 200 list for any authenticated user', async () => {
    const { token } = await createUser({ role: 'patient' });
    await makeWard();

    const res = await request(app)
      .get('/api/wards')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/wards');
    expect(res.status).toBe(401);
  });

  it('filters by ?type= query param', async () => {
    const { token } = await createUser({ role: 'nurse' });
    await makeWard({ name: 'ICU Ward', type: 'ICU' });
    await makeWard({ name: 'Paeds Ward', type: 'pediatric' });

    const res = await request(app)
      .get('/api/wards?type=ICU')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].type).toBe('ICU');
  });
});

// ── POST /api/wards ───────────────────────────────────────────────────────────
describe('POST /api/wards', () => {
  it('returns 201 for admin', async () => {
    const { token } = await createUser({ role: 'admin' });

    const res = await request(app)
      .post('/api/wards')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Surgical Ward B',
        type: 'surgical',
        floor: 3,
        capacity: 2,
        beds: [
          { number: 'S-01', status: 'available' },
          { number: 'S-02', status: 'available' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Surgical Ward B');
    expect(res.body.beds.length).toBe(2);
  });

  it('returns 403 for nurse', async () => {
    const { token } = await createUser({ role: 'nurse' });

    const res = await request(app)
      .post('/api/wards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Unauthorized Ward', type: 'general', capacity: 1, beds: [] });

    expect(res.status).toBe(403);
  });

  it('returns 403 for doctor', async () => {
    const { token } = await createUser({ role: 'doctor' });

    const res = await request(app)
      .post('/api/wards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Unauthorized Ward', type: 'general', capacity: 1, beds: [] });

    expect(res.status).toBe(403);
  });
});

// ── GET /api/wards/:id ────────────────────────────────────────────────────────
describe('GET /api/wards/:id', () => {
  it('returns 200 with ward for any authenticated user', async () => {
    const { token } = await createUser({ role: 'lab_tech' });
    const ward = await makeWard();

    const res = await request(app)
      .get(`/api/wards/${ward._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('General Ward A');
  });

  it('returns 404 for non-existent ward', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .get('/api/wards/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── POST /api/wards/admit ─────────────────────────────────────────────────────
describe('POST /api/wards/admit', () => {
  it('returns 200 and marks bed as occupied for nurse', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const ward = await makeWard();
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/wards/admit')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardId: ward._id, bedNumber: 'G-01', patientId: patient._id });

    expect(res.status).toBe(200);
    const bed = res.body.beds.find((b) => b.number === 'G-01');
    expect(bed.status).toBe('occupied');
    expect(bed.patient.toString()).toBe(patient._id.toString());
    expect(bed.admittedAt).toBeDefined();
  });

  it('returns 200 for doctor', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const ward = await makeWard();
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/wards/admit')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardId: ward._id, bedNumber: 'G-01', patientId: patient._id });

    expect(res.status).toBe(200);
  });

  it('returns 409 when bed is already occupied', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const patient = await makePatient();
    const ward = await makeWard({
      beds: [{ number: 'G-01', status: 'occupied', patient: patient._id, admittedAt: new Date() }],
    });
    const newPatient = await makePatient();

    const res = await request(app)
      .post('/api/wards/admit')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardId: ward._id, bedNumber: 'G-01', patientId: newPatient._id });

    expect(res.status).toBe(409);
  });

  it('returns 404 when ward does not exist', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/wards/admit')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardId: '000000000000000000000000', bedNumber: 'G-01', patientId: patient._id });

    expect(res.status).toBe(404);
  });

  it('returns 404 when bed number does not exist', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const ward = await makeWard();
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/wards/admit')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardId: ward._id, bedNumber: 'Z-99', patientId: patient._id });

    expect(res.status).toBe(404);
  });

  it('returns 403 for receptionist', async () => {
    const { token } = await createUser({ role: 'receptionist' });
    const ward = await makeWard();
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/wards/admit')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardId: ward._id, bedNumber: 'G-01', patientId: patient._id });

    expect(res.status).toBe(403);
  });
});

// ── POST /api/wards/discharge ─────────────────────────────────────────────────
describe('POST /api/wards/discharge', () => {
  it('returns 200 and resets bed to available for nurse', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const patient = await makePatient();
    const ward = await makeWard({
      beds: [
        { number: 'G-01', status: 'occupied', patient: patient._id, admittedAt: new Date() },
        { number: 'G-02', status: 'available', patient: null },
      ],
    });

    const res = await request(app)
      .post('/api/wards/discharge')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardId: ward._id, bedNumber: 'G-01' });

    expect(res.status).toBe(200);
    const bed = res.body.beds.find((b) => b.number === 'G-01');
    expect(bed.status).toBe('available');
    expect(bed.patient).toBeNull();
    expect(bed.admittedAt).toBeNull();
  });

  it('can discharge by patientId when bedNumber is not provided', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const ward = await makeWard({
      beds: [{ number: 'G-01', status: 'occupied', patient: patient._id, admittedAt: new Date() }],
    });

    const res = await request(app)
      .post('/api/wards/discharge')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardId: ward._id, patientId: patient._id });

    expect(res.status).toBe(200);
    const bed = res.body.beds.find((b) => b.number === 'G-01');
    expect(bed.status).toBe('available');
  });

  it('returns 404 when bed number does not match', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const ward = await makeWard();

    const res = await request(app)
      .post('/api/wards/discharge')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardId: ward._id, bedNumber: 'Z-99' });

    expect(res.status).toBe(404);
  });

  it('returns 403 for receptionist', async () => {
    const { token } = await createUser({ role: 'receptionist' });
    const ward = await makeWard();

    const res = await request(app)
      .post('/api/wards/discharge')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardId: ward._id, bedNumber: 'G-01' });

    expect(res.status).toBe(403);
  });
});
