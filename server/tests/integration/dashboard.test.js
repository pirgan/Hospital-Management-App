/**
 * Integration tests — /api/dashboard/stats
 * Verifies role-branching: admin gets KPI keys, doctor gets clinical keys,
 * all other roles get an empty object.
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

// ── Auth guard ────────────────────────────────────────────────────────────────
describe('GET /api/dashboard/stats — auth guard', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });
});

// ── Admin branch ──────────────────────────────────────────────────────────────
describe('GET /api/dashboard/stats — admin role', () => {
  it('returns 200 with all admin KPI keys (empty DB → zero values)', async () => {
    const { token } = await createUser({ role: 'admin' });

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalPatients', 0);
    expect(res.body).toHaveProperty('todayAppointments', 0);
    expect(res.body).toHaveProperty('revenueCollected', 0);
    expect(res.body).toHaveProperty('overdueAmount', 0);
    expect(res.body).toHaveProperty('appointmentsByStatus');
    expect(res.body).toHaveProperty('bedOccupancy');
    expect(res.body).toHaveProperty('recentOverdueInvoices');
    expect(res.body).toHaveProperty('flaggedLabResults');
    expect(res.body).toHaveProperty('highRiskFollowUps');
    expect(Array.isArray(res.body.appointmentsByStatus)).toBe(true);
    expect(Array.isArray(res.body.bedOccupancy)).toBe(true);
  });

  it('does NOT include doctor-specific keys', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body).not.toHaveProperty('todayCount');
    expect(res.body).not.toHaveProperty('pendingLabCount');
  });
});

// ── Admin via secondaryRole ───────────────────────────────────────────────────
describe('GET /api/dashboard/stats — admin via secondaryRole', () => {
  it('returns admin stats for a user whose secondaryRoles includes admin', async () => {
    const { token } = await createUser({ role: 'doctor', secondaryRoles: ['admin'] });

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalPatients');
    expect(res.body).toHaveProperty('bedOccupancy');
  });
});

// ── Doctor branch ─────────────────────────────────────────────────────────────
describe('GET /api/dashboard/stats — doctor role', () => {
  it('returns 200 with doctor-specific keys', async () => {
    const { token } = await createUser({ role: 'doctor' });

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('todayCount');
    expect(res.body).toHaveProperty('pendingLabCount');
    expect(res.body).toHaveProperty('activeRxCount');
    expect(res.body).toHaveProperty('flaggedLabs');
    expect(res.body).toHaveProperty('overdueFollowUps');
  });

  it('does NOT include admin-only keys', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body).not.toHaveProperty('totalPatients');
    expect(res.body).not.toHaveProperty('bedOccupancy');
    expect(res.body).not.toHaveProperty('revenueCollected');
  });

  it('returns zero counts for a doctor with no activity', async () => {
    const { token } = await createUser({ role: 'doctor' });
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.todayCount).toBe(0);
    expect(res.body.pendingLabCount).toBe(0);
    expect(res.body.activeRxCount).toBe(0);
    expect(Array.isArray(res.body.flaggedLabs)).toBe(true);
    expect(Array.isArray(res.body.overdueFollowUps)).toBe(true);
  });
});

// ── Other roles → empty object ────────────────────────────────────────────────
describe('GET /api/dashboard/stats — other roles', () => {
  it.each(['nurse', 'receptionist', 'lab_tech', 'patient'])(
    'returns empty object for %s role',
    async (role) => {
      const { token } = await createUser({ role });

      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    }
  );
});
