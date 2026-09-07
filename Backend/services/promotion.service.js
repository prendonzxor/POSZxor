const prisma = require("../lib/prisma");

const DISCOUNT_TYPES = ["percentage", "fixed_amount"];
const DISCOUNT_SCOPES = ["order", "product", "category", "customer", "subscription", "subscription_plan"];

function normalizeCoupon(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    name: row.name,
    description: row.description,
    scope: row.scope,
    targetRef: row.target_ref,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value || 0),
    maxDiscountAmount: row.max_discount_amount == null ? null : Number(row.max_discount_amount),
    minOrderAmount: row.min_order_amount == null ? null : Number(row.min_order_amount),
    usageLimit: row.usage_limit == null ? null : Number(row.usage_limit),
    usedCount: Number(row.used_count || 0),
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function normalizeDiscount(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    scope: row.scope,
    targetRef: row.target_ref,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value || 0),
    minOrderAmount: row.min_order_amount == null ? null : Number(row.min_order_amount),
    stackable: Boolean(row.stackable),
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function ensurePromotionsTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS coupons (
      id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NOT NULL,
      code VARCHAR(80) NOT NULL,
      name VARCHAR(120) NOT NULL,
      description VARCHAR(255) NULL,
      scope VARCHAR(30) NOT NULL DEFAULT 'order',
      target_ref VARCHAR(80) NULL,
      discount_type VARCHAR(30) NOT NULL,
      discount_value DECIMAL(10, 2) NOT NULL,
      max_discount_amount DECIMAL(10, 2) NULL,
      min_order_amount DECIMAL(10, 2) NULL,
      usage_limit INT NULL,
      used_count INT NOT NULL DEFAULT 0,
      starts_at DATETIME(3) NULL,
      ends_at DATETIME(3) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_coupons_tenant_code (tenant_id, code),
      KEY idx_coupons_tenant_active (tenant_id, is_active),
      KEY idx_coupons_tenant_window (tenant_id, starts_at, ends_at),
      KEY idx_coupons_scope (tenant_id, scope, target_ref)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS discounts (
      id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      description VARCHAR(255) NULL,
      scope VARCHAR(30) NOT NULL DEFAULT 'order',
      target_ref VARCHAR(80) NULL,
      discount_type VARCHAR(30) NOT NULL,
      discount_value DECIMAL(10, 2) NOT NULL,
      min_order_amount DECIMAL(10, 2) NULL,
      stackable TINYINT(1) NOT NULL DEFAULT 0,
      starts_at DATETIME(3) NULL,
      ends_at DATETIME(3) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_discounts_tenant_active (tenant_id, is_active),
      KEY idx_discounts_scope (tenant_id, scope, target_ref)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await ensurePromotionColumn("coupons", "scope", "VARCHAR(30) NOT NULL DEFAULT 'order'");
  await ensurePromotionColumn("coupons", "target_ref", "VARCHAR(80) NULL");
  await ensurePromotionColumn("discounts", "scope", "VARCHAR(30) NOT NULL DEFAULT 'order'");
  await ensurePromotionColumn("discounts", "target_ref", "VARCHAR(80) NULL");
}

async function ensurePromotionColumn(tableName, columnName, definition) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    tableName,
    columnName,
  );

  if (rows.length > 0) {
    return;
  }

  await prisma.$executeRawUnsafe(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function assertDiscountType(value) {
  if (!DISCOUNT_TYPES.includes(value)) {
    const error = new Error("discountType invalido");
    error.statusCode = 400;
    throw error;
  }
}

function assertDiscountScope(value) {
  if (!DISCOUNT_SCOPES.includes(value)) {
    const error = new Error("scope invalido");
    error.statusCode = 400;
    throw error;
  }
}

function assertNonNegativeNumber(value, fieldName) {
  if (value == null) {
    return;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error(`${fieldName} debe ser un numero mayor o igual a 0`);
    error.statusCode = 400;
    throw error;
  }
}

function assertValidDateWindow(startsAt, endsAt) {
  if (!startsAt || !endsAt) {
    return;
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    const error = new Error("la ventana de fechas es invalida");
    error.statusCode = 400;
    throw error;
  }
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 23).replace("T", " ");
}

