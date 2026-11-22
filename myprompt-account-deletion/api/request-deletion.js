
const {
  getFirebaseAdmin,
  isFirebaseAdminConfigured,
} = require("./lib/firebase-admin");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const email = (body.email || "").trim().toLowerCase();
    const testEmail = (process.env.TEST_DELETION_EMAIL || "")
      .trim()
      .toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    // Only allow the dedicated test account.
    if (!testEmail || email !== testEmail) {
      return res.status(403).json({
        error: "This testing page is restricted to the configured test account."
      });
    }

    if (!isFirebaseAdminConfigured()) {
      return res.status(500).json({
        error: "Firebase Admin is not configured. Check your Vercel environment variables."
      });
    }

    const admin = getFirebaseAdmin();
    const user = await admin.auth().getUserByEmail(email);
    const db = admin.firestore();

    // Delete the known personal data documents.
    const collections = [
      "users",
      "user_favorites",
      "saved_prompts",
      "copied_prompts"
    ];

    for (const collection of collections) {
      await db.collection(collection).doc(user.uid).delete();
    }

    // Delete the Firebase Authentication account.
    await admin.auth().deleteUser(user.uid);

    return res.status(200).json({
      success: true,
      message: "Test account deleted successfully."
    });

  } catch (error) {
    console.error("Account deletion failed:", error);

    return res.status(500).json({
      error: "Account deletion failed. Please check the server logs."
    });
  }
};
