"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getMe, type MeSubscriptionStatus, type MeTenant, type MeTenantCatalog, type MeUser } from "@/api-implementations/me";
import { AppMainShell } from "./app-main-shell";
import { AppSidebarBrand } from "./app-sidebar-brand";
import { AppSidebarNav } from "./app-sidebar-nav";
import { OnboardingFullscreen } from "./onboarding-fullscreen";
import { AppToastProvider } from "./toast-provider";
import { TenantRuntimeProvider } from "./tenant-runtime-context";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<MeUser | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentTenant, setCurrentTenant] = useState<MeTenant | null>(null);
  const [currentTenantCatalogs, setCurrentTenantCatalogs] = useState<MeTenantCatalog[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<MeSubscriptionStatus | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const pageTitleMap: Record<string, string> = {
    "/dashboard": "Panel",
    "/productsnservices": "Productos y servicios",
    "/pos": "POS",
    "/orders": "Ordenes",
    "/customers": "Clientes",
    "/inventory": "Inventario",
    "/inventory/stock-validation": "Validacion de stock",
    "/admin": "Administracion",
    "/subscription-checkout": "Metodo de pago",
  };
  const currentTitle = pageTitleMap[pathname] ?? "POS Zxor";
  const isFullscreenRoute = pathname === "/subscription-checkout";

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      try {
        const response = await getMe();
        if (isMounted) {
          setCurrentUser(response.user);
          setCurrentUserRole(response.role);
          setCurrentTenant(response.tenant || null);
          setCurrentTenantCatalogs(response.catalogs || response.tenant?.catalogs || []);
          setSubscriptionStatus(response.subscription?.status || response.subscriptionStatus || null);
          setIsOnboardingOpen(Boolean(response.tenant && !response.tenant.onboardingCompleted));
          setIsAuthChecking(false);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
          setCurrentUserRole(null);
          setCurrentTenant(null);
          setCurrentTenantCatalogs([]);
          setSubscriptionStatus(null);
          setIsOnboardingOpen(false);
          setIsAuthChecking(false);
          localStorage.removeItem("authToken");
          document.cookie = "authToken=; path=/; max-age=0; samesite=lax";
          router.replace("/signin");
        }
      }
    };

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isAuthChecking) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <>
      <AppToastProvider />
      <TenantRuntimeProvider tenant={currentTenant} catalogs={currentTenantCatalogs}>
        {subscriptionStatus === "suspended" ? (
          <div className="relative z-10 border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-900">
            Tu cuenta esta suspendida por falta de pago. Actualiza tu metodo de pago para reactivar el servicio.
          </div>
        ) : null}
        {isFullscreenRoute ? (
          <div className="min-h-screen bg-gray-50 text-gray-900">{children}</div>
        ) : (
          <div className="min-h-screen bg-gray-50 text-gray-900 md:grid md:grid-cols-[260px_1fr]">
            <aside className="border-b border-gray-200 bg-white p-4 md:min-h-screen md:border-r md:border-b-0 md:p-6">
              <AppSidebarBrand />
              <AppSidebarNav />
            </aside>
            <AppMainShell currentTitle={currentTitle} currentUser={currentUser} currentUserRole={currentUserRole}>
              {children}
            </AppMainShell>
          </div>
        )}
        <OnboardingFullscreen
          isOpen={isOnboardingOpen}
          tenantName={currentTenant?.legalName || ""}
          initialStep={currentTenant?.onboardingStep || 1}
          onStateChanged={(nextState) => {
            setCurrentTenant((previous) =>
              previous
                ? {
                    ...previous,
                    onboardingStep: nextState.onboardingStep,
                    onboardingCompleted: nextState.onboardingCompleted,
                  }
                : previous,
            );
          }}
          onCompleted={(nextState) => {
            setCurrentTenant((previous) =>
              previous
                ? {
                    ...previous,
                    onboardingStep: nextState.onboardingStep,
                    onboardingCompleted: nextState.onboardingCompleted,
                  }
                : previous,
            );
            setIsOnboardingOpen(false);
          }}
        />
      </TenantRuntimeProvider>
    </>
  );
}