async function listCouponsByTenant(tenantId) {
  await ensurePromotionsTables();

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM coupons
      WHERE tenant_id = ?
      ORDER BY created_at DESC
    `,
    tenantId,
  );

  return rows.map(normalizeCoupon);
}

async function createCoupon(input) {
  await ensurePromotionsTables();

  const code = String(input.code || "").trim().toUpperCase();
  const name = String(input.name || "").trim();
  const description = String(input.description || "").trim() || null;
  const scope = String(input.scope || "order").trim();
  const targetRef = String(input.targetRef || "").trim() || null;
  const discountType = String(input.discountType || "").trim();
  const discountValue = Number(input.discountValue);
  const maxDiscountAmount = input.maxDiscountAmount == null ? null : Number(input.maxDiscountAmount);
  const minOrderAmount = input.minOrderAmount == null ? null : Number(input.minOrderAmount);
  const usageLimit = input.usageLimit == null ? null : Number(input.usageLimit);
  const startsAt = normalizeDate(input.startsAt);
  const endsAt = normalizeDate(input.endsAt);
  const isActive = input.isActive === undefined ? true : Boolean(input.isActive);

  if (!input.tenantId || !code || !name) {
    const error = new Error("tenantId, code y name son requeridos");
    error.statusCode = 400;
    throw error;
  }

  assertDiscountType(discountType);
  assertDiscountScope(scope);
  assertNonNegativeNumber(discountValue, "discountValue");
  assertNonNegativeNumber(maxDiscountAmount, "maxDiscountAmount");
  assertNonNegativeNumber(minOrderAmount, "minOrderAmount");
  assertNonNegativeNumber(usageLimit, "usageLimit");
  assertValidDateWindow(startsAt, endsAt);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO coupons (
        id,
        tenant_id,
        code,
        name,
        description,
        scope,
        target_ref,
        discount_type,
        discount_value,
        max_discount_amount,
        min_order_amount,
        usage_limit,
        starts_at,
        ends_at,
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
        ?
      )
    `,
    input.tenantId,
    code,
    name,
    description,
    scope,
    targetRef,
    discountType,
    discountValue,
    maxDiscountAmount,
    minOrderAmount,
    usageLimit,
    startsAt,
    endsAt,
    isActive ? 1 : 0,
  );

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM coupons
      WHERE tenant_id = ? AND code = ?
      LIMIT 1
    `,
    input.tenantId,
    code,
  );

  return normalizeCoupon(rows[0]);
}

async function updateCouponById(input) {
  await ensurePromotionsTables();

  const couponId = String(input.id || "").trim();
  const tenantId = String(input.tenantId || "").trim();
  if (!couponId || !tenantId) {
    const error = new Error("id y tenantId son requeridos");
    error.statusCode = 400;
    throw error;
  }

  const existingRows = await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM coupons
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
    `,
    couponId,
    tenantId,
  );

  if (!existingRows.length) {
    const error = new Error("cupon no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const existing = normalizeCoupon(existingRows[0]);
  const code = input.code === undefined ? existing.code : String(input.code || "").trim().toUpperCase();
  const name = input.name === undefined ? existing.name : String(input.name || "").trim();
  const description = input.description === undefined ? existing.description : String(input.description || "").trim() || null;
  const scope = input.scope === undefined ? existing.scope : String(input.scope || "order").trim();
  const targetRef = input.targetRef === undefined ? existing.targetRef : String(input.targetRef || "").trim() || null;
  const discountType = input.discountType === undefined ? existing.discountType : String(input.discountType || "").trim();
  const discountValue = input.discountValue === undefined ? existing.discountValue : Number(input.discountValue);
  const maxDiscountAmount = input.maxDiscountAmount === undefined ? existing.maxDiscountAmount : input.maxDiscountAmount == null ? null : Number(input.maxDiscountAmount);
  const minOrderAmount = input.minOrderAmount === undefined ? existing.minOrderAmount : input.minOrderAmount == null ? null : Number(input.minOrderAmount);
  const usageLimit = input.usageLimit === undefined ? existing.usageLimit : input.usageLimit == null ? null : Number(input.usageLimit);
  const startsAt = input.startsAt === undefined ? normalizeDate(existing.startsAt) : normalizeDate(input.startsAt);
  const endsAt = input.endsAt === undefined ? normalizeDate(existing.endsAt) : normalizeDate(input.endsAt);
  const isActive = input.isActive === undefined ? existing.isActive : Boolean(input.isActive);

  if (!code || !name) {
    const error = new Error("code y name son requeridos");
    error.statusCode = 400;
    throw error;
  }

  assertDiscountType(discountType);
  assertDiscountScope(scope);
  assertNonNegativeNumber(discountValue, "discountValue");
  assertNonNegativeNumber(maxDiscountAmount, "maxDiscountAmount");
  assertNonNegativeNumber(minOrderAmount, "minOrderAmount");
  assertNonNegativeNumber(usageLimit, "usageLimit");
  assertValidDateWindow(startsAt, endsAt);

  await prisma.$executeRawUnsafe(
    `
      UPDATE coupons
      SET
        code = ?,
        name = ?,
        description = ?,
        scope = ?,
        target_ref = ?,
        discount_type = ?,
        discount_value = ?,
        max_discount_amount = ?,
        min_order_amount = ?,
        usage_limit = ?,
        starts_at = ?,
        ends_at = ?,
        is_active = ?
      WHERE id = ? AND tenant_id = ?
    `,
    code,
    name,
    description,
    scope,
    targetRef,
    discountType,
    discountValue,
    maxDiscountAmount,
    minOrderAmount,
    usageLimit,
    startsAt,
    endsAt,
    isActive ? 1 : 0,
    couponId,
    tenantId,
  );

  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM coupons WHERE id = ? AND tenant_id = ? LIMIT 1`,
    couponId,
    tenantId,
  );

  return normalizeCoupon(rows[0]);
}

async function validateCouponForTenant(input) {
  await ensurePromotionsTables();

  const tenantId = String(input.tenantId || "").trim();
  const code = String(input.code || "").trim().toUpperCase();
  const subtotal = input.subtotal == null ? 0 : Number(input.subtotal);
  const scope = String(input.scope || "order").trim();
  const targetRef = String(input.targetRef || "").trim() || null;

  if (!tenantId || !code) {
    const error = new Error("tenantId y code son requeridos");
    error.statusCode = 400;
    throw error;
  }

  assertNonNegativeNumber(subtotal, "subtotal");
  assertDiscountScope(scope);

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM coupons
      WHERE tenant_id = ?
        AND code = ?
      LIMIT 1
    `,
    tenantId,
    code,
  );

  if (!rows.length) {
    return {
      isValid: false,
      reason: "cupon no encontrado",
      coupon: null,
      discountAmount: 0,
      finalSubtotal: subtotal,
    };
  }

  return validateCouponResult({
    coupon: normalizeCoupon(rows[0]),
    subtotal,
    scope,
    targetRef,
  });
}

