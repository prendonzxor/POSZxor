const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const { suspendTenantSubscriptionIfTrialExpired } = require("../services/tenant-subscription.service");

const router = express.Router();

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Obtener datos del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos de usuario obtenidos
 *       401:
 *         description: Token invalido o faltante
 *       404:
 *         description: Usuario no encontrado
 */
router.get("/me", async (req, res) => {
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

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        tenantId: true,
        fullName: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "usuario no encontrado" });
    }

    let subscription = await suspendTenantSubscriptionIfTrialExpired(user.tenantId);
    const trialEndsAt = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
    if (
      subscription?.planCode === "FREE" &&
      subscription.status !== "suspended" &&
      trialEndsAt &&
      !Number.isNaN(trialEndsAt.getTime()) &&
      Date.now() > trialEndsAt.getTime()
    ) {
      await prisma.$executeRaw`
        UPDATE tenant_subscriptions
        SET
          status = 'suspended',
          auto_renew = 0
        WHERE tenant_id = ${user.tenantId}
      `;
      subscription = await suspendTenantSubscriptionIfTrialExpired(user.tenantId);
    }

    let tenant = null;
    try {
      tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          id: true,
          legalName: true,
          email: true,
          posType: true,
          catalogMode: true,
          uiPreset: true,
          onboardingStep: true,
          onboardingCompleted: true,
          catalogs: {
            where: { isEnabled: true },
            select: {
              id: true,
              catalogKey: true,
              isEnabled: true,
              sortOrder: true,
            },
            orderBy: [{ sortOrder: "asc" }, { catalogKey: "asc" }],
          },
        },
      });
    } catch (tenantError) {
      const compatibilityMessage = String(tenantError?.message || "");
      const isCompatibilityIssue =
        compatibilityMessage.includes("Unknown field") ||
        compatibilityMessage.includes("Unknown arg") ||
        compatibilityMessage.includes("does not exist");

      if (!isCompatibilityIssue) {
        throw tenantError;
      }

      let fallbackTenant = null;
      try {
        fallbackTenant = await prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: {
            id: true,
            legalName: true,
          },
        });
      } catch (legacyTenantError) {
        const legacyMessage = String(legacyTenantError?.message || "");
        if (
          !legacyMessage.includes("Unknown field") &&
          !legacyMessage.includes("Unknown arg") &&
          !legacyMessage.includes("does not exist")
        ) {
          throw legacyTenantError;
        }

        const veryLegacyTenant = await prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: {
            id: true,
            name: true,
          },
        });

        fallbackTenant = veryLegacyTenant
          ? { id: veryLegacyTenant.id, legalName: veryLegacyTenant.name }
          : null;
      }

      tenant = fallbackTenant
        ? {
            ...fallbackTenant,
            posType: "RETAIL",
            catalogMode: "STANDARD",
            uiPreset: "DEFAULT",
            onboardingStep: 1,
            onboardingCompleted: false,
            catalogs: [],
          }
        : null;
    }

    const roles = await prisma.$queryRaw`
      SELECT
        r.id,
        r.name,
        r.tenant_id AS tenantId
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${session.userId}
      ORDER BY r.name ASC
    `;

    const primaryRole = roles.length > 0 ? roles[0].name : null;
    const responseUser = {
      ...user,
      email: tenant?.email || null,
    };

    return res.status(200).json({
      message: "datos de usuario obtenidos",
      user: responseUser,
      tenant,
      subscription,
      role: primaryRole,
      roles,
      catalogs: tenant?.catalogs || [],
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener datos del usuario", error: error.message });
  }
});

module.exports = router;
