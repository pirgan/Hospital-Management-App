import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createRecord, getRecords, getRecord, updateRecord,
} from '../../src/controllers/medicalRecordController.js';

vi.mock('../../src/models/MedicalRecord.js', () => ({
  default: {
    create:            vi.fn(),
    find:              vi.fn(),
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

import MedicalRecord from '../../src/models/MedicalRecord.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const res = () => {
  const r = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json   = vi.fn().mockReturnValue(r);
  return r;
};

const q = (value) => {
  const m = {
    populate: vi.fn().mockReturnThis(),
    sort:     vi.fn().mockReturnThis(),
    lean:     vi.fn().mockReturnThis(),
  };
  m.then  = (res, rej) => Promise.resolve(value).then(res, rej);
  m.catch = (rej) => Promise.resolve(value).catch(rej);
  return m;
};

const mockRecord = {
  _id:            'mr1',
  patient:        { _id: 'p1', fullName: 'Jane Doe', nhsNumber: 'NHS-001' },
  doctor:         { _id: 'd1', name: 'Dr. Smith', department: 'Cardiology' },
  visitDate:      new Date('2025-03-01'),
  chiefComplaint: 'Chest pain',
  vitals:         { height: 170, weight: 75, bloodPressure: '120/80', pulse: 72, temperature: 36.6, o2Saturation: 98 },
  diagnoses:      [{ icd10Code: 'I10', description: 'Hypertension', type: 'primary' }],
  treatmentPlan:  'Start antihypertensive therapy.',
  aiRiskScore:    45,
};

const mockDoctor = { _id: 'd1', role: 'doctor' };

// ── createRecord ──────────────────────────────────────────────────────────────
describe('createRecord', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates record and returns 201', async () => {
    MedicalRecord.create.mockResolvedValue(mockRecord);
    const req = { body: { patient: 'p1', chiefComplaint: 'Chest pain' }, user: mockDoctor };
    const r = res();
    await createRecord(req, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(r.json).toHaveBeenCalledWith(mockRecord);
  });

  it('stamps doctor from req.user._id — prevents impersonation', async () => {
    MedicalRecord.create.mockResolvedValue(mockRecord);
    const req = {
      body: { patient: 'p1', doctor: 'EVIL-ID', chiefComplaint: 'X' },
      user: { _id: 'truedoc' },
    };
    await createRecord(req, res());
    const createArg = MedicalRecord.create.mock.calls[0][0];
    expect(createArg.doctor).toBe('truedoc');
  });

  it('returns 400 on DB error', async () => {
    MedicalRecord.create.mockRejectedValue(new Error('fail'));
    const r = res();
    await createRecord({ body: {}, user: mockDoctor }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

// ── getRecords ────────────────────────────────────────────────────────────────
describe('getRecords', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of records', async () => {
    MedicalRecord.find.mockReturnValue(q([mockRecord]));
    const r = res();
    await getRecords({ query: {} }, r);
    expect(r.json).toHaveBeenCalledWith(expect.arrayContaining([mockRecord]));
  });

  it('filters by patient when ?patient= provided', async () => {
    MedicalRecord.find.mockReturnValue(q([]));
    await getRecords({ query: { patient: 'p1' } }, res());
    expect(MedicalRecord.find).toHaveBeenCalledWith(expect.objectContaining({ patient: 'p1' }));
  });

  it('returns all records when no patient filter', async () => {
    MedicalRecord.find.mockReturnValue(q([mockRecord]));
    await getRecords({ query: {} }, res());
    expect(MedicalRecord.find).toHaveBeenCalledWith({});
  });

  it('sorts by visitDate descending', async () => {
    const mockQ = q([mockRecord]);
    MedicalRecord.find.mockReturnValue(mockQ);
    await getRecords({ query: {} }, res());
    expect(mockQ.sort).toHaveBeenCalledWith({ visitDate: -1 });
  });

  it('returns 500 on DB error', async () => {
    MedicalRecord.find.mockReturnValue({ populate: vi.fn().mockRejectedValue(new Error()) });
    const r = res();
    await getRecords({ query: {} }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── getRecord ─────────────────────────────────────────────────────────────────
describe('getRecord', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns record when found', async () => {
    MedicalRecord.findById.mockReturnValue(q(mockRecord));
    const r = res();
    await getRecord({ params: { id: 'mr1' } }, r);
    expect(r.json).toHaveBeenCalledWith(mockRecord);
  });

  it('populates patient and doctor fields', async () => {
    const mockQ = q(mockRecord);
    MedicalRecord.findById.mockReturnValue(mockQ);
    await getRecord({ params: { id: 'mr1' } }, res());
    expect(mockQ.populate).toHaveBeenCalledTimes(2);
  });

  it('returns 404 when not found', async () => {
    MedicalRecord.findById.mockReturnValue(q(null));
    const r = res();
    await getRecord({ params: { id: 'bad' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    MedicalRecord.findById.mockReturnValue({ populate: vi.fn().mockRejectedValue(new Error()) });
    const r = res();
    await getRecord({ params: { id: 'mr1' } }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── updateRecord ──────────────────────────────────────────────────────────────
describe('updateRecord', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns updated record', async () => {
    const updated = { ...mockRecord, aiRiskScore: 80 };
    MedicalRecord.findByIdAndUpdate.mockResolvedValue(updated);
    const r = res();
    await updateRecord({ params: { id: 'mr1' }, body: { aiRiskScore: 80 } }, r);
    expect(r.json).toHaveBeenCalledWith(updated);
  });

  it('returns 404 when not found', async () => {
    MedicalRecord.findByIdAndUpdate.mockResolvedValue(null);
    const r = res();
    await updateRecord({ params: { id: 'bad' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('can attach AI differential diagnosis', async () => {
    const aiDx = [{ diagnosis: 'NSTEMI', confidence: 80, reasoning: 'Troponin elevated' }];
    const updated = { ...mockRecord, aiDifferentialDiagnosis: aiDx };
    MedicalRecord.findByIdAndUpdate.mockResolvedValue(updated);

    const r = res();
    await updateRecord({ params: { id: 'mr1' }, body: { aiDifferentialDiagnosis: aiDx } }, r);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ aiDifferentialDiagnosis: aiDx }));
  });

  it('returns 400 on DB error', async () => {
    MedicalRecord.findByIdAndUpdate.mockRejectedValue(new Error('fail'));
    const r = res();
    await updateRecord({ params: { id: 'mr1' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});
