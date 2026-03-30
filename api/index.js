// Vercel injects all env vars directly into process.env — no dotenv needed here.
// Server deps are installed via: cd server && npm install (in vercel.json buildCommand)
import connectDB from '../server/src/config/db.js';
import app from '../server/src/app.js';

let connected = false;

export default async function handler(req, res) {
  try {
    if (!connected) {
      await connectDB();
      connected = true;
    }
    return app(req, res);
  } catch (err) {
    console.error('[api/index] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
