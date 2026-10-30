import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
const jwt = require('jsonwebtoken');
const {
  validateJwtSecret,
  getJwtSecret,
  assertProductionJwtSecret,
  signUserToken,
  sign2FaChallengeToken,
  signToken,
  verifyToken,
  MIN_SECRET_LENGTH,
  DEV_FALLBACK_SECRET
} = require('./jwt-config');

describe('Aurum Production JWT Security & Deployment Audit Test Suite', () => {
  const originalEnv = process.env;
  const SECURE_TEST_SECRET = 'a'.repeat(64); // 64-character high-entropy test secret
  const ALT_SECURE_SECRET = 'b'.repeat(64);

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // --------------------------------------------------------------------------
  // TEST 1: Missing JWT_SECRET in production
  // --------------------------------------------------------------------------
  describe('1. Missing JWT_SECRET', () => {
    it('should reject undefined secret in production mode', () => {
      const result = validateJwtSecret(undefined, 'production');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('MISSING');
      expect(result.message).toContain('not defined');
    });

    it('should throw ERR_INSECURE_JWT_SECRET when getJwtSecret() is called without JWT_SECRET in production', () => {
      delete process.env['JWT_SECRET'];
      expect(() => getJwtSecret('production', undefined)).toThrowError(
        /In production mode, JWT_SECRET must be configured with a secure random secret/
      );
    });
  });

  // --------------------------------------------------------------------------
  // TEST 2: Empty JWT_SECRET in production
  // --------------------------------------------------------------------------
  describe('2. Empty JWT_SECRET', () => {
    it('should reject empty string secret in production mode', () => {
      const result = validateJwtSecret('', 'production');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('EMPTY');
    });

    it('should reject whitespace-only secret in production mode', () => {
      const result = validateJwtSecret('    \t\n  ', 'production');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('EMPTY');
    });

    it('should throw when getJwtSecret() receives empty string in production', () => {
      expect(() => getJwtSecret('production', '')).toThrowError(
        /In production mode, JWT_SECRET must be configured with a secure random secret/
      );
    });
  });

  // --------------------------------------------------------------------------
  // TEST 3: Placeholder and Insecure JWT_SECRET
  // --------------------------------------------------------------------------
  describe('3. Placeholder & Insecure JWT_SECRET Rejection', () => {
    const knownPlaceholders = [
      'replace_with_a_secure_random_secret',
      'dev-insecure-secret-change-me',
      'your-production-jwt-secret-at-least-32-chars',
      'your-production-jwt-secret',
      'change-me',
      'changeme',
      'secret',
      'jwt-secret',
      'supersecret',
      '12345678',
      'default'
    ];

    knownPlaceholders.forEach((placeholder) => {
      it(`should reject known insecure placeholder: "${placeholder}"`, () => {
        const result = validateJwtSecret(placeholder, 'production');
        expect(result.valid).toBe(false);
        expect(['KNOWN_INSECURE_PLACEHOLDER', 'PLACEHOLDER_PATTERN_MATCH', 'INSUFFICIENT_LENGTH']).toContain(result.reason);
      });

      it(`should throw on placeholder "${placeholder}" in production getJwtSecret()`, () => {
        expect(() => getJwtSecret('production', placeholder)).toThrowError(
          /In production mode, JWT_SECRET must be configured with a secure random secret/
        );
      });
    });

    it('should reject secrets shorter than MIN_SECRET_LENGTH (32 chars) in production', () => {
      const shortSecret = 'short-key-only-24-chars!';
      expect(shortSecret.length).toBeLessThan(MIN_SECRET_LENGTH);

      const result = validateJwtSecret(shortSecret, 'production');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INSUFFICIENT_LENGTH');
      expect(result.message).toContain('at least 32 characters');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 4: Valid Secure JWT_SECRET
  // --------------------------------------------------------------------------
  describe('4. Valid Secure JWT_SECRET Acceptance', () => {
    it('should accept a 32-character random string in production', () => {
      const secret32 = 'x8F9a2B7c4D1e6F0g3H5j7K9m1N3p5Q7';
      expect(secret32.length).toBe(32);
      const result = validateJwtSecret(secret32, 'production');
      expect(result.valid).toBe(true);
    });

    it('should accept a 64-byte hex string (128 chars) generated via crypto', () => {
      const hexSecret128 = 'a'.repeat(128);
      expect(hexSecret128.length).toBe(128);
      const result = validateJwtSecret(hexSecret128, 'production');
      expect(result.valid).toBe(true);
    });

    it('should return the candidate secret cleanly when valid in production', () => {
      const resolved = getJwtSecret('production', SECURE_TEST_SECRET);
      expect(resolved).toBe(SECURE_TEST_SECRET);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 5: JWT Signing with Configured Secret
  // --------------------------------------------------------------------------
  describe('5. JWT Signing Operations', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = SECURE_TEST_SECRET;
    });

    it('should sign user authentication token with subject claim', () => {
      const token = signUserToken('user-uuid-9912');
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);

      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe('user-uuid-9912');
      expect(decoded.exp).toBeDefined();
    });

    it('should sign 2FA challenge token with is2FaChallenge flag and 5m expiration', () => {
      const token = sign2FaChallengeToken('user-2fa-101');
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe('user-2fa-101');
      expect(decoded.is2FaChallenge).toBe(true);
      // 5 minutes expiry check: exp - iat should equal 300 seconds
      expect(decoded.exp - decoded.iat).toBe(300);
    });

    it('should sign arbitrary payload with custom options', () => {
      const token = signToken({ role: 'admin', scope: 'portfolio:read' }, { expiresIn: '1h' });
      const decoded = jwt.decode(token);
      expect(decoded.role).toBe('admin');
      expect(decoded.scope).toBe('portfolio:read');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 6: JWT Verification with Same Secret
  // --------------------------------------------------------------------------
  describe('6. JWT Verification Operations', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = SECURE_TEST_SECRET;
    });

    it('should successfully verify and decode a token signed with the configured secret', () => {
      const token = signUserToken('user-verified-88');
      const verified = verifyToken(token);
      expect(verified.sub).toBe('user-verified-88');
    });

    it('should verify 2FA challenge token correctly', () => {
      const token = sign2FaChallengeToken('user-challenge-42');
      const verified = verifyToken(token);
      expect(verified.sub).toBe('user-challenge-42');
      expect(verified.is2FaChallenge).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 7: Invalid Token Rejection
  // --------------------------------------------------------------------------
  describe('7. Invalid Token Rejection', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = SECURE_TEST_SECRET;
    });

    it('should reject a token tampered with an altered payload or signature', () => {
      const token = signUserToken('legitimate-user');
      const parts = token.split('.');
      // Tamper signature by replacing last 4 characters
      const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -4)}XXXX`;

      expect(() => verifyToken(tampered)).toThrowError();
    });

    it('should reject a token signed with a different secret', () => {
      const foreignToken = jwt.sign({ sub: 'user-foreign' }, ALT_SECURE_SECRET, { expiresIn: '1h' });
      expect(() => verifyToken(foreignToken)).toThrowError(/invalid signature/);
    });

    it('should reject an expired token', () => {
      const expiredToken = jwt.sign({ sub: 'user-expired' }, SECURE_TEST_SECRET, { expiresIn: '-1s' });
      expect(() => verifyToken(expiredToken)).toThrowError(/jwt expired/);
    });

    it('should reject a completely malformed token string', () => {
      expect(() => verifyToken('not-a-valid-jwt')).toThrowError(/jwt malformed/);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 8: Production Startup Validation
  // --------------------------------------------------------------------------
  describe('8. Production Startup Validation (assertProductionJwtSecret)', () => {
    it('should trigger process.exit(1) and log fatal banner when JWT_SECRET is missing in production', () => {
      const mockExit = vi.fn();
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = assertProductionJwtSecret('production', undefined, mockExit);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(result).toBe(false);

      const loggedMessages = mockConsoleError.mock.calls.map(c => c[0]).join('\n');
      expect(loggedMessages).toContain('[FATAL] In production mode, JWT_SECRET must be configured with a secure random secret. Refusing insecure startup.');
      expect(loggedMessages).toContain('RAILWAY DEPLOYMENT ACTION REQUIRED');
      expect(loggedMessages).toContain('node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    });

    it('should trigger process.exit(1) when JWT_SECRET is a placeholder in production', () => {
      const mockExit = vi.fn();
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = assertProductionJwtSecret('production', 'replace_with_a_secure_random_secret', mockExit);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(result).toBe(false);
    });

    it('should succeed and return true when valid secret is provided in production', () => {
      const mockExit = vi.fn();
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = assertProductionJwtSecret('production', SECURE_TEST_SECRET, mockExit);

      expect(mockExit).not.toHaveBeenCalled();
      expect(result).toBe(true);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // TEST 9: Development Environment Configuration
  // --------------------------------------------------------------------------
  describe('9. Development Environment Configuration', () => {
    it('should fall back to development secret with warning when unset in development mode', () => {
      const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const secret = getJwtSecret('development', undefined);

      expect(secret).toBe(DEV_FALLBACK_SECRET);
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET not set')
      );
    });

    it('should use custom secret in development mode when provided', () => {
      const customSecret = 'my-custom-dev-secret-1234567890';
      const secret = getJwtSecret('development', customSecret);
      expect(secret).toBe(customSecret);
    });

    it('should not terminate process in development mode even if secret is empty', () => {
      const mockExit = vi.fn();
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = assertProductionJwtSecret('development', '', mockExit);

      expect(mockExit).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
