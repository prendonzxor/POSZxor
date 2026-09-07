"use client";

import { Separator } from "@heroui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTenantRuntime } from "./tenant-runtime-context";

function PanelIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function CreateIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function BulkEntryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
      <path d="M16 14h5" />
      <path d="M18.5 11.5v5" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 10.5a1 1 0 0 0 1 .8h9.8a1 1 0 0 0 1-.8L21 8H7" />
    </svg>
  );
}

function OrdersListIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

function LayawaysIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2h12l2 5H4l2-5Z" />
      <path d="M4 7v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <rect x="7" y="11" width="3" height="5" rx="1" />
      <rect x="12" y="7" width="3" height="9" rx="1" />
      <rect x="17" y="3" width="3" height="13" rx="1" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function CustomersIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6" />
      <path d="M23 11h-6" />
    </svg>
  );
}

export function AppSidebarNav() {
  const pathname = usePathname();
  const { catalogs } = useTenantRuntime();
  const enabledCatalogKeys = new Set((catalogs || []).map((catalog) => String(catalog.catalogKey || "").toLowerCase()));
  const hasCatalogs = enabledCatalogKeys.size > 0;
  const hasCategoryCatalog = enabledCatalogKeys.has("categories");
  const hasProductCatalog =
    enabledCatalogKeys.has("products") ||
    enabledCatalogKeys.has("screws") ||
    enabledCatalogKeys.has("nuts") ||
    enabledCatalogKeys.has("washers") ||
    enabledCatalogKeys.has("menu") ||
    enabledCatalogKeys.has("services");
  const hasCustomerCatalog = enabledCatalogKeys.has("customers");
  const isCatalogMenuAvailable = !hasCatalogs || hasProductCatalog || hasCategoryCatalog;
  const isCatalogMenuActive =
    pathname === "/productsnservices" ||
    pathname === "/inventory/bulk-entry" ||
    pathname === "/inventory/stock-validation";
  const [isCatalogMenuOpen, setIsCatalogMenuOpen] = useState(isCatalogMenuActive);

  const navItemClass = (href: string) =>
    pathname === href
      ? "shrink-0 whitespace-nowrap flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 no-underline transition-colors hover:bg-blue-100 md:shrink"
      : "shrink-0 whitespace-nowrap flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 no-underline transition-colors hover:bg-gray-100 hover:text-gray-900 md:shrink";
  const submenuButtonClass = isCatalogMenuActive
    ? "shrink-0 whitespace-nowrap flex items-center justify-between gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 md:shrink"
    : "shrink-0 whitespace-nowrap flex items-center justify-between gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 md:shrink";

  return (
    <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
      <Link href="/dashboard" className={navItemClass("/dashboard")}>
        <PanelIcon />
        Panel
      </Link>
      {isCatalogMenuAvailable && (
        <div className="shrink-0 md:shrink">
          <button
            type="button"
            className={submenuButtonClass}
            aria-expanded={isCatalogMenuOpen}
            onClick={() => setIsCatalogMenuOpen((prev) => !prev)}
          >
            <span className="flex items-center gap-2">
              <CreateIcon />
              Catalogo
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`h-4 w-4 transition-transform ${isCatalogMenuOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {isCatalogMenuOpen ? (
            <div className="mt-2 flex gap-2 md:flex-col md:gap-1 md:pl-3">
              {(!hasCatalogs || hasProductCatalog || hasCategoryCatalog) && (
                <Link href="/productsnservices" className={navItemClass("/productsnservices")}>
                  <CreateIcon />
                  Productos | Servicios
                </Link>
              )}
              {(!hasCatalogs || hasProductCatalog) && (
                <Link href="/inventory/bulk-entry" className={navItemClass("/inventory/bulk-entry")}>
                  <BulkEntryIcon />
                  Entrada masiva
                </Link>
              )}
              {(!hasCatalogs || hasProductCatalog) && (
                <Link href="/inventory/stock-validation" className={navItemClass("/inventory/stock-validation")}>
                  <BulkEntryIcon />
                  Validar stock
                </Link>
              )}
              {(!hasCatalogs || hasProductCatalog) && (
                <Link href="/apartados" className={navItemClass("/apartados")}>
                  <LayawaysIcon />
                    Apartados
                </Link>
              )}
            </div>
          ) : null}
        </div>
      )}
      <Link href="/pos" className={navItemClass("/pos")}>
        <OrdersIcon />
        POS
      </Link>
      <Link href="/orders" className={navItemClass("/orders")}>
        <OrdersListIcon />
        Ordenes
      </Link>
      <Link href="/reports" className={navItemClass("/reports")}>
        <ReportsIcon />
        Reportes
      </Link>
      {(!hasCatalogs || hasCustomerCatalog) && (
        <Link href="/customers" className={navItemClass("/customers")}>
          <CustomersIcon />
          Clientes
        </Link>
      )}
      <Link href="/admin" className={navItemClass("/admin")}>
        <SettingsIcon />
        Administracion
      </Link>
      <Separator className="my-4 hidden md:block" />
      <div className="hidden rounded-lg px-3 py-2 text-xs text-gray-500 md:block">
        <p>Made by Dev Zxor</p>
        <p>All rights reserved</p>
      </div>
    </nav>
  );
}
