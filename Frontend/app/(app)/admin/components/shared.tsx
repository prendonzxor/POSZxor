type EstadoValor = "Activo" | "Inactivo" | "Activa" | "Inactiva";

export function EstadoBadge({ valor }: { valor: EstadoValor }) {
  const isActive = valor === "Activo" || valor === "Activa";

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
      }`}
    >
      {valor}
    </span>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-600">{subtitle}</p>
    </div>
  );
}
