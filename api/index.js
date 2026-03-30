import 'dotenv/config';

let app;
let connected = false;

async function init() {
  const [{ default: connectDB }, { default: expressApp }] = await Promise.all([
    import('../server/src/config/db.js'),
    import('../server/src/app.js'),
  ]);
  if (!connected) {
    await connectDB();
    connected = true;
  }
  app = expressApp;
}

export default async function handler(req, res) {
  try {
    if (!app) await init();
    return app(req, res);
  } catch (err) {
    console.error('[api/index] boot error:', err);
    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 5) });
  }
}
