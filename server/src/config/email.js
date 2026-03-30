/**
 * Nodemailer transporter singleton
 * Configures a reusable SMTP transporter using Gmail credentials from env vars.
 * Used by the cron job in seedCronJobs.js to send appointment reminder emails.
 *
 * For production, replace the Gmail service with a dedicated provider
 * (e.g. SendGrid, SES) by swapping the transport config here.
 */
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use a Gmail App Password, not your account password
  },
});

export default transporter;
