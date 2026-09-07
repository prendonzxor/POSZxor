const prisma = require("../lib/prisma");

const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    code: "FREE",
    name: "Gratis",
    priceMxn: 0,
    mercadoPagoPreapprovalPlanId: null,
    billingPeriod: "trial",
    description: "Plan gratis por 15 dias para probar POS Zxor",
    badge: null,
    recommendation: "Ideal para explorar el producto antes de elegir un plan de pago",
    sortOrder: 0,
    trialDays: 15,
    limitsUsers: 1,
    limitsBranches: 1,
    limitsOrdersPerMonth: 300,
    limitsProducts: 100,
    isUnlimitedUsers: false,
    isUnlimitedBranches: false,
    isUnlimitedOrders: false,
    isUnlimitedProducts: false,
    features: [
      "Prueba gratis por 15 dias",
      "POS (ventas)",
      "Clientes",
      "Ordenes",
      "Reportes basicos",
      "1 usuario",
      "1 tienda",
      "Hasta 300 ordenes por mes",
      "Hasta 100 productos",
    ],
  },
  {
    code: "BASIC",
    name: "Basico",
    priceMxn: 150,
    mercadoPagoPreapprovalPlanId: "08ecc78864db4d278ac90ee733f7ae99",
    billingPeriod: "month",
    description: "Mejor para pequenos negocios que estan empezando",
    badge: null,
    recommendation: "Perfecto para negocios atendidos por una sola persona",
    sortOrder: 1,
    trialDays: null,
    limitsUsers: 1,
    limitsBranches: 1,
    limitsOrdersPerMonth: 1000,
    limitsProducts: 500,
    isUnlimitedUsers: false,
    isUnlimitedBranches: false,
    isUnlimitedOrders: false,
    isUnlimitedProducts: false,
    features: [
      "POS (ventas)",
      "Clientes",
      "Ordenes",
      "Reportes basicos",
      "1 usuario",
      "1 tienda",
      "Hasta 1,000 ordenes por mes",
      "Hasta 500 productos",
    ],
  },
  {
    code: "PRO",
    name: "Pro",
    priceMxn: 399,
    mercadoPagoPreapprovalPlanId: "906d73e0a200422c98d6eec7c293311b",
    billingPeriod: "month",
    description: "Para negocios en crecimiento",
    badge: "MAS POPULAR",
    recommendation: "Aqui deberia caer el 70–80% de los usuarios",
    sortOrder: 2,
    trialDays: null,
    limitsUsers: 5,
    limitsBranches: 1,
    limitsOrdersPerMonth: 5000,
    limitsProducts: 5000,
    isUnlimitedUsers: false,
    isUnlimitedBranches: false,
    isUnlimitedOrders: false,
    isUnlimitedProducts: false,
    features: [
      "Todo lo incluido en Basico",
      "Hasta 5 usuarios",
      "Hasta 5,000 ordenes por mes",
      "Hasta 5,000 productos",
      "Reportes avanzados",
      "Gestion de personal",
      "1 tienda",
    ],
  },
  {
    code: "PREMIUM",
    name: "Premium",
    priceMxn: 899,
    mercadoPagoPreapprovalPlanId: "1597d17dea314f4b8564e1db5deb019a",
    billingPeriod: "month",
    description: "Para negocios en expansion",
    badge: null,
    recommendation: "Ideal para crecimiento multi-sucursal con soporte prioritario",
    sortOrder: 3,
    trialDays: null,
    limitsUsers: null,
    limitsBranches: null,
    limitsOrdersPerMonth: null,
    limitsProducts: null,
    isUnlimitedUsers: true,
    isUnlimitedBranches: true,
    isUnlimitedOrders: true,
    isUnlimitedProducts: true,
    features: [
      "Todo lo incluido en Pro",
      "Multi-sucursal (branches)",
      "Usuarios ilimitados",
      "Ordenes ilimitadas",
      "Productos ilimitados",
      "Soporte prioritario",
      "Automatizacion por WhatsApp",
    ],
  },
];

