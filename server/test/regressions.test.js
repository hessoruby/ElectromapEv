// Regression tests use a local HTTP server and mock external services.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('Demo seeding requires explicit acknowledgement before reading configuration', () => {
  const script = path.join(__dirname, '../seeds/seedStations.js');
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    timeout: 3000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://127.0.0.1:9/electromap_guard_test?serverSelectionTimeoutMS=250',
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--reset-demo-data/);
});

delete process.env.CLIENT_URL;
delete process.env.CLOUDINARY_CLOUD_NAME;
delete process.env.CLOUDINARY_API_KEY;
delete process.env.CLOUDINARY_API_SECRET;

const app = require('../app');
const Charger = require('../models/Charger');
const Station = require('../models/Station');
const User = require('../models/User');
const { updateProfile } = require('../controllers/authController');
const { parsePagination } = require('../utils/pagination');
const { isOriginAllowed } = require('../config/cors');
const { cloudinary, uploadBufferToCloudinary } = require('../config/cloudinary');

let server;
let port;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});

test.after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const request = (method, path, { headers = {}, body } = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: { 'content-type': 'application/json', ...headers },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: raw }));
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });

const mockResponse = () => {
  const res = { statusCode: 200, payload: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.payload = payload;
    return res;
  };
  return res;
};

test('Charger pre-save hook runs under Mongoose 9 and stamps lastUpdated', async () => {
  const charger = new Charger({ stationId: '507f1f77bcf86cd799439011' });
  charger.lastUpdated = new Date(0);
  await Charger.schema.s.hooks.execPre('save', charger, [{}]);
  assert.ok(charger.lastUpdated.getTime() > 0);
});

test('Station pre-save hook runs under Mongoose 9 and stamps updatedAt', async () => {
  const station = new Station({});
  station.updatedAt = new Date(0);
  await Station.schema.s.hooks.execPre('save', station, [{}]);
  assert.ok(station.updatedAt.getTime() > 0);
});

test('CORS reads CLIENT_URL at request time, after modules are loaded', async () => {
  const origin = 'https://electromap.example.com';
  assert.equal(isOriginAllowed(origin), false);

  process.env.CLIENT_URL = `https://other.example.com, ${origin}`;
  try {
    assert.equal(isOriginAllowed(origin), true);
    const res = await request('GET', '/api/health', { headers: { origin } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], origin);
  } finally {
    delete process.env.CLIENT_URL;
  }
});

test('CORS still allows local dev origins and rejects unknown ones', () => {
  assert.equal(isOriginAllowed(undefined), true);
  assert.equal(isOriginAllowed('http://localhost:5173'), true);
  assert.equal(isOriginAllowed('http://127.0.0.1:4173'), true);
  assert.equal(isOriginAllowed('https://evil.example.com'), false);
});

test('Invalid login body returns 400 with field errors instead of 500', async () => {
  const res = await request('POST', '/api/auth/login', { body: { email: 'not-an-email' } });
  assert.equal(res.status, 400);
  const payload = JSON.parse(res.body);
  assert.equal(payload.success, false);
  assert.equal(payload.message, 'Validation failed');
  assert.ok(Array.isArray(payload.errors) && payload.errors.length > 0);
  assert.ok(payload.errors.every((item) => typeof item.path === 'string'));
});

test('Wrong current password returns 400 so the client does not log the user out', async (t) => {
  const fakeUser = { email: 'driver@example.com', comparePassword: async () => false };
  t.mock.method(User, 'findById', () => ({ select: async () => fakeUser }));

  const res = mockResponse();
  let forwardedError = null;
  await updateProfile(
    {
      user: { _id: '507f1f77bcf86cd799439011' },
      body: {
        currentPassword: 'WrongPass1',
        newPassword: 'NewPassword1',
        confirmPassword: 'NewPassword1',
      },
    },
    res,
    (error) => {
      forwardedError = error;
    },
  );

  assert.equal(forwardedError, null);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.message, 'Current password is incorrect');
});

test('Pagination falls back to defaults for non-numeric input', () => {
  assert.deepEqual(parsePagination({ page: 'abc', limit: 'xyz' }), { page: 1, limit: 20, skip: 0 });
  assert.deepEqual(parsePagination({}, { defaultLimit: 10 }), { page: 1, limit: 10, skip: 0 });
  assert.deepEqual(parsePagination({ page: '3', limit: '500' }), { page: 3, limit: 100, skip: 200 });
  assert.deepEqual(parsePagination({ page: '-4', limit: '0' }), { page: 1, limit: 1, skip: 0 });
});

test('Uploads fail with a clear 503 when Cloudinary is not configured', async () => {
  await assert.rejects(uploadBufferToCloudinary(Buffer.from('img'), 'test'), (error) => {
    assert.equal(error.statusCode, 503);
    return true;
  });
});

test('Uploads use Cloudinary credentials set after the module was loaded', async (t) => {
  process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  const configMock = t.mock.method(cloudinary, 'config', () => {});
  t.mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => ({
    end: () => callback(null, { secure_url: `https://res.example.com/${options.folder}/img.png` }),
  }));

  try {
    const url = await uploadBufferToCloudinary(Buffer.from('img'), 'electromap/avatars');
    assert.equal(url, 'https://res.example.com/electromap/avatars/img.png');
    assert.equal(configMock.mock.calls[0].arguments[0].cloud_name, 'demo-cloud');
  } finally {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  }
});
