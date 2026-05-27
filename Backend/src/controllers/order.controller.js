import mongoose from "mongoose";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";
import { commitOrderSideEffects, releaseOrderInventory } from "../services/order-fulfillment.service.js";
import { clampNumber, normalizeString } from "../utils/request.utils.js";

const PAYMENT_RESERVATION_MINUTES = Number(process.env.PAYMENT_RESERVATION_MINUTES || 30);

// ----------------------
// CREATE ORDER
// ----------------------
export const createOrder = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { shippingAddress, paymentMethod } = req.body;
        const allowedPaymentMethods = ["paystack", "cash_on_delivery"];

        if (!allowedPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Unsupported payment method",
            });
        }

        if (
            !shippingAddress?.fullName ||
            !shippingAddress?.phone ||
            !shippingAddress?.street ||
            !shippingAddress?.city ||
            !shippingAddress?.state
        ) {
            return res.status(400).json({
                success: false,
                message: "Complete shipping address is required",
            });
        }

        let createdOrder;

        await session.withTransaction(async () => {
            // Get user cart
            const cart = await Cart.findOne({ user: req.user._id }).session(session);
            if (!cart || cart.items.length === 0) {
                throw new Error("Your cart is empty");
            }

            // Verify stock for all items
            for (const item of cart.items) {
                const product = await Product.findById(item.product).session(session);
                if (!product || !product.isActive) {
                    throw new Error(`Product ${item.name} is no longer available`);
                }
                if (product.stock < item.quantity) {
                    throw new Error(`Insufficient stock for ${item.name}`);
                }
            }

            // Calculate shipping price
            const shippingPrice = cart.totalPrice > 50000 ? 0 : 2500;
            const finalPrice = cart.totalPrice + shippingPrice;

            const order = new Order({
                user: req.user._id,
                items: cart.items,
                shippingAddress,
                paymentInfo: {
                    method: paymentMethod,
                    status: "pending",
                    ...(paymentMethod === "paystack"
                        ? { expiresAt: new Date(Date.now() + PAYMENT_RESERVATION_MINUTES * 60 * 1000) }
                        : {}),
                },
                totalItems: cart.totalItems,
                totalPrice: cart.totalPrice,
                shippingPrice,
                finalPrice,
            });

            await commitOrderSideEffects(order, session);

            await order.save({ session });
            createdOrder = order;
        });

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            data: createdOrder,
        });

    } catch (error) {
        const statusCode = error.message === "Your cart is empty" || error.message.startsWith("Product ") || error.message.startsWith("Insufficient stock")
            ? 400
            : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message,
        });
    } finally {
        await session.endSession();
    }
};

// ----------------------
// GET MY ORDERS
// ----------------------
export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            total: orders.length,
            data: orders,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// GET SINGLE ORDER
// ----------------------
export const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // Make sure user owns this order
        if (order.user.toString() !== req.user._id.toString() &&
            req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Not authorized to view this order",
            });
        }

        return res.status(200).json({
            success: true,
            data: order,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// CANCEL ORDER
// ----------------------

export const cancelOrder = async (req, res) => {
    try {
        const reason = normalizeString(req.body.reason, { fallback: "Cancelled by customer" });
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // Make sure user owns this order
        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to cancel this order",
            });
        }

        // Only pending or processing orders can be cancelled
        if (!["pending", "processing"].includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled as it is already ${order.orderStatus}`,
            });
        }

        if (order.paymentInfo?.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "Paid orders cannot be cancelled without a refund process",
            });
        }

        order.orderStatus = "cancelled";
        order.cancellationReason = reason;
        order.cancelledAt = new Date();
        order.statusHistory.push({ status: "cancelled", changedAt: new Date() });
        await releaseOrderInventory(order);

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order cancelled successfully",
            data: order,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// ADMIN - GET ALL ORDERS
// ----------------------
export const getAllOrders = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const query = {};
        if (status) query.orderStatus = status;

        const safePage = clampNumber(page, { min: 1, max: 100000, fallback: 1 });
        const safeLimit = clampNumber(limit, { min: 1, max: 100, fallback: 10 });
        const skip = (safePage - 1) * safeLimit;
        const total = await Order.countDocuments(query);

        const orders = await Order.find(query)
            .populate("user", "fullName email phone")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit);

        return res.status(200).json({
            success: true,
            total,
            page: safePage,
            pages: Math.ceil(total / safeLimit),
            data: orders,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// ADMIN - UPDATE ORDER STATUS
// ----------------------

export const updateOrderStatus = async (req, res) => {
    try {
        const status = normalizeString(req.body.status);
        const note = normalizeString(req.body.note, { fallback: "" });
        const order = await Order.findById(req.params.id);
        const allowedStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
        const allowedTransitions = {
            pending: ["processing", "cancelled"],
            processing: ["shipped", "cancelled"],
            shipped: ["delivered"],
            delivered: [],
            cancelled: [],
        };

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order status",
            });
        }

        if (status === order.orderStatus) {
            return res.status(200).json({
                success: true,
                message: "Order status unchanged",
                data: order,
            });
        }

        if (!allowedTransitions[order.orderStatus]?.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot move order from ${order.orderStatus} to ${status}`,
            });
        }

        if (status === "cancelled" && order.paymentInfo?.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "Paid orders cannot be cancelled from admin status flow without a refund process",
            });
        }

        if (status === "cancelled" && order.inventoryCommitted) {
            await releaseOrderInventory(order);
        }

        order.orderStatus = status;
        order.statusHistory.push({ 
            status, 
            changedAt: new Date(), 
            note: note || "" 
        });
        if (status === "delivered") order.deliveredAt = new Date();
        if (status === "cancelled") order.cancelledAt = new Date();
        if (status === "processing") order.cancelledAt = undefined;

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order status updated successfully",
            data: order,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