async function ensureSubscriptionPlansColumn(columnName, definition) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'subscription_plans'
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    columnName,
  );

  if (rows.length > 0) {
    return;
  }

  await prisma.$executeRawUnsafe(
    `ALTER TABLE subscription_plans ADD COLUMN ${columnName} ${definition}`,
  );
}

async function ensureSubscriptionPlansTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id CHAR(36) NOT NULL,
      code VARCHAR(30) NOT NULL,
      name VARCHAR(80) NOT NULL,
      price_mxn DECIMAL(10, 2) NOT NULL,
      mercado_pago_preapproval_plan_id VARCHAR(80) NULL,
      billing_period VARCHAR(20) NOT NULL DEFAULT 'month',
      description VARCHAR(255) NOT NULL,
      badge VARCHAR(80) NULL,
      recommendation VARCHAR(255) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      trial_days INT NULL,
      limits_users INT NULL,
      limits_branches INT NULL,
      limits_orders_per_month INT NULL,
      limits_products INT NULL,
      is_unlimited_users TINYINT(1) NOT NULL DEFAULT 0,
      is_unlimited_branches TINYINT(1) NOT NULL DEFAULT 0,
      is_unlimited_orders TINYINT(1) NOT NULL DEFAULT 0,
      is_unlimited_products TINYINT(1) NOT NULL DEFAULT 0,
      features_json JSON NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_subscription_plans_code (code),
      KEY idx_subscription_plans_active_order (is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await ensureSubscriptionPlansColumn("trial_days", "INT NULL");
  await ensureSubscriptionPlansColumn("mercado_pago_preapproval_plan_id", "VARCHAR(80) NULL AFTER price_mxn");
}

