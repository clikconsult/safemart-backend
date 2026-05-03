import { Router } from "express";
import {
    getAllProducts,
    getProductById,
    getFeaturedProducts,
    addReview,
    createProduct,
    updateProduct,
    deleteProduct,
} from "../controllers/product.controller.js";
import { verifyJWT, verifyAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// Public routes
router.get("/", getAllProducts);
router.get("/featured", getFeaturedProducts);
router.get("/:id", getProductById);

// Private routes
router.post("/:id/reviews", verifyJWT, addReview);

// Admin routes
router.post("/", verifyJWT, verifyAdmin, createProduct);
router.put("/:id", verifyJWT, verifyAdmin, updateProduct);
router.delete("/:id", verifyJWT, verifyAdmin, deleteProduct);

export default router;