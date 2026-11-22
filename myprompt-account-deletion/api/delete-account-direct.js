const { getFirebaseAdmin, isFirebaseAdminConfigured } = require("./lib/firebase-admin");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required" });

  // Key: Must ensure Admin is configured, otherwise deletion cannot be performed
  if (!isFirebaseAdminConfigured()) {
    return res.status(500).json({
      error: "Firebase Admin is not configured on the server. Please add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel Environment Variables."
    });
  }

  try {
    const admin = getFirebaseAdmin();
    const userRecord = await admin.auth().getUserByEmail(email.trim().toLowerCase());

    // Optional: First clean up user data in Firestore (if any)
    try {
      const db = admin.firestore();
      const uid = userRecord.uid;
      await db.collection("users").doc(uid).delete();
      // ... delete other collections ...
    } catch (fsErr) {
      console.warn("Firestore cleanup skipped:", fsErr.message);
    }

    // Delete Auth user
    await admin.auth().deleteUser(userRecord.uid);

    return res.status(200).json({
      success: true,
      message: `Account for ${email} has been permanently deleted.`
    });
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      // For security, you can also return success to avoid email enumeration
      return res.status(200).json({ success: true, message: "If the account exists, it has been deleted." });
    }
    console.error("Delete error:", error);
    return res.status(500).json({ error: "Failed to delete account. Please check server logs." });
  }
};
