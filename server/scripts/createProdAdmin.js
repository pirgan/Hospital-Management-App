/**
 * Creates the production admin/doctor account.
 * Safe to re-run — skips creation if the email already exists.
 *
 * Run: node scripts/createProdAdmin.js
 *
 * Credentials created:
 *   Email:    admin@medicore.hospital
 *   Password: MediCore2024!
 *   Role:     admin  +  secondaryRoles: [doctor]
 */
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('Connected to:', mongoose.connection.host);

  const EMAIL = 'admin@medicore.hospital';
  const existing = await User.findOne({ email: EMAIL });

  if (existing) {
    // Ensure roles are correct even if user was created earlier without them
    existing.role = 'admin';
    existing.secondaryRoles = ['doctor'];
    await existing.save();
    console.log(`User already exists — roles refreshed: ${EMAIL}`);
  } else {
    await User.create({
      name: 'Danko Pirgan',
      email: EMAIL,
      password: 'MediCore2024!',
      role: 'admin',
      secondaryRoles: ['doctor'],
      department: 'General Practice',
    });
    console.log(`Created admin/doctor user: ${EMAIL}`);
  }

  console.log('\nLogin credentials:');
  console.log('  Email:    admin@medicore.hospital');
  console.log('  Password: MediCore2024!');

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
