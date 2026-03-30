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
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const PASSWORD = 'Admin1234!';
const EMAIL = 'admin@medicore.hospital';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('Connected to:', mongoose.connection.host);

  const db = mongoose.connection.db;
  const hash = await bcrypt.hash(PASSWORD, 12);
  const existing = await db.collection('users').findOne({ email: EMAIL });

  if (existing) {
    // Update roles and reset password directly — bypasses pre-save hook to avoid rehash bugs
    await db.collection('users').updateOne(
      { email: EMAIL },
      { $set: { role: 'admin', secondaryRoles: ['doctor'], password: hash } }
    );
    console.log(`Updated roles + password for: ${EMAIL}`);
  } else {
    await db.collection('users').insertOne({
      name: 'Danko Pirgan',
      email: EMAIL,
      password: hash,
      role: 'admin',
      secondaryRoles: ['doctor'],
      department: 'General Practice',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Created admin/doctor user: ${EMAIL}`);
  }

  console.log('\nLogin credentials:');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
