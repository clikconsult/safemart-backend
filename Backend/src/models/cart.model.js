 import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User is required"],
            unique: true,
        },
        items: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true,
                },
                name: { type: String, required: true },
                image: { type: String },
                price: { type: Number, required: true },
                quantity: {
                    type: Number,
                    required: true,
                    min: [1, "Quantity cannot be less than 1"],
                    default: 1,
                },
                subtotal: { type: Number, required: true },
            },
        ],
        totalItems: { type: Number, default: 0 },
        totalPrice: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export const Cart = mongoose.model("Cart", cartSchema);