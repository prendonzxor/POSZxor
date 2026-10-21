const { randomUUID } = require("crypto");
const prisma = require("../lib/prisma");
const { requireOpenSession, lockOrderRegister } = require("./cash-register.service");

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

function formatOrderNumber(nextNumber) {
  const sequence = Math.max(1, Math.trunc(toNumber(nextNumber, 1)));
  return `ORD-${String(sequence).padStart(4, "0")}`;
}

function isUnknownUpdatedAtColumn(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("unknown column 'updated_at'");
}

function mapOrderRow(order) {
  const customerId = order.customerDataId ?? order.customerId ?? null;
  return {
    id: String(order.id),
    numOrder: order.numOrder ? String(order.numOrder) : null,
    tenantId: String(order.tenantId),
    branchId: String(order.branchId),
    customerId: customerId ? String(customerId) : null,
    customer: customerId
      ? {
          id: String(customerId),
          fullName: String(order.customerFullName || ""),
          phone: order.customerPhone ?? null,
          email: order.customerEmail ?? null,
        }
      : null,
    orderType: String(order.orderType),
    paymentType: String(order.paymentType),
    status: String(order.status),
    subtotal: toNumber(order.subtotal),
    discountAmount: toNumber(order.discountAmount),
    taxAmount: toNumber(order.taxAmount),
    total: toNumber(order.total),
    cost: toNumber(order.cost),
    profit: round2(toNumber(order.total) - toNumber(order.cost)),
    notes: order.notes ?? null,
    createdBy: order.createdBy ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt ?? null,
  };
}

function mapOrderItemRow(item) {
  return {
    id: String(item.id),
    productId: String(item.productId),
    productName: String(item.productName || ""),
    qty: toNumber(item.qty),
    unitPrice: toNumber(item.unitPrice),
    discountAmount: toNumber(item.discountAmount),
    taxAmount: toNumber(item.taxAmount),
    subtotal: toNumber(item.subtotal),
    total: toNumber(item.total),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? null,
  };
}

async function getOrdersByTenant({ tenantId, branchId, status, orderType, paymentType, limit = 100 }) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.trunc(limit))) : 100;
  const branchFilter = branchId || null;
  const statusFilter = status || null;
  const orderTypeFilter = orderType || null;
  const paymentTypeFilter = paymentType || null;
  console.log({ tenantId, branchFilter, statusFilter, orderTypeFilter, paymentTypeFilter, safeLimit });
  let rows;
  try {
    rows = await prisma.$queryRaw`
      SELECT
        o.id AS id,
        o.num_order AS numOrder,
        o.tenant_id AS tenantId,
        o.branch_id AS branchId,
        o.customer_id AS customerId,
        o.order_type AS orderType,
        o.payment_type AS paymentType,
        o.status AS status,
        o.subtotal AS subtotal,
        o.discount_amount AS discountAmount,
        o.tax_amount AS taxAmount,
        o.total AS total,
        COALESCE(order_costs.cost, 0) AS cost,
        o.notes AS notes,
        o.created_by AS createdBy,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt,
        c.id AS customerDataId,
        c.full_name AS customerFullName,
        c.phone AS customerPhone,
        c.email AS customerEmail
      FROM orders o
      LEFT JOIN customers c
        ON c.id = o.customer_id
       AND c.tenant_id = o.tenant_id
      LEFT JOIN (
        SELECT
          oi.tenant_id,
          oi.order_id,
          SUM(COALESCE(oi.qty, 0) * COALESCE(p.cost, 0)) AS cost
        FROM order_items oi
        INNER JOIN products p
          ON p.id = oi.product_id
         AND p.tenant_id = oi.tenant_id
        GROUP BY oi.tenant_id, oi.order_id
      ) order_costs
        ON order_costs.tenant_id = o.tenant_id
       AND order_costs.order_id = o.id
      WHERE o.tenant_id = ${tenantId}
        AND (${branchFilter} IS NULL OR o.branch_id = ${branchFilter})
        AND (${statusFilter} IS NULL OR o.status = ${statusFilter})
        AND (${orderTypeFilter} IS NULL OR o.order_type = ${orderTypeFilter})
        AND (${paymentTypeFilter} IS NULL OR o.payment_type = ${paymentTypeFilter})
      ORDER BY o.created_at DESC
      LIMIT ${safeLimit}
    `;
  } catch (error) {
    if (!isUnknownUpdatedAtColumn(error)) {
      throw error;
    }
    rows = await prisma.$queryRaw`
      SELECT
        o.id AS id,
        o.num_order AS numOrder,
        o.tenant_id AS tenantId,
        o.branch_id AS branchId,
        o.customer_id AS customerId,
        o.order_type AS orderType,
        o.payment_type AS paymentType,
        o.status AS status,
        o.subtotal AS subtotal,
        o.discount_amount AS discountAmount,
        o.tax_amount AS taxAmount,
        o.total AS total,
        COALESCE(order_costs.cost, 0) AS cost,
        o.notes AS notes,
        o.created_by AS createdBy,
        o.created_at AS createdAt,
        NULL AS updatedAt,
        c.id AS customerDataId,
        c.full_name AS customerFullName,
        c.phone AS customerPhone,
        c.email AS customerEmail
      FROM orders o
      LEFT JOIN customers c
        ON c.id = o.customer_id
       AND c.tenant_id = o.tenant_id
      LEFT JOIN (
        SELECT
          oi.tenant_id,
          oi.order_id,
          SUM(COALESCE(oi.qty, 0) * COALESCE(p.cost, 0)) AS cost
        FROM order_items oi
        INNER JOIN products p
          ON p.id = oi.product_id
         AND p.tenant_id = oi.tenant_id
        GROUP BY oi.tenant_id, oi.order_id
      ) order_costs
        ON order_costs.tenant_id = o.tenant_id
       AND order_costs.order_id = o.id
      WHERE o.tenant_id = ${tenantId}
        AND (${branchFilter} IS NULL OR o.branch_id = ${branchFilter})
        AND (${statusFilter} IS NULL OR o.status = ${statusFilter})
        AND (${orderTypeFilter} IS NULL OR o.order_type = ${orderTypeFilter})
        AND (${paymentTypeFilter} IS NULL OR o.payment_type = ${paymentTypeFilter})
      ORDER BY o.created_at DESC
      LIMIT ${safeLimit}
    `;
  }

  return rows.map(mapOrderRow);
}

