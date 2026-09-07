const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const { getAnalyticsSummary } = require("../services/analytics.service");

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

function parseDays(value) {
  if (value === undefined || value === null || value === "") {
    return 7;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(90, Math.max(1, Math.trunc(parsed)));
}

/**
 * @swagger
 * components:
 *   schemas:
 *     AnalyticsSummary:
 *       type: object
 *       properties:
 *         totalSells:
 *           type: number
 *           example: 12450.75
 *         totalOrders:
 *           type: number
 *           example: 98
 *         totalCustomers:
 *           type: number
 *           example: 230
 *     AnalyticsSalesByDay:
 *       type: object
 *       properties:
 *         date:
 *           type: string
 *           format: date
 *           example: 2026-03-05
 *         totalSells:
 *           type: number
 *           example: 2190.45
 *         totalOrders:
 *           type: number
 *           example: 18
 *     AnalyticsOrdersByType:
 *       type: object
 *       properties:
 *         orderType:
 *           type: string
 *           example: pos
 *         totalOrders:
 *           type: number
 *           example: 75
 *         totalSells:
 *           type: number
 *           example: 10230.2
 *     AnalyticsOverviewResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: metricas obtenidas
 *         summary:
 *           $ref: '#/components/schemas/AnalyticsSummary'
 *         salesByDay:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AnalyticsSalesByDay'
 *         ordersByType:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AnalyticsOrdersByType'
 */

/**
 * @swagger
 * /api/analytics/overview:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Obtener metricas del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 90
 *           default: 7
 *         description: Ventana de dias para ventas por dia
 *     responses:
 *       200:
 *         description: Metricas obtenidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalyticsOverviewResponse'
 *       400:
 *         description: Parametro invalido
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
router.get("/overview", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const days = parseDays(req.query.days);
    if (days === null) {
      return res.status(400).json({ message: "days debe ser numerico" });
    }

    const metrics = await getAnalyticsSummary({
      tenantId: authContext.tenantId,
      days,
    });

    return res.status(200).json({
      message: "metricas obtenidas",
      ...metrics,
    });
  } catch (error) {
    return res.status(500).json({
      message: "error al obtener metricas",
      error: error.message,
    });
  }
});

module.exports = router;

