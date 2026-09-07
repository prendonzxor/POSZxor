const crypto = require("crypto");

const SESSION_TOKEN_TTL_MS = 30 * 60 * 1000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";

function buildSessionToken(userId, tenantId) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      tenantId,
      iat: Date.now(),
    })
  ).toString("base64url");

  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");

  return `${payload}.${signature}`;
}

function parseSessionToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const isExpired = Date.now() - Number(parsed.iat || 0) > SESSION_TOKEN_TTL_MS;

    if (!parsed.userId || isExpired) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

module.exports = {
  buildSessionToken,
  parseSessionToken,
};
