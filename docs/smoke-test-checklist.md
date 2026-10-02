# Responsive Smoke-Test Checklist & Verification Guide

This document provides a manual and responsive smoke-test checklist for CloudBite Member 1 frontend and backend changes.

The `Pass` entries below came with the `frontend-api` branch; a full browser run against the Docker or Kubernetes frontend has not been verified here. Staff/demo access is **not** secure while the public `admin123` key remains accepted by the backend. Use only synthetic customer data.

---

## 1. Automated Behavior Tests
Run automated test suite:
```bash
npm test
npm run check
```
Test suite coverage (`test/frontend.test.js` & `test/server.test.js`):
- **Search & Filter**: Matching by restaurant name, cuisine, location, and dish/food names (e.g. searching "biryani" finds restaurants serving Biryani).
- **Cart Validation & Persistence**: Untrusted `localStorage` validation, sanitization of corrupted data, quantity limits (1–50), and calculation of order totals with delivery tiers and platform fee.
- **Checkout Validation & Authoritative Pricing**: Server-side verification against `menu.json`, rejection of price-tampered requests, rejection of unavailable item IDs, and server-confirmed grand total computation.
- **Order Visibility & Access Control**: Strict access control preventing anonymous visitors from viewing global order history, order lookup by ID, masking of sensitive customer phone numbers, and protection of status updates (`403 Forbidden` without staff key).
- **Security & Injection Protection**: Rejection of dangerous URL schemes (`javascript:`, `data:`, `vbscript:`), and safe DOM text handling.

---

## 2. Responsive UI & Layout Smoke Tests

Verify across viewports using browser DevTools Device Mode:
- **Mobile Viewport (360px – 480px)**: e.g. iPhone SE / Pixel 7
- **Tablet Viewport (768px – 1024px)**: e.g. iPad Air
- **Desktop Viewport (1200px+)**: Standard desktop

| Test Case | Viewport | Expected Behavior | Status |
| --- | --- | --- | --- |
| **Mobile Navigation Toggle** | Mobile (< 768px) | Hamburger button displays with `aria-expanded="false"`. Clicking or pressing Space/Enter toggles menu visibility and updates `aria-expanded="true"`. | Pass |
| **Hero Food Search** | All viewports | Input is responsive, full-width on mobile. Submitting "biryani" navigates to `restaurants.html?search=biryani` and displays matching restaurants. | Pass |
| **Cuisine Chips Navigation** | Mobile & Desktop | Category chips wrap smoothly or scroll horizontally without overflowing. Keyboard `Enter`/`Space` activates filter chip and updates `aria-pressed`. | Pass |
| **Restaurant Cards Grid** | Mobile (1 column), Tablet (2 cols), Desktop (3 cols) | Restaurant cards adapt to grid column layout. Image aspect ratio is preserved with fallback image on error. | Pass |
| **Dish Match Indicator** | All viewports | When searching for food items (e.g. "biryani", "pizza", "burger"), matching dish tags (`🍲 Matches dish: "..."`) appear on restaurant cards. | Pass |
| **Menu Category Tabs** | Mobile & Desktop | Dish category chips can be toggled via mouse or keyboard (`Enter`/`Space`). Only items in selected category appear. | Pass |
| **Add To Cart & Live Badge** | All viewports | Clicking "+ ADD" adds dish to cart, shows accessible toast notification, and updates the navbar badge count with `aria-live` announcement. | Pass |
| **Cart Items & Quantity Controls** | Mobile & Desktop | Cart items layout stacks into responsive rows. `+`, `−`, and `🗑️` buttons have clear `aria-label` attributes and update total smoothly. | Pass |
| **Checkout Rejection & Recovery** | All viewports | If an order fails or prices mismatch, cart items remain preserved, submit button is re-enabled, and a clear error banner with "Review & Refresh Cart Prices" is shown. | Pass |
| **Order Confirmation Dialog** | Mobile & Desktop | Upon successful checkout, modal appears with `role="dialog"` and `aria-modal="true"`. Focus is trapped within modal, displaying the server-confirmed order total. Pressing `Escape` closes the dialog. | Pass |
| **Order History Privacy** | All viewports | Public visitors only see their own placed orders or can look up an order by ID. Other customers' private names, phone numbers, and addresses are never exposed. | Pass |
| **Staff Mode Isolation** | All viewports | Status transition simulation controls are hidden from ordinary visitors, but the public demo key currently grants staff access. Remove that bypass and verify real authorization before deployment. | Blocked |

---

## 3. Security & Safe Rendering Verification

| Check | Test Input | Expected Behavior | Status |
| --- | --- | --- | --- |
| **XSS in Restaurant Name** | `<script>alert(1)</script>` | Rendered purely as literal text via `textContent`; does not execute. | Pass |
| **XSS in Dish Description** | `<img src=x onerror=alert('xss')>` | Rendered as text; image tag does not parse. | Pass |
| **XSS in Customer Name** | `<svg onload=alert(1)>` | Displayed as plain text in order cards and confirmation modal. | Pass |
| **XSS in Toast Message** | `<b>Hello</b> <script>...</script>` | Displayed as plain string inside toast text span. | Pass |
| **Malicious Image URLs** | `javascript:alert(1)` | Filtered out by `sanitizeImageUrl` and replaced with safe fallback image. | Pass |
| **Cart Tampering** | Modified price in localStorage | Backend authoritative pricing detects discrepancy, rejects order, and prompts price refresh. | Pass |
| **Unauthorized Status Patch** | `PATCH /api/orders/:id/status` without key | Backend returns `403 Forbidden`. | Pass |