async function getOrdersDebug({ tenantId, branchId, status, orderType, paymentType }) {
  const branchFilter = branchId || null;
  const statusFilter = status || null;
  const orderTypeFilter = orderType || null;
  const paymentTypeFilter = paymentType || null;

  const [totalRows, tenantRows, filteredRows, tenantsRows] = await Promise.all([
    prisma.$queryRaw`SELECT COUNT(*) AS total FROM orders`,
    prisma.$queryRaw`SELECT COUNT(*) AS total FROM orders WHERE tenant_id = ${tenantId}`,
    prisma.$queryRaw`
      SELECT COUNT(*) AS total
      FROM orders
      WHERE tenant_id = ${tenantId}
        AND (${branchFilter} IS NULL OR branch_id = ${branchFilter})
        AND (${statusFilter} IS NULL OR status = ${statusFilter})
        AND (${orderTypeFilter} IS NULL OR order_type = ${orderTypeFilter})
        AND (${paymentTypeFilter} IS NULL OR payment_type = ${paymentTypeFilter})
    `,
    prisma.$queryRaw`
      SELECT tenant_id AS tenantId, COUNT(*) AS total
      FROM orders
      GROUP BY tenant_id
      ORDER BY total DESC
      LIMIT 10
    `,
  ]);

  return {
    totalOrders: toNumber(totalRows[0]?.total),
    tenantOrders: toNumber(tenantRows[0]?.total),
    filteredOrders: toNumber(filteredRows[0]?.total),
    tenants: tenantsRows.map((row) => ({
      tenantId: String(row.tenantId),
      totalOrders: toNumber(row.total),
    })),
  };
}

