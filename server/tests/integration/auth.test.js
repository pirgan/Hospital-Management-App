/**
 * Integration tests — /api/auth
 * Covers register, login, and getMe endpoints end-to-end with a real in-memory DB.
 */

// Prevent index.js from connecting to real MongoDB and starting the HTTP server
vi.mock('../../src/config/db.js', () => ({ default: vi.fn().mockReturnValue(new Promise(() => {})) }));
vi.mock('../../src/scripts/seedCronJobs.js', () => ({ registerCronJobs: vi.fn() }));

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import User from '../../src/models/User.js';
import { connect, disconnect, clearDB } from './helpers/db.js';

beforeAll(async () => await connect());
afterAll(async () => await disconnect());
beforeEach(async () => await clearDB());

// ── POST /api/auth/register ───────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('returns 201 with token and user on valid data', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice Admin', email: 'alice@medicore.test', password: 'Password123!', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@medicore.test');
    expect(res.body.user.password).toBeUndefined(); // never leak the hash
  });

  it('returns 409 when email is already registered', async () => {
    await User.create({ name: 'Existing', email: 'dup@medicore.test', password: 'Password123!', role: 'admin' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Duplicate', email: 'dup@medicore.test', password: 'Password123!', role: 'admin' });

    expect(res.status).toBe(409);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'no-name@medicore.test', password: 'Password123!' }); // missing name + role

    expect(res.status).toBe(400);
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    // Seed a valid user for login tests
    await User.create({ name: 'Bob', email: 'bob@medicore.test', password: 'Password123!', role: 'doctor' });
  });

  it('returns 200 with token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@medicore.test', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('doctor');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@medicore.test', password: 'WrongPass!' });

    expect(res.status).toBe(401);
  });

  it('returns 401 when email is not registered', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@medicore.test', password: 'Password123!' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when account is deactivated', async () => {
    await User.create({
      name: 'Deactivated',
      email: 'dead@medicore.test',
      password: 'Password123!',
      role: 'nurse',
      isActive: false,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dead@medicore.test', password: 'Password123!' });

    expect(res.status).toBe(403);
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns 200 with user profile when token is valid', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Charlie', email: 'charlie@medicore.test', password: 'Password123!', role: 'receptionist' });

    const { token } = regRes.body;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('charlie@medicore.test');
    expect(res.body.password).toBeUndefined();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.valid.jwt');

    expect(res.status).toBe(401);
  });
});