async function seedSubscriptionPlans() {
  await ensureSubscriptionPlansTable();

  for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO subscription_plans (
          id,
          code,
          name,
          price_mxn,
          mercado_pago_preapproval_plan_id,
          billing_period,
          description,
          badge,
          recommendation,
          sort_order,
          trial_days,
          limits_users,
          limits_branches,
          limits_orders_per_month,
          limits_products,
          is_unlimited_users,
          is_unlimited_branches,
          is_unlimited_orders,
          is_unlimited_products,
          features_json,
          is_active
        ) VALUES (
          UUID(),
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          CAST(? AS JSON),
          1
        )
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          price_mxn = VALUES(price_mxn),
          mercado_pago_preapproval_plan_id = VALUES(mercado_pago_preapproval_plan_id),
          billing_period = VALUES(billing_period),
          description = VALUES(description),
          badge = VALUES(badge),
          recommendation = VALUES(recommendation),
          sort_order = VALUES(sort_order),
          trial_days = VALUES(trial_days),
          limits_users = VALUES(limits_users),
          limits_branches = VALUES(limits_branches),
          limits_orders_per_month = VALUES(limits_orders_per_month),
          limits_products = VALUES(limits_products),
          is_unlimited_users = VALUES(is_unlimited_users),
          is_unlimited_branches = VALUES(is_unlimited_branches),
          is_unlimited_orders = VALUES(is_unlimited_orders),
          is_unlimited_products = VALUES(is_unlimited_products),
          features_json = VALUES(features_json),
          is_active = VALUES(is_active)
      `,
      plan.code,
      plan.name,
      plan.priceMxn,
      plan.mercadoPagoPreapprovalPlanId,
      plan.billingPeriod,
      plan.description,
      plan.badge,
      plan.recommendation,
      plan.sortOrder,
      plan.trialDays,
      plan.limitsUsers,
      plan.limitsBranches,
      plan.limitsOrdersPerMonth,
      plan.limitsProducts,
      plan.isUnlimitedUsers ? 1 : 0,
      plan.isUnlimitedBranches ? 1 : 0,
      plan.isUnlimitedOrders ? 1 : 0,
      plan.isUnlimitedProducts ? 1 : 0,
      JSON.stringify(plan.features),
    );
  }
}

function normalizePlanRow(row) {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    priceMxn: Number(row.priceMxn),
    mercadoPagoPreapprovalPlanId: row.mercadoPagoPreapprovalPlanId
      ? String(row.mercadoPagoPreapprovalPlanId)
      : null,
    billingPeriod: String(row.billingPeriod),
    description: String(row.description),
    badge: row.badge ? String(row.badge) : null,
    recommendation: row.recommendation ? String(row.recommendation) : null,
    sortOrder: Number(row.sortOrder || 0),
    trialDays: row.trialDays === null ? null : Number(row.trialDays),
    limitsUsers: row.limitsUsers === null ? null : Number(row.limitsUsers),
    limitsBranches: row.limitsBranches === null ? null : Number(row.limitsBranches),
    limitsOrdersPerMonth: row.limitsOrdersPerMonth === null ? null : Number(row.limitsOrdersPerMonth),
    limitsProducts: row.limitsProducts === null ? null : Number(row.limitsProducts),
    isUnlimitedUsers: Boolean(row.isUnlimitedUsers),
    isUnlimitedBranches: Boolean(row.isUnlimitedBranches),
    isUnlimitedOrders: Boolean(row.isUnlimitedOrders),
    isUnlimitedProducts: Boolean(row.isUnlimitedProducts),
    features: Array.isArray(row.featuresJson)
      ? row.featuresJson
      : JSON.parse(typeof row.featuresJson === "string" ? row.featuresJson : "[]"),
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function getActiveSubscriptionPlans() {
  await seedSubscriptionPlans();

  const rows = await prisma.$queryRaw`
    SELECT
      id,
      code,
      name,
      price_mxn AS priceMxn,
      mercado_pago_preapproval_plan_id AS mercadoPagoPreapprovalPlanId,
      billing_period AS billingPeriod,
      description,
      badge,
      recommendation,
      sort_order AS sortOrder,
      trial_days AS trialDays,
      limits_users AS limitsUsers,
      limits_branches AS limitsBranches,
      limits_orders_per_month AS limitsOrdersPerMonth,
      limits_products AS limitsProducts,
      is_unlimited_users AS isUnlimitedUsers,
      is_unlimited_branches AS isUnlimitedBranches,
      is_unlimited_orders AS isUnlimitedOrders,
      is_unlimited_products AS isUnlimitedProducts,
      features_json AS featuresJson,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM subscription_plans
    WHERE is_active = 1
    ORDER BY sort_order ASC, price_mxn ASC
  `;

  return rows.map(normalizePlanRow);
}

async function getActiveSubscriptionPlanByCode(planCode) {
  await seedSubscriptionPlans();

  const rows = await prisma.$queryRaw`
    SELECT
      id,
      code,
      name,
      price_mxn AS priceMxn,
      mercado_pago_preapproval_plan_id AS mercadoPagoPreapprovalPlanId,
      billing_period AS billingPeriod,
      description,
      badge,
      recommendation,
      sort_order AS sortOrder,
      trial_days AS trialDays,
      limits_users AS limitsUsers,
      limits_branches AS limitsBranches,
      limits_orders_per_month AS limitsOrdersPerMonth,
      limits_products AS limitsProducts,
      is_unlimited_users AS isUnlimitedUsers,
      is_unlimited_branches AS isUnlimitedBranches,
      is_unlimited_orders AS isUnlimitedOrders,
      is_unlimited_products AS isUnlimitedProducts,
      features_json AS featuresJson,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM subscription_plans
    WHERE is_active = 1
      AND code = ${String(planCode || "").trim().toUpperCase()}
    LIMIT 1
  `;

  return rows.length ? normalizePlanRow(rows[0]) : null;
}

module.exports = {
  getActiveSubscriptionPlans,
  getActiveSubscriptionPlanByCode,
};
