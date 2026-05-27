import { Product } from "../models/product.model.js";
import {
    clampNumber,
    normalizeBoolean,
    normalizeNumber,
    normalizeOptionalString,
    normalizeString,
} from "../utils/request.utils.js";

const PRODUCT_UPDATE_FIELDS = new Set([
    "name",
    "description",
    "price",
    "discountPrice",
    "category",
    "brand",
    "stock",
    "isFeatured",
    "images",
    "isActive",
]);

function normalizeProductPayload(payload, { partial = false } = {}) {
    const normalized = {};

    if (!partial || Object.prototype.hasOwnProperty.call(payload, "name")) {
        normalized.name = normalizeString(payload.name);
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, "description")) {
        normalized.description = normalizeString(payload.description);
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, "price")) {
        normalized.price = normalizeNumber(payload.price);
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, "discountPrice")) {
        normalized.discountPrice = normalizeNumber(payload.discountPrice, 0);
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, "category")) {
        normalized.category = normalizeString(payload.category);
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, "brand")) {
        normalized.brand = normalizeOptionalString(payload.brand);
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, "stock")) {
        normalized.stock = normalizeNumber(payload.stock);
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, "isFeatured")) {
        normalized.isFeatured = normalizeBoolean(payload.isFeatured);
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, "isActive")) {
        normalized.isActive = normalizeBoolean(payload.isActive, true);
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, "images")) {
        normalized.images = Array.isArray(payload.images)
            ? payload.images.filter((image) => typeof image === "string" && image.trim())
            : [];
    }

    return normalized;
}

// ----------------------
// GET ALL PRODUCTS
// ----------------------
export const getAllProducts = async (req, res) => {
    try {
        const {
            keyword,
            category,
            brand,
            minPrice,
            maxPrice,
            sort,
            page = 1,
            limit = 10,
            isFeatured,
            inStock,
        } = req.query;

        const query = { isActive: true };

        // Search by keyword
        if (keyword) {
            query.name = { $regex: keyword, $options: "i" };
        }

        // Filter by category
        if (category) {
            query.category = category;
        }

        // Filter by brand
        if (brand) {
            query.brand = { $regex: brand, $options: "i" };
        }

        if (String(isFeatured) === "true") {
            query.isFeatured = true;
        }

        if (String(inStock) === "true") {
            query.stock = { ...(query.stock || {}), $gt: 0 };
        }

        // Filter by price range
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        // Sort options
        let sortOption = {};
        if (sort === "price_asc") sortOption = { price: 1 };
        else if (sort === "price_desc") sortOption = { price: -1 };
        else if (sort === "newest") sortOption = { createdAt: -1 };
        else if (sort === "popular") sortOption = { sold: -1 };
        else sortOption = { createdAt: -1 };

        // Pagination
        const safePage = clampNumber(page, { min: 1, max: 100000, fallback: 1 });
        const safeLimit = clampNumber(limit, { min: 1, max: 50, fallback: 10 });
        const skip = (safePage - 1) * safeLimit;
        const total = await Product.countDocuments(query);

        const products = await Product.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(safeLimit);

        return res.status(200).json({
            success: true,
            total,
            page: safePage,
            pages: Math.ceil(total / safeLimit),
            data: products,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// GET SINGLE PRODUCT
// ----------------------
export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product || !product.isActive) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: product,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// GET FEATURED PRODUCTS
// ----------------------
export const getFeaturedProducts = async (req, res) => {
    try {
        const products = await Product.find({
            isFeatured: true,
            isActive: true,
        }).limit(8);

        return res.status(200).json({
            success: true,
            data: products,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// ADD REVIEW
// ----------------------
export const addReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product || !product.isActive) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Check if user already reviewed
        const alreadyReviewed = product.reviews.find(
            (r) => r.user.toString() === req.user._id.toString()
        );

        if (alreadyReviewed) {
            return res.status(400).json({
                success: false,
                message: "You have already reviewed this product",
            });
        }

        // Add review
        const review = {
            user: req.user._id,
            name: req.user.fullName,
            rating: Number(rating),
            comment,
        };

        product.reviews.push(review);
        product.numReviews = product.reviews.length;
        product.ratings =
            product.reviews.reduce((acc, r) => acc + r.rating, 0) /
            product.reviews.length;

        await product.save();

        return res.status(201).json({
            success: true,
            message: "Review added successfully",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// ADMIN - CREATE PRODUCT
// ----------------------
export const createProduct = async (req, res) => {
    try {
        const product = await Product.create(normalizeProductPayload(req.body));

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// ADMIN - UPDATE PRODUCT
// ----------------------
export const updateProduct = async (req, res) => {
    try {
        const allowedPayload = Object.fromEntries(
            Object.entries(req.body).filter(([key]) => PRODUCT_UPDATE_FIELDS.has(key))
        );

        if (Object.keys(allowedPayload).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid product fields were provided for update",
            });
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            normalizeProductPayload(allowedPayload, { partial: true }),
            { returnDocument: "after", runValidators: true }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: product,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// ADMIN - DELETE PRODUCT
// ----------------------
export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Soft delete - just set isActive to false
        product.isActive = false;
        await product.save();

        return res.status(200).json({
            success: true,
            message: "Product deleted successfully",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
