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
import { bulkImportProducts } from "../controllers/productImport.controller.js";
import { verifyJWT, verifyAdmin } from "../middleware/auth.middleware.js";
import { validate, validators } from "../middleware/validation.middleware.js";

const router = Router();
const categories = ["CCTV", "Alarms", "Access Control", "Intercom", "Networking", "Other"];

// Public routes
router.get("/", getAllProducts);
router.get("/featured", getFeaturedProducts);
router.get("/:id", getProductById);

// Private routes
router.post("/:id/reviews", verifyJWT, validate([
    validators.mongoId("id"),
    validators.custom("rating", (value) => {
        const rating = Number(value);
        return Number.isFinite(rating) && rating >= 1 && rating <= 5;
    }, { required: true, message: "Rating must be between 1 and 5" }),
    validators.requiredString("comment", { min: 3, max: 1000, message: "Review comment must be between 3 and 1000 characters" }),
]), addReview);

// Admin routes
router.post("/", verifyJWT, verifyAdmin, validate([
    validators.requiredString("name", { min: 2, max: 120, message: "Product name must be between 2 and 120 characters" }),
    validators.requiredString("description", { min: 10, max: 5000, message: "Product description must be between 10 and 5000 characters" }),
    validators.nonNegativeNumber("price"),
    validators.nonNegativeNumber("discountPrice", { required: false, message: "Discount price must be a valid non-negative number" }),
    validators.enumValue("category", categories, { message: "Product category is invalid" }),
    validators.optionalString("brand", { max: 80, message: "Brand name is too long" }),
    validators.optionalString("modelNumber", { max: 80, message: "Model number is too long" }),
    validators.optionalString("subCategory", { max: 80, message: "Sub-category is too long" }),
    validators.optionalString("keySpecifications", { max: 2000, message: "Key specifications are too long" }),
    validators.nonNegativeNumber("costPrice", { required: false, message: "Cost price must be a valid non-negative number" }),
    validators.nonNegativeNumber("reorderLevel", { required: false, message: "Reorder level must be a valid non-negative number" }),
    validators.optionalString("notesVariants", { max: 2000, message: "Notes / variants are too long" }),
    validators.nonNegativeNumber("stock"),
    validators.booleanLike("isFeatured"),
]), createProduct);
router.post("/bulk-import", verifyJWT, verifyAdmin, bulkImportProducts);
router.put("/:id", verifyJWT, verifyAdmin, validate([
    validators.mongoId("id"),
]), updateProduct);
router.delete("/:id", verifyJWT, verifyAdmin, validate([
    validators.mongoId("id"),
]), deleteProduct);

export default router;
