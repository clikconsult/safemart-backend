import { Router } from "express";
import {
    register,
    login,
    logout,
    getCurrentUser,
    refreshAccessToken,
} from "../controllers/auth.controller.js";
import { attachUserIfPresent, verifyJWT } from "../middleware/auth.middleware.js";
import { validate, validators } from "../middleware/validation.middleware.js";

const router = Router();

router.post("/register", validate([
    validators.requiredString("fullName", { min: 2, max: 80, message: "Full name must be between 2 and 80 characters" }),
    validators.email(),
    validators.requiredString("password", { min: 6, max: 128, message: "Password must be between 6 and 128 characters" }),
    validators.optionalString("phone", { max: 30, message: "Phone number is too long" }),
]), register);
router.post("/login", validate([
    validators.email(),
    validators.requiredString("password", { min: 6, max: 128, message: "Password is required" }),
]), login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", attachUserIfPresent, logout);
router.get("/me", verifyJWT, getCurrentUser);

export default router;
        
