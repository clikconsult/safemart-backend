import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";

// Generate both tokens and save refresh token to DB
const generateTokens = async (userId) => {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
};

const cookieResponseData = (user, accessToken, refreshToken) => ({
  success: true,
  data: user,
  accessToken,
  refreshToken,
})

function clearAuthCookies(res) {
    const cookieOptions = getCookieOptions();

    return res
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions);
}

// After
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,           // must be true for sameSite: "none"
    sameSite: isProduction ? "none" : "strict",  // "none" required for cross-domain
    path: "/",
  };
}

export const register = async (req, res) => {
    try {
        const cookieOptions = getCookieOptions();
        const { fullName, email, password, phone } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Full name, email and password are required",
            });
        }

        const existingUser = await User.findOne({ email });
        
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered",
            });
        }

        const user = await User.create({ fullName, email, password, phone });

        const { accessToken, refreshToken } = await generateTokens(user._id);

        const createdUser = await User.findById(user._id).select("-password -refreshToken");

        return res.status(201)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json({ ...cookieResponseData(createdUser, accessToken, refreshToken), message: "Account created successfully" });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// LOGIN
// ----------------------
export const login = async (req, res) => {
    try {
        const cookieOptions = getCookieOptions();
        const { email, password } = req.body;

        // Check all fields are provided
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated",
            });
        }

        // Check password
        const isPasswordValid = await user.isPasswordCorrect(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        // Generate tokens
        const { accessToken, refreshToken } = await generateTokens(user._id);

        // Get user without password and refreshToken
        const loggedInUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json({ ...cookieResponseData(loggedInUser, accessToken, refreshToken), message: "Logged in successfully" });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ----------------------
// LOGOUT
// ----------------------
export const logout = async (req, res) => {
    try {
        if (req.user?._id) {
            await User.findByIdAndUpdate(
                req.user._id,
                { $unset: { refreshToken: 1 } },
                { returnDocument: "after" }
            );
        }

        return clearAuthCookies(res)
            .status(200)
            .json({
                success: true,
                message: "Logged out successfully",
            });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const refreshAccessToken = async (req, res) => {
  try {
    // Read from cookie OR request body
    const incomingRefreshToken = 
      req.cookies?.refreshToken || req.body?.refreshToken

    if (!incomingRefreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      })
    }
    
        const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decoded._id);

        if (!user || user.refreshToken !== incomingRefreshToken) {
            return clearAuthCookies(res).status(401).json({
                success: false,
                message: "Invalid refresh token",
            });
        }

        if (!user.isActive) {
            return clearAuthCookies(res).status(403).json({
                success: false,
                message: "Your account has been deactivated",
            });
        }

        const { accessToken, refreshToken } = await generateTokens(user._id);
        const safeUser = await User.findById(user._id).select("-password -refreshToken");
        const cookieOptions = getCookieOptions();

        return res.status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json({
                ...cookieResponseData(safeUser, accessToken, refreshToken),
                message: "Session refreshed successfully",
            });
    } catch (error) {
        return clearAuthCookies(res).status(401).json({
            success: false,
            message: "Invalid or expired refresh token",
        });
    }
};

// ----------------------
// GET CURRENT USER
// ----------------------
export const getCurrentUser = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            data: req.user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
