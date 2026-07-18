
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true,
            unique: true,                    // ✅ No duplicate product names
        },
        description: {
            type: String,
            required: [true, "Product description is required"],
        },
        price: {
            type: Number,
            required: [true, "Product price is required"],
            min: [0, "Price cannot be negative"],
        },
        discountPrice: {
            type: Number,
            default: 0,
        },
        category: {
            type: String,
            required: [true, "Product category is required"],
            enum: [
                "CCTV",
                "Alarms",
                "Access Control",
                "Intercom",
                "Networking",
                "Other",
            ],
        },
        brand: {
            type: String,
            trim: true,
        },
        modelNumber: {
            type: String,
            trim: true,
        },
        subCategory: {
            type: String,
            trim: true,
        },
        keySpecifications: {
            type: String,
            trim: true,
        },
        costPrice: {
            type: Number,
            min: [0, "Cost price cannot be negative"],
        },
        reorderLevel: {
            type: Number,
            min: [0, "Reorder level cannot be negative"],
            default: 5,
        },
        notesVariants: {
            type: String,
            trim: true,
        },
        images: [
            {
                type: String,
            },
        ],
        stock: {
            type: Number,
            required: [true, "Stock quantity is required"],
            min: [0, "Stock cannot be negative"],
            default: 0,
        },
        sold: {
            type: Number,
            default: 0,
        },
        ratings: {
            type: Number,
            default: 0,
            min: [0, "Rating cannot be less than 0"],  // ✅ Min rating
            max: [5, "Rating cannot be more than 5"],  // ✅ Max rating
        },
        numReviews: {
            type: Number,
            default: 0,
        },
        reviews: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                name: String,
                rating: {
                    type: Number,
                    min: [0, "Rating cannot be less than 0"],  // ✅ Min review rating
                    max: [5, "Rating cannot be more than 5"],  // ✅ Max review rating
                },
                comment: String,
            },
        ],
        isFeatured: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export const Product = mongoose.model("Product", productSchema);