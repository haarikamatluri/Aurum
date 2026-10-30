import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';

const originalEnv = { ...process.env };
const TEST_SECRET = 'c'.repeat(64); // 64-character high-entropy secret
process.env['JWT_SECRET'] = TEST_SECRET;
process.env['NODE_ENV'] = 'production';

const app = require('../../../server.js');
const jwtConfig = require('./jwt-config');

describe('Aurum Authentication Routes & Protected Endpoints Integration', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    process.env = originalEnv;
  });

  it('Health endpoint: GET /health returns 200 and healthy status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  it('Health endpoint: GET /api/health returns 200 and healthy status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  it('Protected endpoint: GET /api/auth/me returns 401 when no token is provided', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Not authenticated');
  });

  it('Protected endpoint: GET /api/auth/me returns 401 when invalid token is provided', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: 'Bearer invalid-garbage-token.signature'
      }
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Invalid or expired session');
  });

  it('Authentication lifecycle: Signup -> Login -> Access /api/auth/me -> Logout', async () => {
    const testEmail = `audit-${Date.now()}@aurum-finance.internal`;
    const testPassword = 'SecurePassword123!';
    const testName = 'Audit Officer';

    // 1. Signup
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword, name: testName })
    });
    expect(signupRes.status).toBe(201);
    const signupBody = await signupRes.json();
    expect(signupBody.success).toBe(true);
    expect(signupBody.user.email).toBe(testEmail);

    // 2. Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.user.email).toBe(testEmail);

    // Verify Set-Cookie header contains token
    const cookieHeader = loginRes.headers.get('set-cookie');
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain('token=');

    // Extract token from cookie for header-based Bearer test
    const match = cookieHeader?.match(/token=([^;]+)/);
    const token = match ? match[1] : '';
    expect(token).toBeTruthy();

    // 3. Verify that the token is valid according to canonical jwtConfig
    const decoded = jwtConfig.verifyToken(token);
    expect(decoded.sub).toBe(signupBody.user.id);

    // 4. Access protected route /api/auth/me using Bearer header
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.id).toBe(signupBody.user.id);
    expect(meBody.user.email).toBe(testEmail);

    // 5. Logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST'
    });
    expect(logoutRes.status).toBe(200);
    const logoutBody = await logoutRes.json();
    expect(logoutBody.success).toBe(true);
  });
});
