import { Router } from "express";
import {
    initializePayment,
    verifyPayment,
    paystackWebhook,
} from "../controllers/payment.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { validate, validators } from "../middleware/validation.middleware.js";

const router = Router();

router.post("/initialize", verifyJWT, validate([
    validators.mongoId("orderId", { source: "body", message: "A valid orderId is required" }),
]), initializePayment);
router.get("/verify/:reference", verifyJWT, validate([
    validators.requiredString("reference", { source: "params", min: 6, max: 120, message: "A valid payment reference is required" }),
]), verifyPayment);
router.post("/webhook", paystackWebhook);

export default router;
