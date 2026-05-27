# Safemart Deployment Checklist

## Backend On Render

1. Set the root directory to `Backend`.
2. Use `npm ci` as the install command.
3. Use `npm start` as the start command.
4. Set the health check path to `/api/v1/health/ready`.
5. Add these environment variables:
   `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `PAYSTACK_SECRET_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ADMIN_EMAIL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGIN`, `COOKIE_SAME_SITE`, `COOKIE_SECURE`, `COOKIE_DOMAIN`.
6. For cross-origin production deployments, set:
   `COOKIE_SAME_SITE=None`
   `COOKIE_SECURE=true`
7. Optional hardening envs:
   `MAX_UPLOAD_BYTES=5242880`
   `MAX_UPLOAD_FILES=5`
   `PAYMENT_RESERVATION_MINUTES=30`
   `REQUEST_SIZE_LIMIT=1mb`

## Frontend On Vercel

1. Set the root directory to `safemart-frontend`.
2. Build command: `npm run build`.
3. Output directory: `dist`.
4. Add `VITE_API_URL` pointing to the Render backend origin.
5. Keep [vercel.json](/abs/path/c:/Users/USER/OneDrive/Documents/Safemart/safemart-frontend/vercel.json) in place so SPA routes rewrite to `index.html`.

## Before Going Live

1. Rotate every secret currently present in local `.env` files.
2. Remove any leaked secrets from git history if they were ever pushed.
3. Confirm `https` is active on both frontend and backend origins.
4. Test login, refresh, logout, checkout, Paystack callback, avatar upload, and admin product upload in production.
5. Confirm CORS with browser devtools, not just Postman.
6. Verify `/api/v1/health` returns `200` and `/api/v1/health/ready` returns `200` after DB connection succeeds.
