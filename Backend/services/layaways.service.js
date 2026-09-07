const { randomUUID } = require("crypto");
const prisma = require("../lib/prisma");

const OPEN_STATUSES = new Set(["active", "partially_paid"]);

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;
}

function round3(value) {
  return Math.round((toNumber(value, 0) + Number.EPSILON) * 1000) / 1000;
}

function mapLayawayRow(row) {
  return {
    id: String(row.id),
    tenantId: String(row.tenantId),
    branchId: String(row.branchId),
    branchName: row.branchName ? String(row.branchName) : null,
    customerId: String(row.customerId),
    customer: {
      id: String(row.customerId),
      fullName: String(row.customerFullName || ""),
      phone: row.customerPhone ?? null,
      email: row.customerEmail ?? null,
    },
    status: String(row.status),
    subtotal: toNumber(row.subtotal),
    discountAmount: toNumber(row.discountAmount),
    taxAmount: toNumber(row.taxAmount),
    total: toNumber(row.total),
    depositAmount: toNumber(row.depositAmount),
    balanceDue: toNumber(row.balanceDue),
    expiresAt: row.expiresAt ?? null,
    completedAt: row.completedAt ?? null,
    cancelledAt: row.cancelledAt ?? null,
    notes: row.notes ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    itemCount: toNumber(row.itemCount),
  };
}

function mapLayawayItemRow(row) {
  return {
    id: String(row.id),
    productId: String(row.productId),
    productName: String(row.productName || ""),
    sku: row.sku ?? null,
    barcode: row.barcode ?? null,
    qty: toNumber(row.qty),
    unitPrice: toNumber(row.unitPrice),
    discountAmount: toNumber(row.discountAmount),
    taxAmount: toNumber(row.taxAmount),
    subtotal: toNumber(row.subtotal),
    total: toNumber(row.total),
    createdAt: row.createdAt,
  };
}

async function getLayawaysByTenant({ tenantId, status, customerId, branchId, limit = 100 }) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.trunc(limit))) : 100;
  const hasStatus = Boolean(status);
  const hasCustomerId = Boolean(customerId);
  const hasBranchId = Boolean(branchId);

  const rows = await prisma.$queryRaw`
    SELECT
      l.id AS id,
      l.tenant_id AS tenantId,
      l.branch_id AS branchId,
      b.name AS branchName,
      l.customer_id AS customerId,
      c.full_name AS customerFullName,
      c.phone AS customerPhone,
      c.email AS customerEmail,
      l.status AS status,
      l.subtotal AS subtotal,
      l.discount_amount AS discountAmount,
      l.tax_amount AS taxAmount,
      l.total AS total,
      l.deposit_amount AS depositAmount,
      l.balance_due AS balanceDue,
      l.expires_at AS expiresAt,
      l.completed_at AS completedAt,
      l.cancelled_at AS cancelledAt,
      l.notes AS notes,
      l.created_by AS createdBy,
      l.created_at AS createdAt,
      l.updated_at AS updatedAt,
      (
        SELECT COUNT(*)
        FROM layaway_items li_count
        WHERE li_count.tenant_id = l.tenant_id
          AND li_count.layaway_id = l.id
      ) AS itemCount
    FROM layaways l
    INNER JOIN customers c
      ON c.id COLLATE utf8mb4_unicode_ci = l.customer_id COLLATE utf8mb4_unicode_ci
     AND c.tenant_id COLLATE utf8mb4_unicode_ci = l.tenant_id COLLATE utf8mb4_unicode_ci
    INNER JOIN branches b
      ON b.id COLLATE utf8mb4_unicode_ci = l.branch_id COLLATE utf8mb4_unicode_ci
     AND b.tenant_id COLLATE utf8mb4_unicode_ci = l.tenant_id COLLATE utf8mb4_unicode_ci
    WHERE l.tenant_id = ${tenantId}
      AND IF(${hasStatus}, l.status = ${status ?? ""}, TRUE)
      AND IF(${hasCustomerId}, l.customer_id = ${customerId ?? ""}, TRUE)
      AND IF(${hasBranchId}, l.branch_id = ${branchId ?? ""}, TRUE)
    ORDER BY l.created_at DESC
    LIMIT ${safeLimit}
  `;

  return rows.map(mapLayawayRow);
}

