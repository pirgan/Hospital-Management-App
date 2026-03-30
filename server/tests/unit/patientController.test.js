import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPatient, getPatients, getPatient, updatePatient, deletePatient,
} from '../../src/controllers/patientController.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../../src/models/Patient.js', () => ({
  default: {
    create:            vi.fn(),
    find:              vi.fn(),
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    countDocuments:    vi.fn(),
  },
}));

import Patient from '../../src/models/Patient.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const res = () => {
  const r = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json   = vi.fn().mockReturnValue(r);
  return r;
};

/** Returns a thenable that chains populate/sort/skip/limit/lean */
const q = (value) => {
  const mock = {
    populate: vi.fn().mockReturnThis(),
    sort:     vi.fn().mockReturnThis(),
    skip:     vi.fn().mockReturnThis(),
    limit:    vi.fn().mockReturnThis(),
    lean:     vi.fn().mockReturnThis(),
    select:   vi.fn().mockReturnThis(),
  };
  mock.then = (res, rej) => Promise.resolve(value).then(res, rej);
  mock.catch = (rej) => Promise.resolve(value).catch(rej);
  return mock;
};

const mockPatient = {
  _id: 'p1',
  fullName: 'Jane Doe',
  nhsNumber: 'NHS-000001',
  dateOfBirth: new Date('1980-01-01'),
  gender: 'female',
  bloodType: 'A+',
};

const mockUser = { _id: 'u1', role: 'receptionist' };

// ── createPatient ─────────────────────────────────────────────────────────────
describe('createPatient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates patient and returns 201', async () => {
    Patient.create.mockResolvedValue(mockPatient);

    const req = { body: { fullName: 'Jane Doe' }, user: mockUser };
    const r = res();
    await createPatient(req, r);

    expect(r.status).toHaveBeenCalledWith(201);
    expect(r.json).toHaveBeenCalledWith(mockPatient);
    expect(Patient.create).toHaveBeenCalledWith(
      expect.objectContaining({ registeredBy: mockUser._id })
    );
  });

  it('stamps registeredBy from req.user._id', async () => {
    Patient.create.mockResolvedValue(mockPatient);
    const req = { body: { fullName: 'X' }, user: { _id: 'rec99' } };
    await createPatient(req, res());
    expect(Patient.create).toHaveBeenCalledWith(expect.objectContaining({ registeredBy: 'rec99' }));
  });

  it('returns 400 on validation / DB error', async () => {
    Patient.create.mockRejectedValue(new Error('Validation failed'));
    const r = res();
    await createPatient({ body: {}, user: mockUser }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

// ── getPatients ───────────────────────────────────────────────────────────────
describe('getPatients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated patients with total', async () => {
    Patient.find.mockReturnValue(q([mockPatient]));
    Patient.countDocuments.mockResolvedValue(1);

    const req = { query: {} };
    const r = res();
    await getPatients(req, r);

    expect(r.json).toHaveBeenCalledWith(
      expect.objectContaining({ total: 1, page: 1 })
    );
  });

  it('applies search regex when ?search= is provided', async () => {
    Patient.find.mockReturnValue(q([]));
    Patient.countDocuments.mockResolvedValue(0);

    await getPatients({ query: { search: 'Jane' } }, res());

    expect(Patient.find).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: expect.objectContaining({ $regex: 'Jane' }) })
    );
  });

  it('respects page and limit query params', async () => {
    Patient.find.mockReturnValue(q([]));
    Patient.countDocuments.mockResolvedValue(50);

    const mockQ = q([]);
    Patient.find.mockReturnValue(mockQ);

    await getPatients({ query: { page: '2', limit: '10' } }, res());

    expect(mockQ.skip).toHaveBeenCalledWith(10);  // (page-1)*limit
    expect(mockQ.limit).toHaveBeenCalledWith(10);
  });

  it('defaults to page 1 limit 20 when query params are absent', async () => {
    const mockQ = q([mockPatient]);
    Patient.find.mockReturnValue(mockQ);
    Patient.countDocuments.mockResolvedValue(1);

    await getPatients({ query: {} }, res());

    expect(mockQ.skip).toHaveBeenCalledWith(0);
    expect(mockQ.limit).toHaveBeenCalledWith(20);
  });

  it('returns 500 on DB error', async () => {
    Patient.find.mockReturnValue(q(undefined));
    Patient.countDocuments.mockRejectedValue(new Error('fail'));
    const r = res();
    await getPatients({ query: {} }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── getPatient ────────────────────────────────────────────────────────────────
describe('getPatient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns patient when found', async () => {
    Patient.findById.mockReturnValue(q(mockPatient));

    const r = res();
    await getPatient({ params: { id: 'p1' } }, r);

    expect(r.json).toHaveBeenCalledWith(mockPatient);
  });

  it('returns 404 when patient not found', async () => {
    Patient.findById.mockReturnValue(q(null));

    const r = res();
    await getPatient({ params: { id: 'bad' } }, r);

    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    Patient.findById.mockReturnValue({ populate: vi.fn().mockRejectedValue(new Error('fail')) });
    const r = res();
    await getPatient({ params: { id: 'p1' } }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── updatePatient ─────────────────────────────────────────────────────────────
describe('updatePatient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns updated patient', async () => {
    const updated = { ...mockPatient, fullName: 'Jane Updated' };
    Patient.findByIdAndUpdate.mockResolvedValue(updated);

    const req = { params: { id: 'p1' }, body: { fullName: 'Jane Updated' } };
    const r = res();
    await updatePatient(req, r);

    expect(r.json).toHaveBeenCalledWith(updated);
    expect(Patient.findByIdAndUpdate).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ fullName: 'Jane Updated' }),
      expect.objectContaining({ new: true, runValidators: true })
    );
  });

  it('returns 404 when patient not found', async () => {
    Patient.findByIdAndUpdate.mockResolvedValue(null);
    const r = res();
    await updatePatient({ params: { id: 'bad' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 on validation / DB error', async () => {
    Patient.findByIdAndUpdate.mockRejectedValue(new Error('Validation failed'));
    const r = res();
    await updatePatient({ params: { id: 'p1' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

// ── deletePatient ─────────────────────────────────────────────────────────────
describe('deletePatient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes and returns success message', async () => {
    Patient.findByIdAndDelete.mockResolvedValue(mockPatient);
    const r = res();
    await deletePatient({ params: { id: 'p1' } }, r);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 404 when patient not found', async () => {
    Patient.findByIdAndDelete.mockResolvedValue(null);
    const r = res();
    await deletePatient({ params: { id: 'bad' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    Patient.findByIdAndDelete.mockRejectedValue(new Error('fail'));
    const r = res();
    await deletePatient({ params: { id: 'p1' } }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});
