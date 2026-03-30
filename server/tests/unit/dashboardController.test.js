import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDashboardStats } from '../../src/controllers/dashboardController.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../../src/models/Appointment.js',  () => ({ default: { countDocuments: vi.fn(), aggregate: vi.fn() } }));
vi.mock('../../src/models/Invoice.js',      () => ({ default: { aggregate: vi.fn(), find: vi.fn() } }));
vi.mock('../../src/models/LabOrder.js',     () => ({ default: { countDocuments: vi.fn(), find: vi.fn() } }));
vi.mock('../../src/models/MedicalRecord.js',() => ({ default: { find: vi.fn() } }));
vi.mock('../../src/models/Patient.js',      () => ({ default: { countDocuments: vi.fn() } }));
vi.mock('../../src/models/Prescription.js', () => ({ default: { countDocuments: vi.fn() } }));
vi.mock('../../src/models/Ward.js',         () => ({ default: { aggregate: vi.fn() } }));

import Appointment   from '../../src/models/Appointment.js';
import Invoice       from '../../src/models/Invoice.js';
import LabOrder      from '../../src/models/LabOrder.js';
import MedicalRecord from '../../src/models/MedicalRecord.js';
import Patient       from '../../src/models/Patient.js';
import Prescription  from '../../src/models/Prescription.js';
import Ward          from '../../src/models/Ward.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const res = () => {
  const r = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json   = vi.fn().mockReturnValue(r);
  return r;
};

