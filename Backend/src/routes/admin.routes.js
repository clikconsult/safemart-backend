import { Router } from "express";
import {
    getAllUsers,
    getUserById,
    toggleUserStatus,
    changeUserRole,
    getSalesAnalytics,
} from "../controllers/admin.controller.js";
import { verifyJWT, verifyAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// All admin routes are protected
router.use(verifyJWT, verifyAdmin);

router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id/toggle-status", toggleUserStatus);
router.put("/users/:id/role", changeUserRole);
router.get("/analytics", getSalesAnalytics);

export default router;