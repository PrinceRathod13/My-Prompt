
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
      return res.status(500).json({ error: "Firebase Admin is not configured." });
    }

    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

    const email = (body.email || "").trim().toLowerCase();
    const admin = getFirebaseAdmin();

    const decoded = await admin.auth().verifyIdToken(header.slice(7));
    const user = await admin.auth().getUser(decoded.uid);

    if (!email || !user.email ||
        user.email.toLowerCase() !== email) {
      return res.status(403).json({ error: "Email does not match the verified account." });
    }

    const db = admin.firestore();
    const uid = user.uid;

    // Delete the known personal documents.
    for (const collection of [
      "users",
      "user_favorites",
      "saved_prompts",
      "copied_prompts"
    ]) {
      await db.collection(collection).doc(uid).delete();
    }

    // Delete Authentication account last.
    await admin.auth().deleteUser(uid);

    return res.status(200).json({
      success: true,
      message: "Your account has been deleted."
    });

  } catch (error) {
    console.error("Deletion failed:", error);
    return res.status(500).json({
      error: "Account deletion failed. Please try again."
    });
  }
};
