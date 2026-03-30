import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createLabOrder, getLabOrders, getLabOrder,
  updateLabOrder, enterResults,
} from '../../src/controllers/labOrderController.js';

vi.mock('../../src/models/LabOrder.js', () => ({
  default: {
    create:            vi.fn(),
    find:              vi.fn(),
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

import LabOrder from '../../src/models/LabOrder.js';

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

const mockOrder = {
  _id:         'lo1',
  patient:     { _id: 'p1', fullName: 'Jane Doe', nhsNumber: 'NHS-001' },
  doctor:      { _id: 'd1', name: 'Dr. Smith' },
  tests:       ['CBC', 'Lipid Panel'],
  priority:    'routine',
  status:      'ordered',
  results:     [],
  processedBy: null,
};

const mockDoctor   = { _id: 'd1', role: 'doctor' };
const mockLabTech  = { _id: 'lt1', role: 'lab_tech' };

const sampleResults = [
  { testName: 'WBC',         value: '12.5', unit: '10³/µL', referenceRange: '4.5-11.0', flagged: true },
  { testName: 'Haemoglobin', value: '14.0', unit: 'g/dL',   referenceRange: '13.5-17.5', flagged: false },
];

// ── createLabOrder ────────────────────────────────────────────────────────────
describe('createLabOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates lab order and returns 201', async () => {
    LabOrder.create.mockResolvedValue(mockOrder);
    const req = { body: { patient: 'p1', tests: ['CBC'] }, user: mockDoctor };
    const r = res();
    await createLabOrder(req, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(r.json).toHaveBeenCalledWith(mockOrder);
  });

  it('stamps doctor from req.user._id', async () => {
    LabOrder.create.mockResolvedValue(mockOrder);
    await createLabOrder({ body: { tests: [] }, user: { _id: 'doc77' } }, res());
    expect(LabOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ doctor: 'doc77' })
    );
  });

  it('returns 400 on validation / DB error', async () => {
    LabOrder.create.mockRejectedValue(new Error('Validation failed'));
    const r = res();
    await createLabOrder({ body: {}, user: mockDoctor }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

// ── getLabOrders ──────────────────────────────────────────────────────────────
describe('getLabOrders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of lab orders', async () => {
    LabOrder.find.mockReturnValue(q([mockOrder]));
    const r = res();
    await getLabOrders({ query: {} }, r);
    expect(r.json).toHaveBeenCalledWith(expect.arrayContaining([mockOrder]));
  });

  it('filters by patient', async () => {
    LabOrder.find.mockReturnValue(q([]));
    await getLabOrders({ query: { patient: 'p1' } }, res());
    expect(LabOrder.find).toHaveBeenCalledWith(expect.objectContaining({ patient: 'p1' }));
  });

  it('filters by status', async () => {
    LabOrder.find.mockReturnValue(q([]));
    await getLabOrders({ query: { status: 'ordered' } }, res());
    expect(LabOrder.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'ordered' }));
  });

  it('filters by priority', async () => {
    LabOrder.find.mockReturnValue(q([]));
    await getLabOrders({ query: { priority: 'stat' } }, res());
    expect(LabOrder.find).toHaveBeenCalledWith(expect.objectContaining({ priority: 'stat' }));
  });

  it('combines multiple filters', async () => {
    LabOrder.find.mockReturnValue(q([]));
    await getLabOrders({ query: { patient: 'p1', status: 'ordered', priority: 'urgent' } }, res());
    expect(LabOrder.find).toHaveBeenCalledWith(
      expect.objectContaining({ patient: 'p1', status: 'ordered', priority: 'urgent' })
    );
  });

  it('returns 500 on DB error', async () => {
    LabOrder.find.mockReturnValue({ populate: vi.fn().mockRejectedValue(new Error()) });
    const r = res();
    await getLabOrders({ query: {} }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── getLabOrder ───────────────────────────────────────────────────────────────
describe('getLabOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns order when found', async () => {
    LabOrder.findById.mockReturnValue(q(mockOrder));
    const r = res();
    await getLabOrder({ params: { id: 'lo1' } }, r);
    expect(r.json).toHaveBeenCalledWith(mockOrder);
  });

  it('returns 404 when not found', async () => {
    LabOrder.findById.mockReturnValue(q(null));
    const r = res();
    await getLabOrder({ params: { id: 'bad' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});

// ── updateLabOrder ────────────────────────────────────────────────────────────
describe('updateLabOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns updated order', async () => {
    const updated = { ...mockOrder, status: 'in-progress' };
    LabOrder.findByIdAndUpdate.mockResolvedValue(updated);
    const r = res();
    await updateLabOrder({ params: { id: 'lo1' }, body: { status: 'in-progress' } }, r);
    expect(r.json).toHaveBeenCalledWith(updated);
  });

  it('returns 404 when not found', async () => {
    LabOrder.findByIdAndUpdate.mockResolvedValue(null);
    const r = res();
    await updateLabOrder({ params: { id: 'bad' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});

// ── enterResults ──────────────────────────────────────────────────────────────
describe('enterResults', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets results, status=completed and processedBy', async () => {
    const completed = {
      ...mockOrder,
      status: 'completed',
      results: sampleResults,
      processedBy: 'lt1',
    };
    LabOrder.findByIdAndUpdate.mockResolvedValue(completed);

    const r = res();
    await enterResults({ params: { id: 'lo1' }, body: { results: sampleResults }, user: mockLabTech }, r);

    expect(r.json).toHaveBeenCalledWith(completed);
    expect(LabOrder.findByIdAndUpdate).toHaveBeenCalledWith(
      'lo1',
      expect.objectContaining({
        results:     sampleResults,
        status:      'completed',
        processedBy: mockLabTech._id,
      }),
      expect.objectContaining({ new: true })
    );
  });

  it('returns 404 when order not found', async () => {
    LabOrder.findByIdAndUpdate.mockResolvedValue(null);
    const r = res();
    await enterResults({ params: { id: 'bad' }, body: { results: [] }, user: mockLabTech }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 on validation / DB error', async () => {
    LabOrder.findByIdAndUpdate.mockRejectedValue(new Error('Validation failed'));
    const r = res();
    await enterResults({ params: { id: 'lo1' }, body: { results: [] }, user: mockLabTech }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('stores flagged results correctly', async () => {
    const withFlagged = { ...mockOrder, status: 'completed', results: sampleResults };
    LabOrder.findByIdAndUpdate.mockResolvedValue(withFlagged);

    await enterResults({ params: { id: 'lo1' }, body: { results: sampleResults }, user: mockLabTech }, res());

    const updateArg = LabOrder.findByIdAndUpdate.mock.calls[0][1];
    expect(updateArg.results.some(r => r.flagged)).toBe(true);
  });
});
