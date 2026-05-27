import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

function extractAccessToken(req) {
    return req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");
}

function extractRefreshToken(req) {
    return req.cookies?.refreshToken || null;
}

// Protect routes - must be logged in
export const verifyJWT = async (req, res, next) => {
    try {
        const token = extractAccessToken(req);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized, please login",
            });
        }

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decoded._id).select(
            "-password -refreshToken"
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid token",
            });
        }

        req.user = user;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
};

export const attachUserIfPresent = async (req, res, next) => {
    try {
        const accessToken = extractAccessToken(req);
        const refreshToken = extractRefreshToken(req);
        const token = accessToken || refreshToken;

        if (!token) {
            return next();
        }

        const secret = accessToken
            ? process.env.ACCESS_TOKEN_SECRET
            : process.env.REFRESH_TOKEN_SECRET;

        const decoded = jwt.verify(token, secret);
        const user = await User.findById(decoded._id).select("-password -refreshToken");

        if (user) {
            req.user = user;
        }
    } catch {}

    next();
};

// Restrict to admin only
export const verifyAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Access denied, admins only",
        });
    }
    next();
};