async function validateSubscriptionCouponPreview(input) {
  await ensurePromotionsTables();

  const code = String(input.code || "").trim().toUpperCase();
  const planCode = String(input.planCode || "").trim().toUpperCase();
  const subtotal = Number(input.subtotal || 0);

  if (!planCode) {
    const error = new Error("planCode es requerido");
    error.statusCode = 400;
    throw error;
  }

  if (!code) {
    return {
      isValid: false,
      reason: "cupon no proporcionado",
      coupon: null,
      discountAmount: 0,
      finalSubtotal: subtotal,
    };
  }

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM coupons
      WHERE tenant_id = 'GLOBAL'
        AND code = ?
        AND is_active = 1
      LIMIT 1
    `,
    code,
  );

  if (!rows.length) {
    return {
      isValid: false,
      reason: "cupon no encontrado",
      coupon: null,
      discountAmount: 0,
      finalSubtotal: subtotal,
    };
  }

  return validateCouponResult({
    coupon: normalizeCoupon(rows[0]),
    subtotal,
    scope: "subscription_plan",
    targetRef: planCode,
  });
}

function validateCouponResult({ coupon, subtotal, scope, targetRef }) {
  const now = new Date();
  if (!coupon.isActive) {
    return { isValid: false, reason: "cupon inactivo", coupon, discountAmount: 0, finalSubtotal: subtotal };
  }
  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    return { isValid: false, reason: "cupon aun no disponible", coupon, discountAmount: 0, finalSubtotal: subtotal };
  }
  if (coupon.endsAt && new Date(coupon.endsAt) < now) {
    return { isValid: false, reason: "cupon expirado", coupon, discountAmount: 0, finalSubtotal: subtotal };
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { isValid: false, reason: "cupon sin usos disponibles", coupon, discountAmount: 0, finalSubtotal: subtotal };
  }
  if (coupon.minOrderAmount != null && subtotal < coupon.minOrderAmount) {
    return {
      isValid: false,
      reason: "subtotal minimo no alcanzado",
      coupon,
      discountAmount: 0,
      finalSubtotal: subtotal,
    };
  }
  if (coupon.scope !== scope && coupon.scope !== "order" && coupon.scope !== "subscription") {
    return {
      isValid: false,
      reason: "cupon no aplica a este contexto",
      coupon,
      discountAmount: 0,
      finalSubtotal: subtotal,
    };
  }
  if (coupon.scope === "subscription_plan" && coupon.targetRef && coupon.targetRef !== targetRef) {
    return {
      isValid: false,
      reason: "cupon no aplica a este plan",
      coupon,
      discountAmount: 0,
      finalSubtotal: subtotal,
    };
  }

  let discountAmount =
    coupon.discountType === "percentage"
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue;

  if (coupon.maxDiscountAmount != null) {
    discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
  }

  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

  return {
    isValid: true,
    reason: null,
    coupon,
    discountAmount: Number(discountAmount.toFixed(2)),
    finalSubtotal: Number((subtotal - discountAmount).toFixed(2)),
  };
}

async function listDiscountsByTenant(tenantId) {
  await ensurePromotionsTables();

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM discounts
      WHERE tenant_id = ?
      ORDER BY created_at DESC
    `,
    tenantId,
  );

  return rows.map(normalizeDiscount);
}

