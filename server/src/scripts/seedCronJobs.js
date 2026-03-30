/**
 * Cron job registration
 * Registers scheduled background tasks using node-cron.
 * Called once during server startup (in index.js after the DB connects).
 *
 * Jobs registered:
 *   1. Appointment reminders — daily at 08:00
 *      Finds appointments scheduled for tomorrow that are confirmed and haven't
 *      had a reminder sent, emails the patient, then sets reminderSent = true
 *      to prevent sending a duplicate on the next day's run.
 *
 *   2. Invoice overdue transition — every hour on the hour
 *      Finds invoices with status='sent' whose dueDate has passed and bulk-updates
 *      them to status='overdue'. This runs in bulk (updateMany) for efficiency
 *      rather than fetching and updating individually.
 *
 * Cron syntax: 'minute hour day-of-month month day-of-week'
 *   '0 8 * * *'  = 08:00 every day
 *   '0 * * * *'  = top of every hour
 */
import cron from 'node-cron';
import Appointment from '../models/Appointment.js';
import transporter from '../config/email.js';

/**
 * Registers all cron jobs with node-cron.
 * Must be called after connectDB() so the Mongoose models are ready.
 */
export function registerCronJobs() {

  // ── Job 1: Appointment reminder emails — daily at 08:00 ────────────────
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Running appointment reminder job');
    try {
      // Build a date range covering all of tomorrow (midnight to 23:59:59)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const start = new Date(tomorrow.setHours(0, 0, 0, 0));
      const end = new Date(tomorrow.setHours(23, 59, 59, 999));

      // Find confirmed appointments for tomorrow that haven't had a reminder sent
      const appts = await Appointment.find({
        scheduledAt: { $gte: start, $lte: end },
        status: 'confirmed',
        reminderSent: false,
      }).populate('patient', 'fullName contactInfo');

      for (const appt of appts) {
        const email = appt.patient?.contactInfo?.email;
        if (!email) continue; // skip patients without an email address on file

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Appointment Reminder — MediCore General Hospital',
          text: `Dear ${appt.patient.fullName},\n\nThis is a reminder of your appointment tomorrow at ${appt.scheduledAt.toLocaleTimeString()}.\n\nPlease arrive 10 minutes early.\n\nMediCore General Hospital`,
        });

        // Mark as sent so the cron doesn't email again tomorrow
        appt.reminderSent = true;
        await appt.save();
      }

      console.log(`[CRON] Sent ${appts.length} reminders`);
    } catch (err) {
      console.error('[CRON] Reminder job error:', err.message);
    }
  });

  // ── Job 2: Mark overdue invoices — every hour ───────────────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      // Dynamic import avoids circular dependency issues at module load time
      const InvoiceModel = (await import('../models/Invoice.js')).default;

      // Bulk update: all sent invoices past their due date become overdue
      const { modifiedCount } = await InvoiceModel.updateMany(
        { status: 'sent', dueDate: { $lt: new Date() } },
        { $set: { status: 'overdue' } }
      );

      if (modifiedCount) {
        console.log(`[CRON] Marked ${modifiedCount} invoices as overdue`);
      }
    } catch (err) {
      console.error('[CRON] Invoice overdue job error:', err.message);
    }
  });
}
