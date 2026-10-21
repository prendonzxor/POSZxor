# Stock validation: full count and omitted-product report

The **Guardar items y actualizar stock** action applies a full physical count for the selected branch. The confirmation lists products outside the grid. Confirming:

- Assigns grid quantities to counted products.
- Assigns zero to active, non-service products outside the grid, including products without an inventory row yet.
- Preserves reservations and existing reorder levels.
- Records quantity differences as `adjustment` inventory movements referencing the validation.
- Saves all counted and omitted item snapshots in a permanent report and completes the validation.

Inactive products, services and other branches are excluded. Products hidden by the grid's status filter still count as grid products; they are not treated as omitted. Saving a row or saving progress retains its existing behavior.

`POST /api/inventory/stock-validations/:sessionId/apply` requires Bearer authentication and a body containing `items: [{ productId, realQty }]` plus `scopeProductIds`, the complete active non-service catalog reviewed by the client. The server validates the catalog scope (409 on changes), tenant, branch and session. Applying stock, saving validation items, recording movements, creating the report and closing the validation run in one transaction. A retry of a session with an existing report returns that saved report without applying adjustments again.

`GET /api/inventory/stock-validations/:sessionId/report` returns `{ report }` or `{ report: null }`, scoped to the authenticated tenant. Reports contain immutable names, SKU, barcode, previous stock, real stock, difference and the omitted flag. The reports page (`/reports`) shows omitted products from saved validations and generates their CSV in the browser. `GET /api/inventory/stock-validations/reports?page=1` lists saved reports for the authenticated tenant, newest first, in pages of five. The stock validation page links to reports and still downloads the CSV after applying a count. Omitted zero rows are kept out of the scanning grid on reload.

Database migration: `20261020160000_stock_validation_reports`.

Validation: `node --test tests/stock-validation-report.integration.js` (migrated local MySQL required; fixtures are rolled back).
