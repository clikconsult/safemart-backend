import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";

const calculateCartTotals = (cart) => {
    cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
    cart.totalPrice = cart.items.reduce((total, item) => total + item.subtotal, 0);
    return cart;
};

export const commitOrderSideEffects = async (order, session) => {
    if (order.inventoryCommitted) {
        return order;
    }

    for (const item of order.items) {
        const product = await Product.findById(item.product).session(session);

        if (!product || !product.isActive) {
            throw new Error(`Product ${item.name} is no longer available`);
        }

        if (product.stock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.name}`);
        }

        product.stock -= item.quantity;
        product.sold += item.quantity;
        await product.save({ session });
    }

    const cart = await Cart.findOne({ user: order.user }).session(session);
    if (cart) {
        cart.items = [];
        calculateCartTotals(cart);
        await cart.save({ session });
    }

    order.inventoryCommitted = true;
    order.inventoryCommittedAt = new Date();

    return order;
};
