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
        const { productId, quantity = 1 } = req.body;

        // Find product
        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Check stock
        if (product.stock < quantity) {
            return res.status(400).json({
                success: false,
                message: "Insufficient stock",
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

        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.subtotal = existingItem.price * existingItem.quantity;
        } else {
            cart.items.push({
                product: productId,
                name: product.name,
                image: product.images[0] || "",
                price: product.discountPrice || product.price,
                quantity,
                subtotal: (product.discountPrice || product.price) * quantity,
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
        const { quantity } = req.body;
        const { productId } = req.params;

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

        if (quantity <= 0) {
            // Remove item if quantity is 0
            cart.items = cart.items.filter(
                (item) => item.product.toString() !== productId
            );
        } else {
            item.quantity = quantity;
            item.subtotal = item.price * quantity;
        }

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