async function getOrderById({ tenantId, orderId }) {
  let orderRows;
  try {
    orderRows = await prisma.$queryRaw`
      SELECT
        o.id AS id,
        o.num_order AS numOrder,
        o.tenant_id AS tenantId,
        o.branch_id AS branchId,
        o.customer_id AS customerId,
        o.order_type AS orderType,
        o.payment_type AS paymentType,
        o.status AS status,
        o.subtotal AS subtotal,
        o.discount_amount AS discountAmount,
        o.tax_amount AS taxAmount,
        o.total AS total,
        o.notes AS notes,
        o.created_by AS createdBy,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt,
        c.id AS customerDataId,
        c.full_name AS customerFullName,
        c.phone AS customerPhone,
        c.email AS customerEmail
      FROM orders o
      LEFT JOIN customers c
        ON c.id = o.customer_id
       AND c.tenant_id = o.tenant_id
      WHERE o.tenant_id = ${tenantId}
        AND o.id = ${orderId}
      LIMIT 1
    `;
  } catch (error) {
    if (!isUnknownUpdatedAtColumn(error)) {
      throw error;
    }
    orderRows = await prisma.$queryRaw`
      SELECT
        o.id AS id,
        o.num_order AS numOrder,
        o.tenant_id AS tenantId,
        o.branch_id AS branchId,
        o.customer_id AS customerId,
        o.order_type AS orderType,
        o.payment_type AS paymentType,
        o.status AS status,
        o.subtotal AS subtotal,
        o.discount_amount AS discountAmount,
        o.tax_amount AS taxAmount,
        o.total AS total,
        o.notes AS notes,
        o.created_by AS createdBy,
        o.created_at AS createdAt,
        NULL AS updatedAt,
        c.id AS customerDataId,
        c.full_name AS customerFullName,
        c.phone AS customerPhone,
        c.email AS customerEmail
      FROM orders o
      LEFT JOIN customers c
        ON c.id = o.customer_id
       AND c.tenant_id = o.tenant_id
      WHERE o.tenant_id = ${tenantId}
        AND o.id = ${orderId}
      LIMIT 1
    `;
  }

  if (!orderRows.length) {
    return null;
  }

  let itemRows;
  try {
    itemRows = await prisma.$queryRaw`
      SELECT
        oi.id AS id,
        oi.product_id AS productId,
        p.name AS productName,
        oi.qty AS qty,
        oi.unit_price AS unitPrice,
        oi.discount_amount AS discountAmount,
        oi.tax_amount AS taxAmount,
        oi.subtotal AS subtotal,
        oi.total AS total,
        oi.created_at AS createdAt,
        oi.updated_at AS updatedAt
      FROM order_items oi
      INNER JOIN products p ON p.id = oi.product_id
      WHERE oi.tenant_id = ${tenantId}
        AND oi.order_id = ${orderId}
      ORDER BY oi.created_at ASC
    `;
  } catch (error) {
    if (!isUnknownUpdatedAtColumn(error)) {
      throw error;
    }
    itemRows = await prisma.$queryRaw`
      SELECT
        oi.id AS id,
        oi.product_id AS productId,
        p.name AS productName,
        oi.qty AS qty,
        oi.unit_price AS unitPrice,
        oi.discount_amount AS discountAmount,
        oi.tax_amount AS taxAmount,
        oi.subtotal AS subtotal,
        oi.total AS total,
        oi.created_at AS createdAt,
        NULL AS updatedAt
      FROM order_items oi
      INNER JOIN products p ON p.id = oi.product_id
      WHERE oi.tenant_id = ${tenantId}
        AND oi.order_id = ${orderId}
      ORDER BY oi.created_at ASC
    `;
  }

  return {
    ...mapOrderRow(orderRows[0]),
    items: itemRows.map(mapOrderItemRow),
  };
}

