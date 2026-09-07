const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  getCustomersByTenant,
  searchCustomersByTenant,
  createCustomer,
  updateCustomer,
} = require("../services/customer.service");

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

function parseNumber(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} debe ser numerico`);
  }

  return parsed;
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 9d95eb01-bb30-4f15-bf69-8d66cab90b35
 *         tenantId:
 *           type: string
 *           example: f9789760-4dc8-4fb6-9f7d-9c177d2038ef
 *         fullName:
 *           type: string
 *           example: Juan Perez
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "5512345678"
 *         email:
 *           type: string
 *           nullable: true
 *           example: cliente@correo.com
 *         notes:
 *           type: string
 *           nullable: true
 *         creditLimit:
 *           type: number
 *           example: 1000
 *         creditBalance:
 *           type: number
 *           example: 250
 *         discount:
 *           type: number
 *           example: 10
 *         isActive:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *     CustomerCreateRequest:
 *       type: object
 *       required:
 *         - fullName
 *       properties:
 *         fullName:
 *           type: string
 *           example: Juan Perez
 *         phone:
 *           type: string
 *         email:
 *           type: string
 *         notes:
 *           type: string
 *         creditLimit:
 *           type: number
 *           example: 1000
 *         creditBalance:
 *           type: number
 *           example: 0
 *         discount:
 *           type: number
 *           example: 10
 *         isActive:
 *           type: boolean
 *           example: true
 *     CustomerUpdateRequest:
 *       type: object
 *       properties:
 *         fullName:
 *           type: string
 *         phone:
 *           type: string
 *           nullable: true
 *         email:
 *           type: string
 *           nullable: true
 *         notes:
 *           type: string
 *           nullable: true
 *         creditLimit:
 *           type: number
 *         creditBalance:
 *           type: number
 *         discount:
 *           type: number
 *         isActive:
 *           type: boolean
 *     CustomersListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: clientes obtenidos
 *         customers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Customer'
 *     CustomerSingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: cliente creado
 *         customer:
 *           $ref: '#/components/schemas/Customer'
 */

/**
 * @swagger
 * /api/customers:
 *   get:
 *     tags:
 *       - Customers
 *     summary: Obtener clientes del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Clientes obtenidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomersListResponse'
 */
router.get("/", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const customers = await getCustomersByTenant(authContext.tenantId);
    return res.status(200).json({ message: "clientes obtenidos", customers });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener clientes", error: error.message });
  }
});

/**
 * @swagger
 * /api/customers/search:
 *   get:
 *     tags:
 *       - Customers
 *     summary: Buscar clientes por id, nombre y/o telefono
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: false
 *         schema:
 *           type: string
 *         description: ID exacto del cliente
 *       - in: query
 *         name: name
 *         required: false
 *         schema:
 *           type: string
 *         description: Coincidencia parcial de nombre
 *       - in: query
 *         name: phone
 *         required: false
 *         schema:
 *           type: string
 *         description: Coincidencia parcial de telefono
 *     responses:
 *       200:
 *         description: Resultado de busqueda
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomersListResponse'
 */
router.get("/search", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const id = String(req.query.id || "").trim() || undefined;
    const name = String(req.query.name || "").trim() || undefined;
    const phone = String(req.query.phone || "").trim() || undefined;

    if (!id && !name && !phone) {
      return res.status(400).json({ message: "debes enviar al menos un parametro: id, name o phone" });
    }

    const customers = await searchCustomersByTenant({
      tenantId: authContext.tenantId,
      id,
      name,
      phone,
    });

    return res.status(200).json({
      message: "clientes encontrados",
      customers,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al buscar clientes", error: error.message });
  }
});

/**
 * @swagger
 * /api/customers:
 *   post:
 *     tags:
 *       - Customers
 *     summary: Crear cliente
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerCreateRequest'
 *     responses:
 *       201:
 *         description: Cliente creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerSingleResponse'
 */
router.post("/", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const fullName = String(req.body?.fullName || "").trim();
    const phone = req.body?.phone !== undefined ? String(req.body.phone || "").trim() || null : undefined;
    const email = req.body?.email !== undefined ? String(req.body.email || "").trim() || null : undefined;
    const notes = req.body?.notes !== undefined ? String(req.body.notes || "").trim() || null : undefined;

    if (!fullName) {
      return res.status(400).json({ message: "fullName es requerido" });
    }

    const creditLimit = parseNumber(req.body?.creditLimit, "creditLimit");
    const creditBalance = parseNumber(req.body?.creditBalance, "creditBalance");
    const discount = parseNumber(req.body?.discount, "discount");
    const isActive = parseBoolean(req.body?.isActive, true);

    const customer = await createCustomer({
      tenantId: authContext.tenantId,
      fullName,
      phone,
      email,
      notes,
      creditLimit: creditLimit ?? 0,
      creditBalance: creditBalance ?? 0,
      discount: discount ?? 0,
      isActive,
    });

    return res.status(201).json({ message: "cliente creado", customer });
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(400).json({ message: "tenantId invalido" });
    }

    if (error.message && error.message.includes("debe ser numerico")) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "error al crear cliente", error: error.message });
  }
});

/**
 * @swagger
 * /api/customers/{id}:
 *   put:
 *     tags:
 *       - Customers
 *     summary: Actualizar cliente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerUpdateRequest'
 *     responses:
 *       200:
 *         description: Cliente actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerSingleResponse'
 */
router.put("/:id", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const id = String(req.params.id || "").trim();
    const fullName = req.body?.fullName !== undefined ? String(req.body.fullName || "").trim() : undefined;
    const phone = req.body?.phone !== undefined ? String(req.body.phone || "").trim() || null : undefined;
    const email = req.body?.email !== undefined ? String(req.body.email || "").trim() || null : undefined;
    const notes = req.body?.notes !== undefined ? String(req.body.notes || "").trim() || null : undefined;
    const creditLimit = parseNumber(req.body?.creditLimit, "creditLimit");
    const creditBalance = parseNumber(req.body?.creditBalance, "creditBalance");
    const discount = parseNumber(req.body?.discount, "discount");
    const isActive = req.body?.isActive !== undefined ? parseBoolean(req.body?.isActive, true) : undefined;

    if (!id) {
      return res.status(400).json({ message: "id es requerido" });
    }

    if (fullName !== undefined && !fullName) {
      return res.status(400).json({ message: "fullName no puede ser vacio" });
    }

    const customer = await updateCustomer({
      id,
      tenantId: authContext.tenantId,
      fullName,
      phone,
      email,
      notes,
      creditLimit,
      creditBalance,
      discount,
      isActive,
    });

    if (!customer) {
      return res.status(404).json({ message: "cliente no encontrado" });
    }

    return res.status(200).json({ message: "cliente actualizado", customer });
  } catch (error) {
    if (error.message && error.message.includes("debe ser numerico")) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "error al actualizar cliente", error: error.message });
  }
});

module.exports = router;
