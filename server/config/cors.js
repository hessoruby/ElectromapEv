const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

// Read on each call: modules loaded before dotenv runs would otherwise capture undefined.
const getConfiguredOrigins = () =>
  String(process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const isOriginAllowed = (origin) =>
  !origin ||
  DEFAULT_DEV_ORIGINS.includes(origin) ||
  getConfiguredOrigins().includes(origin) ||
  LOCAL_DEV_ORIGIN.test(origin);

const corsOriginCallback = (label) => (origin, callback) => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin not allowed by ${label}`));
};

module.exports = { isOriginAllowed, corsOriginCallback };
