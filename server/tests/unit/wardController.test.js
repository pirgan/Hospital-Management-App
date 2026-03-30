import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createWard, getWards, getWard, admitPatient, dischargePatient,
} from '../../src/controllers/wardController.js';

vi.mock('../../src/models/Ward.js', () => ({
  default: {
    create:            vi.fn(),
    find:              vi.fn(),
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

import Ward from '../../src/models/Ward.js';

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

// Build a ward with mutable save()
const buildWard = (overrides = {}) => {
  const ward = {
    _id:      'w1',
    name:     'General Ward A',
    type:     'general',
    floor:    2,
    capacity: 4,
    beds: [
      { number: 'G-01', status: 'available', patient: null, admittedAt: null },
      { number: 'G-02', status: 'occupied',  patient: 'old-pt', admittedAt: new Date() },
      { number: 'G-03', status: 'reserved',  patient: null, admittedAt: null },
    ],
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  return ward;
};

// ── createWard ────────────────────────────────────────────────────────────────
describe('createWard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates ward and returns 201', async () => {
    const ward = buildWard();
    Ward.create.mockResolvedValue(ward);

    const r = res();
    await createWard({ body: { name: 'General Ward A', capacity: 4 } }, r);

    expect(r.status).toHaveBeenCalledWith(201);
    expect(r.json).toHaveBeenCalledWith(ward);
  });

  it('returns 400 on DB error', async () => {
    Ward.create.mockRejectedValue(new Error('fail'));
    const r = res();
    await createWard({ body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

// ── getWards ──────────────────────────────────────────────────────────────────
describe('getWards', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of wards', async () => {
    Ward.find.mockReturnValue(q([buildWard()]));
    const r = res();
    await getWards({ query: {} }, r);
    expect(r.json).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'General Ward A' })]));
  });

  it('filters by type', async () => {
    Ward.find.mockReturnValue(q([]));
    await getWards({ query: { type: 'ICU' } }, res());
    expect(Ward.find).toHaveBeenCalledWith(expect.objectContaining({ type: 'ICU' }));
  });

  it('returns all wards when no type filter', async () => {
    Ward.find.mockReturnValue(q([]));
    await getWards({ query: {} }, res());
    expect(Ward.find).toHaveBeenCalledWith({});
  });

  it('returns 500 on DB error', async () => {
    Ward.find.mockReturnValue({ populate: vi.fn().mockRejectedValue(new Error()) });
    const r = res();
    await getWards({ query: {} }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── getWard ───────────────────────────────────────────────────────────────────
describe('getWard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ward when found', async () => {
    Ward.findById.mockReturnValue(q(buildWard()));
    const r = res();
    await getWard({ params: { id: 'w1' } }, r);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'General Ward A' }));
  });

  it('returns 404 when not found', async () => {
    Ward.findById.mockReturnValue(q(null));
    const r = res();
    await getWard({ params: { id: 'bad' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});

// ── admitPatient ──────────────────────────────────────────────────────────────
describe('admitPatient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admits patient to an available bed', async () => {
    const ward = buildWard();
    Ward.findById.mockResolvedValue(ward);

    const r = res();
    await admitPatient(
      { body: { wardId: 'w1', bedNumber: 'G-01', patientId: 'newpt' } },
      r
    );

    const bed = ward.beds.find((b) => b.number === 'G-01');
    expect(bed.status).toBe('occupied');
    expect(String(bed.patient)).toBe('newpt');
    expect(bed.admittedAt).toBeInstanceOf(Date);
    expect(ward.save).toHaveBeenCalled();
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ _id: 'w1', beds: expect.any(Array) }));
  });

  it('returns 404 when ward not found', async () => {
    Ward.findById.mockResolvedValue(null);
    const r = res();
    await admitPatient({ body: { wardId: 'bad', bedNumber: 'G-01', patientId: 'pt' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 404 when bed number does not exist', async () => {
    Ward.findById.mockResolvedValue(buildWard());
    const r = res();
    await admitPatient({ body: { wardId: 'w1', bedNumber: 'Z-99', patientId: 'pt' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 409 when bed is already occupied', async () => {
    Ward.findById.mockResolvedValue(buildWard());
    const r = res();
    await admitPatient({ body: { wardId: 'w1', bedNumber: 'G-02', patientId: 'pt' } }, r);
    expect(r.status).toHaveBeenCalledWith(409);
  });

  it('returns 409 when bed is reserved', async () => {
    Ward.findById.mockResolvedValue(buildWard());
    const r = res();
    await admitPatient({ body: { wardId: 'w1', bedNumber: 'G-03', patientId: 'pt' } }, r);
    expect(r.status).toHaveBeenCalledWith(409);
  });

  it('returns 400 on DB error', async () => {
    Ward.findById.mockRejectedValue(new Error('fail'));
    const r = res();
    await admitPatient({ body: { wardId: 'w1', bedNumber: 'G-01', patientId: 'pt' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

// ── dischargePatient ──────────────────────────────────────────────────────────
describe('dischargePatient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('discharges patient by bed number', async () => {
    const ward = buildWard();
    Ward.findById.mockResolvedValue(ward);

    const r = res();
    await dischargePatient({ body: { wardId: 'w1', bedNumber: 'G-02' } }, r);

    const bed = ward.beds.find((b) => b.number === 'G-02');
    expect(bed.status).toBe('available');
    expect(bed.patient).toBeNull();
    expect(bed.admittedAt).toBeNull();
    expect(ward.save).toHaveBeenCalled();
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ _id: 'w1', beds: expect.any(Array) }));
  });

  it('discharges patient by patientId when bedNumber not provided', async () => {
    const ward = buildWard();
    Ward.findById.mockResolvedValue(ward);

    const r = res();
    await dischargePatient({ body: { wardId: 'w1', patientId: 'old-pt' } }, r);

    const bed = ward.beds.find((b) => b.number === 'G-02');
    expect(bed.status).toBe('available');
    expect(ward.save).toHaveBeenCalled();
  });

  it('returns 404 when ward not found', async () => {
    Ward.findById.mockResolvedValue(null);
    const r = res();
    await dischargePatient({ body: { wardId: 'bad', bedNumber: 'G-01' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 404 when no matching bed or patient found', async () => {
    Ward.findById.mockResolvedValue(buildWard());
    const r = res();
    await dischargePatient({ body: { wardId: 'w1', bedNumber: 'Z-99' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 on DB error', async () => {
    Ward.findById.mockRejectedValue(new Error('fail'));
    const r = res();
    await dischargePatient({ body: { wardId: 'w1', bedNumber: 'G-02' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});
