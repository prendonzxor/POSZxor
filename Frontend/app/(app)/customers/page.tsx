"use client";

import { Button, Card } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { createCustomer, getCustomers, updateCustomer, type Customer } from "@/api-implementations/customers";

type CustomerRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  notes: string;
  credit_limit: string;
  credit_balance: string;
  discount: string;
  is_active: boolean;
  created_at: string;
  created_at_iso: string;
};

type CustomerSortField = "fullName" | "createdAt" | "creditLimit" | "creditBalance" | "discount";

const mapCustomerToRow = (customer: Customer): CustomerRow => ({
  id: customer.id,
  full_name: customer.fullName,
  phone: customer.phone || "-",
  email: customer.email || "-",
  notes: customer.notes || "-",
  credit_limit: Number(customer.creditLimit || 0).toFixed(2),
  credit_balance: Number(customer.creditBalance || 0).toFixed(2),
  discount: Number(customer.discount || 0).toFixed(2),
  is_active: Boolean(customer.isActive),
  created_at: new Date(customer.createdAt).toLocaleString("es-MX"),
  created_at_iso: customer.createdAt,
});

export default function CustomersPage() {
  const [customerForm, setCustomerForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    notes: "",
    credit_limit: "0.00",
    credit_balance: "0.00",
    discount: "0.00",
    is_active: true,
  });
  const [isCustomerSheetOpen, setIsCustomerSheetOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerRows, setCustomerRows] = useState<CustomerRow[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [customersErrorMessage, setCustomersErrorMessage] = useState<string | null>(null);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<CustomerSortField>("fullName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const totalCustomers = customerRows.length;
  const activeCustomers = useMemo(() => customerRows.filter((row) => row.is_active).length, [customerRows]);
  const inactiveCustomers = totalCustomers - activeCustomers;
  const totalCreditBalance = useMemo(
    () => customerRows.reduce((acc, row) => acc + Number(row.credit_balance || 0), 0),
    [customerRows],
  );

  const filteredSortedCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const direction = sortDirection === "asc" ? 1 : -1;

    return customerRows
      .filter((row) => {
        const matchesQuery =
          query.length === 0 ||
          row.full_name.toLowerCase().includes(query) ||
          row.phone.toLowerCase().includes(query) ||
          row.email.toLowerCase().includes(query) ||
          row.notes.toLowerCase().includes(query);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" ? row.is_active : !row.is_active);

        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "fullName") {
          return a.full_name.localeCompare(b.full_name, "es", { sensitivity: "base" }) * direction;
        }
        if (sortBy === "creditLimit") {
          return (Number(a.credit_limit) - Number(b.credit_limit)) * direction;
        }
        if (sortBy === "creditBalance") {
          return (Number(a.credit_balance) - Number(b.credit_balance)) * direction;
        }
        if (sortBy === "discount") {
          return (Number(a.discount) - Number(b.discount)) * direction;
        }

        return (new Date(a.created_at_iso).getTime() - new Date(b.created_at_iso).getTime()) * direction;
      });
  }, [customerRows, searchQuery, statusFilter, sortBy, sortDirection]);

  useEffect(() => {
    let isMounted = true;

    const loadCustomers = async () => {
      try {
        setIsLoadingCustomers(true);
        const response = await getCustomers();

        if (!isMounted) {
          return;
        }

        setCustomerRows(response.customers.map(mapCustomerToRow));
        setCustomersErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCustomerRows([]);
        setCustomersErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los clientes.");
      } finally {
        if (isMounted) {
          setIsLoadingCustomers(false);
        }
      }
    };

    loadCustomers();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fullName = customerForm.full_name.trim();
    const normalizedEmail = customerForm.email.trim().toLowerCase();
    const normalizedPhone = customerForm.phone.trim();
    if (!fullName) {
      setCustomersErrorMessage("full_name es requerido");
      return;
    }

    try {
      setIsSubmittingCustomer(true);
      const existingCustomer = customerRows.find((row) => {
        const rowEmail = row.email === "-" ? "" : row.email.trim().toLowerCase();
        const rowPhone = row.phone === "-" ? "" : row.phone.trim();

        const emailMatch = normalizedEmail.length > 0 && rowEmail.length > 0 && rowEmail === normalizedEmail;
        const phoneMatch = normalizedPhone.length > 0 && rowPhone.length > 0 && rowPhone === normalizedPhone;

        return emailMatch || phoneMatch;
      });

      const customerIdToUpdate = editingCustomerId ?? existingCustomer?.id ?? null;

      if (customerIdToUpdate) {
        const response = await updateCustomer({
          id: customerIdToUpdate,
          fullName,
          phone: normalizedPhone || null,
          email: normalizedEmail || null,
          notes: customerForm.notes.trim() || null,
          creditLimit: Number(customerForm.credit_limit || "0"),
          creditBalance: Number(customerForm.credit_balance || "0"),
          discount: Number(customerForm.discount || "0"),
          isActive: customerForm.is_active,
        });
        const updated = mapCustomerToRow(response.customer);
        setCustomerRows((prev) => prev.map((row) => (row.id === customerIdToUpdate ? updated : row)));
      } else {
        const response = await createCustomer({
          fullName,
          phone: normalizedPhone || undefined,
          email: normalizedEmail || undefined,
          notes: customerForm.notes.trim() || undefined,
          creditLimit: Number(customerForm.credit_limit || "0"),
          creditBalance: Number(customerForm.credit_balance || "0"),
          discount: Number(customerForm.discount || "0"),
          isActive: customerForm.is_active,
        });
        setCustomerRows((prev) => [mapCustomerToRow(response.customer), ...prev]);
      }
      setCustomersErrorMessage(null);
      setCustomerForm((prev) => ({
        ...prev,
        full_name: "",
        phone: "",
        email: "",
        notes: "",
        credit_limit: "0.00",
        credit_balance: "0.00",
        discount: "0.00",
        is_active: true,
      }));
      setEditingCustomerId(null);
      setIsCustomerSheetOpen(false);
    } catch (error) {
      setCustomersErrorMessage(error instanceof Error ? error.message : "No se pudo guardar el cliente.");
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-indigo-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Clientes</h1>
            <p className="mt-2 text-sm text-gray-600">Gestiona los clientes y consulta su estado.</p>
          </div>
          <Button
            onPress={() => {
              setEditingCustomerId(null);
              setCustomerForm({
                full_name: "",
                phone: "",
                email: "",
                notes: "",
                credit_limit: "0.00",
                credit_balance: "0.00",
                discount: "0.00",
                is_active: true,
              });
              setIsCustomerSheetOpen(true);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
          >
            Nuevo cliente
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-xl border border-dotted border-slate-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total clientes</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalCustomers}</p>
        </section>
        <section className="rounded-xl border border-dotted border-slate-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activos</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{activeCustomers}</p>
        </section>
        <section className="rounded-xl border border-dotted border-slate-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inactivos</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{inactiveCustomers}</p>
        </section>
        <section className="rounded-xl border border-dotted border-slate-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo total</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">${totalCreditBalance.toFixed(2)}</p>
        </section>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">Usa filtros y orden para encontrar clientes rapido.</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <p className="text-sm font-semibold text-slate-800">Listado de clientes</p>
          <p className="text-xs font-medium text-slate-500">
            Total: {customerRows.length} | Mostrando: {filteredSortedCustomers.length}
          </p>
        </div>
        <div className="grid gap-3 border-b border-slate-100 bg-white px-5 py-3 md:grid-cols-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="customers-search" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Buscar
            </label>
            <input
              id="customers-search"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
              placeholder="Nombre, telefono, correo o notas"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="customers-status" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Estado
            </label>
            <select
              id="customers-status"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
            >
              <option value="all">Todos</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="customers-sort-by" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Ordenar por
            </label>
            <select
              id="customers-sort-by"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as CustomerSortField)}
            >
              <option value="fullName">Nombre completo</option>
              <option value="createdAt">Fecha de alta</option>
              <option value="creditLimit">Limite de credito</option>
              <option value="creditBalance">Saldo de credito</option>
              <option value="discount">Descuento</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="customers-sort-direction" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Direccion
            </label>
            <select
              id="customers-sort-direction"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
            >
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onPress={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setSortBy("fullName");
                setSortDirection("asc");
              }}
              className="h-10 w-full rounded-lg bg-slate-100 px-3 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="hidden min-w-[1320px] grid-cols-10 gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 md:grid">
            <p>Nombre</p>
            <p>Telefono</p>
            <p>Correo</p>
            <p>Notas</p>
            <p>Limite</p>
            <p>Saldo</p>
            <p>Descuento</p>
            <p>Estado</p>
            <p>Creado</p>
            <p>Acciones</p>
          </div>
          <div className="min-w-0 md:min-w-[1320px]">
            {isLoadingCustomers ? (
              <div className="px-5 py-5 text-sm text-slate-600">Cargando clientes...</div>
            ) : null}
            {!isLoadingCustomers && customersErrorMessage ? (
              <div className="px-5 py-5 text-sm text-red-600">{customersErrorMessage}</div>
            ) : null}
            {!isLoadingCustomers && !customersErrorMessage && customerRows.length === 0 ? (
              <div className="px-5 py-5 text-sm text-slate-600">No hay clientes disponibles.</div>
            ) : null}
            {filteredSortedCustomers.map((row) => (
              <div
                key={row.id}
                className="grid gap-2 border-b border-slate-100 px-5 py-4 text-sm text-slate-700 transition-colors hover:bg-slate-50 md:grid-cols-10 md:items-center md:gap-4"
              >
                <p className="font-semibold text-slate-900">
                  <span className="mr-2 text-xs uppercase tracking-wide text-slate-400 md:hidden">Nombre</span>
                  {row.full_name}
                </p>
                <p>
                  <span className="mr-2 text-xs uppercase tracking-wide text-slate-400 md:hidden">Telefono</span>
                  {row.phone}
                </p>
                <p className="truncate" title={row.email}>
                  <span className="mr-2 text-xs uppercase tracking-wide text-slate-400 md:hidden">Correo</span>
                  {row.email}
                </p>
                <p className="truncate" title={row.notes}>
                  <span className="mr-2 text-xs uppercase tracking-wide text-slate-400 md:hidden">Notas</span>
                  {row.notes}
                </p>
                <p className="font-mono tabular-nums">
                  <span className="mr-2 text-xs uppercase tracking-wide text-slate-400 md:hidden">Limite</span>
                  ${row.credit_limit}
                </p>
                <p className="font-mono tabular-nums">
                  <span className="mr-2 text-xs uppercase tracking-wide text-slate-400 md:hidden">Saldo</span>
                  ${row.credit_balance}
                </p>
                <p className="font-mono tabular-nums">
                  <span className="mr-2 text-xs uppercase tracking-wide text-slate-400 md:hidden">Descuento</span>
                  {row.discount}%
                </p>
                <p>
                  <span className="mr-2 text-xs uppercase tracking-wide text-slate-400 md:hidden">Estado</span>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      row.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {row.is_active ? "Activo" : "Inactivo"}
                  </span>
                </p>
                <p className="text-slate-600">
                  <span className="mr-2 text-xs uppercase tracking-wide text-slate-400 md:hidden">Creado</span>
                  {row.created_at}
                </p>
                <div className="flex justify-start">
                  <Button
                    size="sm"
                    onPress={() => {
                      setEditingCustomerId(row.id);
                      setCustomerForm({
                        full_name: row.full_name === "-" ? "" : row.full_name,
                        phone: row.phone === "-" ? "" : row.phone,
                        email: row.email === "-" ? "" : row.email,
                        notes: row.notes === "-" ? "" : row.notes,
                        credit_limit: row.credit_limit,
                        credit_balance: row.credit_balance,
                        discount: row.discount,
                        is_active: row.is_active,
                      });
                      setIsCustomerSheetOpen(true);
                    }}
                    className="rounded bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200"
                  >
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          isCustomerSheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsCustomerSheetOpen(false)}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-2xl transition-transform sm:p-6 ${
          isCustomerSheetOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {editingCustomerId ? "Editar cliente" : "Formulario de cliente"}
          </h2>
          <Button
            onPress={() => {
              setIsCustomerSheetOpen(false);
              setEditingCustomerId(null);
            }}
            className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
          >
            Cerrar
          </Button>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Captura los datos principales del cliente.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="full_name" className="text-sm font-semibold text-gray-800">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                placeholder="Ej. Mariana Soto"
                value={customerForm.full_name}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, full_name: event.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="phone" className="text-sm font-semibold text-gray-800">Telefono</label>
              <input
                id="phone"
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                placeholder="Ej. 5512345678"
                value={customerForm.phone}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-semibold text-gray-800">Correo electronico</label>
              <input
                id="email"
                type="email"
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                placeholder="cliente@empresa.com"
                value={customerForm.email}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="is_active" className="text-sm font-semibold text-gray-800">Estado</label>
              <select
                id="is_active"
                className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                value={customerForm.is_active ? "1" : "0"}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, is_active: event.target.value === "1" }))}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="credit_limit" className="text-sm font-semibold text-gray-800">Limite de credito</label>
              <input
                id="credit_limit"
                type="number"
                step="0.01"
                min="0"
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                value={customerForm.credit_limit}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, credit_limit: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="credit_balance" className="text-sm font-semibold text-gray-800">Saldo de credito</label>
              <input
                id="credit_balance"
                type="number"
                step="0.01"
                min="0"
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                value={customerForm.credit_balance}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, credit_balance: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="discount" className="text-sm font-semibold text-gray-800">Descuento (%)</label>
              <input
                id="discount"
                type="number"
                step="0.01"
                min="0"
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                value={customerForm.discount}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, discount: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="notes" className="text-sm font-semibold text-gray-800">Notas</label>
            <textarea
              id="notes"
              rows={3}
              className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
              placeholder="Observaciones importantes del cliente"
              value={customerForm.notes}
              onChange={(event) => setCustomerForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
            <Button
              type="button"
              onPress={() => {
                setIsCustomerSheetOpen(false);
                setEditingCustomerId(null);
              }}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isDisabled={isSubmittingCustomer}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {isSubmittingCustomer ? "Guardando..." : editingCustomerId ? "Actualizar cliente" : "Guardar cliente"}
            </Button>
          </div>
        </form>
      </aside>
    </section>
  );
}
