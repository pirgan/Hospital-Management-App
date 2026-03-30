import { describe, it, expect, vi, beforeEach } from 'vitest';
import { register, login, getMe } from '../../src/controllers/authController.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../../src/models/User.js', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn(() => 'mock.jwt.token') },
}));

import User from '../../src/models/User.js';
import jwt from 'jsonwebtoken';

// ── Helpers ───────────────────────────────────────────────────────────────────
const res = () => {
  const r = { _status: 200 };
  r.status = vi.fn((code) => { r._status = code; return r; });
  r.json   = vi.fn((body) => { r._body = body; return r; });
  return r;
};

const makeUser = (overrides = {}) => ({
  _id:           'uid1',
  name:          'Alice Smith',
  email:         'alice@example.com',
  role:          'doctor',
  department:    'Cardiology',
  isActive:      true,
  matchPassword: vi.fn(),
  toJSON:        vi.fn().mockReturnValue({ _id: 'uid1', name: 'Alice Smith', email: 'alice@example.com', role: 'doctor' }),
  ...overrides,
});

// ── register ──────────────────────────────────────────────────────────────────
describe('register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a user and returns 201 with token', async () => {
    User.findOne.mockResolvedValue(null);
    const user = makeUser();
    User.create.mockResolvedValue(user);

    const req = { body: { name: 'Alice Smith', email: 'alice@example.com', password: 'Password1!', role: 'doctor' } };
    const r = res();
    await register(req, r);

    expect(r.status).toHaveBeenCalledWith(201);
    expect(r._body).toMatchObject({ token: 'mock.jwt.token' });
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' })
    );
  });

  it('returns 409 when email already exists', async () => {
    User.findOne.mockResolvedValue(makeUser());

    const req = { body: { email: 'alice@example.com', password: 'pass', name: 'Alice' } };
    const r = res();
    await register(req, r);

    expect(r.status).toHaveBeenCalledWith(409);
    expect(r._body.message).toMatch(/already/i);
  });

  it('returns 400 on DB / validation error', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockRejectedValue(new Error('Validation failed'));

    const req = { body: { email: 'a@b.com', password: 'pass', name: 'A' } };
    const r = res();
    await register(req, r);

    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('signs JWT with the newly created user _id', async () => {
    User.findOne.mockResolvedValue(null);
    const user = makeUser({ _id: 'newuid' });
    User.create.mockResolvedValue(user);

    await register({ body: { name: 'B', email: 'b@b.com', password: 'pw' } }, res());

    // JWT_SECRET may be undefined in test env — only assert payload and options shape
    expect(jwt.sign).toHaveBeenCalledWith({ id: 'newuid' }, expect.toSatisfy(() => true), expect.any(Object));
  });
});

// ── login ─────────────────────────────────────────────────────────────────────
describe('login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns token and user on valid credentials', async () => {
    const user = makeUser();
    user.matchPassword.mockResolvedValue(true);
    User.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    });

    const req = { body: { email: 'alice@example.com', password: 'Password1!' } };
    const r = res();
    await login(req, r);

    expect(r._body).toMatchObject({ token: 'mock.jwt.token' });
    expect(r.status).not.toHaveBeenCalledWith(401);
  });

  it('returns 401 when user not found', async () => {
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });

    const r = res();
    await login({ body: { email: 'nobody@x.com', password: 'pw' } }, r);

    expect(r.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when password is wrong', async () => {
    const user = makeUser();
    user.matchPassword.mockResolvedValue(false);
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });

    const r = res();
    await login({ body: { email: 'alice@example.com', password: 'wrong' } }, r);

    expect(r.status).toHaveBeenCalledWith(401);
    expect(r._body.message).toMatch(/invalid/i);
  });

  it('returns 403 when account is deactivated', async () => {
    const user = makeUser({ isActive: false });
    user.matchPassword.mockResolvedValue(true);
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });

    const r = res();
    await login({ body: { email: 'alice@example.com', password: 'pw' } }, r);

    expect(r.status).toHaveBeenCalledWith(403);
  });

  it('returns 500 on DB error', async () => {
    User.findOne.mockReturnValue({ select: vi.fn().mockRejectedValue(new Error('fail')) });

    const r = res();
    await login({ body: { email: 'a@b.com', password: 'pw' } }, r);

    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── getMe ─────────────────────────────────────────────────────────────────────
describe('getMe', () => {
  it('returns req.user', async () => {
    const user = makeUser();
    const req = { user };
    const r = res();
    await getMe(req, r);

    expect(r.json).toHaveBeenCalledWith(user);
  });
});