async function createDiscount(input) {
  await ensurePromotionsTables();

  const tenantId = String(input.tenantId || "").trim();
  const name = String(input.name || "").trim();
  const description = String(input.description || "").trim() || null;
  const scope = String(input.scope || "order").trim();
  const targetRef = String(input.targetRef || "").trim() || null;
  const discountType = String(input.discountType || "").trim();
  const discountValue = Number(input.discountValue);
  const minOrderAmount = input.minOrderAmount == null ? null : Number(input.minOrderAmount);
  const stackable = Boolean(input.stackable);
  const startsAt = normalizeDate(input.startsAt);
  const endsAt = normalizeDate(input.endsAt);
  const isActive = input.isActive === undefined ? true : Boolean(input.isActive);

  if (!tenantId || !name) {
    const error = new Error("tenantId y name son requeridos");
    error.statusCode = 400;
    throw error;
  }

  assertDiscountScope(scope);
  assertDiscountType(discountType);
  assertNonNegativeNumber(discountValue, "discountValue");
  assertNonNegativeNumber(minOrderAmount, "minOrderAmount");
  assertValidDateWindow(startsAt, endsAt);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO discounts (
        id,
        tenant_id,
        name,
        description,
        scope,
        target_ref,
        discount_type,
        discount_value,
        min_order_amount,
        stackable,
        starts_at,
        ends_at,
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
        ?
      )
    `,
    tenantId,
    name,
    description,
    scope,
    targetRef,
    discountType,
    discountValue,
    minOrderAmount,
    stackable ? 1 : 0,
    startsAt,
    endsAt,
    isActive ? 1 : 0,
  );

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM discounts
      WHERE tenant_id = ? AND name = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    tenantId,
    name,
  );

  return normalizeDiscount(rows[0]);
}

async function updateDiscountById(input) {
  await ensurePromotionsTables();

  const discountId = String(input.id || "").trim();
  const tenantId = String(input.tenantId || "").trim();
  if (!discountId || !tenantId) {
    const error = new Error("id y tenantId son requeridos");
    error.statusCode = 400;
    throw error;
  }

  const existingRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM discounts WHERE id = ? AND tenant_id = ? LIMIT 1`,
    discountId,
    tenantId,
  );

  if (!existingRows.length) {
    const error = new Error("descuento no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const existing = normalizeDiscount(existingRows[0]);
  const name = input.name === undefined ? existing.name : String(input.name || "").trim();
  const description = input.description === undefined ? existing.description : String(input.description || "").trim() || null;
  const scope = input.scope === undefined ? existing.scope : String(input.scope || "").trim();
  const targetRef = input.targetRef === undefined ? existing.targetRef : String(input.targetRef || "").trim() || null;
  const discountType = input.discountType === undefined ? existing.discountType : String(input.discountType || "").trim();
  const discountValue = input.discountValue === undefined ? existing.discountValue : Number(input.discountValue);
  const minOrderAmount = input.minOrderAmount === undefined ? existing.minOrderAmount : input.minOrderAmount == null ? null : Number(input.minOrderAmount);
  const stackable = input.stackable === undefined ? existing.stackable : Boolean(input.stackable);
  const startsAt = input.startsAt === undefined ? normalizeDate(existing.startsAt) : normalizeDate(input.startsAt);
  const endsAt = input.endsAt === undefined ? normalizeDate(existing.endsAt) : normalizeDate(input.endsAt);
  const isActive = input.isActive === undefined ? existing.isActive : Boolean(input.isActive);

  if (!name) {
    const error = new Error("name es requerido");
    error.statusCode = 400;
    throw error;
  }

  assertDiscountScope(scope);
  assertDiscountType(discountType);
  assertNonNegativeNumber(discountValue, "discountValue");
  assertNonNegativeNumber(minOrderAmount, "minOrderAmount");
  assertValidDateWindow(startsAt, endsAt);

  await prisma.$executeRawUnsafe(
    `
      UPDATE discounts
      SET
        name = ?,
        description = ?,
        scope = ?,
        target_ref = ?,
        discount_type = ?,
        discount_value = ?,
        min_order_amount = ?,
        stackable = ?,
        starts_at = ?,
        ends_at = ?,
        is_active = ?
      WHERE id = ? AND tenant_id = ?
    `,
    name,
    description,
    scope,
    targetRef,
    discountType,
    discountValue,
    minOrderAmount,
    stackable ? 1 : 0,
    startsAt,
    endsAt,
    isActive ? 1 : 0,
    discountId,
    tenantId,
  );

  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM discounts WHERE id = ? AND tenant_id = ? LIMIT 1`,
    discountId,
    tenantId,
  );

  return normalizeDiscount(rows[0]);
}

module.exports = {
  DISCOUNT_TYPES,
  DISCOUNT_SCOPES,
  ensurePromotionsTables,
  listCouponsByTenant,
  createCoupon,
  updateCouponById,
  validateCouponForTenant,
  validateSubscriptionCouponPreview,
  listDiscountsByTenant,
  createDiscount,
  updateDiscountById,
};
