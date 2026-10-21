# Authoritative server time

`GET /api/time` is public and uncached. It does not require the database or authentication, so sign-in and other public pages can synchronize too.

Response fields:

- `serverTime`: current application-server time in ISO 8601 UTC.
- `epochMilliseconds`: the same instant as Unix milliseconds.
- `timeZone`: `SERVER_TIME_ZONE`, default `America/Mexico_City`.
- `date`: calendar date in that timezone (`YYYY-MM-DD`).

Set `SERVER_TIME_ZONE` to a valid IANA timezone. UTC timestamps remain UTC regardless of this setting. All backend writes continue to use database/server timestamps; browser estimates do not become authoritative audit timestamps.

## Web applications

`Frontend` and `FrontAdm` each have `lib/server-time.ts` and a root `ServerTimeProvider`. Both applications synchronize before mounting their contents. A failed initial synchronization displays a retry screen instead of falling back to the user's clock. Resynchronization runs every minute and on focus, visibility restoration and reconnection.

The clock anchors the received server epoch to `performance.now()` with a half-round-trip latency estimate. `serverNow()` advances the anchor using monotonic elapsed time. It never reads `Date.now()` or constructs a current-time Date without an explicit epoch. A failed later refresh retains the last server anchor. It is not persisted across browser reloads.

Use `serverDateKey()` for today's calendar date, `serverCalendarDate()` for UTC-based calendar arithmetic, `serverDateTimeInput()` for datetime inputs, and `serverDateTimeToIso()` to convert a selected business-local datetime to UTC. The latter rejects impossible calendar dates and nonexistent DST times. Existing database timestamps are still parsed normally, and timestamp displays use the server timezone. Date filters supplied by users remain selectable.

Stock-validation periods and exports, quote exports, cash-report defaults, layaway expiry defaults, dashboard comparisons, inventory defaults/today filters, sidebar date, copyright year, subscription period defaults and middleware subscription checks now use this source. Date-only analytics grouping uses UTC calendar arithmetic to prevent browser timezone shifts. Coupon datetime inputs also use the configured server timezone.

## Mobile application

`App/lib/core/services/server_clock.dart` synchronizes the same endpoint and advances its UTC anchor with `Stopwatch`. API mode starts synchronization at startup and when configuring an API connection; it refreshes once per minute. API dashboard reads synchronize as well. Its `now` getter throws until synchronized and never falls back to `DateTime.now()`.

Offline/local mode does not require a server connection. It currently has no device-clock business-date calls; future date-dependent local features must explicitly handle an unavailable server clock rather than substitute the phone's time.

## Validation

- `TZ=Pacific/Auckland node --test Backend/tests/server-time.test.js`
- `cd App && dart run test/server_clock_test.dart`
