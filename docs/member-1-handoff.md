# Member 1 frontend handoff

The `frontend-api` work now includes safer DOM rendering, validated image URLs and cart entries, dish search, server-checked checkout pricing with an error/review flow, improved keyboard behavior, and frontend behavior tests. See `docs/smoke-test-checklist.md` for manual UI checks. These changes still need a browser smoke test in the deployed frontend image.

## Remaining application-owner work

1. **Staff access:** The public demo key and fallback are removed. Set `ADMIN_TOKEN` privately to enable staff mode. The token is entered by staff and kept in browser session storage; this is a demo access model, not production account authentication.
2. **Customer tracking:** New orders receive a random tracking token. The browser stores it with the order ID and sends it when fetching that order. The server stores only a hash, rejects ID-only lookup, and omits phone and address from customer tracking responses. Previously placed JSON orders have no tracking token and can only be viewed by authorized staff.
3. **Keep checkout and cart behavior aligned with the backend.** The backend now verifies menu prices and computes totals. If the order payload or response changes again, update `client/js/cart.js`, the API tests, and the price-change recovery flow together. Preserve the same-origin `/api` URLs used by NGINX and Kubernetes.
4. **Persistence and observability:** PostgreSQL order storage is available when configured; local JSON remains a development fallback. Kubernetes uses a PostgreSQL StatefulSet and persistent volume claim. Backend request metrics are not exposed yet.

Use only synthetic customer details in demos and tests. The catalog now contains 100 restaurants and 1,957 menu items imported from Zomato and Swiggy menu CSVs, with matching restaurant metadata; these are historical demo records, not live listings. The raw CSVs remain Git-ignored. See the [catalog import notes](catalog-import.md) before redistributing generated records. Run `npm run check`, `npm test`, and the responsive browser checklist.
