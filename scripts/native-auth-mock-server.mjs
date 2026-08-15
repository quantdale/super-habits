#!/usr/bin/env node
/**
 * Minimal deterministic Supabase-Auth mock for the NATIVE auth-persistence
 * lane (no real Supabase credentials are available in this environment).
 *
 * Serves exactly the Auth REST surface supabase-js uses on Android/iOS:
 * anonymous signup, user fetch, token refresh, logout, email-change (PATCH),
 * OTP request, OTP verify, plus empty owner-scoped REST probes for restore
 * previews. It never emails anyone: the OTP is always `123456`.
 *
 * Diagnostics are printed as `[mock]` lines WITHOUT tokens — only event types,
 * user ids, and counts. The journey asserts:
 *  - exactly ONE anonymous signup across app launches (session restored, no
 *    second anonymous user),
 *  - relaunch `/user` calls authenticate with the session issued at launch 1
 *    (same UID restored),
 *  - protection verify returns the SAME user id with is_anonymous=false.
 *
 * Usage: node scripts/native-auth-mock-server.mjs [port]
 */
import { createServer } from 'node:http';

const PORT = Number(process.argv[2] ?? 4545);
const ANON_USER = {
  id: '00000000-0000-0000-0000-00000000ca1a', // synthetic, never a real account
  aud: 'authenticated',
  role: 'authenticated',
  email: null,
  is_anonymous: true,
};

const CORS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'content-range',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS',
};

let user = { ...ANON_USER };
const issuedTokens = new Map(); // token -> userId
let signupCount = 0;
let userCheckCount = 0;
let userCheckAuthedCount = 0;
let refreshCount = 0;
let verifyCount = 0;
let otpRequestCount = 0;
let logoutCount = 0;

function sessionFor(currentUser, tokenType) {
  const accessToken = `mock-access-${tokenType}-${Math.random().toString(36).slice(2)}`;
  const refreshToken = `mock-refresh-${Math.random().toString(36).slice(2)}`;
  issuedTokens.set(accessToken, currentUser.id);
  issuedTokens.set(refreshToken, currentUser.id);
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: refreshToken,
    user: currentUser,
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const json = (status, body) => {
    res.writeHead(status, CORS);
    res.end(JSON.stringify(body));
  };

  if (path === '/auth/v1/signup' && method === 'POST') {
    signupCount += 1;
    console.log(`[mock] signup count=${signupCount} user=${user.id}`);
    json(200, sessionFor(user, 'anon'));
    return;
  }

  if (path === '/auth/v1/user' && method === 'GET') {
    userCheckCount += 1;
    if (!token || !issuedTokens.has(token)) {
      console.log(`[mock] user-check UNAUTHENTICATED (${userCheckCount})`);
      json(401, { message: 'Auth session missing' });
      return;
    }
    userCheckAuthedCount += 1;
    console.log(`[mock] user-check authed=${userCheckAuthedCount} user=${user.id}`);
    json(200, user);
    return;
  }

  if (path === '/auth/v1/user' && method === 'PATCH') {
    const body = await readBody(req);
    if (typeof body.email === 'string' && body.email.length > 0) {
      user.pending_email = body.email;
      console.log(`[mock] email-change requested for ${body.email} user=${user.id}`);
    }
    json(200, user);
    return;
  }

  if (path === '/auth/v1/verify' && method === 'POST') {
    const body = await readBody(req);
    verifyCount += 1;
    if (body.token !== '123456') {
      console.log(`[mock] verify REJECTED (bad token) type=${body.type ?? '?'}`);
      json(400, { message: 'Invalid or expired OTP' });
      return;
    }
    if (body.type === 'email_change') {
      user = {
        ...user,
        email: user.pending_email ?? body.email ?? 'canary@example.test',
        pending_email: undefined,
        is_anonymous: false,
      };
      console.log(`[mock] verify email_change -> permanent user=${user.id}`);
    } else {
      console.log(`[mock] verify type=${body.type} user=${user.id}`);
    }
    json(200, sessionFor(user, 'verify'));
    return;
  }

  if (path === '/auth/v1/otp' && method === 'POST') {
    const body = await readBody(req);
    otpRequestCount += 1;
    console.log(
      `[mock] otp requested email=${body.email ?? '?'} shouldCreateUser=${body.options?.shouldCreateUser ?? '?'} count=${otpRequestCount}`,
    );
    json(200, {});
    return;
  }

  if (path === '/auth/v1/token' && method === 'POST') {
    const body = await readBody(req);
    refreshCount += 1;
    if (body.grant_type === 'refresh_token' && issuedTokens.has(String(body.refresh_token ?? ''))) {
      console.log(`[mock] token refresh ok count=${refreshCount} user=${user.id}`);
      json(200, sessionFor(user, 'refresh'));
      return;
    }
    console.log(`[mock] token refresh REJECTED count=${refreshCount}`);
    json(400, { message: 'invalid grant' });
    return;
  }

  if (path === '/auth/v1/logout' && method === 'POST') {
    logoutCount += 1;
    console.log(`[mock] logout count=${logoutCount}`);
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (path.startsWith('/auth/v1/')) {
    json(200, {});
    return;
  }

  if (path.startsWith('/rest/v1/')) {
    // Owner-scoped restore/backup probes: empty dataset.
    json(200, []);
    return;
  }

  json(404, { message: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[mock] native auth mock listening on :${PORT} (user ${user.id})`);
});
