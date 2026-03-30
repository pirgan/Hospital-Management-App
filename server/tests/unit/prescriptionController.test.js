import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPrescription, getPrescriptions, getPrescription,
  updatePrescription, dispensePrescription,
} from '../../src/controllers/prescriptionController.js';

vi.mock('../../src/models/Prescription.js', () => ({
  default: {
    create:            vi.fn(),
    find:              vi.fn(),
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

import Prescription from '../../src/models/Prescription.js';

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
    limit:    vi.fn().mockReturnThis(),
    lean:     vi.fn().mockReturnThis(),
  };
  m.then  = (res, rej) => Promise.resolve(value).then(res, rej);
  m.catch = (rej) => Promise.resolve(value).catch(rej);
  return m;
};

const mockRx = {
  _id:           'rx1',
  patient:       { _id: 'p1', fullName: 'Jane Doe' },
  doctor:        { _id: 'd1', name: 'Dr. Smith' },
  medications:   [{ name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', duration: '30 days' }],
  status:        'active',
  dispensedBy:   null,
  dispensedAt:   null,
};

const mockDoctor = { _id: 'd1', role: 'doctor' };
const mockNurse  = { _id: 'n1', role: 'nurse' };

// ── createPrescription ────────────────────────────────────────────────────────
describe('createPrescription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates prescription and returns 201', async () => {
    Prescription.create.mockResolvedValue(mockRx);
    const req = { body: { patient: 'p1', medications: [] }, user: mockDoctor };
    const r = res();
    await createPrescription(req, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(r.json).toHaveBeenCalledWith(mockRx);
  });

  it('stamps doctor from req.user._id', async () => {
    Prescription.create.mockResolvedValue(mockRx);
    await createPrescription({ body: { patient: 'p1' }, user: { _id: 'doc99' } }, res());
    expect(Prescription.create).toHaveBeenCalledWith(
      expect.objectContaining({ doctor: 'doc99' })
    );
  });

  it('returns 400 on validation / DB error', async () => {
    Prescription.create.mockRejectedValue(new Error('Validation failed'));
    const r = res();
    await createPrescription({ body: {}, user: mockDoctor }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

// ── getPrescriptions ──────────────────────────────────────────────────────────
describe('getPrescriptions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of prescriptions', async () => {
    Prescription.find.mockReturnValue(q([mockRx]));
    const r = res();
    await getPrescriptions({ query: {} }, r);
    expect(r.json).toHaveBeenCalledWith(expect.arrayContaining([mockRx]));
  });

  it('filters by patient', async () => {
    Prescription.find.mockReturnValue(q([]));
    await getPrescriptions({ query: { patient: 'p1' } }, res());
    expect(Prescription.find).toHaveBeenCalledWith(
      expect.objectContaining({ patient: 'p1' })
    );
  });

  it('filters by status', async () => {
    Prescription.find.mockReturnValue(q([]));
    await getPrescriptions({ query: { status: 'active' } }, res());
    expect(Prescription.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
  });

  it('returns 500 on DB error', async () => {
    Prescription.find.mockReturnValue({ populate: vi.fn().mockRejectedValue(new Error()) });
    const r = res();
    await getPrescriptions({ query: {} }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── getPrescription ───────────────────────────────────────────────────────────
describe('getPrescription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns prescription when found', async () => {
    Prescription.findById.mockReturnValue(q(mockRx));
    const r = res();
    await getPrescription({ params: { id: 'rx1' } }, r);
    expect(r.json).toHaveBeenCalledWith(mockRx);
  });

  it('returns 404 when not found', async () => {
    Prescription.findById.mockReturnValue(q(null));
    const r = res();
    await getPrescription({ params: { id: 'bad' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    Prescription.findById.mockReturnValue({ populate: vi.fn().mockRejectedValue(new Error()) });
    const r = res();
    await getPrescription({ params: { id: 'rx1' } }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── updatePrescription ────────────────────────────────────────────────────────
describe('updatePrescription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns updated prescription', async () => {
    const updated = { ...mockRx, status: 'cancelled' };
    Prescription.findByIdAndUpdate.mockResolvedValue(updated);
    const r = res();
    await updatePrescription({ params: { id: 'rx1' }, body: { status: 'cancelled' } }, r);
    expect(r.json).toHaveBeenCalledWith(updated);
  });

  it('returns 404 when not found', async () => {
    Prescription.findByIdAndUpdate.mockResolvedValue(null);
    const r = res();
    await updatePrescription({ params: { id: 'bad' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});

// ── dispensePrescription ──────────────────────────────────────────────────────
describe('dispensePrescription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks prescription as dispensed with nurse and timestamp', async () => {
    const dispensed = { ...mockRx, status: 'dispensed', dispensedBy: 'n1', dispensedAt: new Date() };
    Prescription.findByIdAndUpdate.mockResolvedValue(dispensed);

    const r = res();
    await dispensePrescription({ params: { id: 'rx1' }, user: mockNurse }, r);

    expect(r.json).toHaveBeenCalledWith(dispensed);
    expect(Prescription.findByIdAndUpdate).toHaveBeenCalledWith(
      'rx1',
      expect.objectContaining({
        status:      'dispensed',
        dispensedBy: mockNurse._id,
        dispensedAt: expect.any(Date),
      }),
      expect.objectContaining({ new: true })
    );
  });

  it('returns 404 when prescription not found', async () => {
    Prescription.findByIdAndUpdate.mockResolvedValue(null);
    const r = res();
    await dispensePrescription({ params: { id: 'bad' }, user: mockNurse }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    Prescription.findByIdAndUpdate.mockRejectedValue(new Error('fail'));
    const r = res();
    await dispensePrescription({ params: { id: 'rx1' }, user: mockNurse }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});
