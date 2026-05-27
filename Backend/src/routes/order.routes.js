import { Router } from "express";
import {
    createOrder,
    getMyOrders,
    getOrderById,
    cancelOrder,
    getAllOrders,
    updateOrderStatus,
} from "../controllers/order.controller.js";
import { verifyJWT, verifyAdmin } from "../middleware/auth.middleware.js";
import { validate, validators } from "../middleware/validation.middleware.js";

const router = Router();

// Private routes
router.use(verifyJWT);

router.post("/", validate([
    validators.enumValue("paymentMethod", ["paystack", "cash_on_delivery"], { message: "Unsupported payment method" }),
    validators.custom("shippingAddress", (value) => {
        const address = value;
        return Boolean(
            address &&
            typeof address === "object" &&
            String(address.fullName || "").trim() &&
            String(address.phone || "").trim() &&
            String(address.street || "").trim() &&
            String(address.city || "").trim() &&
            String(address.state || "").trim()
        );
    }, { required: true, message: "Complete shipping address is required" }),
]), createOrder);
router.get("/my-orders", getMyOrders);
router.get("/:id", validate([
    validators.mongoId("id"),
]), getOrderById);
router.put("/:id/cancel", validate([
    validators.mongoId("id"),
    validators.optionalString("reason", { max: 250, message: "Cancellation reason is too long" }),
]), cancelOrder);

// Admin routes
router.get("/", verifyAdmin, getAllOrders);
router.put("/:id/status", verifyAdmin, validate([
    validators.mongoId("id"),
    validators.enumValue("status", ["pending", "processing", "shipped", "delivered", "cancelled"], { message: "Invalid order status" }),
    validators.optionalString("note", { max: 250, message: "Status note is too long" }),
]), updateOrderStatus);

export default router;
