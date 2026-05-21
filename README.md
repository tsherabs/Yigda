# Yigda

Yigda is a single-origin Next.js document verification platform. Pages and API route handlers run from one app, so local development uses one localhost instead of separate frontend and backend ports.

## Getting Started

1. Copy `.env.example` to `.env.local`.
2. Fill in `DATABASE_URL` and any live integrations you want to test.
3. Install dependencies with `npm install`.
4. Run the app with `npm run dev`.

The app seeds a local admin account on first database access using `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
