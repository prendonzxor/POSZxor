const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  createLayaway,
  getLayawaysByTenant,
  getLayawayById,
  closeLayaway,
} = require("../services/layaways.service");
const { createNotification } = require("../services/notification.service");

const router = express.Router();
const LAYAWAY_STATUSES = ["active", "partially_paid", "completed", "cancelled", "expired"];

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

async function notifyLayaway({ tenantId, layaway, title, action }) {
  try {
    await createNotification({
      tenantId,
      title,
      message: `Apartado de ${layaway.customer?.fullName || "cliente"} por $${Number(layaway.total || 0).toFixed(2)}.`,
      type: action === "completed" ? "success" : action === "cancelled" ? "warning" : "info",
      metadata: {
        entity: "layaway",
        action,
        layawayId: layaway.id,
        customerId: layaway.customerId,
        total: layaway.total,
      },
    });
  } catch (error) {
    console.error("No se pudo crear notificacion de apartado:", error);
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     LayawayItemRequest:
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
 *           description: Defaults to current product price when omitted.
 *         discountAmount:
 *           type: number
 *           default: 0
 *         taxAmount:
 *           type: number
 *           description: Defaults to product tax rate when omitted.
 *     LayawayCreateRequest:
 *       type: object
 *       required:
 *         - branchId
 *         - customerId
 *         - items
 *       properties:
 *         branchId:
 *           type: string
 *         customerId:
 *           type: string
 *         depositAmount:
 *           type: number
 *           example: 100
 *         discountAmount:
 *           type: number
 *           example: 0
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         notes:
 *           type: string
 *         items:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/LayawayItemRequest'
 *     LayawayItemResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         productId:
 *           type: string
 *         productName:
 *           type: string
 *         sku:
 *           type: string
 *           nullable: true
 *         barcode:
 *           type: string
 *           nullable: true
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
 *     LayawayResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         tenantId:
 *           type: string
 *         branchId:
 *           type: string
 *         branchName:
 *           type: string
 *           nullable: true
 *         customerId:
 *           type: string
 *         customer:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             fullName:
 *               type: string
 *             phone:
 *               type: string
 *               nullable: true
 *         status:
 *           type: string
 *           enum: [active, partially_paid, completed, cancelled, expired]
 *         subtotal:
 *           type: number
 *         discountAmount:
 *           type: number
 *         taxAmount:
 *           type: number
 *         total:
 *           type: number
 *         depositAmount:
 *           type: number
 *         balanceDue:
 *           type: number
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         itemCount:
 *           type: number
 *     LayawaySingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         layaway:
 *           allOf:
 *             - $ref: '#/components/schemas/LayawayResponse'
 *             - type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LayawayItemResponse'
 *     LayawayListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         layaways:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LayawayResponse'
 */

/**
 * @swagger
 * /api/layaways:
 *   get:
 *     tags:
 *       - Layaways
 *     summary: List tenant layaways
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, partially_paid, completed, cancelled, expired]
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Layaways obtained
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LayawayListResponse'
 */
router.get("/", async (req, res) => {
  try {
    const authContext = await resolveAuthContextFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const status = String(req.query.status || "").trim() || undefined;
    if (status && !LAYAWAY_STATUSES.includes(status)) {
      return res.status(400).json({ message: "status invalido" });
    }

    const layaways = await getLayawaysByTenant({
      tenantId: authContext.tenantId,
      status,
      customerId: String(req.query.customerId || "").trim() || undefined,
      branchId: String(req.query.branchId || "").trim() || undefined,
      limit: parseNumber(req.query.limit, 100),
    });

    return res.status(200).json({ message: "apartados obtenidos", layaways });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener apartados", error: error.message });
  }
});

/**
 * @swagger
 * /api/layaways/{id}:
 *   get:
 *     tags:
 *       - Layaways
 *     summary: Get layaway details
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
 *         description: Layaway obtained
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LayawaySingleResponse'
 *       404:
 *         description: Layaway not found
 */
router.get("/:id", async (req, res) => {
  try {
    const authContext = await resolveAuthContextFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const layaway = await getLayawayById({
      tenantId: authContext.tenantId,
      layawayId: String(req.params.id || "").trim(),
    });

    if (!layaway) {
      return res.status(404).json({ message: "apartado no encontrado" });
    }

    return res.status(200).json({ message: "apartado obtenido", layaway });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener apartado", error: error.message });
  }
});

/**
 * @swagger
 * /api/layaways:
 *   post:
 *     tags:
 *       - Layaways
 *     summary: Create a layaway and reserve stock
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LayawayCreateRequest'
 *     responses:
 *       201:
 *         description: Layaway created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LayawaySingleResponse'
 */
router.post("/", async (req, res) => {
  try {
    const authContext = await resolveAuthContextFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const branchId = String(req.body?.branchId || "").trim();
    const customerId = String(req.body?.customerId || "").trim();
    if (!branchId || !customerId || !Array.isArray(req.body?.items)) {
      return res.status(400).json({ message: "branchId, customerId e items son requeridos" });
    }

    const layaway = await createLayaway({
      tenantId: authContext.tenantId,
      branchId,
      customerId,
      items: req.body.items,
      depositAmount: parseNumber(req.body?.depositAmount, 0),
      discountAmount: parseNumber(req.body?.discountAmount, 0),
      expiresAt: req.body?.expiresAt || null,
      notes: req.body?.notes ? String(req.body.notes).trim() : null,
      createdBy: authContext.userId,
    });

    await notifyLayaway({
      tenantId: authContext.tenantId,
      layaway,
      title: "Apartado creado",
      action: "created",
    });

    return res.status(201).json({ message: "apartado creado", layaway });
  } catch (error) {
    return res.status(400).json({ message: error.message || "error al crear apartado" });
  }
});

/**
 * @swagger
 * /api/layaways/{id}/complete:
 *   post:
 *     tags:
 *       - Layaways
 *     summary: Complete a layaway, consume reserved stock, and close balance
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
 *         description: Layaway completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LayawaySingleResponse'
 */
router.post("/:id/complete", async (req, res) => {
  try {
    const authContext = await resolveAuthContextFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const layaway = await closeLayaway({
      tenantId: authContext.tenantId,
      layawayId: String(req.params.id || "").trim(),
      nextStatus: "completed",
      userId: authContext.userId,
    });

    if (!layaway) {
      return res.status(404).json({ message: "apartado no encontrado" });
    }

    await notifyLayaway({
      tenantId: authContext.tenantId,
      layaway,
      title: "Apartado completado",
      action: "completed",
    });

    return res.status(200).json({ message: "apartado completado", layaway });
  } catch (error) {
    return res.status(400).json({ message: error.message || "error al completar apartado" });
  }
});

/**
 * @swagger
 * /api/layaways/{id}/cancel:
 *   post:
 *     tags:
 *       - Layaways
 *     summary: Cancel a layaway and release reserved stock
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
 *         description: Layaway cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LayawaySingleResponse'
 */
router.post("/:id/cancel", async (req, res) => {
  try {
    const authContext = await resolveAuthContextFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const layaway = await closeLayaway({
      tenantId: authContext.tenantId,
      layawayId: String(req.params.id || "").trim(),
      nextStatus: "cancelled",
      userId: authContext.userId,
    });

    if (!layaway) {
      return res.status(404).json({ message: "apartado no encontrado" });
    }

    await notifyLayaway({
      tenantId: authContext.tenantId,
      layaway,
      title: "Apartado cancelado",
      action: "cancelled",
    });

    return res.status(200).json({ message: "apartado cancelado", layaway });
  } catch (error) {
    return res.status(400).json({ message: error.message || "error al cancelar apartado" });
  }
});

module.exports = router;