async function getLayawayById({ tenantId, layawayId, db = prisma }) {
  const rows = await db.$queryRaw`
    SELECT
      l.id AS id,
      l.tenant_id AS tenantId,
      l.branch_id AS branchId,
      b.name AS branchName,
      l.customer_id AS customerId,
      c.full_name AS customerFullName,
      c.phone AS customerPhone,
      c.email AS customerEmail,
      l.status AS status,
      l.subtotal AS subtotal,
      l.discount_amount AS discountAmount,
      l.tax_amount AS taxAmount,
      l.total AS total,
      l.deposit_amount AS depositAmount,
      l.balance_due AS balanceDue,
      l.expires_at AS expiresAt,
      l.completed_at AS completedAt,
      l.cancelled_at AS cancelledAt,
      l.notes AS notes,
      l.created_by AS createdBy,
      l.created_at AS createdAt,
      l.updated_at AS updatedAt,
      (
        SELECT COUNT(*)
        FROM layaway_items li_count
        WHERE li_count.tenant_id = l.tenant_id
          AND li_count.layaway_id = l.id
      ) AS itemCount
    FROM layaways l
    INNER JOIN customers c
      ON c.id COLLATE utf8mb4_unicode_ci = l.customer_id COLLATE utf8mb4_unicode_ci
     AND c.tenant_id COLLATE utf8mb4_unicode_ci = l.tenant_id COLLATE utf8mb4_unicode_ci
    INNER JOIN branches b
      ON b.id COLLATE utf8mb4_unicode_ci = l.branch_id COLLATE utf8mb4_unicode_ci
     AND b.tenant_id COLLATE utf8mb4_unicode_ci = l.tenant_id COLLATE utf8mb4_unicode_ci
    WHERE l.tenant_id = ${tenantId}
      AND l.id = ${layawayId}
    LIMIT 1
  `;

  if (!rows.length) {
    return null;
  }

  const itemRows = await db.$queryRaw`
    SELECT
      li.id AS id,
      li.product_id AS productId,
      p.name AS productName,
      p.sku AS sku,
      p.barcode AS barcode,
      li.qty AS qty,
      li.unit_price AS unitPrice,
      li.discount_amount AS discountAmount,
      li.tax_amount AS taxAmount,
      li.subtotal AS subtotal,
      li.total AS total,
      li.created_at AS createdAt
    FROM layaway_items li
    INNER JOIN products p
      ON p.id COLLATE utf8mb4_unicode_ci = li.product_id COLLATE utf8mb4_unicode_ci
     AND p.tenant_id COLLATE utf8mb4_unicode_ci = li.tenant_id COLLATE utf8mb4_unicode_ci
    WHERE li.tenant_id = ${tenantId}
      AND li.layaway_id = ${layawayId}
    ORDER BY li.created_at ASC
  `;

  return {
    ...mapLayawayRow(rows[0]),
    items: itemRows.map(mapLayawayItemRow),
  };
}

