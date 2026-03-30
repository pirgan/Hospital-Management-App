import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInvoice, getInvoices, getInvoice,
  updateInvoice, markPaid,
} from '../../src/controllers/invoiceController.js';

vi.mock('../../src/models/Invoice.js', () => ({
  default: {
    create:            vi.fn(),
    find:              vi.fn(),
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

import Invoice from '../../src/models/Invoice.js';

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

const mockInvoice = {
  _id: 'inv1',
  patient: { _id: 'p1', fullName: 'Jane Doe', nhsNumber: 'NHS-001' },
  lineItems: [{ description: 'Consultation', qty: 1, unitPrice: 250 }],
  totalAmount: 250,
  status: 'sent',
  dueDate: new Date('2025-04-30'),
  paidAt: null,
  insuranceClaim: { provider: 'BlueCross', policyNumber: 'POL-001', claimStatus: 'pending' },
};

// ── createInvoice ─────────────────────────────────────────────────────────────
describe('createInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates invoice and returns 201', async () => {
    Invoice.create.mockResolvedValue(mockInvoice);
    const r = res();
    await createInvoice({ body: { patient: 'p1', lineItems: [], totalAmount: 250 } }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(r.json).toHaveBeenCalledWith(mockInvoice);
  });

  it('returns 400 on validation / DB error', async () => {
    Invoice.create.mockRejectedValue(new Error('Validation failed'));
    const r = res();
    await createInvoice({ body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

// ── getInvoices ───────────────────────────────────────────────────────────────
describe('getInvoices', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of invoices', async () => {
    Invoice.find.mockReturnValue(q([mockInvoice]));
    const r = res();
    await getInvoices({ query: {} }, r);
    expect(r.json).toHaveBeenCalledWith(expect.arrayContaining([mockInvoice]));
  });

  it('filters by patient', async () => {
    Invoice.find.mockReturnValue(q([]));
    await getInvoices({ query: { patient: 'p1' } }, res());
    expect(Invoice.find).toHaveBeenCalledWith(expect.objectContaining({ patient: 'p1' }));
  });

  it('filters by status', async () => {
    Invoice.find.mockReturnValue(q([]));
    await getInvoices({ query: { status: 'overdue' } }, res());
    expect(Invoice.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'overdue' }));
  });

  it('returns empty array when no invoices match', async () => {
    Invoice.find.mockReturnValue(q([]));
    const r = res();
    await getInvoices({ query: { status: 'paid' } }, r);
    expect(r.json).toHaveBeenCalledWith([]);
  });

  it('returns 500 on DB error', async () => {
    Invoice.find.mockReturnValue({ populate: vi.fn().mockRejectedValue(new Error()) });
    const r = res();
    await getInvoices({ query: {} }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── getInvoice ────────────────────────────────────────────────────────────────
describe('getInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns invoice when found', async () => {
    Invoice.findById.mockReturnValue(q(mockInvoice));
    const r = res();
    await getInvoice({ params: { id: 'inv1' } }, r);
    expect(r.json).toHaveBeenCalledWith(mockInvoice);
  });

  it('returns 404 when not found', async () => {
    Invoice.findById.mockReturnValue(q(null));
    const r = res();
    await getInvoice({ params: { id: 'bad' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});

// ── updateInvoice ─────────────────────────────────────────────────────────────
describe('updateInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns updated invoice', async () => {
    const updated = { ...mockInvoice, status: 'overdue' };
    Invoice.findByIdAndUpdate.mockResolvedValue(updated);
    const r = res();
    await updateInvoice({ params: { id: 'inv1' }, body: { status: 'overdue' } }, r);
    expect(r.json).toHaveBeenCalledWith(updated);
  });

  it('returns 404 when not found', async () => {
    Invoice.findByIdAndUpdate.mockResolvedValue(null);
    const r = res();
    await updateInvoice({ params: { id: 'bad' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('uses new:true and runValidators:true', async () => {
    Invoice.findByIdAndUpdate.mockResolvedValue(mockInvoice);
    await updateInvoice({ params: { id: 'inv1' }, body: {} }, res());
    expect(Invoice.findByIdAndUpdate).toHaveBeenCalledWith(
      'inv1', expect.anything(),
      expect.objectContaining({ new: true, runValidators: true })
    );
  });
});

// ── markPaid ──────────────────────────────────────────────────────────────────
describe('markPaid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets status=paid and paidAt timestamp', async () => {
    const paid = { ...mockInvoice, status: 'paid', paidAt: new Date() };
    Invoice.findByIdAndUpdate.mockResolvedValue(paid);

    const r = res();
    await markPaid({ params: { id: 'inv1' } }, r);

    expect(r.json).toHaveBeenCalledWith(paid);
    expect(Invoice.findByIdAndUpdate).toHaveBeenCalledWith(
      'inv1',
      expect.objectContaining({
        status: 'paid',
        paidAt: expect.any(Date),
      }),
      expect.objectContaining({ new: true })
    );
  });

  it('returns 404 when invoice not found', async () => {
    Invoice.findByIdAndUpdate.mockResolvedValue(null);
    const r = res();
    await markPaid({ params: { id: 'bad' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    Invoice.findByIdAndUpdate.mockRejectedValue(new Error('fail'));
    const r = res();
    await markPaid({ params: { id: 'inv1' } }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});
