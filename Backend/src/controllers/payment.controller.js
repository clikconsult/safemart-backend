import axios from "axios";
import crypto from "crypto";
import mongoose from "mongoose";
import { Order } from "../models/order.model.js";
import { commitOrderSideEffects, releaseOrderInventory } from "../services/order-fulfillment.service.js";

function isReservationExpired(order) {
    const expiresAt = order.paymentInfo?.expiresAt;
    return Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now());
}

async function expirePendingOrder(order) {
    if (order.orderStatus === "cancelled") {
        return order;
    }

    await releaseOrderInventory(order);
    order.orderStatus = "cancelled";
    order.cancelledAt = new Date();
    order.cancellationReason = "Payment window expired";
    order.paymentInfo.status = "failed";
    order.statusHistory.push({
        status: "cancelled",
        changedAt: new Date(),
        note: "Payment window expired",
    });
    await order.save();

    return order;
}


// ----------------------
// INITIALIZE PAYMENT
// ----------------------
export const initializePayment = async (req, res) => {
    try {
        const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
        const { orderId } = req.body;

        const order = await Order.findById(orderId);
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
                message: "Not authorized",
            });
        }

        // Check if already paid
        if (order.paymentInfo.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "Order already paid",
            });
        }

        if (order.paymentInfo.method !== "paystack") {
            return res.status(400).json({
                success: false,
                message: "This order is not configured for Paystack payment",
            });
        }

        if (isReservationExpired(order)) {
            await expirePendingOrder(order);
            return res.status(410).json({
                success: false,
                message: "This payment session has expired. Please create a new order.",
            });
        }

        // Initialize payment with Paystack
        const reference = `safemart_${orderId}_${Date.now()}`;
        const response = await axios.post(
            "https://api.paystack.co/transaction/initialize",
            {
                email: req.user.email,
                amount: order.finalPrice * 100, // Paystack uses kobo
                reference,
                metadata: {
                    orderId,
                    userId: req.user._id,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET}`,
                    "Content-Type": "application/json",
                },
            }
        );

        order.paymentInfo.paystackReference = reference;
        await order.save();

        return res.status(200).json({
            success: true,
            message: "Payment initialized",
            data: {
                authorizationUrl: response.data.data.authorization_url,
                reference: response.data.data.reference,
                accessCode: response.data.data.access_code,
            },
        });


    } catch (error) {
        console.log("Paystack error:", error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: error.response?.data?.message || error.message,
        });
    }
};


// ----------------------
// VERIFY PAYMENT
// ----------------------
export const verifyPayment = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
        const { reference } = req.params;

        // Verify with Paystack
        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET}`,
                },
            }
        );

        const { status, metadata, amount } = response.data.data;

        if (status !== "success") {
            return res.status(400).json({
                success: false,
                message: "Payment verification failed",
            });
        }

        // Find and update order
        const order = await Order.findById(metadata.orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        if (order.paymentInfo.method !== "paystack") {
            return res.status(400).json({
                success: false,
                message: "Order does not use Paystack payment",
            });
        }

        if (isReservationExpired(order) && order.paymentInfo.status !== "paid") {
            await expirePendingOrder(order);
            return res.status(410).json({
                success: false,
                message: "This payment session expired before verification completed",
            });
        }

        if (String(metadata?.userId) !== String(order.user)) {
            return res.status(400).json({
                success: false,
                message: "Payment metadata does not match this order",
            });
        }

        if (Number(amount) !== Number(order.finalPrice) * 100) {
            return res.status(400).json({
                success: false,
                message: "Verified payment amount does not match order total",
            });
        }

        if (order.paymentInfo.paystackReference && order.paymentInfo.paystackReference !== reference) {
            return res.status(400).json({
                success: false,
                message: "Payment reference does not match initialized order payment",
            });
        }

        if (order.paymentInfo.status === "paid" && order.inventoryCommitted) {
            return res.status(200).json({
                success: true,
                message: "Payment already verified",
                data: order,
            });
        }

        let updatedOrder;
        await session.withTransaction(async () => {
            const transactionalOrder = await Order.findById(order._id).session(session);

            if (!transactionalOrder) {
                throw new Error("Order not found");
            }

            if (transactionalOrder.paymentInfo.status !== "paid") {
                transactionalOrder.paymentInfo.status = "paid";
                transactionalOrder.paymentInfo.paidAt = new Date();
                transactionalOrder.paymentInfo.paystackReference = reference;
                transactionalOrder.paymentInfo.expiresAt = undefined;
                transactionalOrder.orderStatus = "processing";
                transactionalOrder.statusHistory.push({
                    status: "processing",
                    changedAt: new Date(),
                    note: "Payment confirmed",
                });
            }

            await transactionalOrder.save({ session });
            updatedOrder = transactionalOrder;
        });

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            data: updatedOrder,
        });

    } catch (error) {
        const statusCode = error.message.startsWith("Insufficient stock") || error.message.startsWith("Product ")
            ? 409
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
// PAYSTACK WEBHOOK
// ----------------------
export const paystackWebhook = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const hash = crypto
            .createHmac("sha512", secret)
            .update(JSON.stringify(req.body))
            .digest("hex");

        if (hash !== req.headers["x-paystack-signature"]) {
            return res.status(401).json({ message: "Invalid signature" });
        }

        const event = req.body;

        if (event.event === "charge.success") {
            const { metadata, reference, amount } = event.data;

            const order = await Order.findById(metadata.orderId);
            if (
                order &&
                order.paymentInfo.method === "paystack" &&
                String(metadata?.userId) === String(order.user) &&
                Number(amount) === Number(order.finalPrice) * 100 &&
                (!order.paymentInfo.paystackReference || order.paymentInfo.paystackReference === reference)
            ) {
                await session.withTransaction(async () => {
                    const transactionalOrder = await Order.findById(order._id).session(session);

                    if (!transactionalOrder) {
                        return;
                    }

                    if (isReservationExpired(transactionalOrder) && transactionalOrder.paymentInfo.status !== "paid") {
                        await expirePendingOrder(transactionalOrder);
                        return;
                    }

                    if (transactionalOrder.paymentInfo.status !== "paid") {
                        transactionalOrder.paymentInfo.status = "paid";
                        transactionalOrder.paymentInfo.paidAt = new Date();
                        transactionalOrder.paymentInfo.paystackReference = reference;
                        transactionalOrder.paymentInfo.expiresAt = undefined;
                        transactionalOrder.orderStatus = "processing";
                        transactionalOrder.statusHistory.push({
                            status: "processing",
                            changedAt: new Date(),
                            note: "Payment confirmed via webhook",
                        });
                    }

                    await transactionalOrder.save({ session });
                });
            }
        }

        return res.status(200).json({ received: true });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    } finally {
        await session.endSession();
    }
};
