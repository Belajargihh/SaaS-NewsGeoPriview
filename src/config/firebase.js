import dotenv from "dotenv";
dotenv.config();

import { createRequire } from "module";
import admin from "firebase-admin";

const require = createRequire(import.meta.url);

let db = null;

try {
    // Path relatif dari src/config/ ke root
    const serviceAccount = require("../../serviceAccountKey.json");
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log("🔥 Firebase Admin Terhubung!");
} catch (error) {
    console.warn("⚠️ Firebase Admin skip (File key tidak ditemukan).");
}

export { admin, db };
