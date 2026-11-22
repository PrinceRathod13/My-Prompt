const {
  getFirebaseAdmin,
  isFirebaseAdminConfigured,
  signDeletionToken,
} = require("./lib/firebase-admin");

module.exports = async function handler(req, res) {
  // CORS & Methods
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const email = (body.email || "").trim().toLowerCase();

    // 1. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
      });
    }

    // 2. Check if Firebase Admin is configured
    if (!isFirebaseAdminConfigured()) {
      // In development / initial deployment mode without service account
      // Still generate a secure signed token so verification flow works seamlessly
      const token = signDeletionToken({
        email,
        uid: "pending_" + Buffer.from(email).toString("hex").substring(0, 16),
        exp: Date.now() + 30 * 60 * 1000, // 30 minutes
      });

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
      const baseUrl = process.env.APP_BASE_URL || `${protocol}://${host}`;
      const verificationLink = `${baseUrl}/?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

      return res.status(200).json({
        success: true,
        message:
          "Verification link generated. Please check your inbox and click the verification link to confirm account deletion.",
        verificationLink,
        note: "To enable direct server-side deletion, add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel Environment Variables.",
      });
    }

    // 3. Firebase Admin is configured: query real user in Firebase Authentication
    const admin = getFirebaseAdmin();

    let userRecord = null;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        // Safe response: do not reveal user existence
        return res.status(200).json({
          success: true,
          message:
            "If an account with this email address exists in MyPrompt, a verification link has been sent to confirm deletion.",
        });
      }
      throw err;
    }

    // 4. Generate signed cryptographic deletion token
    const token = signDeletionToken({
      uid: userRecord.uid,
      email: userRecord.email,
      exp: Date.now() + 30 * 60 * 1000, // 30 minutes
    });

    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
    const baseUrl = process.env.APP_BASE_URL || `${protocol}://${host}`;
    const verificationLink = `${baseUrl}/?token=${encodeURIComponent(token)}&email=${encodeURIComponent(userRecord.email)}`;

    // 5. Record pending deletion request in Firestore
    try {
      await admin
        .firestore()
        .collection("account_deletion_requests")
        .doc(userRecord.uid)
        .set({
          uid: userRecord.uid,
          email: userRecord.email,
          status: "pending_verification",
          requestedAt: Date.now(),
          expiresAt: Date.now() + 30 * 60 * 1000,
          ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown",
        });
    } catch (fsErr) {
      console.warn("Could not save to Firestore deletion collection:", fsErr.message);
    }

    // 6. Generate Firebase Email Link if supported
    let firebaseEmailLink = null;
    try {
      firebaseEmailLink = await admin.auth().generateSignInWithEmailLink(userRecord.email, {
        url: verificationLink,
        handleCodeInApp: true,
      });
    } catch (linkErr) {
      console.warn("generateSignInWithEmailLink fallback:", linkErr.message);
    }

    return res.status(200).json({
      success: true,
      message:
        "A verification link has been generated for your email. Please click the link to confirm and permanently delete your account and personal data.",
      verificationLink: firebaseEmailLink || verificationLink,
    });
  } catch (error) {
    console.error("Error in request-deletion handler:", error);
    return res.status(500).json({
      error: "An internal error occurred while processing your request. Please try again later.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
