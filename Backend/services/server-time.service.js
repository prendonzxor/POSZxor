function getServerTime(now = new Date()) {
  const timeZone = process.env.SERVER_TIME_ZONE || "America/Mexico_City";
  const format = (options) => new Intl.DateTimeFormat("en-CA", { timeZone, ...options }).format(now);
  return { serverTime: now.toISOString(), epochMilliseconds: now.getTime(), timeZone,
    date: format({ year: "numeric", month: "2-digit", day: "2-digit" }),
  };
}
module.exports = { getServerTime };
