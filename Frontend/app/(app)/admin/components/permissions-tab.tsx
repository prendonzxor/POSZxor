import { Button, Tabs } from "@heroui/react";
import { SectionHeader } from "./shared";

type PermissionRow = {
  modulo: string;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
  exportar: boolean;
};

export function PermissionsTab({ permissionMatrix }: { permissionMatrix: PermissionRow[] }) {
  return (
    <Tabs.Panel id="permisos" className="pt-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader title="Matriz de permisos por modulo" subtitle="Define lo que cada rol puede ver y ejecutar." />
        <Button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Guardar cambios
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Modulo</th>
              <th className="px-4 py-3 text-center">Ver</th>
              <th className="px-4 py-3 text-center">Crear</th>
              <th className="px-4 py-3 text-center">Editar</th>
              <th className="px-4 py-3 text-center">Eliminar</th>
              <th className="px-4 py-3 text-center">Exportar</th>
            </tr>
          </thead>
          <tbody>
            {permissionMatrix.map((row) => (
              <tr key={row.modulo} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-900">{row.modulo}</td>
                <td className="px-4 py-3 text-center"><input type="checkbox" checked={row.ver} readOnly /></td>
                <td className="px-4 py-3 text-center"><input type="checkbox" checked={row.crear} readOnly /></td>
                <td className="px-4 py-3 text-center"><input type="checkbox" checked={row.editar} readOnly /></td>
                <td className="px-4 py-3 text-center"><input type="checkbox" checked={row.eliminar} readOnly /></td>
                <td className="px-4 py-3 text-center"><input type="checkbox" checked={row.exportar} readOnly /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tabs.Panel>
  );
}
