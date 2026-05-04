import { Router } from "express";
import {
    initializePayment,
    verifyPayment,
    paystackWebhook,
} from "../controllers/payment.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/initialize", verifyJWT, initializePayment);
router.get("/verify/:reference", verifyJWT, verifyPayment);
router.post("/webhook", paystackWebhook);

export default router;