async function createLayaway({
  tenantId,
  branchId,
  customerId,
  items,
  depositAmount = 0,
  discountAmount = 0,
  expiresAt = null,
  notes = null,
  createdBy = null,
}) {
  const normalizedItems = (items || [])
    .map((item) => ({
      productId: String(item.productId || "").trim(),
      qty: round3(item.qty),
      unitPrice: item.unitPrice === undefined ? undefined : round2(item.unitPrice),
      discountAmount: round2(item.discountAmount || 0),
      taxAmount: item.taxAmount === undefined ? undefined : round2(item.taxAmount),
    }))
    .filter((item) => item.productId && item.qty > 0);

  if (!normalizedItems.length) {
    throw new Error("items debe tener al menos un producto con cantidad mayor a 0");
  }

  return prisma.$transaction(async (tx) => {
    const [branch] = await tx.$queryRaw`
      SELECT id
      FROM branches
      WHERE tenant_id = ${tenantId}
        AND id = ${branchId}
        AND is_active = TRUE
      LIMIT 1
    `;

    if (!branch) {
      throw new Error("sucursal invalida o inactiva");
    }

    const [customer] = await tx.$queryRaw`
      SELECT id
      FROM customers
      WHERE tenant_id = ${tenantId}
        AND id = ${customerId}
        AND is_active = TRUE
      LIMIT 1
    `;

    if (!customer) {
      throw new Error("cliente invalido o inactivo");
    }

    const layawayId = randomUUID();
    const preparedItems = [];
    let subtotal = 0;
    let taxTotal = 0;
    let itemDiscountTotal = 0;

    for (const item of normalizedItems) {
      const [product] = await tx.$queryRaw`
        SELECT
          p.id AS id,
          p.name AS name,
          p.price AS price,
          p.tax_rate AS taxRate,
          COALESCE(i.qty_on_hand, 0) AS qtyOnHand,
          COALESCE(i.qty_reserved, 0) AS qtyReserved
        FROM products p
        LEFT JOIN inventory i
          ON i.tenant_id COLLATE utf8mb4_unicode_ci = p.tenant_id COLLATE utf8mb4_unicode_ci
         AND i.product_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
         AND i.branch_id COLLATE utf8mb4_unicode_ci = ${branchId} COLLATE utf8mb4_unicode_ci
        WHERE p.tenant_id = ${tenantId}
          AND p.id = ${item.productId}
          AND p.is_active = TRUE
        LIMIT 1
      `;

      if (!product) {
        throw new Error(`producto invalido: ${item.productId}`);
      }

      const qtyOnHand = toNumber(product.qtyOnHand);
      const qtyReserved = toNumber(product.qtyReserved);
      const availableQty = round3(qtyOnHand - qtyReserved);

      if (availableQty < item.qty) {
        throw new Error(`stock insuficiente para ${product.name}. Disponible: ${availableQty}`);
      }

      const unitPrice = item.unitPrice ?? round2(product.price);
      const lineSubtotal = round2(unitPrice * item.qty);
      const lineDiscount = item.discountAmount;
      const lineTax =
        item.taxAmount === undefined
          ? round2(Math.max(0, lineSubtotal - lineDiscount) * (toNumber(product.taxRate) / 100))
          : item.taxAmount;
      const lineTotal = round2(lineSubtotal - lineDiscount + lineTax);

      preparedItems.push({
        id: randomUUID(),
        productId: item.productId,
        qty: item.qty,
        unitPrice,
        discountAmount: lineDiscount,
        taxAmount: lineTax,
        subtotal: lineSubtotal,
        total: lineTotal,
      });

      subtotal = round2(subtotal + lineSubtotal);
      itemDiscountTotal = round2(itemDiscountTotal + lineDiscount);
      taxTotal = round2(taxTotal + lineTax);

      const updatedRows = await tx.$executeRaw`
        UPDATE inventory
        SET qty_reserved = qty_reserved + ${item.qty}
        WHERE tenant_id = ${tenantId}
          AND branch_id = ${branchId}
          AND product_id = ${item.productId}
          AND qty_on_hand - qty_reserved >= ${item.qty}
      `;

      if (Number(updatedRows) !== 1) {
        throw new Error(`no se pudo reservar stock para ${product.name}`);
      }
    }

    const headerDiscount = round2(discountAmount);
    const total = round2(subtotal - itemDiscountTotal - headerDiscount + taxTotal);
    const safeDeposit = Math.min(Math.max(0, round2(depositAmount)), total);
    const balanceDue = round2(total - safeDeposit);
    const status = safeDeposit > 0 && balanceDue > 0 ? "partially_paid" : "active";
    const parsedExpiresAt = expiresAt ? new Date(expiresAt) : null;

    await tx.$executeRaw`
      INSERT INTO layaways (
        id, tenant_id, branch_id, customer_id, status,
        subtotal, discount_amount, tax_amount, total,
        deposit_amount, balance_due, expires_at, notes, created_by
      )
      VALUES (
        ${layawayId}, ${tenantId}, ${branchId}, ${customerId}, ${status},
        ${subtotal}, ${headerDiscount}, ${taxTotal}, ${total},
        ${safeDeposit}, ${balanceDue}, ${parsedExpiresAt}, ${notes}, ${createdBy}
      )
    `;

    for (const item of preparedItems) {
      await tx.$executeRaw`
        INSERT INTO layaway_items (
          id, tenant_id, layaway_id, product_id, qty,
          unit_price, discount_amount, tax_amount, subtotal, total
        )
        VALUES (
          ${item.id}, ${tenantId}, ${layawayId}, ${item.productId}, ${item.qty},
          ${item.unitPrice}, ${item.discountAmount}, ${item.taxAmount}, ${item.subtotal}, ${item.total}
        )
      `;
    }

    return getLayawayById({ tenantId, layawayId, db: tx });
  });
}

