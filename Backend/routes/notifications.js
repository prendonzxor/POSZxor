const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
  createNotification,
  getNotificationsByTenant,
} = require("../services/notification.service");

const router = express.Router();

async function resolveTenantIdFromToken(req) {
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
    return { tenantId: String(session.tenantId).trim() };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return { error: "usuario autenticado no encontrado" };
  }

  return { tenantId: String(user.tenantId).trim() };
}

function parseJsonObject(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  throw new Error("metadata debe ser un objeto JSON");
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 4aef4f6c-8de4-4ea9-8f73-4f4717a2d112
 *         tenantId:
 *           type: string
 *           example: f9789760-4dc8-4fb6-9f7d-9c177d2038ef
 *         title:
 *           type: string
 *           example: Inventario bajo
 *         message:
 *           type: string
 *           example: El producto Refresco 600ml esta por debajo del minimo.
 *         type:
 *           type: string
 *           enum: [info, success, warning, error]
 *           example: warning
 *         status:
 *           type: string
 *           enum: [unread, read, archived]
 *           example: unread
 *         metadata:
 *           type: object
 *           nullable: true
 *         readAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     NotificationCreateRequest:
 *       type: object
 *       required:
 *         - title
 *         - message
 *       properties:
 *         title:
 *           type: string
 *           example: Inventario bajo
 *         message:
 *           type: string
 *           example: El producto Refresco 600ml esta por debajo del minimo.
 *         type:
 *           type: string
 *           enum: [info, success, warning, error]
 *           example: warning
 *         status:
 *           type: string
 *           enum: [unread, read, archived]
 *           example: unread
 *         metadata:
 *           type: object
 *           nullable: true
 *     NotificationListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: notificaciones obtenidas
 *         notifications:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Notification'
 *     NotificationSingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: notificacion creada
 *         notification:
 *           $ref: '#/components/schemas/Notification'
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Obtener notificaciones del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [unread, read, archived]
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Notificaciones obtenidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationListResponse'
 *       401:
 *         description: Token invalido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const status = String(req.query.status || "").trim();
    const limit = Number(req.query.limit || 50);

    if (status && !NOTIFICATION_STATUSES.has(status)) {
      return res.status(400).json({ message: "status invalido" });
    }

    const notifications = await getNotificationsByTenant({
      tenantId: authContext.tenantId,
      status: status || undefined,
      limit,
    });

    return res.status(200).json({
      message: "notificaciones obtenidas",
      notifications,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener notificaciones", error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     tags:
 *       - Notifications
 *     summary: Crear notificacion o mensaje
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationCreateRequest'
 *     responses:
 *       201:
 *         description: Notificacion creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationSingleResponse'
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
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const title = String(req.body?.title || "").trim();
    const message = String(req.body?.message || "").trim();
    const type = String(req.body?.type || "info").trim().toLowerCase();
    const status = String(req.body?.status || "unread").trim().toLowerCase();
    const metadata = parseJsonObject(req.body?.metadata);

    if (!title || !message) {
      return res.status(400).json({ message: "title y message son requeridos" });
    }

    if (title.length > 160) {
      return res.status(400).json({ message: "title no puede superar 160 caracteres" });
    }

    if (message.length > 1000) {
      return res.status(400).json({ message: "message no puede superar 1000 caracteres" });
    }

    if (!NOTIFICATION_TYPES.has(type)) {
      return res.status(400).json({ message: "type invalido" });
    }

    if (!NOTIFICATION_STATUSES.has(status)) {
      return res.status(400).json({ message: "status invalido" });
    }

    const notification = await createNotification({
      tenantId: authContext.tenantId,
      title,
      message,
      type,
      status,
      metadata,
    });

    return res.status(201).json({
      message: "notificacion creada",
      notification,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al crear notificacion", error: error.message });
  }
});

module.exports = router;
