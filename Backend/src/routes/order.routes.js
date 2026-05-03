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

const router = Router();

// Private routes
router.use(verifyJWT);

router.post("/", createOrder);
router.get("/my-orders", getMyOrders);
router.get("/:id", getOrderById);
router.put("/:id/cancel", cancelOrder);

// Admin routes
router.get("/", verifyAdmin, getAllOrders);
router.put("/:id/status", verifyAdmin, updateOrderStatus);

export default router;