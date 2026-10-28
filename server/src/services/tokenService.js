import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const HMAC_SECRET = process.env.HMAC_SECRET || 'rescuegrid_default_hmac_secret_2026';

/**
 * Generates an HMAC-SHA256 signature and a user-friendly 6-digit OTP code for a listing claim
 */
export function generateHandoverToken(listingId, courierId) {
  const timestamp = Date.now();
  const rawPayload = `${listingId}:${courierId}:${timestamp}`;
  
  const hmac = crypto.createHmac('sha256', HMAC_SECRET).update(rawPayload).digest('hex');
  
  // Deterministic 6-digit verification code derived from the first 8 hex characters
  const codeNum = parseInt(hmac.substring(0, 8), 16) % 1000000;
  const verificationCode = codeNum.toString().padStart(6, '0');

  return {
    verificationCode,
    signature: hmac,
    timestamp,
  };
}

/**
 * Generates a scoped, single-use 6-digit OTP specifically bound to an allocation, rider assignment, and rider ID.
 * If a rider is replaced, the new assignment ID ensures the previous code is invalid.
 */
export function generateAssignmentOtp(allocationId, assignmentId, riderId) {
  const rawPayload = `ASSIGNMENT:${allocationId}:${assignmentId}:${riderId}`;
  const hmac = crypto.createHmac('sha256', HMAC_SECRET).update(rawPayload).digest('hex');
  const codeNum = parseInt(hmac.substring(0, 8), 16) % 1000000;
  const otpCode = codeNum.toString().padStart(6, '0');

  return {
    otpCode,
    signature: hmac,
  };
}

/**
 * Hashes a verification token into a non-reversible SHA-256 digest for audit ledger storage.
 * Eliminates raw secrets from disk, audit logs, and non-privileged database inspect queries.
 */
export function hashTokenDigest(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Validates verification code using constant-time equality check
 */
export function verifyHandoverToken(expectedCode, providedCode) {
  if (!expectedCode || !providedCode) return false;
  const expStr = String(expectedCode).trim();
  const provStr = String(providedCode).trim();
  if (expStr.length !== provStr.length) return false;

  const expectedBuf = Buffer.from(expStr);
  const providedBuf = Buffer.from(provStr);

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
