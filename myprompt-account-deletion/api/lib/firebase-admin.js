const crypto = require("crypto");
let adminInstance = null;

/**
 * Initializes and returns the Firebase Admin SDK instance.
 * Reads credentials strictly from secure environment variables on Vercel.
 * Never exposes credentials to client-side.
 */
function getFirebaseAdmin() {
  if (adminInstance) return adminInstance;

  const admin = require("firebase-admin");

  if (admin.apps.length > 0) {
    adminInstance = admin.app();
    return adminInstance;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || "mypromptapp-dcc07";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    // Replace literal escaped "\n" with actual newlines if pasted as single line
    if (privateKey.includes("\\n")) {
      privateKey = privateKey.replace(/\\n/g, "\n");
    }

    adminInstance = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
    return adminInstance;
  }

  // Fallback to application default credentials (if running in GCP / Firebase Functions)
  try {
    adminInstance = admin.initializeApp({
      projectId,
    });
    return adminInstance;
  } catch (err) {
    console.warn("Firebase Admin initialized without explicit credentials:", err.message);
    adminInstance = admin;
    return adminInstance;
  }
}

/**
 * Check whether Firebase Admin credentials are fully supplied in environment.
 */
function isFirebaseAdminConfigured() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  return Boolean(clientEmail && privateKey);
}

/**
 * Generates an HMAC-SHA256 signature for a token payload.
 */
function getSecret() {
  return (
    process.env.DELETION_TOKEN_SECRET ||
    process.env.FIREBASE_CLIENT_EMAIL ||
    "myprompt_default_fallback_secret_396296243916"
  );
}

function signDeletionToken(payload) {
  const secret = getSecret();
  const serialized = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(serialized)
    .digest("base64url");
  return `${serialized}.${signature}`;
}

function verifyDeletionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const [serialized, signature] = token.split(".");
  const secret = getSecret();
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(serialized)
    .digest("base64url");

  // Constant-time comparison to prevent timing attacks
  if (
    signature.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
  ) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(serialized, "base64url").toString("utf8");
    const payload = JSON.parse(jsonStr);

    // Verify expiration (default: 30 minutes)
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = {
  getFirebaseAdmin,
  isFirebaseAdminConfigured,
  signDeletionToken,
  verifyDeletionToken,
};
