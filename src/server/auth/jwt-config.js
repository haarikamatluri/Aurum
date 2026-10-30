/**
 * Aurum Financial Intelligence — Canonical JWT Configuration & Validation Engine
 * 
 * Provides unified secret resolution, security policy enforcement, token signing,
 * and token verification across development and production environments.
 * 
 * SECURITY RULES:
 * 1. In production (NODE_ENV === 'production'), a secure, high-entropy JWT_SECRET (>= 32 chars)
 *    is strictly mandatory.
 * 2. Insecure placeholders, default strings, and short keys are refused with exit code 1.
 * 3. Never silently generate an ephemeral random secret at production startup:
 *    ephemeral keys invalidate user sessions upon container restart and break multi-instance deployments.
 * 4. Never commit or log the actual secret value.
 */

const jwt = require('jsonwebtoken');

const MIN_SECRET_LENGTH = 32;
const DEV_FALLBACK_SECRET = 'dev-insecure-secret-change-me';

// Known insecure defaults, repository placeholders, and documentation strings
const KNOWN_INSECURE_SECRETS = new Set([
  'dev-insecure-secret-change-me',
  'replace_with_a_secure_random_secret',
  'your-production-jwt-secret-at-least-32-chars',
  'your-production-jwt-secret',
  'your-jwt-secret',
  'change-me',
  'changeme',
  'secret',
  'jwt-secret',
  'supersecret',
  'super-secret',
  'password',
  '12345678',
  'default',
  'default-secret'
]);

// Patterns matching common documentation placeholders
const PLACEHOLDER_PATTERNS = [
  /^replace_with_/i,
  /^your-.*-secret/i,
  /^change-?me/i
];

/**
 * Validates whether a candidate secret meets security requirements.
 * 
 * @param {string|undefined|null} secret - The secret candidate to validate.
 * @param {string} [nodeEnv=process.env.NODE_ENV] - Current NODE_ENV ('production' | 'development' | 'test').
 * @returns {{ valid: boolean, reason?: string, message?: string }}
 */
function validateJwtSecret(secret, nodeEnv = process.env.NODE_ENV) {
  const isProduction = nodeEnv === 'production';

  if (secret === undefined || secret === null) {
    return {
      valid: false,
      reason: 'MISSING',
      message: 'JWT_SECRET environment variable is not defined.'
    };
  }

  if (typeof secret !== 'string') {
    return {
      valid: false,
      reason: 'INVALID_TYPE',
      message: `JWT_SECRET must be a string, received ${typeof secret}.`
    };
  }

  const trimmed = secret.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      reason: 'EMPTY',
      message: 'JWT_SECRET environment variable is empty or whitespace-only.'
    };
  }

  const lower = trimmed.toLowerCase();

  if (KNOWN_INSECURE_SECRETS.has(lower)) {
    return {
      valid: false,
      reason: 'KNOWN_INSECURE_PLACEHOLDER',
      message: `JWT_SECRET is set to a known insecure placeholder or default value ("${trimmed.slice(0, 10)}...").`
    };
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        reason: 'PLACEHOLDER_PATTERN_MATCH',
        message: `JWT_SECRET matches a known placeholder pattern ("${trimmed.slice(0, 10)}...").`
      };
    }
  }

  if (isProduction && trimmed.length < MIN_SECRET_LENGTH) {
    return {
      valid: false,
      reason: 'INSUFFICIENT_LENGTH',
      message: `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production (provided length: ${trimmed.length}).`
    };
  }

  return { valid: true };
}

/**
 * Resolves the canonical JWT secret according to the environment.
 * 
 * @param {string} [nodeEnv=process.env.NODE_ENV] - Current NODE_ENV.
 * @param {string} [envSecret=process.env.JWT_SECRET] - Candidate secret string.
 * @returns {string} The active JWT secret.
 * @throws {Error} If in production and secret is invalid.
 */
function getJwtSecret(nodeEnv = process.env.NODE_ENV, envSecret = process.env.JWT_SECRET) {
  const isProduction = nodeEnv === 'production';
  const candidate = (envSecret !== undefined && envSecret !== null) ? String(envSecret).trim() : '';

  const validation = validateJwtSecret(candidate, nodeEnv);

  if (isProduction) {
    if (!validation.valid) {
      const err = new Error(`[FATAL] In production mode, JWT_SECRET must be configured with a secure random secret. Refusing insecure startup. Reason: ${validation.message}`);
      err.code = 'ERR_INSECURE_JWT_SECRET';
      err.validationReason = validation.reason;
      throw err;
    }
    return candidate;
  }

  // Non-production (development / testing)
  if (validation.valid) {
    return candidate;
  }

  // Fallback with warning for local development convenience
  console.warn('[auth] JWT_SECRET not set or using insecure default — falling back to development secret. DO NOT USE IN PRODUCTION.');
  return DEV_FALLBACK_SECRET;
}

