const { randomUUID } = require("crypto");
const prisma = require("../lib/prisma");

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round3(value) {
  return Math.round((toNumber(value, 0) + Number.EPSILON) * 1000) / 1000;
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePeriodKey(value) {
  const normalized = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getValidationStatus({ realQty, virtualQty }) {
  if (realQty === null || realQty === undefined) {
    return "pending";
  }

  const differenceQty = round3(realQty - virtualQty);
  if (differenceQty === 0) return "matched";
  return differenceQty > 0 ? "surplus" : "shortage";
}

async function ensureStockValidationTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS stock_validation_sessions (
      id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NOT NULL,
      branch_id CHAR(36) NOT NULL,
      period_key CHAR(7) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      notes VARCHAR(255) NULL,
      created_by INT NULL,
      completed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_stock_validation_session_period (tenant_id, branch_id, period_key, created_at),
      KEY idx_stock_validation_sessions_tenant_period (tenant_id, period_key),
      KEY idx_stock_validation_sessions_branch (branch_id),
      CONSTRAINT fk_stock_validation_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
      CONSTRAINT fk_stock_validation_sessions_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
      CONSTRAINT fk_stock_validation_sessions_user FOREIGN KEY (created_by) REFERENCES \`User\`(id) ON DELETE SET NULL ON UPDATE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS stock_validation_items (
      id CHAR(36) NOT NULL,
      session_id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NOT NULL,
      branch_id CHAR(36) NOT NULL,
      product_id CHAR(36) NOT NULL,
      virtual_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
      reserved_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
      real_qty DECIMAL(12,3) NULL,
      difference_qty DECIMAL(12,3) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      adjusted_at DATETIME(3) NULL,
      adjusted_by INT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_stock_validation_item_product (session_id, product_id),
      KEY idx_stock_validation_items_tenant_branch (tenant_id, branch_id),
      KEY idx_stock_validation_items_product (product_id),
      CONSTRAINT fk_stock_validation_items_session FOREIGN KEY (session_id) REFERENCES stock_validation_sessions(id) ON DELETE CASCADE ON UPDATE RESTRICT,
      CONSTRAINT fk_stock_validation_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
      CONSTRAINT fk_stock_validation_items_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
      CONSTRAINT fk_stock_validation_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
      CONSTRAINT fk_stock_validation_items_adjusted_by FOREIGN KEY (adjusted_by) REFERENCES \`User\`(id) ON DELETE SET NULL ON UPDATE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
}

function mapSession(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    tenantId: String(row.tenantId),
    branchId: String(row.branchId),
    periodKey: String(row.periodKey),
    status: String(row.status),
    notes: row.notes === null || row.notes === undefined ? null : String(row.notes),
    createdBy: row.createdBy === null || row.createdBy === undefined ? null : Number(row.createdBy),
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function mapItem(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    sessionId: String(row.sessionId),
    tenantId: String(row.tenantId),
    branchId: String(row.branchId),
    productId: String(row.productId),
    virtualQty: toNumber(row.virtualQty),
    reservedQty: toNumber(row.reservedQty),
    realQty: row.realQty === null || row.realQty === undefined ? null : toNumber(row.realQty),
    differenceQty: row.differenceQty === null || row.differenceQty === undefined ? null : toNumber(row.differenceQty),
    status: String(row.status || "pending"),
    adjustedAt: row.adjustedAt ? new Date(row.adjustedAt).toISOString() : null,
    adjustedBy: row.adjustedBy === null || row.adjustedBy === undefined ? null : Number(row.adjustedBy),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function getStockValidationSessionById({ tenantId, sessionId }) {
  await ensureStockValidationTables();

  const rows = await prisma.$queryRaw`
    SELECT
      id,
      tenant_id AS tenantId,
      branch_id AS branchId,
      period_key AS periodKey,
      status,
      notes,
      created_by AS createdBy,
      completed_at AS completedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM stock_validation_sessions
    WHERE tenant_id = ${tenantId}
      AND id = ${sessionId}
    LIMIT 1
  `;

  return mapSession(rows[0]);
}

async function getStockValidationSession({ tenantId, branchId, periodKey }) {
  await ensureStockValidationTables();

  const normalizedPeriodKey = normalizePeriodKey(periodKey);
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      tenant_id AS tenantId,
      branch_id AS branchId,
      period_key AS periodKey,
      status,
      notes,
      created_by AS createdBy,
      completed_at AS completedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM stock_validation_sessions
    WHERE tenant_id = ${tenantId}
      AND branch_id = ${branchId}
      AND period_key = ${normalizedPeriodKey}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;

  const session = mapSession(rows[0]);
  if (!session) {
    return null;
  }

  const items = await listStockValidationItems({ tenantId, sessionId: session.id });
  return { session, items };
}

async function ensureStockValidationSession({
  tenantId,
  branchId,
  periodKey,
  notes = null,
  createdBy = null,
}) {
  await ensureStockValidationTables();

  const normalizedPeriodKey = normalizePeriodKey(periodKey);
  return prisma.$transaction(async (tx) => {
    const branches = await tx.$queryRaw`SELECT id FROM branches WHERE id = ${branchId} AND tenant_id = ${tenantId} FOR UPDATE`;
    if (!branches.length) throw Object.assign(new Error("sucursal no encontrada"), { statusCode: 404 });
    const existing = await tx.stockValidationSession.findFirst({ where: { tenantId, branchId, periodKey: normalizedPeriodKey }, orderBy: { createdAt: "desc" } });
    const session = existing || await tx.stockValidationSession.create({ data: { tenantId, branchId, periodKey: normalizedPeriodKey, notes: normalizeNullableString(notes), createdBy } });
    const items = await tx.stockValidationItem.findMany({ where: { tenantId, sessionId: session.id }, orderBy: { updatedAt: "desc" } });
    return { session: mapSession(session), items: items.map(mapItem) };
  });
}

async function createNewStockValidationSession({ tenantId, branchId, periodKey, createdBy }) {
  const normalizedPeriodKey = normalizePeriodKey(periodKey);
  return prisma.$transaction(async (tx) => {
    const branches = await tx.$queryRaw`SELECT id FROM branches WHERE id = ${branchId} AND tenant_id = ${tenantId} FOR UPDATE`;
    if (!branches.length) throw Object.assign(new Error("sucursal no encontrada"), { statusCode: 404 });
    const latest = await tx.stockValidationSession.findFirst({ where: { tenantId, branchId, periodKey: normalizedPeriodKey }, orderBy: { createdAt: "desc" } });
    await tx.stockValidationSession.updateMany({ where: { tenantId, branchId, periodKey: normalizedPeriodKey, status: "draft" }, data: { status: "completed", completedAt: new Date() } });
    const session = await tx.stockValidationSession.create({ data: {
      tenantId, branchId, periodKey: normalizedPeriodKey, createdBy,
      createdAt: new Date(Math.max(Date.now(), (latest?.createdAt.getTime() || 0) + 1)),
    } });
    return { session: mapSession(session), items: [] };
  });
}

async function listStockValidationItems({ tenantId, sessionId }) {
  await ensureStockValidationTables();

  const rows = await prisma.$queryRaw`
    SELECT
      id,
      session_id AS sessionId,
      tenant_id AS tenantId,
      branch_id AS branchId,
      product_id AS productId,
      virtual_qty AS virtualQty,
      reserved_qty AS reservedQty,
      real_qty AS realQty,
      difference_qty AS differenceQty,
      status,
      adjusted_at AS adjustedAt,
      adjusted_by AS adjustedBy,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM stock_validation_items
    WHERE tenant_id = ${tenantId}
      AND session_id = ${sessionId}
    ORDER BY updated_at DESC
  `;

  return rows.map(mapItem);
}

async function upsertStockValidationItem({
  tenantId,
  sessionId,
  productId,
  virtualQty = 0,
  reservedQty = 0,
  realQty = null,
}) {
  await ensureStockValidationTables();

  const session = await getStockValidationSessionById({ tenantId, sessionId });
  if (!session) {
    const error = new Error("sesion de validacion no encontrada");
    error.statusCode = 404;
    throw error;
  }

  if (session.status === "completed") {
    const error = new Error("la sesion de validacion ya esta completada");
    error.statusCode = 400;
    throw error;
  }

  const normalizedVirtualQty = round3(virtualQty);
  const normalizedReservedQty = round3(reservedQty);
  const normalizedRealQty = realQty === null || realQty === undefined || realQty === "" ? null : round3(realQty);
  const differenceQty = normalizedRealQty === null ? null : round3(normalizedRealQty - normalizedVirtualQty);
  const status = getValidationStatus({ realQty: normalizedRealQty, virtualQty: normalizedVirtualQty });
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO stock_validation_items (
      id,
      session_id,
      tenant_id,
      branch_id,
      product_id,
      virtual_qty,
      reserved_qty,
      real_qty,
      difference_qty,
      status
    )
    VALUES (
      ${id},
      ${session.id},
      ${tenantId},
      ${session.branchId},
      ${productId},
      ${normalizedVirtualQty},
      ${normalizedReservedQty},
      ${normalizedRealQty},
      ${differenceQty},
      ${status}
    )
    ON DUPLICATE KEY UPDATE
      virtual_qty = VALUES(virtual_qty),
      reserved_qty = VALUES(reserved_qty),
      real_qty = VALUES(real_qty),
      difference_qty = VALUES(difference_qty),
      status = VALUES(status),
      updated_at = CURRENT_TIMESTAMP(3)
  `;

  const rows = await prisma.$queryRaw`
    SELECT
      id,
      session_id AS sessionId,
      tenant_id AS tenantId,
      branch_id AS branchId,
      product_id AS productId,
      virtual_qty AS virtualQty,
      reserved_qty AS reservedQty,
      real_qty AS realQty,
      difference_qty AS differenceQty,
      status,
      adjusted_at AS adjustedAt,
      adjusted_by AS adjustedBy,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM stock_validation_items
    WHERE tenant_id = ${tenantId}
      AND session_id = ${session.id}
      AND product_id = ${productId}
    LIMIT 1
  `;

  return mapItem(rows[0]);
}

async function markStockValidationItemAdjusted({ tenantId, sessionId, productId, adjustedBy = null }) {
  await ensureStockValidationTables();

  await prisma.$executeRaw`
    UPDATE stock_validation_items
    SET
      adjusted_at = CURRENT_TIMESTAMP(3),
      adjusted_by = ${adjustedBy},
      updated_at = CURRENT_TIMESTAMP(3)
    WHERE tenant_id = ${tenantId}
      AND session_id = ${sessionId}
      AND product_id = ${productId}
  `;
}

async function completeStockValidationSession({ tenantId, sessionId }) {
  await ensureStockValidationTables();

  await prisma.$executeRaw`
    UPDATE stock_validation_sessions
    SET
      status = 'completed',
      completed_at = CURRENT_TIMESTAMP(3),
      updated_at = CURRENT_TIMESTAMP(3)
    WHERE tenant_id = ${tenantId}
      AND id = ${sessionId}
  `;

  const session = await getStockValidationSessionById({ tenantId, sessionId });
  const items = session ? await listStockValidationItems({ tenantId, sessionId }) : [];
  return { session, items };
}

module.exports = {
  createNewStockValidationSession,
  completeStockValidationSession,
  ensureStockValidationSession,
  ensureStockValidationTables,
  getStockValidationSession,
  markStockValidationItemAdjusted,
  upsertStockValidationItem,
};
