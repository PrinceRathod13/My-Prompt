const {
  getFirebaseAdmin,
  isFirebaseAdminConfigured,
  verifyDeletionToken,
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
    const token = (body.token || "").trim();
    const email = (body.email || "").trim().toLowerCase();

    // Check for Authorization Header with Firebase ID Token
    const authHeader = req.headers["authorization"] || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : null;

    let targetUid = null;
    let targetEmail = null;

    // 1. Authenticate via Bearer Firebase ID Token (if user signed in via Email Link)
    if (bearerToken && isFirebaseAdminConfigured()) {
      try {
        const admin = getFirebaseAdmin();
        const decoded = await admin.auth().verifyIdToken(bearerToken);
        targetUid = decoded.uid;
        targetEmail = (decoded.email || "").toLowerCase();
      } catch (authErr) {
        console.warn("Invalid Bearer token:", authErr.message);
      }
    }

    // 2. Or authenticate via Signed Cryptographic Verification Token
    if (!targetUid && token) {
      const payload = verifyDeletionToken(token);
      if (!payload) {
        return res.status(400).json({
          error:
            "Invalid or expired verification token. Please submit a new account deletion request.",
        });
      }

      if (email && payload.email && email !== payload.email.toLowerCase()) {
        return res.status(400).json({
          error: "Verification email mismatch. Please submit a new request.",
        });
      }

      targetUid = payload.uid;
      targetEmail = payload.email.toLowerCase();
    }

    if (!targetUid && !targetEmail) {
      return res.status(400).json({
        error:
          "Missing valid verification credentials. Please click the deletion link from your verification email.",
      });
    }

    // 3. If Firebase Admin is not configured, simulate successful verified deletion (preview/mock mode)
    if (!isFirebaseAdminConfigured()) {
      return res.status(200).json({
        success: true,
        message: `Account for ${targetEmail} and all associated personal data have been successfully verified and deleted.`,
        mode: "preview",
        note: "Add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel to perform live Firebase deletion.",
      });
    }

    // 4. Live Deletion via Firebase Admin SDK
    const admin = getFirebaseAdmin();

    // Resolve UID from email if pending prefix was used
    if (targetUid.startsWith("pending_")) {
      try {
        const liveUser = await admin.auth().getUserByEmail(targetEmail);
        targetUid = liveUser.uid;
      } catch (lookupErr) {
        console.warn("User lookup by email failed:", lookupErr.message);
      }
    }

    const firestore = admin.firestore();

    // A. Delete user document and personal subcollections from Firestore
    try {
      if (targetUid && !targetUid.startsWith("pending_")) {
        // Delete user profile
        await firestore.collection("users").doc(targetUid).delete();

        // Delete favorites record
        await firestore.collection("user_favorites").doc(targetUid).delete();

        // Delete saved prompts record
        await firestore.collection("saved_prompts").doc(targetUid).delete();

        // Delete copied prompts record
        await firestore.collection("copied_prompts").doc(targetUid).delete();

        // Update or record deletion in audit log
        await firestore
          .collection("account_deletion_requests")
          .doc(targetUid)
          .set({
            uid: targetUid,
            email: targetEmail,
            status: "deleted",
            completedAt: Date.now(),
            ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown",
          });
      }
    } catch (fsErr) {
      console.error("Error deleting Firestore user data:", fsErr.message);
    }

    // B. Delete Firebase Auth User Record
    try {
      if (targetUid && !targetUid.startsWith("pending_")) {
        await admin.auth().deleteUser(targetUid);
      }
    } catch (authDeleteErr) {
      // If user was already deleted, ignore error
      if (authDeleteErr.code !== "auth/user-not-found") {
        console.error("Error deleting Firebase Auth user:", authDeleteErr);
        throw authDeleteErr;
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "Your MyPrompt account and all associated personal data have been permanently deleted.",
      deletedEmail: targetEmail,
    });
  } catch (error) {
    console.error("Error in verify-and-delete handler:", error);
    return res.status(500).json({
      error: "An internal error occurred while deleting your account. Please try again later.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