async function closeLayaway({ tenantId, layawayId, nextStatus, userId = null }) {
  if (!["completed", "cancelled", "expired"].includes(nextStatus)) {
    throw new Error("estatus de cierre invalido");
  }

  return prisma.$transaction(async (tx) => {
    const [layaway] = await tx.$queryRaw`
      SELECT id, branch_id AS branchId, status
      FROM layaways
      WHERE tenant_id = ${tenantId}
        AND id = ${layawayId}
      LIMIT 1
    `;

    if (!layaway) {
      return null;
    }

    if (!OPEN_STATUSES.has(String(layaway.status))) {
      throw new Error("el apartado ya esta cerrado");
    }

    const items = await tx.$queryRaw`
      SELECT product_id AS productId, qty, unit_price AS unitPrice
      FROM layaway_items
      WHERE tenant_id = ${tenantId}
        AND layaway_id = ${layawayId}
    `;

    for (const item of items) {
      const qty = toNumber(item.qty);
      let updatedRows;

      if (nextStatus === "completed") {
        updatedRows = await tx.$executeRaw`
          UPDATE inventory
          SET qty_reserved = GREATEST(qty_reserved - ${qty}, 0),
              qty_on_hand = qty_on_hand - ${qty}
          WHERE tenant_id = ${tenantId}
            AND branch_id = ${layaway.branchId}
            AND product_id = ${item.productId}
            AND qty_reserved >= ${qty}
            AND qty_on_hand >= ${qty}
        `;

        await tx.$executeRaw`
          INSERT INTO inventory_movements (
            id, tenant_id, branch_id, product_id, type, qty_delta,
            unit_cost, reference_type, reference_id, note, created_by
          )
          VALUES (
            ${randomUUID()}, ${tenantId}, ${layaway.branchId}, ${item.productId}, 'sale', ${-qty},
            ${item.unitPrice}, 'layaway', ${layawayId}, 'Apartado completado', ${userId}
          )
        `;
      } else {
        updatedRows = await tx.$executeRaw`
          UPDATE inventory
          SET qty_reserved = GREATEST(qty_reserved - ${qty}, 0)
          WHERE tenant_id = ${tenantId}
            AND branch_id = ${layaway.branchId}
            AND product_id = ${item.productId}
        `;
      }

      if (Number(updatedRows) !== 1) {
        throw new Error("no se pudo actualizar la reserva de inventario");
      }
    }

    if (nextStatus === "completed") {
      await tx.$executeRaw`
        UPDATE layaways
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP(3),
            deposit_amount = total,
            balance_due = 0
        WHERE tenant_id = ${tenantId}
          AND id = ${layawayId}
      `;
    } else {
      await tx.$executeRaw`
        UPDATE layaways
        SET status = ${nextStatus},
            cancelled_at = CURRENT_TIMESTAMP(3)
        WHERE tenant_id = ${tenantId}
          AND id = ${layawayId}
      `;
    }

    return getLayawayById({ tenantId, layawayId, db: tx });
  });
}

module.exports = {
  createLayaway,
  getLayawaysByTenant,
  getLayawayById,
  closeLayaway,
};
