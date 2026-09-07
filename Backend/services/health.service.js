const prisma = require("../lib/prisma");

function normalizeHealthRow(row) {
  if (!row) {
    return null;
  }

  return {
    database: row.databaseName ? String(row.databaseName) : null,
    currentDate: row.currentDate ? new Date(row.currentDate).toISOString() : null,
  };
}

async function getBackendHealth() {
  const checkedAt = new Date().toISOString();

  try {
    const rows = await prisma.$queryRaw`
      SELECT
        DATABASE() AS databaseName,
        CURRENT_TIMESTAMP(3) AS currentDate
    `;
    const database = normalizeHealthRow(rows[0]);

    return {
      status: "ok",
      app: {
        status: "ok",
        checkedAt,
        uptimeSeconds: Math.round(process.uptime()),
      },
      database: {
        status: "connected",
        name: database?.database || null,
        currentDate: database?.currentDate || null,
      },
    };
  } catch (error) {
    return {
      status: "error",
      app: {
        status: "ok",
        checkedAt,
        uptimeSeconds: Math.round(process.uptime()),
      },
      database: {
        status: "disconnected",
        name: null,
        currentDate: null,
        error: error.message,
      },
    };
  }
}

module.exports = {
  getBackendHealth,
};
