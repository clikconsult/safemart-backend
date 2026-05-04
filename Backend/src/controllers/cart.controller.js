import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";

// Calculate cart totals
const calculateTotals = (cart) => {
    cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
    cart.totalPrice = cart.items.reduce((total, item) => total + item.subtotal, 0);
    return cart;
};

// ----------------------
// GET CART
// ----------------------
// ... rest of your code
// ----------------------
// GET CART
// ----------------------
export const getCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(200).json({
                success: true,
                data: { items: [], totalItems: 0, totalPrice: 0 },
            });
        }

        return res.status(200).json({
            success: true,
            data: cart,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// ADD ITEM TO CART
// ----------------------
export const addToCart = async (req, res) => {
    try {
        const { productId } = req.body;
        const rawQuantity = req.body.quantity ?? 1;
        const quantity = Number(rawQuantity);

        if (!productId) {
            return res.status(400).json({ success: false, message: "productId is required" });
        }
        if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1) {
            return res.status(400).json({ success: false, message: "Invalid quantity" });
        }

        const MAX_QTY = 999;
        const safeQty = Math.min(quantity, MAX_QTY);

        // Find product
        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Find or create cart
        let cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            cart = new Cart({ user: req.user._id, items: [] });
        }

        // Check if product already in cart
        const existingItem = cart.items.find(
            (item) => item.product.toString() === productId
        );

        const existingQty = existingItem?.quantity ?? 0;

        // Check stock against resulting quantity (prevents oversell on add)
        if (product.stock < existingQty + safeQty) {
            return res.status(400).json({
                success: false,
                message: "Insufficient stock",
            });
        }

        if (existingItem) {
            existingItem.quantity = existingQty + safeQty;
            existingItem.subtotal = existingItem.price * existingItem.quantity;
        } else {
            cart.items.push({
                product: productId,
                name: product.name,
                image: product.images[0] || "",
                price: product.discountPrice || product.price,
                quantity: safeQty,
                subtotal: (product.discountPrice || product.price) * safeQty,
            });
        }

        calculateTotals(cart);
        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Item added to cart",
            data: cart,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// UPDATE ITEM QUANTITY
// ----------------------
export const updateCartItem = async (req, res) => {
    try {
        const rawQuantity = req.body.quantity;
        const { productId } = req.params;

        if (!productId) {
            return res.status(400).json({ success: false, message: "productId is required" });
        }

        const quantity = Number(rawQuantity);

        if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
            return res.status(400).json({ success: false, message: "Invalid quantity" });
        }

        if (quantity <= 0) {
            // Remove item if quantity is 0 or negative
            const cart = await Cart.findOne({ user: req.user._id });
            if (!cart) {
                return res.status(404).json({
                    success: false,
                    message: "Cart not found",
                });
            }

            cart.items = cart.items.filter(
                (item) => item.product.toString() !== productId
            );

            calculateTotals(cart);
            await cart.save();

            return res.status(200).json({
                success: true,
                message: "Cart updated",
                data: cart,
            });
        }

        // Enforce stock for the resulting quantity
        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        if (product.stock < quantity) {
            return res.status(400).json({ success: false, message: "Insufficient stock" });
        }

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found",
            });
        }

        const item = cart.items.find(
            (item) => item.product.toString() === productId
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart",
            });
        }

        item.quantity = quantity;
        item.subtotal = item.price * quantity;

        calculateTotals(cart);
        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Cart updated",
            data: cart,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// REMOVE ITEM FROM CART
// ----------------------
export const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.params;

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found",
            });
        }

        cart.items = cart.items.filter(
            (item) => item.product.toString() !== productId
        );

        calculateTotals(cart);
        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Item removed from cart",
            data: cart,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// CLEAR CART
// ----------------------
export const clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found",
            });
        }

        cart.items = [];
        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Cart cleared",
            data: cart,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
