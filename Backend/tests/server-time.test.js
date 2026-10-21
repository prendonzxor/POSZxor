const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("../../Frontend/node_modules/typescript");
const { getServerTime } = require("../services/server-time.service");

test("server time exposes one coherent UTC instant and server calendar day", () => {
  const original = process.env.SERVER_TIME_ZONE;
  process.env.SERVER_TIME_ZONE = "America/Mexico_City";
  try {
    const result = getServerTime(new Date("2026-10-21T00:30:00Z"));
    assert.equal(result.epochMilliseconds, Date.parse(result.serverTime));
    assert.equal(result.date, "2026-10-20");
    assert.equal(result.timeZone, "America/Mexico_City");
  } finally {
    if (original === undefined) delete process.env.SERVER_TIME_ZONE; else process.env.SERVER_TIME_ZONE = original;
  }
});
test("public time endpoint sends an uncached response without needing a database query", () => {
  const router = require("../routes/api");
  const handler = router.stack.find((layer) => layer.route?.path === "/time").route.stack[0].handle;
  const headers = {};
  let result;
  handler({}, { set: (key, value) => { headers[key] = value; }, json: (body) => { result = body; } });
  assert.equal(headers["Cache-Control"], "no-store");
  assert.equal(result.epochMilliseconds, Date.parse(result.serverTime));
});
for (const frontend of ["Frontend", "FrontAdm"]) {
  test(`${frontend}: server clock ignores wall-clock changes, converts timezone inputs and never falls back locally`, async () => {
    let monotonic = 1000;
    let calls = 0;
    let fail = false;
    let timeZone = "America/Mexico_City";
    const epoch = Date.parse("2026-10-21T00:30:00Z");
    class DeviceDate extends Date {
      constructor(value) { if (value === undefined) throw new Error("Device wall clock forbidden"); super(value); }
      static now() { throw new Error("Device wall clock forbidden"); }
    }
    const source = fs.readFileSync(path.join(__dirname, "../..", frontend, "lib/server-time.ts"), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, Date: DeviceDate, Intl, AbortSignal, process: { env: {} }, performance: { now: () => monotonic }, fetch: async () => {
      calls += 1; monotonic += 200;
      if (fail) throw new Error("offline");
      return { ok: true, json: async () => ({ serverTime: new Date(epoch).toISOString(), epochMilliseconds: epoch, timeZone, date: "2026-10-20" }) };
    } });
    assert.throws(() => exports.serverNow(), /sincronizada/);
    fail = true;
    await assert.rejects(exports.synchronizeServerTime(), /offline/);
    assert.throws(() => exports.serverNow(), /sincronizada/);
    fail = false;
    await Promise.all([exports.synchronizeServerTime(), exports.synchronizeServerTime()]);
    assert.equal(calls, 2); // one failed request, one deduplicated request
    assert.equal(exports.serverNow().getTime(), epoch + 100);
    monotonic += 5000;
    assert.equal(exports.serverNow().getTime(), epoch + 5100);
    assert.equal(exports.serverDateKey(), "2026-10-20");
    assert.equal(exports.serverDateTimeInput(), "2026-10-20T18:30");
    assert.equal(exports.serverDateTimeToIso("2026-10-20T23:59:59"), "2026-10-21T05:59:59.000Z");
    assert.throws(() => exports.serverDateTimeToIso("2026-02-30T12:00"), /no existe/);
    fail = true;
    await assert.rejects(exports.synchronizeServerTime());
    assert.equal(exports.serverNow().getTime(), epoch + 5300);
    fail = false; timeZone = "America/New_York";
    await exports.synchronizeServerTime();
    assert.throws(() => exports.serverDateTimeToIso("2026-03-08T02:30"), /no existe/);
  });
}
