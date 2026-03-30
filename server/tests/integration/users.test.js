/**
 * Integration tests — /api/users
 */

vi.mock('../../src/config/db.js', () => ({ default: vi.fn().mockReturnValue(new Promise(() => {})) }));
vi.mock('../../src/scripts/seedCronJobs.js', () => ({ registerCronJobs: vi.fn() }));

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { connect, disconnect, clearDB } from './helpers/db.js';
import { createUser } from './helpers/auth.js';

beforeAll(async () => await connect());
afterAll(async () => await disconnect());
beforeEach(async () => await clearDB());

// ── GET /api/users ────────────────────────────────────────────────────────────
describe('GET /api/users', () => {
  it('returns 200 list of all users for any authenticated user', async () => {
    const { token } = await createUser({ role: 'nurse' });
    await createUser({ role: 'doctor' });
    await createUser({ role: 'receptionist' });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('never includes the password field', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((u) => u.password === undefined)).toBe(true);
  });

  it('filters by ?role=doctor and matches primary role', async () => {
    const { token } = await createUser({ role: 'admin' });
    await createUser({ role: 'doctor', name: 'Dr. House' });
    await createUser({ role: 'nurse', name: 'Nurse Ratchet' });

    const res = await request(app)
      .get('/api/users?role=doctor')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((u) => u.role === 'doctor' || (u.secondaryRoles ?? []).includes('doctor'))).toBe(true);
  });

  it('includes users matching via secondaryRoles when filtering by role', async () => {
    const { token } = await createUser({ role: 'admin' });
    await createUser({ role: 'admin', secondaryRoles: ['doctor'], name: 'Admin-Doctor' });
    await createUser({ role: 'nurse', name: 'Pure Nurse' });

    const res = await request(app)
      .get('/api/users?role=doctor')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const hasSecondaryMatch = res.body.some(
      (u) => u.role === 'admin' && u.secondaryRoles.includes('doctor')
    );
    expect(hasSecondaryMatch).toBe(true);
  });

  it('returns results sorted alphabetically by name', async () => {
    const { token } = await createUser({ role: 'admin', name: 'Zara' });
    await createUser({ role: 'doctor', name: 'Aaron' });
    await createUser({ role: 'nurse', name: 'Monica' });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.map((u) => u.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

// ── PUT /api/users/:id ────────────────────────────────────────────────────────
describe('PUT /api/users/:id', () => {
  it('returns 200 and updates the user for admin', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { user: target } = await createUser({ role: 'nurse', name: 'Original Name' });

    const res = await request(app)
      .put(`/api/users/${target._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.password).toBeUndefined();
  });

  it('can deactivate a user account', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { user: target } = await createUser({ role: 'doctor' });

    const res = await request(app)
      .put(`/api/users/${target._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it('can update role and department', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { user: target } = await createUser({ role: 'nurse' });

    const res = await request(app)
      .put(`/api/users/${target._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin', department: 'Management' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    expect(res.body.department).toBe('Management');
  });

  it('returns 403 for doctor', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const { user: target } = await createUser({ role: 'nurse' });

    const res = await request(app)
      .put(`/api/users/${target._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('returns 403 for receptionist', async () => {
    const { token } = await createUser({ role: 'receptionist' });
    const { user: target } = await createUser({ role: 'nurse' });

    const res = await request(app)
      .put(`/api/users/${target._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent user', async () => {
    const { token } = await createUser({ role: 'admin' });

    const res = await request(app)
      .put('/api/users/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});
