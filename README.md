# ACCESSORIES DZ

Algerian accessories store: Arabic (RTL) with French toggle, DZD prices, Cash on Delivery,
delivery to all 58 wilayas, server-side pricing, SQLite storage.

## Run locally

Requires Node.js 22.13 or newer (uses the built-in `node:sqlite`; no npm install needed).

    npm start                       # http://localhost:3000
    npm test                        # API test suite

Optional environment variables:

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 3000) |
| `DB_FILE` | SQLite file path (default `data/accessories-dz.db`) |
| `STORE_WHATSAPP` | Store WhatsApp number, digits with country code, e.g. `213555000000` |
| `STORE_PHONE` | Store phone number shown on the call button |
| `RATE_LIMIT_MAX` | Max order attempts per IP per 10 min (default 10) |

## Before going live

- **Delivery fees are placeholders** (home 700 DA, pickup 400 DA, same for all wilayas).
  Set real values in the `delivery_settings` table. Admin UI for this is not built yet.
- **Products are sample data.** Replace them in the `products` table.
- **Privacy policy and terms pages** are not written yet (footer links are placeholders).
- **Admin dashboard, order status updates and CSV export** are not built yet.

## Architecture

- `server.js`: HTTP server, JSON API, static files, security headers, rate limits.
- `lib/db.js`: versioned migrations and first-run seed data.
- `lib/orders.js`: validation, server-side pricing, stock checks, idempotent order creation, tracking.
- `lib/data.js`: 58 wilayas (Arabic and French) and sample catalog.
- `public/`: storefront (vanilla HTML/CSS/JS, no build step).

## Security notes

- Prices, totals and delivery fees are always computed on the server. Client values are ignored.
- Duplicate orders are prevented with an `Idempotency-Key` header (one key per checkout attempt).
- Order tracking needs both the reference and the phone number and returns only the status.
- Responses carry a Content-Security-Policy, `X-Frame-Options: DENY` and `nosniff`.
- Customer data is never written to browser storage. Only the cart (product ids and quantities) is kept locally.