/** Thenable chainable mock — for .populate().sort().limit().lean() chains */
const chain = (value) => {
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

const adminUser  = { _id: 'admin1',  role: 'admin',  secondaryRoles: [] };
const doctorUser = { _id: 'doctor1', role: 'doctor', secondaryRoles: [] };
const nurseUser  = { _id: 'nurse1',  role: 'nurse',  secondaryRoles: [] };

// Raw appointment aggregation output (by date+status)
const rawApptAgg = [
  { _id: { date: '2025-03-23', status: 'completed' }, count: 3 },
  { _id: { date: '2025-03-23', status: 'confirmed' }, count: 2 },
  { _id: { date: '2025-03-24', status: 'scheduled' }, count: 4 },
  { _id: { date: '2025-03-24', status: 'cancelled' }, count: 1 },
];

const rawBedAgg = [
  { _id: 'available', count: 50 },
  { _id: 'occupied',  count: 30 },
  { _id: 'reserved',  count: 10 },
];

const mockOverdueInvoices = [
  { _id: 'inv1', patient: { fullName: 'Jane Doe' }, totalAmount: 500, dueDate: new Date(Date.now() - 20 * 86_400_000) },
  { _id: 'inv2', patient: { fullName: 'Bob Smith' }, totalAmount: 300, dueDate: new Date(Date.now() - 5  * 86_400_000) },
];

const mockFlaggedLabs = [
  {
    _id: 'lo1', patient: { fullName: 'Jane Doe' }, tests: ['CBC'],
    results: [
      { testName: 'WBC', value: '15', unit: '10³/µL', referenceRange: '4.5-11.0', flagged: true },
      { testName: 'Hb',  value: '14', unit: 'g/dL',   referenceRange: '13.5-17.5', flagged: false },
    ],
    updatedAt: new Date(),
  },
];

const mockHighRisk = [
  { _id: 'mr1', patient: { fullName: 'Alice' }, aiRiskScore: 88, followUpDate: new Date(Date.now() - 3 * 86_400_000) },
];

// ── Admin stats ───────────────────────────────────────────────────────────────
describe('getDashboardStats — admin role', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Patient.countDocuments.mockResolvedValue(100);
    Appointment.countDocuments.mockResolvedValue(12);
    Appointment.aggregate.mockResolvedValue(rawApptAgg);

    Invoice.aggregate
      .mockResolvedValueOnce([{ _id: null, total: 75000 }])  // revenueCollected
      .mockResolvedValueOnce([{ _id: null, total: 12000 }]); // overdueAmount

    Ward.aggregate.mockResolvedValue(rawBedAgg);

    Invoice.find.mockReturnValue(chain(mockOverdueInvoices));
    LabOrder.find.mockReturnValue(chain(mockFlaggedLabs));
    MedicalRecord.find.mockReturnValue(chain(mockHighRisk));
  });

  it('returns 200 with all admin stats keys', async () => {
    const req = { user: adminUser };
    const r = res();
    await getDashboardStats(req, r);

    expect(r.status).not.toHaveBeenCalledWith(500);
    const body = r.json.mock.calls[0][0];
    expect(body).toHaveProperty('totalPatients');
    expect(body).toHaveProperty('todayAppointments');
    expect(body).toHaveProperty('revenueCollected');
    expect(body).toHaveProperty('overdueAmount');
    expect(body).toHaveProperty('appointmentsByStatus');
    expect(body).toHaveProperty('bedOccupancy');
    expect(body).toHaveProperty('recentOverdueInvoices');
    expect(body).toHaveProperty('flaggedLabResults');
    expect(body).toHaveProperty('highRiskFollowUps');
  });

  it('totalPatients is the patient count', async () => {
    await getDashboardStats({ user: adminUser }, res());
    expect(Patient.countDocuments).toHaveBeenCalledWith({});
  });

  it('revenueCollected sums paid invoices', async () => {
    const r = res();
    await getDashboardStats({ user: adminUser }, r);
    expect(Invoice.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ $match: { status: 'paid' } })])
    );
  });

  it('overdueAmount sums overdue invoices', async () => {
    const r = res();
    await getDashboardStats({ user: adminUser }, r);
    expect(Invoice.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ $match: { status: 'overdue' } })])
    );
  });

  it('pivots appointment aggregation into chart-ready format', async () => {
    const r = res();
    await getDashboardStats({ user: adminUser }, r);
    const { appointmentsByStatus } = r.json.mock.calls[0][0];
    expect(Array.isArray(appointmentsByStatus)).toBe(true);
    // Each element should have a date string and status count keys
    appointmentsByStatus.forEach((row) => {
      expect(row).toHaveProperty('date');
    });
  });

  it('normalises bedOccupancy to { name, value } pairs', async () => {
    const r = res();
    await getDashboardStats({ user: adminUser }, r);
    const { bedOccupancy } = r.json.mock.calls[0][0];
    expect(bedOccupancy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: expect.any(String), value: expect.any(Number) }),
      ])
    );
  });

  it('appends daysOverdue to each overdue invoice', async () => {
    const r = res();
    await getDashboardStats({ user: adminUser }, r);
    const { recentOverdueInvoices } = r.json.mock.calls[0][0];
    recentOverdueInvoices.forEach((inv) => {
      expect(inv).toHaveProperty('daysOverdue');
      expect(typeof inv.daysOverdue).toBe('number');
      expect(inv.daysOverdue).toBeGreaterThanOrEqual(0);
    });
  });

  it('filters flaggedResults to only flagged=true rows', async () => {
    const r = res();
    await getDashboardStats({ user: adminUser }, r);
    const { flaggedLabResults } = r.json.mock.calls[0][0];
    flaggedLabResults.forEach((order) => {
      order.flaggedResults.forEach((result) => {
        expect(result.flagged).toBe(true);
      });
    });
  });

  it('queries high-risk records with aiRiskScore > 75', async () => {
    await getDashboardStats({ user: adminUser }, res());
    expect(MedicalRecord.find).toHaveBeenCalledWith(
      expect.objectContaining({ aiRiskScore: { $gt: 75 } })
    );
  });

  it('returns 500 when any aggregation throws', async () => {
    Patient.countDocuments.mockRejectedValue(new Error('DB fail'));
    const r = res();
    await getDashboardStats({ user: adminUser }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── Doctor stats ──────────────────────────────────────────────────────────────
describe('getDashboardStats — doctor role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Appointment.countDocuments.mockResolvedValue(5);
    LabOrder.countDocuments.mockResolvedValue(3);
    Prescription.countDocuments.mockResolvedValue(8);
    LabOrder.find.mockReturnValue(chain(mockFlaggedLabs));
    MedicalRecord.find.mockReturnValue(chain([]));
  });

  it('returns 200 with doctor-specific keys', async () => {
    const r = res();
    await getDashboardStats({ user: doctorUser }, r);

    const body = r.json.mock.calls[0][0];
    expect(body).toHaveProperty('todayCount');
    expect(body).toHaveProperty('pendingLabCount');
    expect(body).toHaveProperty('activeRxCount');
    expect(body).toHaveProperty('flaggedLabs');
    expect(body).toHaveProperty('overdueFollowUps');
  });

  it('does NOT include admin-only keys', async () => {
    const r = res();
    await getDashboardStats({ user: doctorUser }, r);
    const body = r.json.mock.calls[0][0];
    expect(body).not.toHaveProperty('totalPatients');
    expect(body).not.toHaveProperty('bedOccupancy');
  });

  it('scopes appointment count to the doctor\'s own userId', async () => {
    await getDashboardStats({ user: doctorUser }, res());
    expect(Appointment.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ doctor: doctorUser._id })
    );
  });

  it('scopes pending lab count to the doctor\'s own userId', async () => {
    await getDashboardStats({ user: doctorUser }, res());
    expect(LabOrder.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ doctor: doctorUser._id })
    );
  });

  it('counts only ordered/in-progress lab orders as pending', async () => {
    await getDashboardStats({ user: doctorUser }, res());
    expect(LabOrder.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $in: ['ordered', 'in-progress'] } })
    );
  });

  it('scopes active prescription count to the doctor', async () => {
    await getDashboardStats({ user: doctorUser }, res());
    expect(Prescription.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ doctor: doctorUser._id, status: 'active' })
    );
  });

  it('filters flagged labs to only flagged=true results', async () => {
    const r = res();
    await getDashboardStats({ user: doctorUser }, r);
    const { flaggedLabs } = r.json.mock.calls[0][0];
    flaggedLabs.forEach((order) => {
      order.flaggedResults.forEach((result) => {
        expect(result.flagged).toBe(true);
      });
    });
  });

  it('queries overdue follow-ups with followUpDate in the past', async () => {
    await getDashboardStats({ user: doctorUser }, res());
    const findArg = MedicalRecord.find.mock.calls[0][0];
    expect(findArg.followUpDate.$lt).toBeDefined();
    expect(findArg.followUpDate.$lt).toBeInstanceOf(Date);
  });

  it('returns 500 on DB error', async () => {
    Appointment.countDocuments.mockRejectedValue(new Error('fail'));
    const r = res();
    await getDashboardStats({ user: doctorUser }, r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── Admin via secondaryRole ───────────────────────────────────────────────────
describe('getDashboardStats — admin via secondaryRole', () => {
  it('treats user with secondaryRole=admin like an admin', async () => {
    vi.clearAllMocks();
    const adminViaSecondary = { _id: 'doc2', role: 'doctor', secondaryRoles: ['admin'] };

    Patient.countDocuments.mockResolvedValue(50);
    Appointment.countDocuments.mockResolvedValue(5);
    Appointment.aggregate.mockResolvedValue([]);
    Invoice.aggregate.mockResolvedValue([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    Ward.aggregate.mockResolvedValue([]);
    Invoice.find.mockReturnValue(chain([]));
    LabOrder.find.mockReturnValue(chain([]));
    MedicalRecord.find.mockReturnValue(chain([]));

    const r = res();
    await getDashboardStats({ user: adminViaSecondary }, r);
    const body = r.json.mock.calls[0][0];
    expect(body).toHaveProperty('totalPatients');
  });
});

// ── Other roles ───────────────────────────────────────────────────────────────
describe('getDashboardStats — other roles', () => {
  it('returns empty object for nurse', async () => {
    const r = res();
    await getDashboardStats({ user: nurseUser }, r);
    expect(r.json).toHaveBeenCalledWith({});
  });

  it('returns empty object for receptionist', async () => {
    const r = res();
    await getDashboardStats({ user: { _id: 'r1', role: 'receptionist', secondaryRoles: [] } }, r);
    expect(r.json).toHaveBeenCalledWith({});
  });

  it('returns empty object for lab_tech', async () => {
    const r = res();
    await getDashboardStats({ user: { _id: 'lt1', role: 'lab_tech', secondaryRoles: [] } }, r);
    expect(r.json).toHaveBeenCalledWith({});
  });

  it('returns empty object for patient', async () => {
    const r = res();
    await getDashboardStats({ user: { _id: 'pt1', role: 'patient', secondaryRoles: [] } }, r);
    expect(r.json).toHaveBeenCalledWith({});
  });
});
