# Member 1 frontend handoff

The `frontend-api` work now includes safer DOM rendering, validated image URLs and cart entries, dish search, server-checked checkout pricing with an error/review flow, improved keyboard behavior, and frontend behavior tests. See `docs/smoke-test-checklist.md` for manual UI checks. These changes still need a browser smoke test in the deployed frontend image.

## Remaining application-owner work

1. **Remove the public staff credential.** `server/routes/orderRoutes.js` accepts `admin123` even when `ADMIN_TOKEN` is set, and `client/js/orders.js` tells visitors that key. Remove both the bypass and the hint. The CI security contract test intentionally fails until the public key no longer grants staff access. Do not treat a replacement static token in browser JavaScript as production authentication.
2. **Protect order lookup and personal data.** The UI stores sequential order IDs in the browser and permits lookup by ID; the backend masks phone numbers but still returns other order details. Use real identity/authorization or a deliberately limited, non-personal lookup flow before exposing the app to real users. Frontend controls alone cannot enforce this.
3. **Keep checkout and cart behavior aligned with the backend.** The backend now verifies menu prices and computes totals. If the order payload or response changes again, update `client/js/cart.js`, the API tests, and the price-change recovery flow together. Preserve the same-origin `/api` URLs used by NGINX and Kubernetes.
4. **Complete persistence and observability with the team.** Orders still live in `server/data/orders.json`, which is lost on backend pod replacement. Backend request metrics are not exposed yet. Tell Member 3 the agreed database and metrics contracts before new infrastructure is added.

Use only synthetic customer details in demos and tests. The repository has six sample restaurants and 28 menu items; no external food dataset is needed. Commit each logical change and run `npm run check`, `npm test`, and the responsive browser checklist. Once the demo-key bypass is removed, the full test suite should pass again.
