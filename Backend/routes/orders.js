const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  cancelOrderById,
  createCheckoutOrder,
  getOrdersByTenant,
  getOrdersDebug,
  getOrderById,
  updateOrderById,
} = require("../services/orders.service");
const { createNotification } = require("../services/notification.service");

const router = express.Router();

const ORDER_TYPES = ["pos", "delivery", "pickup"];
const PAYMENT_TYPES = ["cash", "card", "transfer", "mixed", "credit"];
const ORDER_STATUS = ["created", "paid", "cancelled"];

async function resolveAuthContextFromToken(req) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return { error: "token de autorizacion requerido" };
  }

  const session = parseSessionToken(token);
  if (!session) {
    return { error: "token invalido o expirado" };
  }

  if (session.tenantId) {
    return {
      tenantId: String(session.tenantId).trim(),
      userId: Number(session.userId) || null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return { error: "usuario autenticado no encontrado" };
  }

  return {
    tenantId: String(user.tenantId).trim(),
    userId: Number(session.userId) || null,
  };
}

function parseNumber(value, fallback = undefined) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     CheckoutItemRequest:
 *       type: object
 *       required:
 *         - productId
 *         - qty
 *       properties:
 *         productId:
 *           type: string
 *         qty:
 *           type: number
 *           example: 2
 *         unitPrice:
 *           type: number
 *           example: 120
 *         discountAmount:
 *           type: number
 *           example: 10
 *         taxAmount:
 *           type: number
 *           example: 19.2
 *     CheckoutRequest:
 *       type: object
 *       required:
 *         - branchId
 *         - orderType
 *         - paymentType
 *         - items
 *       properties:
 *         branchId:
 *           type: string
 *         customerId:
 *           type: string
 *           nullable: true
 *         orderType:
 *           type: string
 *           enum: [pos, delivery, pickup]
 *         paymentType:
 *           type: string
 *           enum: [cash, card, transfer, mixed, credit]
 *         discountAmount:
 *           type: number
 *         taxAmount:
 *           type: number
 *         notes:
 *           type: string
 *         items:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/CheckoutItemRequest'
 *     CheckoutItemResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         productId:
 *           type: string
 *         productName:
 *           type: string
 *         qty:
 *           type: number
 *         unitPrice:
 *           type: number
 *         discountAmount:
 *           type: number
 *         taxAmount:
 *           type: number
 *         subtotal:
 *           type: number
 *         total:
 *           type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     OrderResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         numOrder:
 *           type: string
 *           nullable: true
 *           example: ORD-0001
 *         tenantId:
 *           type: string
 *         branchId:
 *           type: string
 *         customerId:
 *           type: string
 *           nullable: true
 *         customer:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: string
 *             fullName:
 *               type: string
 *             phone:
 *               type: string
 *               nullable: true
 *             email:
 *               type: string
 *               nullable: true
 *         orderType:
 *           type: string
 *         paymentType:
 *           type: string
 *         status:
 *           type: string
 *         subtotal:
 *           type: number
 *         discountAmount:
 *           type: number
 *         taxAmount:
 *           type: number
 *         total:
 *           type: number
 *         notes:
 *           type: string
 *           nullable: true
 *         createdBy:
 *           type: integer
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     CheckoutResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: checkout creado
 *         order:
 *           allOf:
 *             - $ref: '#/components/schemas/OrderResponse'
 *             - type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CheckoutItemResponse'
 *     OrdersListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: ordenes obtenidas
 *         orders:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderResponse'
 *     OrderDetailsResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: orden obtenida
 *         order:
 *           allOf:
 *             - $ref: '#/components/schemas/OrderResponse'
 *             - type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CheckoutItemResponse'
 *     OrderUpdateRequest:
 *       type: object
 *       properties:
 *         customerId:
 *           type: string
 *           nullable: true
 *         orderType:
 *           type: string
 *           enum: [pos, delivery, pickup]
 *         paymentType:
 *           type: string
 *           enum: [cash, card, transfer, mixed, credit]
 *         status:
 *           type: string
 *           enum: [created, paid, cancelled]
 *         discountAmount:
 *           type: number
 *         taxAmount:
 *           type: number
 *         notes:
 *           type: string
 *           nullable: true
 */

/**
 * @swagger
 * /api/orders:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Obtener ordenes del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [created, paid, cancelled]
 *       - in: query
 *         name: orderType
 *         schema:
 *           type: string
 *           enum: [pos, delivery, pickup]
 *       - in: query
 *         name: paymentType
 *         schema:
 *           type: string
 *           enum: [cash, card, transfer, mixed, credit]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *           default: 100
 *     responses:
 *       200:
 *         description: Ordenes obtenidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrdersListResponse'
 */
