import { User } from "../models/user.model.js";
import { Product } from "../models/product.model.js";
import { Order } from "../models/order.model.js";
import { clampNumber, normalizeString } from "../utils/request.utils.js";

// ----------------------
// GET ALL USERS
// ----------------------
export const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, role } = req.query;

        const query = {};
        if (role) query.role = role;

        const safePage = clampNumber(page, { min: 1, max: 100000, fallback: 1 });
        const safeLimit = clampNumber(limit, { min: 1, max: 100, fallback: 10 });
        const skip = (safePage - 1) * safeLimit;
        const total = await User.countDocuments(query);

        const users = await User.find(query)
            .select("-password -refreshToken")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit);

        return res.status(200).json({
            success: true,
            total,
            page: safePage,
            pages: Math.ceil(total / safeLimit),
            data: users,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// GET SINGLE USER
// ----------------------
export const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select("-password -refreshToken");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: user,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// ACTIVATE / DEACTIVATE USER
// ----------------------
export const toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Prevent admin from deactivating themselves
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot deactivate your own account",
            });
        }

        user.isActive = !user.isActive;
        await user.save();

        return res.status(200).json({
            success: true,
            message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
            data: user,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// CHANGE USER ROLE
// ----------------------
export const changeUserRole = async (req, res) => {
    try {
        const role = normalizeString(req.body.role);
        const user = await User.findById(req.params.id);
        const allowedRoles = ["customer", "admin"];

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role",
            });
        }

        if (user._id.toString() === req.user._id.toString() && role !== "admin") {
            return res.status(400).json({
                success: false,
                message: "You cannot remove your own admin access",
            });
        }

        user.role = role;
        await user.save();

        return res.status(200).json({
            success: true,
            message: `User role changed to ${role} successfully`,
            data: user,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// SALES ANALYTICS
// ----------------------
export const getSalesAnalytics = async (req, res) => {
    try {
        // Total revenue
        const revenueData = await Order.aggregate([
            { $match: { "paymentInfo.status": "paid" } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$finalPrice" },
                    totalOrders: { $sum: 1 },
                },
            },
        ]);

        // Orders by status
        const ordersByStatus = await Order.aggregate([
            {
                $group: {
                    _id: "$orderStatus",
                    count: { $sum: 1 },
                },
            },
        ]);

        // Revenue by month (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyRevenue = await Order.aggregate([
            {
                $match: {
                    "paymentInfo.status": "paid",
                    createdAt: { $gte: sixMonthsAgo },
                },
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        year: { $year: "$createdAt" },
                    },
                    revenue: { $sum: "$finalPrice" },
                    orders: { $sum: 1 },
                },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]);

        // Top selling products
        const topProducts = await Product.find()
            .sort({ sold: -1 })
            .limit(5)
            .select("name sold price category");

        // Total users
        const totalUsers = await User.countDocuments({ role: "customer" });

        // Recent orders
        const recentOrders = await Order.find()
            .populate("user", "fullName email")
            .sort({ createdAt: -1 })
            .limit(5);

        return res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalRevenue: revenueData[0]?.totalRevenue || 0,
                    totalOrders: revenueData[0]?.totalOrders || 0,
                    totalUsers,
                    totalProducts: await Product.countDocuments({ isActive: true }),
                },
                ordersByStatus,
                monthlyRevenue,
                topProducts,
                recentOrders,
            },
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
