/**
 * Integration tests — /api/medical-records
 */

vi.mock('../../src/config/db.js', () => ({ default: vi.fn().mockReturnValue(new Promise(() => {})) }));
vi.mock('../../src/scripts/seedCronJobs.js', () => ({ registerCronJobs: vi.fn() }));

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import MedicalRecord from '../../src/models/MedicalRecord.js';
import Patient from '../../src/models/Patient.js';
import { connect, disconnect, clearDB } from './helpers/db.js';
import { createUser } from './helpers/auth.js';

beforeAll(async () => await connect());
afterAll(async () => await disconnect());
beforeEach(async () => await clearDB());

const makePatient = () =>
  Patient.create({ fullName: 'Record Patient', dateOfBirth: '1985-06-20', gender: 'male', nhsNumber: `NHS-MR-${Date.now()}` });

const baseRecord = (patientId, doctorId) => ({
  patient: patientId,
  doctor: doctorId,
  visitDate: new Date('2026-01-15'),
  chiefComplaint: 'Headache',
  vitals: { bloodPressure: '130/85', pulse: 78, temperature: 37.1, o2Saturation: 98 },
});

// ── POST /api/medical-records ─────────────────────────────────────────────────
describe('POST /api/medical-records', () => {
  it('returns 201 and forces doctor field to req.user._id', async () => {
    const { user: doctor, token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/medical-records')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...baseRecord(patient._id, 'FAKE-DOCTOR-ID'), chiefComplaint: 'Back pain' });

    expect(res.status).toBe(201);
    // Controller overrides body.doctor with req.user._id — prevents impersonation
    expect(res.body.doctor.toString()).toBe(doctor._id.toString());
  });

  it('returns 403 for receptionist', async () => {
    const { token } = await createUser({ role: 'receptionist' });
    const { user: doctor } = await createUser({ role: 'doctor' });
    const patient = await makePatient();

    const res = await request(app)
      .post('/api/medical-records')
      .set('Authorization', `Bearer ${token}`)
      .send(baseRecord(patient._id, doctor._id));

    expect(res.status).toBe(403);
  });

  it('returns 403 for nurse', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const res = await request(app)
      .post('/api/medical-records')
      .set('Authorization', `Bearer ${token}`)
      .send({ chiefComplaint: 'test' });

    expect(res.status).toBe(403);
  });
});

// ── GET /api/medical-records ──────────────────────────────────────────────────
describe('GET /api/medical-records', () => {
  it('returns 200 list for doctor', async () => {
    const { user: doctor, token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    await MedicalRecord.create(baseRecord(patient._id, doctor._id));

    const res = await request(app)
      .get('/api/medical-records')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it('returns 200 list for nurse', async () => {
    const { token } = await createUser({ role: 'nurse' });
    const res = await request(app)
      .get('/api/medical-records')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 403 for patient role', async () => {
    const { token } = await createUser({ role: 'patient' });
    const res = await request(app)
      .get('/api/medical-records')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('filters by ?patient= query param', async () => {
    const { user: doctor, token } = await createUser({ role: 'doctor' });
    const patientA = await makePatient();
    const patientB = await makePatient();
    await MedicalRecord.create(baseRecord(patientA._id, doctor._id));
    await MedicalRecord.create(baseRecord(patientB._id, doctor._id));

    const res = await request(app)
      .get(`/api/medical-records?patient=${patientA._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].patient._id ?? res.body[0].patient).toBe(patientA._id.toString());
  });

  it('returns records sorted newest visit first', async () => {
    const { user: doctor, token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    await MedicalRecord.create({ ...baseRecord(patient._id, doctor._id), visitDate: new Date('2024-01-01') });
    await MedicalRecord.create({ ...baseRecord(patient._id, doctor._id), visitDate: new Date('2025-06-01') });

    const res = await request(app)
      .get('/api/medical-records')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(new Date(res.body[0].visitDate) >= new Date(res.body[1].visitDate)).toBe(true);
  });
});

// ── GET /api/medical-records/:id ──────────────────────────────────────────────
describe('GET /api/medical-records/:id', () => {
  it('returns 200 with populated patient and doctor for doctor', async () => {
    const { user: doctor, token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const record = await MedicalRecord.create(baseRecord(patient._id, doctor._id));

    const res = await request(app)
      .get(`/api/medical-records/${record._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.patient).toBeDefined();
    expect(res.body.doctor).toBeDefined();
  });

  it('returns 404 for non-existent record', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const res = await request(app)
      .get('/api/medical-records/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 for patient role', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'patient' });
    const patient = await makePatient();
    const record = await MedicalRecord.create(baseRecord(patient._id, doctor._id));

    const res = await request(app)
      .get(`/api/medical-records/${record._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ── PUT /api/medical-records/:id ──────────────────────────────────────────────
describe('PUT /api/medical-records/:id', () => {
  it('returns 200 updated record for doctor', async () => {
    const { user: doctor, token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const record = await MedicalRecord.create(baseRecord(patient._id, doctor._id));

    const res = await request(app)
      .put(`/api/medical-records/${record._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ treatmentPlan: 'Start NSAIDs' });

    expect(res.status).toBe(200);
    expect(res.body.treatmentPlan).toBe('Start NSAIDs');
  });

  it('can attach AI differential diagnosis', async () => {
    const { user: doctor, token } = await createUser({ role: 'doctor' });
    const patient = await makePatient();
    const record = await MedicalRecord.create(baseRecord(patient._id, doctor._id));
    const aiDx = [{ diagnosis: 'Tension headache', confidence: 85, reasoning: 'Classic presentation' }];

    const res = await request(app)
      .put(`/api/medical-records/${record._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aiDifferentialDiagnosis: aiDx });

    expect(res.status).toBe(200);
    expect(res.body.aiDifferentialDiagnosis).toBeDefined();
  });

  it('returns 403 for receptionist', async () => {
    const { user: doctor } = await createUser({ role: 'doctor' });
    const { token } = await createUser({ role: 'receptionist' });
    const patient = await makePatient();
    const record = await MedicalRecord.create(baseRecord(patient._id, doctor._id));

    const res = await request(app)
      .put(`/api/medical-records/${record._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ treatmentPlan: 'Unauthorized' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent record', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const res = await request(app)
      .put('/api/medical-records/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ treatmentPlan: 'N/A' });

    expect(res.status).toBe(404);
  });
});
