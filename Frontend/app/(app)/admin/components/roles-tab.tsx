import { Button, Input, Tabs } from "@heroui/react";
import { SectionHeader } from "./shared";

type RoleItem = {
  nombre: string;
  usuarios: number;
  descripcion: string;
};

type RolesTabProps = {
  roles: RoleItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
};

export function RolesTab({ roles, isLoading = false, errorMessage = null }: RolesTabProps) {
  const totalUsersInRoles = roles.reduce((acc, role) => acc + Number(role.usuarios || 0), 0);

  return (
    <Tabs.Panel id="roles" className="pt-5">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-indigo-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionHeader title="Roles y perfiles" subtitle="Crea y ajusta perfiles de acceso." />
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
                {roles.length} rol(es)
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
                {totalUsersInRoles} usuario(s) asignados
              </span>
            </div>
          </div>
          <Button
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            isDisabled
          >
            Nuevo rol (proximamente)
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="px-4 py-4 text-sm text-gray-600">Cargando roles...</div>
        ) : null}
        {!isLoading && errorMessage ? (
          <div className="px-4 py-4 text-sm text-red-600">{errorMessage}</div>
        ) : null}
        {!isLoading && !errorMessage && roles.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-600">No hay roles disponibles.</div>
        ) : null}
        {!isLoading && !errorMessage ? (
          <div className="divide-y divide-gray-100">
            {roles.map((role) => (
              <div
                key={role.nombre}
                className="px-4 py-3 transition-colors hover:bg-gray-50 sm:px-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">{role.nombre}</p>
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                    {role.usuarios} usuarios
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{role.descripcion}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Tabs.Panel>
  );
}
