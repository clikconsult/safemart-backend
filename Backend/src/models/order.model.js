import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User is required"],
        },
        items: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true,
                },
                name: {
                    type: String,
                    required: true,
                },
                image: {
                    type: String,
                },
                price: {
                    type: Number,
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: [1, "Quantity cannot be less than 1"],
                },
                subtotal: {
                    type: Number,
                    required: true,
                },
            },
        ],
        shippingAddress: {
            fullName: {
                type: String,
                required: [true, "Full name is required"],
            },
            phone: {
                type: String,
                required: [true, "Phone number is required"],
            },
            street: {
                type: String,
                required: [true, "Street is required"],
            },
            city: {
                type: String,
                required: [true, "City is required"],
            },
            state: {
                type: String,
                required: [true, "State is required"],
            },
            country: {
                type: String,
                default: "Nigeria",
            },
        },
        paymentInfo: {
            method: {
                type: String,
                enum: ["paystack", "cash_on_delivery"],
                required: [true, "Payment method is required"],
            },
            status: {
                type: String,
                enum: ["pending", "paid", "failed", "refunded"],
                default: "pending",
            },
            paidAt: {
                type: Date,
            },
            paystackReference: {
                type: String,
            },
            expiresAt: {
                type: Date,
            },
        },
        orderStatus: {
            type: String,
            enum: [
                "pending",
                "processing",
                "shipped",
                "delivered",
                "cancelled",
            ],
            default: "pending",
        },
        statusHistory: [
            {
                status: {
                    type: String,
                    enum: [
                        "pending",
                        "processing",
                        "shipped",
                        "delivered",
                        "cancelled",
                    ],
                },
                changedAt: {
                    type: Date,
                    default: Date.now,
                },
                note: String,
            },
        ],
        totalItems: {
            type: Number,
            required: true,
        },
        totalPrice: {
            type: Number,
            required: true,
        },
        shippingPrice: {
            type: Number,
            default: 0,
        },
        finalPrice: {
            type: Number,
            required: true,
        },
        inventoryCommitted: {
            type: Boolean,
            default: false,
        },
        inventoryCommittedAt: {
            type: Date,
        },
        deliveredAt: {
            type: Date,
        },
        cancelledAt: {
            type: Date,
        },
        cancellationReason: {
            type: String,
        },
    },
    { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
