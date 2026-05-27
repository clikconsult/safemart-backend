import { Router } from "express";
import { submitContactForm } from "../controllers/contact.controller.js";
import { validate, validators } from "../middleware/validation.middleware.js";

const router = Router();

router.post("/", validate([
    validators.requiredString("name", { min: 2, max: 80, message: "Name must be between 2 and 80 characters" }),
    validators.email(),
    validators.optionalString("phone", { max: 30, message: "Phone number is too long" }),
    validators.requiredString("subject", { min: 3, max: 120, message: "Subject must be between 3 and 120 characters" }),
    validators.requiredString("message", { min: 10, max: 5000, message: "Message must be between 10 and 5000 characters" }),
]), submitContactForm);

export default router;