async function updateOrderById({
  tenantId,
  orderId,
  customerId,
  orderType,
  paymentType,
  status,
  discountAmount,
  taxAmount,
  notes,
}) {
  const hasCustomerId = customerId !== undefined;
  const hasOrderType = orderType !== undefined;
  const hasPaymentType = paymentType !== undefined;
  const hasStatus = status !== undefined;
  const hasDiscountAmount = discountAmount !== undefined;
  const hasTaxAmount = taxAmount !== undefined;
  const hasNotes = notes !== undefined;

  if (
    !hasCustomerId &&
    !hasOrderType &&
    !hasPaymentType &&
    !hasStatus &&
    !hasDiscountAmount &&
    !hasTaxAmount &&
    !hasNotes
  ) {
    throw new Error("no hay campos para actualizar");
  }

  if (hasCustomerId && customerId) {
    const customerRows = await prisma.$queryRaw`
      SELECT id
      FROM customers
      WHERE id = ${customerId}
        AND tenant_id = ${tenantId}
      LIMIT 1
    `;
    if (!customerRows.length) {
      throw new Error("cliente no encontrado para el tenant");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await lockOrderRegister(tx, tenantId, orderId);
    const existingRows = await tx.$queryRaw`
      SELECT subtotal, discount_amount AS discountAmount, tax_amount AS taxAmount
      FROM orders
      WHERE tenant_id = ${tenantId}
        AND id = ${orderId}
      LIMIT 1
      FOR UPDATE
    `;

    if (!existingRows.length) {
      return null;
    }

    const existing = existingRows[0];
    const subtotal = toNumber(existing.subtotal);
    const nextDiscount = hasDiscountAmount ? round2(discountAmount) : toNumber(existing.discountAmount);
    const nextTax = hasTaxAmount ? round2(taxAmount) : toNumber(existing.taxAmount);
    const nextTotal = round2(Math.max(0, subtotal - nextDiscount + nextTax));

    await tx.$executeRaw`
      UPDATE orders
      SET
        customer_id = IF(${hasCustomerId}, ${customerId ?? null}, customer_id),
        order_type = IF(${hasOrderType}, ${orderType ?? ""}, order_type),
        payment_type = IF(${hasPaymentType}, ${paymentType ?? ""}, payment_type),
        status = IF(${hasStatus}, ${status ?? ""}, status),
        discount_amount = IF(${hasDiscountAmount}, ${nextDiscount}, discount_amount),
        tax_amount = IF(${hasTaxAmount}, ${nextTax}, tax_amount),
        total = IF(${hasDiscountAmount} OR ${hasTaxAmount}, ${nextTotal}, total),
        notes = IF(${hasNotes}, ${notes ?? null}, notes)
      WHERE tenant_id = ${tenantId}
        AND id = ${orderId}
    `;

    return true;
  });
  if (!updated) return null;

  return getOrderById({ tenantId, orderId });
}

async function cancelOrderById({ tenantId, orderId, cancelledBy }) {
  const result = await prisma.$transaction(async (tx) => {
    await lockOrderRegister(tx, tenantId, orderId);
    const orderRows = await tx.$queryRaw`
      SELECT
        id,
        branch_id AS branchId,
        status
      FROM orders
      WHERE tenant_id = ${tenantId}
        AND id = ${orderId}
      LIMIT 1
      FOR UPDATE
    `;

    if (!orderRows.length) {
      return null;
    }

    const order = orderRows[0];
    const previousStatus = String(order.status || "");
    if (previousStatus === "cancelled") {
      return { alreadyCancelled: true };
    }

    const itemRows = await tx.$queryRaw`
      SELECT
        product_id AS productId,
        qty,
        unit_price AS unitPrice
      FROM order_items
      WHERE tenant_id = ${tenantId}
        AND order_id = ${orderId}
      ORDER BY created_at ASC
    `;

    try {
      await tx.$executeRaw`
        UPDATE orders
        SET
          status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP(3)
        WHERE tenant_id = ${tenantId}
          AND id = ${orderId}
      `;
    } catch (error) {
      if (!isUnknownUpdatedAtColumn(error)) {
        throw error;
      }

      await tx.$executeRaw`
        UPDATE orders
        SET status = 'cancelled'
        WHERE tenant_id = ${tenantId}
          AND id = ${orderId}
      `;
    }

    for (const item of itemRows) {
      const qty = round3(item.qty);
      if (qty <= 0) {
        continue;
      }

      try {
        await tx.$executeRaw`
          INSERT INTO inventory (
            tenant_id,
            branch_id,
            product_id,
            qty_on_hand,
            reorder_level,
            updated_at
          )
          VALUES (
            ${tenantId},
            ${order.branchId},
            ${item.productId},
            ${qty},
            0,
            CURRENT_TIMESTAMP(3)
          )
          ON DUPLICATE KEY UPDATE
            qty_on_hand = qty_on_hand + VALUES(qty_on_hand),
            updated_at = CURRENT_TIMESTAMP(3)
        `;
      } catch (error) {
        if (!isUnknownUpdatedAtColumn(error)) {
          throw error;
        }

        await tx.$executeRaw`
          INSERT INTO inventory (
            tenant_id,
            branch_id,
            product_id,
            qty_on_hand,
            reorder_level
          )
          VALUES (
            ${tenantId},
            ${order.branchId},
            ${item.productId},
            ${qty},
            0
          )
          ON DUPLICATE KEY UPDATE
            qty_on_hand = qty_on_hand + VALUES(qty_on_hand)
        `;
      }

      await tx.$executeRaw`
        INSERT INTO inventory_movements (
          id,
          tenant_id,
          branch_id,
          product_id,
          type,
          qty_delta,
          unit_cost,
          reference_type,
          reference_id,
          note,
          created_by
        )
        VALUES (
          ${randomUUID()},
          ${tenantId},
          ${order.branchId},
          ${item.productId},
          'return',
          ${qty},
          ${item.unitPrice ?? null},
          'order_cancellation',
          ${orderId},
          ${`cancelacion de orden ${orderId}`},
          ${cancelledBy ?? null}
        )
      `;
    }

    return {
      alreadyCancelled: false,
      restoredItemCount: itemRows.length,
    };
  });

  if (!result) {
    return null;
  }

  const order = await getOrderById({ tenantId, orderId });
  return {
    ...result,
    order,
  };
}

