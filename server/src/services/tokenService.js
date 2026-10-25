import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const HMAC_SECRET = process.env.HMAC_SECRET || 'rescuegrid_default_hmac_secret_2026';

/**
 * Generates an HMAC-SHA256 signature and a user-friendly 6-digit OTP code
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
 * Validates verification code using constant-time equality check
 */
export function verifyHandoverToken(expectedCode, providedCode) {
  if (!expectedCode || !providedCode) return false;
  if (expectedCode.length !== providedCode.length) return false;

  const expectedBuf = Buffer.from(expectedCode);
  const providedBuf = Buffer.from(providedCode);

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
