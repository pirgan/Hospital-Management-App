/**
 * One-off script: set primary role admin + secondary doctor for Danko Pirgan.
 * Run from server folder: node scripts/setDankoRoles.js
 * Requires MONGODB_URI in server/.env — log out and back in so the client picks up secondaryRoles.
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
  if (!uri) {
    console.error('MONGODB_URI is not set in server/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const found = await User.findOne({
    $or: [
      { name: /danko.*pirgan|pirgan.*danko/i },
      { name: /^Danko Pirgan$/i },
      { email: /danko\.pirgan/i },
    ],
  });

  if (!found) {
    console.error('No user found matching Danko Pirgan. Create the account first or adjust the query in this script.');
    await mongoose.disconnect();
    process.exit(1);
  }

  found.role = 'admin';
  found.secondaryRoles = ['doctor'];
  await found.save();

  console.log('Updated user:', found.email, '| role:', found.role, '| secondaryRoles:', found.secondaryRoles);
  console.log('Log out and log in again so the browser receives the updated profile.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
