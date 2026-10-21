import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { createAuthRouter } from '../routes/auth.js';
import { createClerkAuth } from '../middleware/clerkAuth.js';

function makeUserModel(existingUser, shouldFail = false) {
  return class TestUserModel {
    static async findOne(query) {
      if (shouldFail) throw new Error('database lookup failed');
      return query.clerkId === existingUser.clerkId ? existingUser : null;
    }
  };
}

function invokeProfile(app, { authorization } = {}) {
  const req = Readable.from([]);
  req.method = 'GET';
  req.url = '/api/auth/profile';
  req.originalUrl = '/api/auth/profile';
  req.headers = { accept: 'application/json' };
  if (authorization) req.headers.authorization = authorization;
  req.httpVersion = '1.1';
  req.socket = { encrypted: false, remoteAddress: '127.0.0.1' };
  req.connection = req.socket;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timed out')), 3000);
    const complete = (result) => { clearTimeout(timeout); resolve(result); };
    let responseBody = '';
    const res = Object.create(app.response);
    res.app = app;
    res.req = req;
    res.locals = {};
    res.statusCode = 200;
    res.finished = false;
    res.headerStore = new Map();
    res.setHeader = (name, value) => res.headerStore.set(name.toLowerCase(), value);
    res.getHeader = (name) => res.headerStore.get(name.toLowerCase());
    res.hasHeader = (name) => res.headerStore.has(name.toLowerCase());
    res.removeHeader = (name) => res.headerStore.delete(name.toLowerCase());
    res.end = (chunk) => {
      if (chunk != null) responseBody += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      res.finished = true;
      res.emit('finish');
      complete({ status: res.statusCode, body: responseBody ? JSON.parse(responseBody) : null });
      return res;
    };
    res.write = () => true;
    try {
      app.handle(req, res, (error) => error ? reject(error) : complete({ status: res.statusCode, body: null }));
    } catch (error) { reject(error); }
  });
}

test('clerkAuth rejects requests with no Authorization header', async () => {
  const app = createApp({ authRouter: createAuthRouter({ auth: createClerkAuth() }), logRequests: false });
  const res = await invokeProfile(app);
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { message: 'Unauthorized' });
});

test('clerkAuth rejects malformed Bearer credentials', async () => {
  const app = createApp({ authRouter: createAuthRouter({ auth: createClerkAuth() }), logRequests: false });
  for (const authorization of ['Bearer', 'Bearer  ', 'Token abc']) {
    const res = await invokeProfile(app, { authorization });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { message: 'Unauthorized' });
  }
});

test('clerkAuth rejects an invalid Clerk JWT', async () => {
  const app = createApp({ authRouter: createAuthRouter({ auth: createClerkAuth() }), logRequests: false });
  const res = await invokeProfile(app, { authorization: 'Bearer not.a.valid.jwt' });
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { message: 'Unauthorized' });
});

test('clerkAuth verifies a valid Clerk JWT and populates the profile', async () => {
  const clerkId = 'user_clerkaudit_test';
  const user = { _id: 'owner_clerkaudit', clerkId, username: 'clerk-audit', email: 'audit@territoryrun.test' };
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwtKey = publicKey.export({ type: 'spki', format: 'pem' });

  const auth = createClerkAuth({ UserModel: makeUserModel(user), jwtKey });
  const app = createApp({ authRouter: createAuthRouter({ auth }), logRequests: false });

  const token = jwt.sign(
    { sub: clerkId, email: user.email, username: user.username, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 },
    privateKey, { algorithm: 'RS256', keyid: 'local' },
  );

  const res = await invokeProfile(app, { authorization: `Bearer ${token}` });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.id, clerkId);
  assert.equal(res.body.user.username, user.username);
  assert.equal(res.body.user.email, user.email);
  assert.equal(res.body.user._id, user._id);
});

test('clerkAuth distinguishes downstream profile lookup failures with a 500', async () => {
  // Stub verification so this test isolates the downstream database lookup,
  // independent of the cross-test JWK cache used by the local jwtKey path.
  const auth = createClerkAuth({
    UserModel: makeUserModel(null, true),
    verifyToken: async () => ({ sub: 'user_downstream_test', email: '', username: 'downstream' }),
  });
  const app = createApp({ authRouter: createAuthRouter({ auth }), logRequests: false });

  const res = await invokeProfile(app, { authorization: 'Bearer any.token.here' });
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { message: 'Failed to fetch profile' });
});
