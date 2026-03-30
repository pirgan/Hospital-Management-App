import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAppointment, getAppointments, getAppointment,
  updateAppointment, deleteAppointment,
} from '../../src/controllers/appointmentController.js';

vi.mock('../../src/models/Appointment.js', () => ({
  default: {
    create:            vi.fn(),
    find:              vi.fn(),
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

import Appointment from '../../src/models/Appointment.js';

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

const mockAppt = {
  _id: 'a1',
  patient: { _id: 'p1', fullName: 'Jane Doe', nhsNumber: 'NHS-001' },
  doctor:  { _id: 'd1', name: 'Dr. Smith' },
  scheduledAt: new Date('2025-04-01T09:00:00Z'),
  duration: 30,
  status: 'confirmed',
  type: 'consultation',
};

const mockUser = { _id: 'u1', role: 'receptionist' };

// ── createAppointment ─────────────────────────────────────────────────────────
describe('createAppointment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates appointment and returns 201', async () => {
    Appointment.create.mockResolvedValue(mockAppt);
    const req = { body: { patient: 'p1', doctor: 'd1', scheduledAt: '2025-04-01T09:00:00Z' }, user: mockUser };
    const r = res();
    await createAppointment(req, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(r.json).toHaveBeenCalledWith(mockAppt);
  });

  it('stamps createdBy from req.user._id', async () => {
    Appointment.create.mockResolvedValue(mockAppt);
    await createAppointment({ body: {}, user: { _id: 'rec42' } }, res());
    expect(Appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 'rec42' })
    );
  });

  it('returns 400 on validation / DB error', async () => {
    Appointment.create.mockRejectedValue(new Error('Validation failed'));
    const r = res();
    await createAppointment({ body: {}, user: mockUser }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

// ── getAppointments ───────────────────────────────────────────────────────────
describe('getAppointments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns array of appointments', async () => {
    Appointment.find.mockReturnValue(q([mockAppt]));
    const r = res();
    await getAppointments({ query: {} }, r);
    expect(r.json).toHaveBeenCalledWith(expect.arrayContaining([mockAppt]));
  });

  it('applies doctor filter from query string', async () => {
    Appointment.find.mockReturnValue(q([]));
    await getAppointments({ query: { doctor: 'd1' } }, res());
    expect(Appointment.find).toHaveBeenCalledWith(
      expect.objectContaining({ doctor: 'd1' })
    );
  });

  it('applies patient filter from query string', async () => {
    Appointment.find.mockReturnValue(q([]));
    await getAppointments({ query: { patient: 'p1' } }, res());
    expect(Appointment.find).toHaveBeenCalledWith(
      expect.objectContaining({ patient: 'p1' })
    );
  });

  it('applies status filter from query string', async () => {
    Appointment.find.mockReturnValue(q([]));
    await getAppointments({ query: { status: 'confirmed' } }, res());
    expect(Appointment.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed' })
    );
  });

  it('applies from/to date range filter', async () => {
    Appointment.find.mockReturnValue(q([]));
    await getAppointments({ query: { from: '2025-04-01', to: '2025-04-01' } }, res());
    const filterArg = Appointment.find.mock.calls[0][0];
    expect(filterArg.scheduledAt).toMatchObject({ $gte: expect.any(Date), $lte: expect.any(Date) });
  });

  it('applies only $gte when only from is provided', async () => {
    Appointment.find.mockReturnValue(q([]));
    await getAppointments({ query: { from: '2025-04-01' } }, res());
    const filterArg = Appointment.find.mock.calls[0][0];
    expect(filterArg.scheduledAt.$gte).toBeDefined();
    expect(filterArg.scheduledAt.$lte).toBeUndefined();
  });

  it('returns 500 on DB error', async () => {
    Appointment.find.mockReturnValue({ populate: vi.fn().mockRejectedValue(new Error()) });
    const r = res();
    await getAppointments({ query: {} }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── getAppointment ────────────────────────────────────────────────────────────
describe('getAppointment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns appointment when found', async () => {
    Appointment.findById.mockReturnValue(q(mockAppt));
    const r = res();
    await getAppointment({ params: { id: 'a1' } }, r);
    expect(r.json).toHaveBeenCalledWith(mockAppt);
  });

  it('returns 404 when not found', async () => {
    Appointment.findById.mockReturnValue(q(null));
    const r = res();
    await getAppointment({ params: { id: 'bad' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});

// ── updateAppointment ─────────────────────────────────────────────────────────
describe('updateAppointment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns updated appointment', async () => {
    const updated = { ...mockAppt, status: 'completed' };
    Appointment.findByIdAndUpdate.mockResolvedValue(updated);
    const r = res();
    await updateAppointment({ params: { id: 'a1' }, body: { status: 'completed' } }, r);
    expect(r.json).toHaveBeenCalledWith(updated);
  });

  it('returns 404 when not found', async () => {
    Appointment.findByIdAndUpdate.mockResolvedValue(null);
    const r = res();
    await updateAppointment({ params: { id: 'bad' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('uses new:true and runValidators:true', async () => {
    Appointment.findByIdAndUpdate.mockResolvedValue(mockAppt);
    await updateAppointment({ params: { id: 'a1' }, body: {} }, res());
    expect(Appointment.findByIdAndUpdate).toHaveBeenCalledWith(
      'a1', expect.anything(),
      expect.objectContaining({ new: true, runValidators: true })
    );
  });
});

// ── deleteAppointment ─────────────────────────────────────────────────────────
describe('deleteAppointment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes and responds with message', async () => {
    Appointment.findByIdAndDelete.mockResolvedValue(mockAppt);
    const r = res();
    await deleteAppointment({ params: { id: 'a1' } }, r);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 404 when not found', async () => {
    Appointment.findByIdAndDelete.mockResolvedValue(null);
    const r = res();
    await deleteAppointment({ params: { id: 'bad' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});
