"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, Label, Tabs } from "@heroui/react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { getBranches } from "@/api-implementations/branches";
import { EstadoBadge, SectionHeader } from "./shared";

type StoreItem = {
  id: string;
  nombre: string;
  phone: string;
  addressLine1: string;
  tenant_id: string;
  ciudad: string;
  state: string;
  isActive: boolean;
  estado: string;
};

type StoresTabProps = {
  openStoreSheet: () => void;
  isStoreSheetOpen: boolean;
  setIsStoreSheetOpen: Dispatch<SetStateAction<boolean>>;
  editingStoreId: string | null;
  setEditingStoreId: Dispatch<SetStateAction<string | null>>;
  storeForm: {
    name: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    isActive: boolean;
  };
  setStoreForm: Dispatch<
    SetStateAction<{
      name: string;
      phone: string;
      addressLine1: string;
      city: string;
      state: string;
      isActive: boolean;
    }>
  >;
  handleStoreSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  storesReloadKey: number;
};

export function StoresTab({
  openStoreSheet,
  isStoreSheetOpen,
  setIsStoreSheetOpen,
  editingStoreId,
  setEditingStoreId,
  storeForm,
  setStoreForm,
  handleStoreSubmit,
  storesReloadKey,
}: StoresTabProps) {
  const [apiStores, setApiStores] = useState<StoreItem[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [storesErrorMessage, setStoresErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadStores = async () => {
      try {
        setIsLoadingStores(true);
        const response = await getBranches();

        if (!isMounted) {
          return;
        }

        setApiStores(
          response.branches.map((branch) => ({
            id: branch.id,
            nombre: branch.name,
            phone: branch.phone || "",
            addressLine1: branch.addressLine1 || "",
            tenant_id: branch.tenantId,
            ciudad: branch.city || "Sin ciudad",
            state: branch.state || "",
            isActive: branch.isActive,
            estado: branch.isActive ? "Activa" : "Inactiva",
          })),
        );
        setStoresErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setApiStores([]);
        setStoresErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las sucursales.");
      } finally {
        if (isMounted) {
          setIsLoadingStores(false);
        }
      }
    };

    loadStores();

    return () => {
      isMounted = false;
    };
  }, [storesReloadKey]);

  const sourceStores = apiStores.length > 0 ? apiStores : [];
  const filteredStores = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return sourceStores;
    }

    return sourceStores.filter(
      (store) =>
        store.nombre.toLowerCase().includes(normalizedSearch) ||
        store.ciudad.toLowerCase().includes(normalizedSearch) ||
        store.phone.toLowerCase().includes(normalizedSearch),
    );
  }, [searchTerm, sourceStores]);

  const onSubmitStoreForm = async (event: FormEvent<HTMLFormElement>) => {
    setIsSubmittingForm(true);
    try {
      await Promise.resolve(handleStoreSubmit(event));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  return (
    <>
      <Tabs.Panel id="tiendas" className="pt-5">
        <div className="mb-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-indigo-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <SectionHeader
                title="Gestion de tiendas / sucursales"
                subtitle="Administra tiendas asociadas al tenant y su estado operativo."
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
                  {sourceStores.length} tienda(s)
                </span>
                {searchTerm.trim() ? (
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {filteredStores.length} resultado(s)
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Input
                className="w-full rounded-full border-border/60 sm:min-w-[280px]"
                placeholder="Buscar por nombre, ciudad o telefono..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              {searchTerm.trim() ? (
                <Button
                  onPress={() => setSearchTerm("")}
                  className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                >
                  Limpiar
                </Button>
              ) : null}
              <Button
                onPress={openStoreSheet}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Nueva tienda
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden min-w-[860px] grid-cols-5 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
            <p>Nombre</p>
            <p>Ciudad</p>
            <p>Telefono</p>
            <p>Estado</p>
            <p>Acciones</p>
          </div>
          {isLoadingStores ? <div className="px-4 py-4 text-sm text-gray-600">Cargando sucursales...</div> : null}
          {!isLoadingStores && storesErrorMessage ? (
            <div className="px-4 py-4 text-sm text-red-600">{storesErrorMessage}</div>
          ) : null}
          {!isLoadingStores && !storesErrorMessage && filteredStores.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-600">
              {searchTerm.trim() ? "No hay coincidencias para la busqueda." : "No hay sucursales disponibles."}
            </div>
          ) : null}
          {filteredStores.map((store) => (
            <div
              key={store.id}
              className="grid min-w-0 gap-2 border-b border-gray-100 px-4 py-3 text-sm text-gray-800 transition-colors hover:bg-gray-50 md:min-w-[860px] md:grid-cols-5 md:items-center"
            >
              <p className="font-medium text-gray-900">{store.nombre}</p>
              <p>{store.ciudad}</p>
              <p>{store.phone}</p>
              <p><EstadoBadge valor={store.estado as "Activa" | "Inactiva"} /></p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onPress={() => {
                    setEditingStoreId(store.id);
                    setStoreForm({
                      name: store.nombre,
                      phone: store.phone,
                      addressLine1: store.addressLine1,
                      city: store.ciudad === "Sin ciudad" ? "" : store.ciudad,
                      state: store.state,
                      isActive: store.isActive,
                    });
                    setIsStoreSheetOpen(true);
                  }}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
                >
                  Editar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Tabs.Panel>

      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          isStoreSheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          if (!isSubmittingForm) {
            setIsStoreSheetOpen(false);
          }
        }}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-2xl transition-transform sm:p-6 ${
          isStoreSheetOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-5 border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {editingStoreId ? "Editar tienda" : "Nueva tienda"}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {editingStoreId ? `ID: ${editingStoreId}` : "Captura la informacion de la sucursal."}
              </p>
            </div>
            <Button
              onPress={() => {
                setEditingStoreId(null);
                setIsStoreSheetOpen(false);
              }}
              className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
              isDisabled={isSubmittingForm}
            >
              Cerrar
            </Button>
          </div>
        </div>

        <form onSubmit={onSubmitStoreForm} className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Datos basicos</p>
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="store-name">Nombre de sucursal *</Label>
                <Input
                  id="store-name"
                  className="rounded-xl border-border/60"
                  placeholder="Sucursal Centro"
                  value={storeForm.name}
                  onChange={(event) => setStoreForm((prev) => ({ ...prev, name: event.target.value }))}
                  disabled={isSubmittingForm}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="store-phone">Telefono</Label>
                <Input
                  id="store-phone"
                  className="rounded-xl border-border/60"
                  placeholder="+52 555 000 0000"
                  value={storeForm.phone}
                  onChange={(event) => setStoreForm((prev) => ({ ...prev, phone: event.target.value }))}
                  disabled={isSubmittingForm}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Direccion</p>
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="store-address-line1">Direccion</Label>
                <Input
                  id="store-address-line1"
                  className="rounded-xl border-border/60"
                  placeholder="Calle 123, Colonia Centro"
                  value={storeForm.addressLine1}
                  onChange={(event) => setStoreForm((prev) => ({ ...prev, addressLine1: event.target.value }))}
                  disabled={isSubmittingForm}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="store-city">Ciudad</Label>
                  <Input
                    id="store-city"
                    className="rounded-xl border-border/60"
                    placeholder="CDMX"
                    value={storeForm.city}
                    onChange={(event) => setStoreForm((prev) => ({ ...prev, city: event.target.value }))}
                    disabled={isSubmittingForm}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="store-state">Estado</Label>
                  <Input
                    id="store-state"
                    className="rounded-xl border-border/60"
                    placeholder="Ciudad de Mexico"
                    value={storeForm.state}
                    onChange={(event) => setStoreForm((prev) => ({ ...prev, state: event.target.value }))}
                    disabled={isSubmittingForm}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Configuracion</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="store-is-active">Estatus</Label>
                <select
                  id="store-is-active"
                  className="h-10 rounded-xl border border-default-200 bg-white px-3 text-sm text-gray-900 outline-hidden transition-colors focus:border-blue-500"
                  value={storeForm.isActive ? "true" : "false"}
                  onChange={(event) => setStoreForm((prev) => ({ ...prev, isActive: event.target.value === "true" }))}
                  disabled={isSubmittingForm}
                >
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-gray-100 bg-white pt-3">
            <Button
              type="button"
              onPress={() => {
                setEditingStoreId(null);
                setIsStoreSheetOpen(false);
              }}
              className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              isDisabled={isSubmittingForm}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              isLoading={isSubmittingForm}
              isDisabled={isSubmittingForm || !storeForm.name.trim()}
            >
              {editingStoreId ? "Actualizar tienda" : "Guardar tienda"}
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}
