const express = require('express');
const router = express.Router();
const prisma = require("../lib/prisma");
const { getBackendHealth } = require("../services/health.service");

/**
 * @swagger
 * /api/status:
 *   get:
 *     tags:
 *       - System
 *     summary: Get API status and current timestamp
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiStatusResponse'
 */
router.get('/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags:
 *       - System
 *     summary: Obtener salud del backend y fecha actual de la base de datos
 *     responses:
 *       200:
 *         description: Backend y base de datos disponibles
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       503:
 *         description: Backend disponible pero base de datos desconectada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthErrorResponse'
 */
router.get("/health", async (req, res) => {
  const health = await getBackendHealth();
  const statusCode = health.status === "ok" ? 200 : 503;
  return res.status(statusCode).json(health);
});

/**
 * @swagger
 * /api/db-status:
 *   get:
 *     tags:
 *       - System
 *     summary: Check MySQL connectivity via Prisma
 *     responses:
 *       200:
 *         description: Database is connected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DbStatusResponse'
 *       500:
 *         description: Database connection failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/db-status", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      message: "No se pudo conectar a la base de datos",
      error: error.message,
    });
  }
});

module.exports = router;