/**
 * Asserts valid JWT_SECRET configuration during server startup.
 * In production mode, if invalid, logs an actionable Railway diagnostic banner and exits with code 1.
 * 
 * @param {string} [nodeEnv=process.env.NODE_ENV] - Current NODE_ENV.
 * @param {string} [envSecret=process.env.JWT_SECRET] - Candidate secret string.
 * @param {Function} [exitFn=process.exit] - Exit handler (injected for testing).
 * @returns {boolean} True if validation passed or running in development fallback.
 */
function assertProductionJwtSecret(nodeEnv = process.env.NODE_ENV, envSecret = process.env.JWT_SECRET, exitFn = process.exit) {
  const isProduction = nodeEnv === 'production';
  const validation = validateJwtSecret(envSecret, nodeEnv);

  if (isProduction && !validation.valid) {
    console.error('');
    console.error('================================================================================');
    console.error('[FATAL] In production mode, JWT_SECRET must be configured with a secure random secret. Refusing insecure startup.');
    console.error('================================================================================');
    console.error(`DIAGNOSTIC REASON: ${validation.message}`);
    console.error('');
    console.error('RAILWAY DEPLOYMENT ACTION REQUIRED:');
    console.error('1. Generate a cryptographically secure 64-byte random hex secret on your local machine:');
    console.error('   node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    console.error('');
    console.error('2. Open the Railway Dashboard:');
    console.error('   - Navigate to your Aurum project.');
    console.error('   - Select your Backend Service.');
    console.error('   - Click the "Variables" tab.');
    console.error('   - Add or edit variable:');
    console.error('       Variable Name:  JWT_SECRET');
    console.error('       Variable Value: <paste the 128-hex-character output from step 1>');
    console.error('');
    console.error('3. Redeploy:');
    console.error('   - Railway will automatically redeploy the service once the variable is saved.');
    console.error('');
    console.error('SECURITY POLICY:');
    console.error('- Ephemeral in-memory secrets are intentionally NOT auto-generated on startup');
    console.error('  because they would immediately invalidate all active user sessions across restarts');
    console.error('  and break session consistency in multi-replica deployments.');
    console.error('================================================================================');
    console.error('');
    if (typeof exitFn === 'function') {
      exitFn(1);
    }
    return false;
  }

  if (!isProduction && !validation.valid) {
    console.warn('[auth] JWT_SECRET not set — using an insecure default. Set JWT_SECRET in production.');
  }

  return true;
}

/**
 * Signs a standard user authentication token.
 * 
 * @param {string} userId - User identifier (UUID/string).
 * @param {object} [options={}] - jsonwebtoken sign options.
 * @returns {string} Signed JWT.
 */
function signUserToken(userId, options = {}) {
  const secret = getJwtSecret();
  const signOptions = { expiresIn: '30d', ...options };
  return jwt.sign({ sub: userId }, secret, signOptions);
}

/**
 * Signs a short-lived 2FA challenge token.
 * 
 * @param {string} userId - User identifier.
 * @param {object} [options={}] - jsonwebtoken sign options.
 * @returns {string} Signed JWT for 2FA verification.
 */
function sign2FaChallengeToken(userId, options = {}) {
  const secret = getJwtSecret();
  const signOptions = { expiresIn: '5m', ...options };
  return jwt.sign({ sub: userId, is2FaChallenge: true }, secret, signOptions);
}

/**
 * Signs a generic JWT payload.
 * 
 * @param {object} payload - Token claims.
 * @param {object} [options={}] - jsonwebtoken sign options.
 * @returns {string} Signed JWT.
 */
function signToken(payload, options = {}) {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, options);
}

/**
 * Verifies a JWT token using the canonical secret.
 * 
 * @param {string} token - Raw JWT string.
 * @param {object} [options={}] - jsonwebtoken verify options.
 * @returns {object} Decoded token payload.
 * @throws {jwt.JsonWebTokenError|jwt.TokenExpiredError} If token is invalid or expired.
 */
function verifyToken(token, options = {}) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret, options);
}

module.exports = {
  MIN_SECRET_LENGTH,
  DEV_FALLBACK_SECRET,
  KNOWN_INSECURE_SECRETS,
  validateJwtSecret,
  getJwtSecret,
  assertProductionJwtSecret,
  signUserToken,
  sign2FaChallengeToken,
  signToken,
  verifyToken
};
