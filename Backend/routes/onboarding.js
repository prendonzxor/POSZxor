const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  getBusinessTemplates,
  getDefaultCategoriesByBusinessType,
  applyBusinessTemplateToTenant,
} = require("../services/business-template.service");

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

/**
 * @swagger
 * /api/onboarding:
 *   patch:
 *     tags:
 *       - Onboarding
 *     summary: Actualiza estado de onboarding del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               onboardingStep:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *               onboardingCompleted:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Estado actualizado
 *       400:
 *         description: Validacion invalida
 *       401:
 *         description: Token invalido o faltante
 */
router.patch("/", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const hasStep = req.body?.onboardingStep !== undefined;
    const hasCompleted = req.body?.onboardingCompleted !== undefined;

    if (!hasStep && !hasCompleted) {
      return res.status(400).json({ message: "onboardingStep o onboardingCompleted es requerido" });
    }

    const data = {};

    if (hasStep) {
      const onboardingStep = Number(req.body.onboardingStep);
      if (!Number.isInteger(onboardingStep) || onboardingStep < 1 || onboardingStep > 10) {
        return res.status(400).json({ message: "onboardingStep debe ser entero entre 1 y 10" });
      }
      data.onboardingStep = onboardingStep;
    }

    if (hasCompleted) {
      if (typeof req.body.onboardingCompleted !== "boolean") {
        return res.status(400).json({ message: "onboardingCompleted debe ser booleano" });
      }
      data.onboardingCompleted = req.body.onboardingCompleted;
    }

    const tenant = await prisma.tenant.update({
      where: { id: authContext.tenantId },
      data,
      select: {
        id: true,
        onboardingStep: true,
        onboardingCompleted: true,
      },
    });

    return res.status(200).json({
      message: "onboarding actualizado",
      tenant,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al actualizar onboarding", error: error.message });
  }
});

/**
 * @swagger
 * /api/onboarding/templates:
 *   get:
 *     tags:
 *       - Onboarding
 *     summary: Obtiene plantillas de onboarding por tipo de negocio
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Plantillas obtenidas
 *       401:
 *         description: Token invalido o faltante
 */
router.get("/templates", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const templates = await getBusinessTemplates();
    return res.status(200).json({
      message: "plantillas obtenidas",
      templates: templates.map((template) => ({
        key: template.key,
        label: template.label,
        posType: template.posType,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener plantillas", error: error.message });
  }
});

/**
 * @swagger
 * /api/onboarding/templates/default-categories:
 *   get:
 *     tags:
 *       - Onboarding
 *     summary: Obtiene categorias por defecto para un tipo de negocio (desde tabla plantilla)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: businessType
 *         required: true
 *         schema:
 *           type: string
 *         example: FERRETERIA
 *     responses:
 *       200:
 *         description: Categorias por defecto obtenidas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: categorias por defecto obtenidas
 *                 businessType:
 *                   type: string
 *                   example: FERRETERIA
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [Tornillos, Tuercas, Rondanas]
 *       400:
 *         description: businessType es requerido
 *       401:
 *         description: Token invalido o faltante
 *       404:
 *         description: Plantilla no encontrada
 */
router.get("/templates/default-categories", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const businessType = String(req.query.businessType || "").trim().toUpperCase();
    if (!businessType) {
      return res.status(400).json({ message: "businessType es requerido" });
    }

    const categories = await getDefaultCategoriesByBusinessType(businessType);
    if (!categories) {
      return res.status(404).json({ message: "plantilla no encontrada para businessType" });
    }

    return res.status(200).json({
      message: "categorias por defecto obtenidas",
      businessType,
      categories,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "error al obtener categorias por defecto", error: error.message });
  }
});

/**
 * @swagger
 * /api/onboarding/templates/apply:
 *   post:
 *     tags:
 *       - Onboarding
 *     summary: Aplica plantilla de negocio al tenant autenticado y carga catalogos/categorias por tenant
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessType
 *             properties:
 *               businessType:
 *                 type: string
 *                 example: FERRETERIA
 *     responses:
 *       200:
 *         description: Plantilla aplicada
 *       400:
 *         description: businessType es requerido
 *       401:
 *         description: Token invalido o faltante
 *       404:
 *         description: Plantilla no encontrada
 */
router.post("/templates/apply", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const businessType = String(req.body?.businessType || "").trim().toUpperCase();
    if (!businessType) {
      return res.status(400).json({ message: "businessType es requerido" });
    }

    const result = await applyBusinessTemplateToTenant({
      tenantId: authContext.tenantId,
      businessTypeKey: businessType,
    });

    if (!result) {
      return res.status(404).json({ message: "plantilla no encontrada para businessType" });
    }

    return res.status(200).json({
      message: "plantilla aplicada",
      result,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al aplicar plantilla", error: error.message });
  }
});

module.exports = router;
