const prisma = require("../lib/prisma");

const DEFAULTS_BY_PLAN = {
  FREE: {
    limitsUsers: 1,
    limitsBranches: 1,
    limitsProducts: 100,
    limitsOrdersPerMonth: 300,
    limitsCustomers: 300,
  },
  BASIC: {
    limitsUsers: 1,
    limitsBranches: 1,
    limitsProducts: 500,
    limitsOrdersPerMonth: 1000,
    limitsCustomers: 1000,
  },
  PRO: {
    limitsUsers: 5,
    limitsBranches: 1,
    limitsProducts: 5000,
    limitsOrdersPerMonth: 5000,
    limitsCustomers: 5000,
  },
  PREMIUM: {
    limitsUsers: 9999,
    limitsBranches: 9999,
    limitsProducts: 999999,
    limitsOrdersPerMonth: 999999,
    limitsCustomers: 999999,
  },
  STARTER: {
    limitsUsers: 1,
    limitsBranches: 1,
    limitsProducts: 500,
    limitsOrdersPerMonth: 1000,
    limitsCustomers: 1000,
  },
  ENTERPRISE: {
    limitsUsers: 9999,
    limitsBranches: 9999,
    limitsProducts: 999999,
    limitsOrdersPerMonth: 999999,
    limitsCustomers: 999999,
  },
};

const ALLOWED_PLAN_CODES = Object.keys(DEFAULTS_BY_PLAN);
const DEFAULT_TRIAL_DAYS = 15;
const ALLOWED_STATUS = ["trialing", "trial_ended", "active", "past_due", "suspended", "canceled"];
const ALLOWED_PAYMENT_METHOD_STATUS = ["pending", "ready", "expired", "revoked"];

async function ensureTenantSubscriptionColumn(columnName, definition) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tenant_subscriptions'
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    columnName,
  );

  if (rows.length > 0) {
    return;
  }

  await prisma.$executeRawUnsafe(
    `ALTER TABLE tenant_subscriptions ADD COLUMN ${columnName} ${definition}`,
  );
}

async function ensureTenantSubscriptionTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS tenant_subscriptions (
      id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NOT NULL,
      plan_code VARCHAR(30) NOT NULL DEFAULT 'FREE',
      status VARCHAR(20) NOT NULL DEFAULT 'trialing',
      trial_ends_at DATETIME(3) NULL,
      current_period_start DATETIME(3) NULL,
      current_period_end DATETIME(3) NULL,
      auto_renew TINYINT(1) NOT NULL DEFAULT 1,
      payment_provider VARCHAR(40) NULL,
      payment_customer_ref VARCHAR(120) NULL,
      payment_method_token VARCHAR(255) NULL,
      payment_method_brand VARCHAR(60) NULL,
      payment_method_last4 VARCHAR(4) NULL,
      payment_method_status VARCHAR(20) NULL,
      limits_users INT NOT NULL DEFAULT 1,
      limits_branches INT NOT NULL DEFAULT 1,
      limits_products INT NOT NULL DEFAULT 100,
      limits_orders_per_month INT NOT NULL DEFAULT 300,
      limits_customers INT NOT NULL DEFAULT 300,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_tenant_subscriptions_tenant (tenant_id),
      KEY idx_tenant_subscriptions_plan_status (plan_code, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await ensureTenantSubscriptionColumn("payment_method_token", "VARCHAR(255) NULL");
  await ensureTenantSubscriptionColumn("payment_method_brand", "VARCHAR(60) NULL");
  await ensureTenantSubscriptionColumn("payment_method_status", "VARCHAR(20) NULL");
}

function normalizeRow(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    tenantId: String(row.tenantId),
    planCode: String(row.planCode || "FREE").toUpperCase(),
    status: String(row.status || "trialing").toLowerCase(),
    trialEndsAt: row.trialEndsAt ? new Date(row.trialEndsAt).toISOString() : null,
    currentPeriodStart: row.currentPeriodStart ? new Date(row.currentPeriodStart).toISOString() : null,
    currentPeriodEnd: row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toISOString() : null,
    autoRenew: Boolean(row.autoRenew),
    paymentProvider: row.paymentProvider ? String(row.paymentProvider) : null,
    paymentCustomerRef: row.paymentCustomerRef ? String(row.paymentCustomerRef) : null,
    paymentMethodToken: row.paymentMethodToken ? String(row.paymentMethodToken) : null,
    paymentMethodBrand: row.paymentMethodBrand ? String(row.paymentMethodBrand) : null,
    paymentMethodLast4: row.paymentMethodLast4 ? String(row.paymentMethodLast4) : null,
    paymentMethodStatus: row.paymentMethodStatus ? String(row.paymentMethodStatus).toLowerCase() : null,
    limitsUsers: Number(row.limitsUsers || 0),
    limitsBranches: Number(row.limitsBranches || 0),
    limitsProducts: Number(row.limitsProducts || 0),
    limitsOrdersPerMonth: Number(row.limitsOrdersPerMonth || 0),
    limitsCustomers: Number(row.limitsCustomers || 0),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function selectTenantSubscriptionByTenantId(tenantId) {
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      tenant_id AS tenantId,
      plan_code AS planCode,
      status,
      trial_ends_at AS trialEndsAt,
      current_period_start AS currentPeriodStart,
      current_period_end AS currentPeriodEnd,
      auto_renew AS autoRenew,
      payment_provider AS paymentProvider,
      payment_customer_ref AS paymentCustomerRef,
      payment_method_token AS paymentMethodToken,
      payment_method_brand AS paymentMethodBrand,
      payment_method_last4 AS paymentMethodLast4,
      payment_method_status AS paymentMethodStatus,
      limits_users AS limitsUsers,
      limits_branches AS limitsBranches,
      limits_products AS limitsProducts,
      limits_orders_per_month AS limitsOrdersPerMonth,
      limits_customers AS limitsCustomers,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM tenant_subscriptions
    WHERE tenant_id = ${tenantId}
    LIMIT 1
  `;

  return rows[0] || null;
}

async function markTrialEndedIfExpired(tenantId) {
  await prisma.$executeRaw`
    UPDATE tenant_subscriptions
    SET
      status = 'trial_ended',
      auto_renew = 0
    WHERE tenant_id = ${tenantId}
      AND status = 'trialing'
      AND UPPER(plan_code) = 'FREE'
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at <= CURRENT_TIMESTAMP(3)
  `;
}

async function suspendTenantSubscriptionIfTrialExpired(tenantId) {
  await ensureTenantSubscriptionTable();

  await prisma.$executeRaw`
    UPDATE tenant_subscriptions
    SET
      status = 'suspended',
      auto_renew = 0
    WHERE tenant_id = ${tenantId}
      AND status IN ('trialing', 'trial_ended')
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at <= CURRENT_TIMESTAMP(3)
  `;

  return normalizeRow(await selectTenantSubscriptionByTenantId(tenantId));
}

async function getTenantSubscriptionByTenantId(tenantId) {
  await ensureTenantSubscriptionTable();

  const existing = await selectTenantSubscriptionByTenantId(tenantId);
debugger;
  if (existing) {
    // Backfill one-time: free plan should start with the standard trial window.
    if (
      String(existing.planCode || "FREE").toUpperCase() === "FREE" &&
      !existing.trialEndsAt
    ) {
      await prisma.$executeRaw`
        UPDATE tenant_subscriptions
        SET trial_ends_at = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 15 DAY)
        WHERE tenant_id = ${tenantId}
      `;

      await markTrialEndedIfExpired(tenantId);
      return normalizeRow(await selectTenantSubscriptionByTenantId(tenantId));
    }

    await markTrialEndedIfExpired(tenantId);
    return normalizeRow(await selectTenantSubscriptionByTenantId(tenantId));
  }

  const defaults = DEFAULTS_BY_PLAN.FREE;

  await prisma.$executeRaw`
    INSERT INTO tenant_subscriptions (
      id,
      tenant_id,
      plan_code,
      status,
      trial_ends_at,
      auto_renew,
      limits_users,
      limits_branches,
      limits_products,
      limits_orders_per_month,
      limits_customers
    ) VALUES (
      UUID(),
      ${tenantId},
      'FREE',
      'trialing',
      DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 15 DAY),
      1,
      ${defaults.limitsUsers},
      ${defaults.limitsBranches},
      ${defaults.limitsProducts},
      ${defaults.limitsOrdersPerMonth},
      ${defaults.limitsCustomers}
    )
  `;

  await markTrialEndedIfExpired(tenantId);
  return normalizeRow(await selectTenantSubscriptionByTenantId(tenantId));
}

function normalizeDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function normalizeInt(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

async function updateTenantSubscriptionByTenantId({ tenantId, data }) {
  await ensureTenantSubscriptionTable();
  await getTenantSubscriptionByTenantId(tenantId);

  const updateData = {
    planCode: data.planCode ? String(data.planCode).trim().toUpperCase() : undefined,
    status: data.status ? String(data.status).trim().toLowerCase() : undefined,
    trialEndsAt: normalizeDate(data.trialEndsAt),
    currentPeriodStart: normalizeDate(data.currentPeriodStart),
    currentPeriodEnd: normalizeDate(data.currentPeriodEnd),
    autoRenew: data.autoRenew === undefined ? undefined : Boolean(data.autoRenew),
    paymentProvider:
      data.paymentProvider === undefined
        ? undefined
        : data.paymentProvider === null || String(data.paymentProvider).trim() === ""
          ? null
          : String(data.paymentProvider).trim(),
    paymentCustomerRef:
      data.paymentCustomerRef === undefined
        ? undefined
        : data.paymentCustomerRef === null || String(data.paymentCustomerRef).trim() === ""
          ? null
          : String(data.paymentCustomerRef).trim(),
    paymentMethodToken:
      data.paymentMethodToken === undefined
        ? undefined
        : data.paymentMethodToken === null || String(data.paymentMethodToken).trim() === ""
          ? null
          : String(data.paymentMethodToken).trim(),
    paymentMethodBrand:
      data.paymentMethodBrand === undefined
        ? undefined
        : data.paymentMethodBrand === null || String(data.paymentMethodBrand).trim() === ""
          ? null
          : String(data.paymentMethodBrand).trim(),
    paymentMethodLast4:
      data.paymentMethodLast4 === undefined
        ? undefined
        : data.paymentMethodLast4 === null || String(data.paymentMethodLast4).trim() === ""
          ? null
          : String(data.paymentMethodLast4).trim(),
    paymentMethodStatus:
      data.paymentMethodStatus === undefined
        ? undefined
        : data.paymentMethodStatus === null || String(data.paymentMethodStatus).trim() === ""
          ? null
          : String(data.paymentMethodStatus).trim().toLowerCase(),
    limitsUsers: normalizeInt(data.limitsUsers),
    limitsBranches: normalizeInt(data.limitsBranches),
    limitsProducts: normalizeInt(data.limitsProducts),
    limitsOrdersPerMonth: normalizeInt(data.limitsOrdersPerMonth),
    limitsCustomers: normalizeInt(data.limitsCustomers),
  };

  if (updateData.planCode && !ALLOWED_PLAN_CODES.includes(updateData.planCode)) {
    const error = new Error(`planCode invalido. Usa: ${ALLOWED_PLAN_CODES.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  if (updateData.status && !ALLOWED_STATUS.includes(updateData.status)) {
    const error = new Error(`status invalido. Usa: ${ALLOWED_STATUS.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  if (updateData.paymentMethodLast4 !== undefined && updateData.paymentMethodLast4 !== null) {
    const onlyDigits = /^\d{4}$/.test(updateData.paymentMethodLast4);
    if (!onlyDigits) {
      const error = new Error("paymentMethodLast4 debe contener exactamente 4 digitos");
      error.statusCode = 400;
      throw error;
    }
  }

  if (
    updateData.paymentMethodStatus !== undefined &&
    updateData.paymentMethodStatus !== null &&
    !ALLOWED_PAYMENT_METHOD_STATUS.includes(updateData.paymentMethodStatus)
  ) {
    const error = new Error(
      `paymentMethodStatus invalido. Usa: ${ALLOWED_PAYMENT_METHOD_STATUS.join(", ")}`,
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    updateData.paymentMethodToken === null &&
    (updateData.paymentMethodBrand !== undefined ||
      updateData.paymentMethodLast4 !== undefined ||
      updateData.paymentMethodStatus !== undefined)
  ) {
    updateData.paymentMethodBrand = null;
    updateData.paymentMethodLast4 = null;
    updateData.paymentMethodStatus = null;
  }

  const planDefaults = updateData.planCode ? DEFAULTS_BY_PLAN[updateData.planCode] : null;

  const nextLimitsUsers = updateData.limitsUsers === undefined && planDefaults ? planDefaults.limitsUsers : updateData.limitsUsers;
  const nextLimitsBranches =
    updateData.limitsBranches === undefined && planDefaults ? planDefaults.limitsBranches : updateData.limitsBranches;
  const nextLimitsProducts =
    updateData.limitsProducts === undefined && planDefaults ? planDefaults.limitsProducts : updateData.limitsProducts;
  const nextLimitsOrdersPerMonth =
    updateData.limitsOrdersPerMonth === undefined && planDefaults
      ? planDefaults.limitsOrdersPerMonth
      : updateData.limitsOrdersPerMonth;
  const nextLimitsCustomers =
    updateData.limitsCustomers === undefined && planDefaults ? planDefaults.limitsCustomers : updateData.limitsCustomers;

  const sets = [];
  const params = [];

  if (updateData.planCode !== undefined) {
    sets.push("plan_code = ?");
    params.push(updateData.planCode);
  }
  if (updateData.status !== undefined) {
    sets.push("status = ?");
    params.push(updateData.status);
  }
  if (updateData.trialEndsAt !== undefined) {
    sets.push("trial_ends_at = ?");
    params.push(updateData.trialEndsAt);
  }
  if (updateData.currentPeriodStart !== undefined) {
    sets.push("current_period_start = ?");
    params.push(updateData.currentPeriodStart);
  }
  if (updateData.currentPeriodEnd !== undefined) {
    sets.push("current_period_end = ?");
    params.push(updateData.currentPeriodEnd);
  }
  if (updateData.autoRenew !== undefined) {
    sets.push("auto_renew = ?");
    params.push(updateData.autoRenew ? 1 : 0);
  }
  if (updateData.paymentProvider !== undefined) {
    sets.push("payment_provider = ?");
    params.push(updateData.paymentProvider);
  }
  if (updateData.paymentCustomerRef !== undefined) {
    sets.push("payment_customer_ref = ?");
    params.push(updateData.paymentCustomerRef);
  }
  if (updateData.paymentMethodToken !== undefined) {
    sets.push("payment_method_token = ?");
    params.push(updateData.paymentMethodToken);
  }
  if (updateData.paymentMethodBrand !== undefined) {
    sets.push("payment_method_brand = ?");
    params.push(updateData.paymentMethodBrand);
  }
  if (updateData.paymentMethodLast4 !== undefined) {
    sets.push("payment_method_last4 = ?");
    params.push(updateData.paymentMethodLast4);
  }
  if (updateData.paymentMethodStatus !== undefined) {
    sets.push("payment_method_status = ?");
    params.push(updateData.paymentMethodStatus);
  }
  if (nextLimitsUsers !== undefined) {
    sets.push("limits_users = ?");
    params.push(nextLimitsUsers);
  }
  if (nextLimitsBranches !== undefined) {
    sets.push("limits_branches = ?");
    params.push(nextLimitsBranches);
  }
  if (nextLimitsProducts !== undefined) {
    sets.push("limits_products = ?");
    params.push(nextLimitsProducts);
  }
  if (nextLimitsOrdersPerMonth !== undefined) {
    sets.push("limits_orders_per_month = ?");
    params.push(nextLimitsOrdersPerMonth);
  }
  if (nextLimitsCustomers !== undefined) {
    sets.push("limits_customers = ?");
    params.push(nextLimitsCustomers);
  }

  if (sets.length === 0) {
    const error = new Error("debes enviar al menos un campo para actualizar");
    error.statusCode = 400;
    throw error;
  }

  params.push(tenantId);
  await prisma.$executeRawUnsafe(
    `UPDATE tenant_subscriptions SET ${sets.join(", ")} WHERE tenant_id = ?`,
    ...params,
  );

  return getTenantSubscriptionByTenantId(tenantId);
}

module.exports = {
  ALLOWED_PLAN_CODES,
  ALLOWED_STATUS,
  ALLOWED_PAYMENT_METHOD_STATUS,
  DEFAULTS_BY_PLAN,
  DEFAULT_TRIAL_DAYS,
  ensureTenantSubscriptionTable,
  getTenantSubscriptionByTenantId,
  suspendTenantSubscriptionIfTrialExpired,
  updateTenantSubscriptionByTenantId,
};
