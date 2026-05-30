import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import mongoose from "mongoose";
import { errorHandler } from "./middleware/error.middleware.js";
import { createRateLimiter, securityHeaders } from "./middleware/security.middleware.js";

import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import contactRouter from "./routes/contact.routes.js";

const app = express();
const requestSizeLimit = process.env.REQUEST_SIZE_LIMIT || "1mb";

app.set("trust proxy", 1);

// ====================== GLOBAL MIDDLEWARE ======================
app.use(express.json({
  limit: requestSizeLimit,
  verify: (req, res, buffer) => {
    req.rawBody = buffer;
  },
}));
app.use(express.urlencoded({ extended: true, limit: requestSizeLimit }));
app.use(cookieParser());
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: process.env.UPLOAD_TEMP_DIR || "./tmp",
  createParentPath: true,
  abortOnLimit: true,
  safeFileNames: true,
  preserveExtension: true,
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024),
    files: Number(process.env.MAX_UPLOAD_FILES || 5),
  },
}));
app.use(securityHeaders);

// ====================== CORS CONFIG ======================
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGIN || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, mobile apps, server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error("CORS policy: origin not allowed"))
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}))

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  message: "Too many authentication attempts. Please try again later.",
});

const contactLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.CONTACT_RATE_LIMIT_MAX || 10),
  message: "Too many contact requests. Please try again later.",
});

const paymentLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.PAYMENT_RATE_LIMIT_MAX || 30),
  message: "Too many payment requests. Please try again later.",
});

// ====================== ROUTES ======================
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "safemart-backend",
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: "v1",
  });
});

app.get("/api/v1/health/ready", (req, res) => {
  const isReady = mongoose.connection.readyState === 1;

  res.status(isReady ? 200 : 503).json({
    success: isReady,
    service: "safemart-backend",
    status: isReady ? "ready" : "degraded",
    database: {
      readyState: mongoose.connection.readyState,
    },
    timestamp: new Date().toISOString(),
    version: "v1",
  });
});

app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/payment", paymentLimiter, paymentRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/contact", contactLimiter, contactRouter);

// ====================== ERROR HANDLER LAST======================
app.use(errorHandler);

export default app;