router.get("/", async (req, res) => {
  try {
    const authContext = await resolveAuthContextFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const branchId = String(req.query.branchId || "").trim() || undefined;
    const status = String(req.query.status || "").trim().toLowerCase() || undefined;
    const orderType = String(req.query.orderType || "").trim().toLowerCase() || undefined;
    const paymentType = String(req.query.paymentType || "").trim().toLowerCase() || undefined;
    const limit = parseNumber(req.query.limit, 100);
    const includeDebug = String(req.query.debug || "").trim() === "1";

    if (status && !ORDER_STATUS.includes(status)) {
      return res.status(400).json({ message: `status invalido. Usa: ${ORDER_STATUS.join(", ")}` });
    }
    if (orderType && !ORDER_TYPES.includes(orderType)) {
      return res.status(400).json({ message: `orderType invalido. Usa: ${ORDER_TYPES.join(", ")}` });
    }
    if (paymentType && !PAYMENT_TYPES.includes(paymentType)) {
      return res.status(400).json({ message: `paymentType invalido. Usa: ${PAYMENT_TYPES.join(", ")}` });
    }
    if (limit === null) {
      return res.status(400).json({ message: "limit debe ser numerico" });
    }

    const orders = await getOrdersByTenant({
      tenantId: authContext.tenantId,
      branchId,
      status,
      orderType,
      paymentType,
      limit: limit ?? 100,
    });

    const response = {
      message: "ordenes obtenidas",
      orders,
    };

    if (includeDebug) {
      response.debug = {
        tenantId: authContext.tenantId,
        filters: {
          branchId: branchId ?? null,
          status: status ?? null,
          orderType: orderType ?? null,
          paymentType: paymentType ?? null,
          limit: limit ?? 100,
        },
        counts: await getOrdersDebug({
          tenantId: authContext.tenantId,
          branchId,
          status,
          orderType,
          paymentType,
        }),
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: "error al obtener ordenes", error: error.message });
  }
});

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Obtener detalle de una orden
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orden obtenida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderDetailsResponse'
 *       404:
 *         description: Orden no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", async (req, res) => {
  try {
    const authContext = await resolveAuthContextFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const orderId = String(req.params.id || "").trim();
    if (!orderId) {
      return res.status(400).json({ message: "id es requerido" });
    }

    const order = await getOrderById({
      tenantId: authContext.tenantId,
      orderId,
    });

    if (!order) {
      return res.status(404).json({ message: "orden no encontrada" });
    }

    return res.status(200).json({ message: "orden obtenida", order });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener orden", error: error.message });
  }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const authContext = await resolveAuthContextFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const orderId = String(req.params.id || "").trim();
    if (!orderId) {
      return res.status(400).json({ message: "id es requerido" });
    }

    const result = await cancelOrderById({
      tenantId: authContext.tenantId,
      orderId,
      cancelledBy: authContext.userId,
    });

    if (!result) {
      return res.status(404).json({ message: "orden no encontrada" });
    }

    try {
      await createNotification({
        tenantId: authContext.tenantId,
        title: result.alreadyCancelled ? "Orden ya cancelada" : "Orden cancelada",
        message: result.alreadyCancelled
          ? `La orden ${result.order?.numOrder || result.order?.id || orderId} ya estaba cancelada.`
          : `Se cancelo la orden ${result.order?.numOrder || result.order?.id || orderId} y se restauro el inventario.`,
        type: result.alreadyCancelled ? "info" : "warning",
        metadata: {
          entity: "order",
          action: "cancelled",
          orderId,
          numOrder: result.order?.numOrder || null,
          restoredItemCount: result.restoredItemCount || 0,
          alreadyCancelled: result.alreadyCancelled,
        },
      });
    } catch (notificationError) {
      console.error("No se pudo crear notificacion de cancelacion de orden:", notificationError);
    }

    return res.status(200).json({
      message: result.alreadyCancelled ? "orden ya estaba cancelada" : "orden cancelada",
      restoredItemCount: result.restoredItemCount || 0,
      order: result.order,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al cancelar orden", error: error.message });
  }
});