async function createCheckoutOrder({
  tenantId,
  createdBy,
  branchId,
  customerId,
  orderType,
  paymentType,
  discountAmount,
  taxAmount,
  notes,
  items,
  cashRegisterSessionId,
}) {
  return prisma.$transaction(async (tx) => {
    const register = await requireOpenSession(tx, tenantId, branchId, cashRegisterSessionId);
    const [nextOrderNumberRow] = await tx.$queryRaw`
      SELECT
        COALESCE(
          MAX(
            CAST(SUBSTRING(num_order, 5) AS UNSIGNED)
          ),
          0
        ) + 1 AS nextOrderNumber
      FROM orders
      WHERE tenant_id = ${tenantId}
      FOR UPDATE
    `;
    const numOrder = formatOrderNumber(nextOrderNumberRow?.nextOrderNumber);

    const branch = await tx.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });

    if (!branch) {
      throw new Error("sucursal no encontrada para el tenant");
    }

    if (customerId) {
      const customerRows = await tx.$queryRaw`
        SELECT id
        FROM customers
        WHERE id = ${customerId}
          AND tenant_id = ${tenantId}
        LIMIT 1
      `;

      if (!customerRows.length) {
        throw new Error("cliente no encontrado para el tenant");
      }
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await tx.product.findMany({
      where: {
        tenantId,
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
        price: true,
        unit: true,
        allowDecimalQty: true,
      },
    });

    const productMap = new Map(products.map((product) => [product.id, product]));

    if (products.length !== productIds.length) {
      throw new Error("uno o mas productos no existen para el tenant");
    }

    const normalizedItems = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error("producto invalido en la orden");
      }

      const rawQty = Number(item.qty);
      const decimalAllowed = product.allowDecimalQty || ["kg", "g", "l", "ml"].includes(product.unit);
      if (!Number.isFinite(rawQty) || rawQty <= 0 || Math.abs(rawQty * 1000 - Math.round(rawQty * 1000)) > 0.00001 || (!decimalAllowed && !Number.isInteger(rawQty))) {
        throw Object.assign(new Error(`Cantidad invalida para ${product.name}. ${decimalAllowed ? "Usa hasta 3 decimales." : "Usa unidades enteras."}`), { status: 400 });
      }
      const qty = round3(rawQty);
      if (qty <= 0) {
        throw new Error("qty debe ser mayor a 0");
      }

      const unitPrice = round2(item.unitPrice ?? product.price);
      const lineDiscount = round2(item.discountAmount ?? 0);
      const lineTax = round2(item.taxAmount ?? 0);
      const lineSubtotal = round2(qty * unitPrice);
      const lineTotal = round2(lineSubtotal - lineDiscount + lineTax);

      return {
        id: randomUUID(),
        productId: item.productId,
        productName: product.name,
        qty,
        unitPrice,
        discountAmount: lineDiscount,
        taxAmount: lineTax,
        subtotal: lineSubtotal,
        total: lineTotal,
      };
    });

    const subtotal = round2(normalizedItems.reduce((acc, item) => acc + item.subtotal, 0));
    const computedDiscount = round2(normalizedItems.reduce((acc, item) => acc + item.discountAmount, 0));
    const computedTax = round2(normalizedItems.reduce((acc, item) => acc + item.taxAmount, 0));
    const finalDiscount = round2(discountAmount ?? computedDiscount);
    const finalTax = round2(taxAmount ?? computedTax);
    const total = round2(Math.max(0, subtotal - finalDiscount + finalTax));

    const orderId = randomUUID();
    try {
      await tx.$executeRaw`
        INSERT INTO orders (
          id,
          num_order,
          tenant_id,
          branch_id,
          customer_id,
          order_type,
          payment_type,
          status,
          subtotal,
          discount_amount,
          tax_amount,
          total,
          notes,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          ${orderId},
          ${numOrder},
          ${tenantId},
          ${branchId},
          ${customerId ?? null},
          ${orderType},
          ${paymentType},
          'paid',
          ${subtotal},
          ${finalDiscount},
          ${finalTax},
          ${total},
          ${notes ?? null},
          ${createdBy ?? null},
          CURRENT_TIMESTAMP(3),
          CURRENT_TIMESTAMP(3)
        )
      `;
    } catch (error) {
      if (!isUnknownUpdatedAtColumn(error)) {
        throw error;
      }

      await tx.$executeRaw`
        INSERT INTO orders (
          id,
          num_order,
          tenant_id,
          branch_id,
          customer_id,
          order_type,
          payment_type,
          status,
          subtotal,
          discount_amount,
          tax_amount,
          total,
          notes,
          created_by,
          created_at
        )
        VALUES (
          ${orderId},
          ${numOrder},
          ${tenantId},
          ${branchId},
          ${customerId ?? null},
          ${orderType},
          ${paymentType},
          'paid',
          ${subtotal},
          ${finalDiscount},
          ${finalTax},
          ${total},
          ${notes ?? null},
          ${createdBy ?? null},
          CURRENT_TIMESTAMP(3)
        )
      `;
    }

    await tx.$executeRaw`UPDATE orders SET cash_register_session_id = ${register.id} WHERE id = ${orderId} AND tenant_id = ${tenantId}`;

    for (const item of normalizedItems) {
      try {
        await tx.$executeRaw`
          INSERT INTO order_items (
            id,
            order_id,
            tenant_id,
            product_id,
            qty,
            unit_price,
            discount_amount,
            tax_amount,
            subtotal,
            total,
            created_at,
            updated_at
          )
          VALUES (
            ${item.id},
            ${orderId},
            ${tenantId},
            ${item.productId},
            ${item.qty},
            ${item.unitPrice},
            ${item.discountAmount},
            ${item.taxAmount},
            ${item.subtotal},
            ${item.total},
            CURRENT_TIMESTAMP(3),
            CURRENT_TIMESTAMP(3)
          )
        `;
      } catch (error) {
        if (!isUnknownUpdatedAtColumn(error)) {
          throw error;
        }

        await tx.$executeRaw`
          INSERT INTO order_items (
            id,
            order_id,
            tenant_id,
            product_id,
            qty,
            unit_price,
            discount_amount,
            tax_amount,
            subtotal,
            total,
            created_at
          )
          VALUES (
            ${item.id},
            ${orderId},
            ${tenantId},
            ${item.productId},
            ${item.qty},
            ${item.unitPrice},
            ${item.discountAmount},
            ${item.taxAmount},
            ${item.subtotal},
            ${item.total},
            CURRENT_TIMESTAMP(3)
          )
        `;
      }

      const [previousInventory] = await tx.$queryRaw`
        SELECT
          qty_on_hand AS qtyOnHand,
          qty_reserved AS qtyReserved,
          reorder_level AS reorderLevel
        FROM inventory
        WHERE tenant_id = ${tenantId}
          AND branch_id = ${branchId}
          AND product_id = ${item.productId}
        LIMIT 1
        FOR UPDATE
      `;
      const previousQtyOnHand =
        previousInventory?.qtyOnHand === undefined ? null : toNumber(previousInventory.qtyOnHand);
      const previousQtyReserved =
        previousInventory?.qtyReserved === undefined ? 0 : toNumber(previousInventory.qtyReserved);
      const previousReorderLevel =
        previousInventory?.reorderLevel === undefined ? 0 : toNumber(previousInventory.reorderLevel);
      const availableQty = round3((previousQtyOnHand ?? 0) - previousQtyReserved);

      if (!previousInventory || availableQty < item.qty) {
        throw new Error(`stock insuficiente para ${item.productName}. Disponible: ${Math.max(0, availableQty)}`);
      }

      try {
        const updatedRows = await tx.$executeRaw`
          UPDATE inventory
          SET
            qty_on_hand = qty_on_hand - ${item.qty},
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE tenant_id = ${tenantId}
            AND branch_id = ${branchId}
            AND product_id = ${item.productId}
            AND qty_on_hand - qty_reserved >= ${item.qty}
        `;

        if (Number(updatedRows) !== 1) {
          throw new Error(`stock insuficiente para ${item.productName}. Disponible: ${Math.max(0, availableQty)}`);
        }
      } catch (error) {
        if (!isUnknownUpdatedAtColumn(error)) {
          throw error;
        }

        const updatedRows = await tx.$executeRaw`
          UPDATE inventory
          SET qty_on_hand = qty_on_hand - ${item.qty}
          WHERE tenant_id = ${tenantId}
            AND branch_id = ${branchId}
            AND product_id = ${item.productId}
            AND qty_on_hand - qty_reserved >= ${item.qty}
        `;

        if (Number(updatedRows) !== 1) {
          throw new Error(`stock insuficiente para ${item.productName}. Disponible: ${Math.max(0, availableQty)}`);
        }
      }

      const [nextInventory] = await tx.$queryRaw`
        SELECT
          qty_on_hand AS qtyOnHand,
          reorder_level AS reorderLevel
        FROM inventory
        WHERE tenant_id = ${tenantId}
          AND branch_id = ${branchId}
          AND product_id = ${item.productId}
        LIMIT 1
      `;
      const nextQtyOnHand = toNumber(nextInventory?.qtyOnHand);
      const reorderLevel = toNumber(nextInventory?.reorderLevel, previousReorderLevel);
      const isOutOfStock = nextQtyOnHand <= 0;
      const isBelowReorderLevel = !isOutOfStock && reorderLevel > 0 && nextQtyOnHand < reorderLevel;

      if (isOutOfStock) {
        try {
          await tx.notification.create({
            data: {
              tenantId,
              title: "Stock agotado",
              message: `El stock de "${item.productName}" se agoto al crear la orden ${numOrder}. Stock actual: ${nextQtyOnHand}.`,
              type: "error",
              status: "unread",
              metadata: {
                entity: "inventory",
                action: "out_of_stock_after_order",
                branchId,
                productId: item.productId,
                productName: item.productName,
                orderId,
                numOrder,
                previousQtyOnHand,
                nextQtyOnHand,
                reorderLevel,
              },
            },
          });
        } catch (notificationError) {
          console.error("No se pudo crear notificacion de stock agotado:", notificationError);
        }
      }

      if (isBelowReorderLevel) {
        try {
          await tx.notification.create({
            data: {
              tenantId,
              title: "Stock bajo",
              message: `El stock de "${item.productName}" esta por debajo del minimo. Stock actual: ${nextQtyOnHand}. Minimo: ${reorderLevel}.`,
              type: "warning",
              status: "unread",
              metadata: {
                entity: "inventory",
                action: "low_stock_after_order",
                branchId,
                productId: item.productId,
                productName: item.productName,
                orderId,
                numOrder,
                previousQtyOnHand,
                nextQtyOnHand,
                reorderLevel,
              },
            },
          });
        } catch (notificationError) {
          console.error("No se pudo crear notificacion de stock bajo:", notificationError);
        }
      }

      await tx.$executeRaw`
        INSERT INTO inventory_movements (
          id,
          tenant_id,
          branch_id,
          product_id,
          type,
          qty_delta,
          unit_cost,
          reference_type,
          reference_id,
          note,
          created_by
        )
        VALUES (
          ${randomUUID()},
          ${tenantId},
          ${branchId},
          ${item.productId},
          'sale',
          ${-item.qty},
          ${item.unitPrice},
          ${orderType},
          ${orderId},
          ${`checkout ${orderType}`},
          ${createdBy ?? null}
        )
      `;
    }

    return {
      id: orderId,
      numOrder,
      tenantId,
      branchId,
      customerId: customerId ?? null,
      orderType,
      paymentType,
      status: "paid",
      subtotal,
      discountAmount: finalDiscount,
      taxAmount: finalTax,
      total,
      notes: notes ?? null,
      items: normalizedItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        taxAmount: item.taxAmount,
        subtotal: item.subtotal,
        total: item.total,
      })),
    };
  });
}

module.exports = {
  cancelOrderById,
  createCheckoutOrder,
  getOrdersByTenant,
  getOrdersDebug,
  getOrderById,
  updateOrderById,
};
