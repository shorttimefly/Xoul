# Public interface changes

## 2026-09-13

- Added `GET /api/v1/admin/products` so the management page hydrates from the server before syncing browser state. This prevents a fresh browser from overwriting existing products with demo data.
- The products response strips any legacy per-product API keys or tokens before returning data to the browser.
- Added `GET /api/v1/admin/catalog` for shared type/model metadata. Model API keys are never returned; clients receive only `api_key_configured`.
- Product image saves now trigger asynchronous image understanding and expose an editable product Prompt in the management UI.
- Product management now generates a copyable C-end URL at `/e/{slug}` for direct preview and NFC writing.
