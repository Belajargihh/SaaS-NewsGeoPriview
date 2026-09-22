import express from "express";
import { snap } from "../config/midtrans.js";
import { admin, db } from "../config/firebase.js";

const router = express.Router();

// --- Create Transaction ---
router.post("/create-transaction", async (req, res) => {
    try {
        const { uid, email, name } = req.body;
        if (!uid || !email) return res.status(400).json({ error: "Data kurang" });

        const orderId = `PREM-${Date.now()}-${uid}`;
        const parameter = {
            transaction_details: { order_id: orderId, gross_amount: 50000 },
            customer_details: { first_name: name || "User", email: email },
            item_details: [{ id: 'PREM', price: 50000, quantity: 1, name: "Premium" }]
        };

        const transaction = await snap.createTransaction(parameter);
        res.json({ token: transaction.token });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Midtrans Notification Webhook ---
router.post("/midtrans-notification", async (req, res) => {
    try {
        const notif = req.body;
        const statusResponse = await snap.transaction.notification(notif);
        const { order_id, transaction_status, fraud_status } = statusResponse;
        let isSuccess = (transaction_status === 'capture' && fraud_status === 'accept') || transaction_status === 'settlement';

        if (isSuccess && db) {
            const parts = order_id.split("-");
            const uid = parts.slice(2).join("-");
            if (uid) {
                await db.collection("users").doc(uid).set({
                    isPremium: true,
                    role: 'premium',
                    premiumSince: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log(`✅ User ${uid} PREMIUM ACTIVATED`);
            }
        }
        res.status(200).send("OK");
    } catch (e) {
        res.status(500).send("Error");
    }
});

export default router;
