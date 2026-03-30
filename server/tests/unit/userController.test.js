import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUsers, updateUser } from '../../src/controllers/userController.js';

vi.mock('../../src/models/User.js', () => ({
  default: {
    find:              vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

import User from '../../src/models/User.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const res = () => {
  const r = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json   = vi.fn().mockReturnValue(r);
  return r;
};

const q = (value) => {
  const m = {
    select: vi.fn().mockReturnThis(),
    sort:   vi.fn().mockReturnThis(),
  };
  m.then  = (res, rej) => Promise.resolve(value).then(res, rej);
  m.catch = (rej) => Promise.resolve(value).catch(rej);
  return m;
};

const mockDoctor = {
  _id: 'd1', name: 'Dr. Smith', email: 'smith@medicore.hospital',
  role: 'doctor', department: 'Cardiology', isActive: true,
};

const mockNurse = {
  _id: 'n1', name: 'Grace Kim', email: 'grace@medicore.hospital',
  role: 'nurse', department: 'General Ward', isActive: true,
};

// ── getUsers ──────────────────────────────────────────────────────────────────
describe('getUsers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all users when no role filter', async () => {
    User.find.mockReturnValue(q([mockDoctor, mockNurse]));
    const r = res();
    await getUsers({ query: {} }, r);
    expect(r.json).toHaveBeenCalledWith(expect.arrayContaining([mockDoctor, mockNurse]));
    expect(User.find).toHaveBeenCalledWith({});
  });

  it('filters by primary role', async () => {
    User.find.mockReturnValue(q([mockDoctor]));
    await getUsers({ query: { role: 'doctor' } }, res());
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          expect.objectContaining({ role: 'doctor' }),
        ]),
      })
    );
  });

  it('also matches secondaryRoles when filtering by role', async () => {
    User.find.mockReturnValue(q([]));
    await getUsers({ query: { role: 'doctor' } }, res());
    const filterArg = User.find.mock.calls[0][0];
    const hasSecondaryCheck = filterArg.$or?.some(
      (cond) => cond.secondaryRoles !== undefined
    );
    expect(hasSecondaryCheck).toBe(true);
  });

  it('excludes password from results', async () => {
    const mockQ = q([mockDoctor]);
    User.find.mockReturnValue(mockQ);
    await getUsers({ query: {} }, res());
    expect(mockQ.select).toHaveBeenCalledWith('-password');
  });

  it('sorts by name ascending', async () => {
    const mockQ = q([]);
    User.find.mockReturnValue(mockQ);
    await getUsers({ query: {} }, res());
    expect(mockQ.sort).toHaveBeenCalledWith({ name: 1 });
  });

  it('returns empty array when no users match', async () => {
    User.find.mockReturnValue(q([]));
    const r = res();
    await getUsers({ query: { role: 'admin' } }, r);
    expect(r.json).toHaveBeenCalledWith([]);
  });

  it('returns 500 on DB error', async () => {
    User.find.mockReturnValue({ select: vi.fn().mockRejectedValue(new Error('fail')) });
    const r = res();
    await getUsers({ query: {} }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── updateUser ────────────────────────────────────────────────────────────────
describe('updateUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns updated user', async () => {
    const updated = { ...mockDoctor, department: 'Neurology' };
    User.findByIdAndUpdate.mockReturnValue({ select: vi.fn().mockResolvedValue(updated) });

    const r = res();
    await updateUser({ params: { id: 'd1' }, body: { department: 'Neurology' } }, r);

    expect(r.json).toHaveBeenCalledWith(updated);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ department: 'Neurology' }),
      expect.objectContaining({ new: true, runValidators: true })
    );
  });

  it('can update name', async () => {
    const updated = { ...mockDoctor, name: 'Dr. Jones' };
    User.findByIdAndUpdate.mockReturnValue({ select: vi.fn().mockResolvedValue(updated) });
    const r = res();
    await updateUser({ params: { id: 'd1' }, body: { name: 'Dr. Jones' } }, r);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'Dr. Jones' }));
  });

  it('can deactivate a user (isActive: false)', async () => {
    const updated = { ...mockDoctor, isActive: false };
    User.findByIdAndUpdate.mockReturnValue({ select: vi.fn().mockResolvedValue(updated) });
    const r = res();
    await updateUser({ params: { id: 'd1' }, body: { isActive: false } }, r);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
  });

  it('can update role', async () => {
    const updated = { ...mockDoctor, role: 'nurse' };
    User.findByIdAndUpdate.mockReturnValue({ select: vi.fn().mockResolvedValue(updated) });
    const r = res();
    await updateUser({ params: { id: 'd1' }, body: { role: 'nurse' } }, r);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ role: 'nurse' }));
  });

  it('returns 404 when user not found', async () => {
    User.findByIdAndUpdate.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    const r = res();
    await updateUser({ params: { id: 'bad' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 on DB error', async () => {
    User.findByIdAndUpdate.mockReturnValue({ select: vi.fn().mockRejectedValue(new Error('fail')) });
    const r = res();
    await updateUser({ params: { id: 'd1' }, body: {} }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});