/**
 * @swagger
 * /api/orders/{id}:
 *   put:
 *     tags:
 *       - Orders
 *     summary: Actualizar orden
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrderUpdateRequest'
 *     responses:
 *       200:
 *         description: Orden actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderDetailsResponse'
 *       404:
 *         description: Orden no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:id", async (req, res) => {
  try {
    const authContext = await resolveAuthContextFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const orderId = String(req.params.id || "").trim();
    if (!orderId) {
      return res.status(400).json({ message: "id es requerido" });
    }

    const customerId =
      req.body?.customerId !== undefined ? String(req.body.customerId || "").trim() || null : undefined;
    const orderType =
      req.body?.orderType !== undefined ? String(req.body.orderType || "").trim().toLowerCase() : undefined;
    const paymentType =
      req.body?.paymentType !== undefined ? String(req.body.paymentType || "").trim().toLowerCase() : undefined;
    const status = req.body?.status !== undefined ? String(req.body.status || "").trim().toLowerCase() : undefined;
    const discountAmount = parseNumber(req.body?.discountAmount, undefined);
    const taxAmount = parseNumber(req.body?.taxAmount, undefined);
    const notes = req.body?.notes !== undefined ? String(req.body.notes || "").trim() || null : undefined;

    if (orderType !== undefined && !ORDER_TYPES.includes(orderType)) {
      return res.status(400).json({ message: `orderType invalido. Usa: ${ORDER_TYPES.join(", ")}` });
    }
    if (paymentType !== undefined && !PAYMENT_TYPES.includes(paymentType)) {
      return res.status(400).json({ message: `paymentType invalido. Usa: ${PAYMENT_TYPES.join(", ")}` });
    }
    if (status !== undefined && !ORDER_STATUS.includes(status)) {
      return res.status(400).json({ message: `status invalido. Usa: ${ORDER_STATUS.join(", ")}` });
    }
    if (discountAmount === null || taxAmount === null) {
      return res.status(400).json({ message: "discountAmount y taxAmount deben ser numericos" });
    }

    const order = await updateOrderById({
      tenantId: authContext.tenantId,
      orderId,
      customerId,
      orderType,
      paymentType,
      status,
      discountAmount,
      taxAmount,
      notes,
    });

    if (!order) {
      return res.status(404).json({ message: "orden no encontrada" });
    }

    return res.status(200).json({ message: "orden actualizada", order });
  } catch (error) {
    if (error.message?.includes("no hay campos para actualizar")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message?.includes("cliente no encontrado")) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "error al actualizar orden", error: error.message });
  }
});

/**
 * @swagger
 * /api/orders/checkout:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Crear orden de checkout
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckoutRequest'
 *     responses:
 *       201:
 *         description: Checkout creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CheckoutResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token invalido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/checkout", async (req, res) => {
  try {
    const authContext = await resolveAuthContextFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const branchId = String(req.body?.branchId || "").trim();
    const customerId = req.body?.customerId !== undefined ? String(req.body.customerId || "").trim() || null : null;
    const orderType = String(req.body?.orderType || "").trim().toLowerCase();
    const paymentType = String(req.body?.paymentType || "").trim().toLowerCase();
    const discountAmount = parseNumber(req.body?.discountAmount, undefined);
    const taxAmount = parseNumber(req.body?.taxAmount, undefined);
    const notes = req.body?.notes !== undefined ? String(req.body.notes || "").trim() || null : null;

    if (!branchId) {
      return res.status(400).json({ message: "branchId es requerido" });
    }
    if (!ORDER_TYPES.includes(orderType)) {
      return res.status(400).json({ message: `orderType invalido. Usa: ${ORDER_TYPES.join(", ")}` });
    }
    if (!PAYMENT_TYPES.includes(paymentType)) {
      return res.status(400).json({ message: `paymentType invalido. Usa: ${PAYMENT_TYPES.join(", ")}` });
    }
    if (discountAmount === null || taxAmount === null) {
      return res.status(400).json({ message: "discountAmount y taxAmount deben ser numericos" });
    }

    const bodyItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (bodyItems.length === 0) {
      return res.status(400).json({ message: "items es requerido y debe tener al menos un producto" });
    }

    const items = bodyItems.map((item, index) => {
      const productId = String(item?.productId || "").trim();
      const qty = parseNumber(item?.qty, undefined);
      const unitPrice = parseNumber(item?.unitPrice, undefined);
      const lineDiscount = parseNumber(item?.discountAmount, undefined);
      const lineTax = parseNumber(item?.taxAmount, undefined);

      if (!productId) {
        throw new Error(`items[${index}].productId es requerido`);
      }
      if (qty === undefined || qty === null || qty <= 0) {
        throw new Error(`items[${index}].qty debe ser mayor a 0`);
      }
      if (unitPrice === null || lineDiscount === null || lineTax === null) {
        throw new Error(`items[${index}] contiene valores numericos invalidos`);
      }

      return {
        productId,
        qty,
        unitPrice,
        discountAmount: lineDiscount,
        taxAmount: lineTax,
      };
    });

    const order = await createCheckoutOrder({
      tenantId: authContext.tenantId,
      createdBy: authContext.userId,
      branchId,
      customerId,
      orderType,
      paymentType,
      discountAmount,
      taxAmount,
      notes,
      items,
    });

    try {
      await createNotification({
        tenantId: authContext.tenantId,
        title: "Orden creada",
        message: `Se creo la orden ${order.numOrder || order.id} por $${Number(order.total || 0).toFixed(2)}.`,
        type: "success",
        metadata: {
          entity: "order",
          action: "created",
          orderId: order.id,
          numOrder: order.numOrder,
          branchId: order.branchId,
          customerId: order.customerId,
          orderType: order.orderType,
          paymentType: order.paymentType,
          total: order.total,
          itemCount: order.items?.length || 0,
        },
      });
    } catch (notificationError) {
      console.error("No se pudo crear notificacion de orden:", notificationError);
    }

    return res.status(201).json({ message: "checkout creado", order });
  } catch (error) {
    if (error.message?.includes("items[")) {
      return res.status(400).json({ message: error.message });
    }

    if (
      error.message?.includes("no encontrada") ||
      error.message?.includes("no encontrado") ||
      error.message?.includes("no existen") ||
      error.message?.includes("stock insuficiente")
    ) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "error al crear checkout", error: error.message });
  }
});

module.exports = router;
