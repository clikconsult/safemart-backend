# Safemart Backend

Express API for the Safemart storefront.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in your MongoDB, JWT, Paystack, Cloudinary, and email settings.
3. Install dependencies with `npm install`.
4. Start the API with `npm run dev`.

## Cookie And CORS Notes

- `CORS_ALLOWED_ORIGIN` accepts a comma-separated list of allowed frontend origins.
- `COOKIE_SAME_SITE`, `COOKIE_SECURE`, and `COOKIE_DOMAIN` control how auth cookies are issued.
- For cross-origin production deployments, use `COOKIE_SAME_SITE=None` and `COOKIE_SECURE=true`.

## Operations

- Health endpoint: `/api/v1/health`
- Readiness endpoint: `/api/v1/health/ready`
- See [DEPLOYMENT.md](/abs/path/c:/Users/USER/OneDrive/Documents/Safemart/DEPLOYMENT.md) for Render and Vercel rollout steps.
