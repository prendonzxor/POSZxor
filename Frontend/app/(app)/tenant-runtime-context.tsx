"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { MeTenant, MeTenantCatalog } from "@/api-implementations/me";

type TenantRuntimeContextValue = {
  tenant: MeTenant | null;
  catalogs: MeTenantCatalog[];
  posType: MeTenant["posType"] | null;
  catalogMode: MeTenant["catalogMode"] | null;
  uiPreset: MeTenant["uiPreset"] | null;
};

const TenantRuntimeContext = createContext<TenantRuntimeContextValue>({
  tenant: null,
  catalogs: [],
  posType: null,
  catalogMode: null,
  uiPreset: null,
});

type TenantRuntimeProviderProps = {
  tenant: MeTenant | null;
  catalogs: MeTenantCatalog[];
  children: ReactNode;
};

export function TenantRuntimeProvider({ tenant, catalogs, children }: TenantRuntimeProviderProps) {
  const value = useMemo<TenantRuntimeContextValue>(
    () => ({
      tenant,
      catalogs: catalogs || [],
      posType: tenant?.posType || null,
      catalogMode: tenant?.catalogMode || null,
      uiPreset: tenant?.uiPreset || null,
    }),
    [tenant, catalogs],
  );

  return <TenantRuntimeContext.Provider value={value}>{children}</TenantRuntimeContext.Provider>;
}

export function useTenantRuntime() {
  return useContext(TenantRuntimeContext);
}
