const prisma = require("../lib/prisma");

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getAnalyticsSummary({ tenantId, days = 7 }) {
  const safeDays = Number.isFinite(days) ? Math.min(90, Math.max(1, Math.trunc(days))) : 7;

  const [salesSummaryRows, salesByDayRows, ordersByTypeRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        COALESCE(SUM(ABS(qty_delta) * COALESCE(unit_cost, 0)), 0) AS totalSells,
        COUNT(DISTINCT COALESCE(NULLIF(reference_id, ''), id)) AS totalOrders
      FROM inventory_movements
      WHERE tenant_id = ${tenantId}
        AND type = 'sale'
    `,
    prisma.$queryRaw`
      SELECT
        DATE(created_at) AS saleDate,
        COALESCE(SUM(ABS(qty_delta) * COALESCE(unit_cost, 0)), 0) AS totalSells,
        COUNT(DISTINCT COALESCE(NULLIF(reference_id, ''), id)) AS totalOrders
      FROM inventory_movements
      WHERE tenant_id = ${tenantId}
        AND type = 'sale'
        AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL ${safeDays - 1} DAY)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `,
    prisma.$queryRaw`
      SELECT
        COALESCE(NULLIF(reference_type, ''), 'sale') AS orderType,
        COUNT(DISTINCT COALESCE(NULLIF(reference_id, ''), id)) AS totalOrders,
        COALESCE(SUM(ABS(qty_delta) * COALESCE(unit_cost, 0)), 0) AS totalSells
      FROM inventory_movements
      WHERE tenant_id = ${tenantId}
        AND type = 'sale'
      GROUP BY COALESCE(NULLIF(reference_type, ''), 'sale')
      ORDER BY totalOrders DESC
    `,
  ]);

  let totalCustomers = 0;
  try {
    const customerCountRows = await prisma.$queryRaw`
      SELECT COUNT(*) AS totalCustomers
      FROM customers
      WHERE tenant_id = ${tenantId}
    `;
    totalCustomers = toNumber(customerCountRows?.[0]?.totalCustomers);
  } catch {
    const fallbackCount = await prisma.customer.count();
    totalCustomers = toNumber(fallbackCount);
  }

  const salesSummary = salesSummaryRows[0] || { totalSells: 0, totalOrders: 0 };

  return {
    summary: {
      totalSells: toNumber(salesSummary.totalSells),
      totalOrders: toNumber(salesSummary.totalOrders),
      totalCustomers,
    },
    salesByDay: salesByDayRows.map((row) => ({
      date: row.saleDate,
      totalSells: toNumber(row.totalSells),
      totalOrders: toNumber(row.totalOrders),
    })),
    ordersByType: ordersByTypeRows.map((row) => ({
      orderType: String(row.orderType || "sale"),
      totalOrders: toNumber(row.totalOrders),
      totalSells: toNumber(row.totalSells),
    })),
  };
}

module.exports = {
  getAnalyticsSummary,
};
