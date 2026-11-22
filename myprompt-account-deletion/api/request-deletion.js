
const {
  getFirebaseAdmin,
  isFirebaseAdminConfigured,
} = require("./lib/firebase-admin");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!isFirebaseAdminConfigured()) {
      return res.status(500).json({
        error: "Firebase Admin is not configured."
      });
    }

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Please sign in to verify account ownership."
      });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const email = (body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(
      authHeader.substring(7).trim()
    );

    if (!decoded.email || decoded.email.toLowerCase() !== email) {
      return res.status(403).json({
        error: "The signed-in account does not match this email."
      });
    }

    const uid = decoded.uid;
    const db = admin.firestore();

    // Delete the user's known personal Firestore documents.
    const collections = [
      "users",
      "user_favorites",
      "saved_prompts",
      "copied_prompts"
    ];

    for (const collection of collections) {
      await db.collection(collection).doc(uid).delete();
    }

    // Delete Firebase Authentication account.
    await admin.auth().deleteUser(uid);

    return res.status(200).json({
      success: true,
      message: "Your MyPrompt account has been deleted."
    });

  } catch (error) {
    console.error("Deletion error:", error);

    return res.status(500).json({
      error: "Account deletion failed. Please try again."
    });
  }
};
