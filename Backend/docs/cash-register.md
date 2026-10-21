# Cash register sessions

One register session can be open per tenant branch. Sessions are shared across devices. All endpoints require the existing Bearer session token; tenant and actor are derived from the authenticated user.

- `GET /api/cash-register?branchId=<id>` returns `{ active, lastClosed }`, including numeric opening balance, expected cash and sale count. Closed sessions also include counted cash, difference, closing time and actor.
- `POST /api/cash-register/open` accepts `{ branchId, openingBalance }` and returns `{ session }` (201).
- `POST /api/cash-register/:id/close` accepts `{ branchId, countedCash }` and returns `{ session }`.

Money inputs must be JSON numbers, nonnegative, with at most two decimals. Missing branches return 404, invalid amounts 400, and already-open/closed or stale sessions 409. Branch access is restricted to the authenticated tenant.

Every `/api/orders/checkout` now requires an open session for its branch, including requests from other clients. An optional `cashRegisterSessionId` rejects checkout if the client is displaying an older session. The server associates the order with the session in the same transaction as stock changes. Older orders stay unassigned. Existing browser-local records are not imported.

Expected cash is opening balance plus paid cash orders linked to the session. Canceled orders are excluded. Card, transfer, credit and mixed orders do not add to expected cash; the current checkout model has no cash portion for mixed payments. Sale count includes all paid orders, regardless of method. Before closing, linked order changes are reflected in the totals. Closing stores a snapshot and prevents edits or cancellations of linked orders. Refunds after closing require a future cash movement/refund workflow.

Branch row locks serialize opening, closing, checkout and linked order updates. A nullable unique active branch key additionally prevents duplicate open sessions. The frontend refreshes on focus, every 15 seconds, and after its own writes; the backend checks session state for every checkout.

Database setup:

```sh
npm run prisma:generate
npx prisma migrate deploy
```

Validation:

```sh
node --test tests/cash-register.test.js
node --test tests/cash-register.integration.js
```

The integration test requires migrated MySQL and rolls back its fixtures.

## Daily cash report

`GET /api/cash-register/report?from=YYYY-MM-DD&to=YYYY-MM-DD&branchId=<optional>&page=1`

Returns `daily`, `movements`, `totalMovements`, `page`, `pageSize` (25), and the tenant's `timezone`. Date filters are inclusive local calendar days, with a maximum span of 90 days. Omit branchId to include all tenant branches. A foreign branch returns 404. Movements are sorted newest first and paginated; daily balances cover the entire selected period.

Daily rows are separate per date and session, with branch, opening balance (carried forward for overnight sessions), paid cash sales, expected cash, and closing count/difference when closed on that date. Open sessions appear through today. The report includes only orders linked to register sessions. Canceled cash orders appear with zero net amount at the original sale time; this is a reconciliation report based on current order state, not an immutable ledger of refunds or edits. Opening and closing entries are balance observations, not sales or withdrawals. No new database migration is required for the report.
