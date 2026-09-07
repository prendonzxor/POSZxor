const express = require("express");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");

const router = express.Router();
const PASSWORD_MIN_LENGTH = 8;
const PHONE_MIN_LENGTH = 8;

function normalizePhone(phoneNumber) {
  return String(phoneNumber || "").trim().replace(/[\s()-]/g, "");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     TenantUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         tenantId:
 *           type: string
 *           example: f9789760-4dc8-4fb6-9f7d-9c177d2038ef
 *         fullName:
 *           type: string
 *           example: Mariana Soto
 *         phoneNumber:
 *           type: string
 *           example: 5551234567
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         role:
 *           type: string
 *           nullable: true
 *           example: Administrador
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *             example: Cajero
 *     TenantUsersResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: usuarios obtenidos
 *         tenantId:
 *           type: string
 *           example: f9789760-4dc8-4fb6-9f7d-9c177d2038ef
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TenantUser'
 *     CreateTenantUserRequest:
 *       type: object
 *       required:
 *         - fullName
 *         - phoneNumber
 *         - password
 *         - confirmPassword
 *       properties:
 *         fullName:
 *           type: string
 *           example: Juan Perez
 *         phoneNumber:
 *           type: string
 *           example: 5512345678
 *         password:
 *           type: string
 *           example: StrongPass123
 *         confirmPassword:
 *           type: string
 *           example: StrongPass123
 *         roleId:
 *           type: string
 *           nullable: true
 *           example: 2d8fb6de-0c1b-4460-bc8a-c9329e5755ef
 *     CreateTenantUserResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: usuario creado
 *         user:
 *           $ref: '#/components/schemas/TenantUser'
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags:
 *       - Users
 *     summary: Obtener usuarios del mismo tenant del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuarios obtenidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TenantUsersResponse'
 *       401:
 *         description: Token invalido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Usuario autenticado no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token) {
      return res.status(401).json({ message: "token de autorizacion requerido" });
    }

    const session = parseSessionToken(token);
    if (!session) {
      return res.status(401).json({ message: "token invalido o expirado" });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!currentUser) {
      return res.status(404).json({ message: "usuario autenticado no encontrado" });
    }

    const users = await prisma.user.findMany({
      where: { tenantId: currentUser.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenantId: true,
        fullName: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            role: {
              name: "asc",
            },
          },
        },
      },
    });

    const responseUsers = users.map((user) => {
      const roleNames = user.userRoles.map((item) => item.role.name);

      return {
        id: user.id,
        tenantId: user.tenantId,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: roleNames[0] || null,
        roles: roleNames,
      };
    });

    return res.status(200).json({
      message: "usuarios obtenidos",
      tenantId: currentUser.tenantId,
      users: responseUsers,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener usuarios", error: error.message });
  }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags:
 *       - Users
 *     summary: Crear usuario dentro del mismo tenant del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTenantUserRequest'
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateTenantUserResponse'
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
 *       404:
 *         description: Usuario autenticado o rol no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Telefono duplicado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token) {
      return res.status(401).json({ message: "token de autorizacion requerido" });
    }

    const session = parseSessionToken(token);
    if (!session) {
      return res.status(401).json({ message: "token invalido o expirado" });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!currentUser) {
      return res.status(404).json({ message: "usuario autenticado no encontrado" });
    }

    const fullName = String(req.body?.fullName || "").trim();
    const phoneNumber = normalizePhone(req.body?.phoneNumber);
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");
    const roleId = String(req.body?.roleId || "").trim();

    if (!fullName || !phoneNumber || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "fullName, phoneNumber, password y confirmPassword son requeridos" });
    }

    if (phoneNumber.length < PHONE_MIN_LENGTH) {
      return res
        .status(400)
        .json({ message: `phoneNumber debe tener al menos ${PHONE_MIN_LENGTH} caracteres` });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res
        .status(400)
        .json({ message: `password debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "password y confirmPassword deben coincidir" });
    }

    const existingUser = await prisma.user.findUnique({ where: { phoneNumber } });
    if (existingUser) {
      return res.status(409).json({ message: "phoneNumber ya esta registrado" });
    }

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: currentUser.tenantId,
          fullName,
          phoneNumber,
          passwordHash: hashPassword(password),
        },
      });

      if (roleId) {
        const role = await tx.role.findFirst({
          where: {
            id: roleId,
            tenantId: currentUser.tenantId,
          },
          select: {
            id: true,
          },
        });

        if (!role) {
          throw new Error("ROLE_NOT_FOUND");
        }

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });
      }

      const userWithRoles = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          tenantId: true,
          fullName: true,
          phoneNumber: true,
          createdAt: true,
          updatedAt: true,
          userRoles: {
            select: {
              role: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              role: {
                name: "asc",
              },
            },
          },
        },
      });

      return userWithRoles;
    });

    if (!createdUser) {
      return res.status(500).json({ message: "error al crear usuario" });
    }

    const roleNames = createdUser.userRoles.map((item) => item.role.name);

    return res.status(201).json({
      message: "usuario creado",
      user: {
        id: createdUser.id,
        tenantId: createdUser.tenantId,
        fullName: createdUser.fullName,
        phoneNumber: createdUser.phoneNumber,
        createdAt: createdUser.createdAt,
        updatedAt: createdUser.updatedAt,
        role: roleNames[0] || null,
        roles: roleNames,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "phoneNumber ya esta registrado" });
    }

    if (error.message === "ROLE_NOT_FOUND") {
      return res.status(404).json({ message: "rol no encontrado para este tenant" });
    }

    return res.status(500).json({ message: "error al crear usuario", error: error.message });
  }
});

module.exports = router;
