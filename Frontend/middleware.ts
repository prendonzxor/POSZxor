import { fetchServerTime } from "./lib/server-time";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/productsnservices",
  "/pos",
  "/orders",
  "/customers",
  "/inventory",
  "/apartados",
  "/reports",
  "/admin",
  "/subscription-checkout",
];

const AUTH_ROUTES = ["/signin", "/signup"];

type TenantSubscription = {
  tenantId?: string | null;
  planCode?: string | null;
  status?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
};

function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getSubscriptionValidity(subscription: TenantSubscription | null, now: Date) {
  if (!subscription) {
    return { isValid: false, reason: "sin suscripcion" };
  }

  const status = String(subscription.status || "").trim().toLowerCase();

  if (status === "canceled") {
    return { isValid: false, reason: "suscripcion cancelada" };
  }

  if (status === "trial_ended") {
    return { isValid: false, reason: "trial finalizado" };
  }

  if (status === "past_due") {
    return { isValid: false, reason: "suscripcion vencida por falta de pago" };
  }

  if (status === "suspended") {
    return { isValid: false, reason: "suscripcion suspendida" };
  }

  if (status === "trialing") {
    const planCode = String(subscription.planCode || "").trim().toUpperCase();
    if (planCode !== "FREE") {
      return { isValid: true, reason: "trial de plan pagado" };
    }

    const trialEndsAt = parseDate(subscription.trialEndsAt);
    return {
      isValid: Boolean(trialEndsAt && trialEndsAt.getTime() > now.getTime()),
      reason: trialEndsAt ? `trial vencido desde ${trialEndsAt.toISOString()}` : "trial sin fecha de expiracion",
    };
  }

  if (status === "active") {
    const currentPeriodEnd = parseDate(subscription.currentPeriodEnd);
    return {
      isValid: !currentPeriodEnd || currentPeriodEnd.getTime() > now.getTime(),
      reason: currentPeriodEnd
        ? `periodo vencido desde ${currentPeriodEnd.toISOString()}`
        : "suscripcion activa sin fecha de fin",
    };
  }

  return { isValid: false, reason: `estado invalido: ${status || "desconocido"}` };
}

async function logInvalidSubscription(authToken: string) {
  try {
    console.log("[subscription] consultando /api/auth/me", {
      url: `${API_BASE_URL}/api/auth/me`,
    });

    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.log("[subscription] no se pudo validar /api/auth/me", {
        status: response.status,
      });
      return null;
    }

    const data = (await response.json()) as {
      subscription?: TenantSubscription | null;
      subscriptionStatus?: string | null;
    };
    const subscription = data.subscription || null;
    const time = await fetchServerTime();
    const validity = getSubscriptionValidity(subscription, new Date(time.serverTime));

    if (!validity.isValid) {
      console.log("[subscription] suscripcion no valida", {
        tenantId: subscription?.tenantId || null,
        planCode: subscription?.planCode || null,
        status: subscription?.status || null,
        trialEndsAt: subscription?.trialEndsAt || null,
        currentPeriodEnd: subscription?.currentPeriodEnd || null,
        reason: validity.reason,
      });
      return subscription;
    }

    console.log("[subscription] suscripcion valida", {
      tenantId: subscription?.tenantId || null,
      planCode: subscription?.planCode || null,
      status: subscription?.status || null,
      trialEndsAt: subscription?.trialEndsAt || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
    });
    return subscription;
  } catch (error) {
    console.log("[subscription] error validando tenant_subscriptions", {
      message: error instanceof Error ? error.message : "error desconocido",
    });
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const authToken = request.cookies.get("authToken")?.value;

  if (authToken && isAuthRoute) {
    const requestedRedirect = request.nextUrl.searchParams.get("redirect") || "";
    const pointsToAuthRoute = AUTH_ROUTES.some(
      (route) => requestedRedirect === route || requestedRedirect.startsWith(`${route}/`),
    );
    const redirectTarget =
      requestedRedirect && isSafeInternalPath(requestedRedirect) && !pointsToAuthRoute
        ? requestedRedirect
        : "/dashboard";

    return NextResponse.redirect(new URL(redirectTarget, request.url));
  }

  if (!authToken && isProtectedRoute) {
    const signinUrl = new URL("/signin", request.url);
    signinUrl.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(signinUrl);
  }

  if (authToken && isProtectedRoute) {
    console.log("[subscription] ejecutando validacion con logInvalidSubscription(authToken)", {
      path: pathname,
    });
    const subscription = await logInvalidSubscription(authToken);
    const subscriptionStatus = String(subscription?.status || "").trim().toLowerCase();

    if (subscriptionStatus === "suspended" && pathname !== "/subscription-checkout") {
      return NextResponse.redirect(new URL("/subscription-checkout", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/signin",
    "/signup",
    "/dashboard/:path*",
    "/productsnservices/:path*",
    "/pos/:path*",
    "/orders/:path*",
    "/customers/:path*",
    "/inventory/:path*",
    "/apartados/:path*",
    "/reports/:path*",
    "/admin/:path*",
    "/subscription-checkout/:path*",
  ],
};
