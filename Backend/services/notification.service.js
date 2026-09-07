const prisma = require("../lib/prisma");

const NOTIFICATION_TYPES = new Set(["info", "success", "warning", "error"]);
const NOTIFICATION_STATUSES = new Set(["unread", "read", "archived"]);

function normalizeNotification(notification) {
  return {
    id: String(notification.id),
    tenantId: String(notification.tenantId),
    title: String(notification.title),
    message: String(notification.message),
    type: notification.type,
    status: notification.status,
    metadata: notification.metadata ?? null,
    readAt: notification.readAt ?? null,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

function normalizeNotificationType(value) {
  const normalized = String(value || "info").trim().toLowerCase();
  return NOTIFICATION_TYPES.has(normalized) ? normalized : "info";
}

function normalizeNotificationStatus(value) {
  const normalized = String(value || "unread").trim().toLowerCase();
  return NOTIFICATION_STATUSES.has(normalized) ? normalized : "unread";
}

async function getNotificationsByTenant({ tenantId, status, limit = 50 }) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const where = { tenantId };
  const normalizedStatus = status ? normalizeNotificationStatus(status) : null;

  if (normalizedStatus) {
    where.status = normalizedStatus;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });

  return notifications.map(normalizeNotification);
}

async function createNotification({
  tenantId,
  title,
  message,
  type = "info",
  status = "unread",
  metadata,
}) {
  const notification = await prisma.notification.create({
    data: {
      tenantId,
      title,
      message,
      type: normalizeNotificationType(type),
      status: normalizeNotificationStatus(status),
      metadata: metadata ?? undefined,
      readAt: normalizeNotificationStatus(status) === "read" ? new Date() : undefined,
    },
  });

  return normalizeNotification(notification);
}

module.exports = {
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
  createNotification,
  getNotificationsByTenant,
};
