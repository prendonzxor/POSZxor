"use client";

import { Button, Dropdown, Label } from "@heroui/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { MeUser } from "@/api-implementations/me";

type AppMainShellProps = {
  children: ReactNode;
  currentTitle: string;
  currentUser: MeUser | null;
  currentUserRole: string | null;
};

export function AppMainShell({ children, currentTitle, currentUser, currentUserRole }: AppMainShellProps) {
  const router = useRouter();

  const handleUserMenuAction = (key: string | number) => {
    if (key === "signout") {
      localStorage.removeItem("authToken");
      document.cookie = "authToken=; path=/; max-age=0; samesite=lax";
      router.replace("/signin");
    }
  };

  return (
    <main className="min-w-0">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Sistema</p>
            <h1 className="text-base font-semibold text-gray-900 sm:text-lg">{currentTitle}</h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white px-2 py-2 sm:gap-3 sm:px-3">
            <Button
              isIconOnly
              aria-label="Notificaciones"
              className="relative h-9 w-9 min-w-0 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
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
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                <path d="M9 17a3 3 0 0 0 6 0" />
              </svg>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            </Button>
            <Dropdown>
              <Dropdown.Trigger>
                <span className="inline-flex h-9 w-9 min-w-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4.5 w-4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span className="sr-only">Menu de usuario</span>
                </span>
              </Dropdown.Trigger>
              <Dropdown.Popover >
                <Dropdown.Menu aria-label="Menu de usuario" onAction={handleUserMenuAction}>
                  <Dropdown.Item id="profile" textValue="Mi perfil">
                    <Label>Mi perfil</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="signout" textValue="Signout" variant="danger">
                    <Label>Signout</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
            <div className="hidden leading-tight text-left sm:block">
              <p className="text-sm font-semibold text-gray-900">{currentUser?.fullName || "Usuario"}</p>
              <p className="text-xs text-gray-600">{currentUserRole || "Sin rol"}</p>
            </div>
          </div>
        </div>
      </header>
      <div className="px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</div>
    </main>
  );
}
