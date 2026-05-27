const rateLimitStore = new Map();

function now() {
    return Date.now();
}

function getClientKey(req) {
    const forwardedFor = req.headers["x-forwarded-for"];
    const ip = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : String(forwardedFor || req.ip || req.socket?.remoteAddress || "unknown")
            .split(",")[0]
            .trim();

    return ip || "unknown";
}

export function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "0");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
}

export function createRateLimiter({ windowMs, max, message }) {
    return (req, res, next) => {
        const key = `${req.baseUrl || ""}:${req.path}:${getClientKey(req)}`;
        const startedAt = now();
        const existing = rateLimitStore.get(key);

        if (!existing || startedAt > existing.resetAt) {
            rateLimitStore.set(key, {
                count: 1,
                resetAt: startedAt + windowMs,
            });
            return next();
        }

        if (existing.count >= max) {
            const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - startedAt) / 1000));
            res.setHeader("Retry-After", retryAfterSeconds);
            return res.status(429).json({
                success: false,
                message,
            });
        }

        existing.count += 1;
        return next();
    };
}
