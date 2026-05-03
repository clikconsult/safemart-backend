import { Router } from "express";
import {
    uploadProductImages,
    deleteProductImage,
    uploadUserAvatar,
} from "../controllers/upload.controller.js";
import { verifyJWT, verifyAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/products", verifyJWT, verifyAdmin, uploadProductImages);
router.delete("/products", verifyJWT, verifyAdmin, deleteProductImage);
router.post("/avatar", verifyJWT, uploadUserAvatar);

export default router;