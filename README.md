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
| `ADMIN_TOKEN` | Secret for the admin page `/admin.html`. Admin is disabled when unset. Set it only in the hosting dashboard. |
| `STORE_FACEBOOK` / `STORE_INSTAGRAM` / `STORE_TIKTOK` | Optional social links, must start with `https://`. Shown in the footer only when set. |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Optional. Sends a Telegram message for each new order, listing, and buyer message. Both must be set. |

### Admin page

Open `/admin.html` and enter the `ADMIN_TOKEN`. Tabs: orders (status, internal notes, call/WhatsApp), product review (approve/reject sellers' listings), products (edit price, discount, stock; pause or delete), buyer messages, coupons, stats, and a database backup download.

Order status changes: cancelling or rejecting an order returns its stock and coupon use. A cancelled or rejected order cannot be reopened.

### Sellers

A seller submits a product at `#sell`. It stays hidden until approved. The seller receives a private manage link (shown once) at `/manage.html#TOKEN` to change price, discount, stock, and description. Only a hash of the token is stored.

### Limits and privacy

- Each phone number can place at most 3 orders in 24 hours (cancelled and rejected orders are not counted).
- Legal pages `privacy.html` and `terms.html` are drafts. Review them before relying on them.
- Delivery fees in `lib/data.js` are placeholders. Set real fees per wilaya.

### Persistence

On Railway, attach a Volume and set `DB_FILE` to a path inside it (for example `/app/data/accessories-dz.db`). Without a Volume, data is lost on redeploy.

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
