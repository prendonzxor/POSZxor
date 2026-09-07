"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Label, Tabs, toast } from "@heroui/react";
import { getTenantMe, updateTenantMe } from "@/api-implementations/tenants";
import { EstadoBadge, SectionHeader } from "./shared";

type TenantItem = {
  id: string;
  legal_name: string;
  commercial_name: string;
  rfc: string;
  phone: string;
  email: string;
  country: string;
  timezone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  is_active: string;
};

export function TenantTab({ tenant }: { tenant: TenantItem }) {
  const [tenantForm, setTenantForm] = useState<TenantItem>(tenant);
  const [initialTenantForm, setInitialTenantForm] = useState<TenantItem>(tenant);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);
  const [isSavingTenant, setIsSavingTenant] = useState(false);
  const [tenantErrorMessage, setTenantErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTenant = async () => {
      try {
        setIsLoadingTenant(true);
        const response = await getTenantMe();
        if (!isMounted) return;

        const data = response.tenant;
        setTenantForm({
          id: data.id,
          legal_name: data.legalName || "",
          commercial_name: data.commercialName || "",
          rfc: data.rfc || "",
          phone: data.phone || "",
          email: data.email || "",
          country: data.country || "",
          timezone: data.timezone || "",
          address_line1: data.addressLine1 || "",
          address_line2: data.addressLine2 || "",
          city: data.city || "",
          state: data.state || "",
          postal_code: data.postalCode || "",
          is_active: data.onboardingCompleted === false ? "0" : "1",
        });
        setInitialTenantForm({
          id: data.id,
          legal_name: data.legalName || "",
          commercial_name: data.commercialName || "",
          rfc: data.rfc || "",
          phone: data.phone || "",
          email: data.email || "",
          country: data.country || "",
          timezone: data.timezone || "",
          address_line1: data.addressLine1 || "",
          address_line2: data.addressLine2 || "",
          city: data.city || "",
          state: data.state || "",
          postal_code: data.postalCode || "",
          is_active: data.onboardingCompleted === false ? "0" : "1",
        });
        setTenantErrorMessage(null);
      } catch (error) {
        if (!isMounted) return;
        setTenantErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el tenant.");
      } finally {
        if (isMounted) {
          setIsLoadingTenant(false);
        }
      }
    };

    loadTenant();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveTenant = async () => {
    try {
      setIsSavingTenant(true);
      await updateTenantMe({
        legalName: tenantForm.legal_name.trim(),
        commercialName: tenantForm.commercial_name.trim() || null,
        rfc: tenantForm.rfc.trim() || null,
        phone: tenantForm.phone.trim() || null,
        email: tenantForm.email.trim() || null,
        country: tenantForm.country.trim() || null,
        timezone: tenantForm.timezone.trim() || null,
        addressLine1: tenantForm.address_line1.trim() || null,
        addressLine2: tenantForm.address_line2.trim() || null,
        city: tenantForm.city.trim() || null,
        state: tenantForm.state.trim() || null,
        postalCode: tenantForm.postal_code.trim() || null,
      });

      toast.success("Tenant actualizado", {
        description: "Los datos del tenant se guardaron correctamente.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      setInitialTenantForm(tenantForm);
      setTenantErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el tenant.";
      setTenantErrorMessage(message);
      toast.danger("No se pudo guardar tenant", {
        description: message,
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsSavingTenant(false);
    }
  };

  const inputClassName = "rounded-xl border-border/60 bg-white";
  const isFormDisabled = isLoadingTenant || isSavingTenant;
  const hasUnsavedChanges = JSON.stringify(tenantForm) !== JSON.stringify(initialTenantForm);

  return (
    <Tabs.Panel id="tenant" className="pt-5">
      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Gestion de la cuenta"
          subtitle="Administra datos legales, contacto y direccion del tenant."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            isDisabled={isFormDisabled || !hasUnsavedChanges}
            onPress={() => setTenantForm(initialTenantForm)}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Descartar cambios
          </Button>
          <Button
            isLoading={isSavingTenant}
            isDisabled={isSavingTenant || isLoadingTenant || !tenantForm.legal_name.trim() || !hasUnsavedChanges}
            onPress={() => {
              void handleSaveTenant();
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Guardar tenant
          </Button>
        </div>
      </div>
      {tenantErrorMessage ? <p className="mb-3 text-sm text-red-600">{tenantErrorMessage}</p> : null}
      {isLoadingTenant ? <p className="mb-3 text-sm text-gray-600">Cargando tenant...</p> : null}

      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Datos legales</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-legal-name">Razon social *</Label>
              <Input
                id="tenant-legal-name"
                className={inputClassName}
                disabled={isFormDisabled}
                placeholder="Ej. POS Zxor SA de CV"
                value={tenantForm.legal_name}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, legal_name: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-commercial-name">Nombre comercial</Label>
              <Input
                id="tenant-commercial-name"
                className={inputClassName}
                disabled={isFormDisabled}
                placeholder="Ej. POS Zxor"
                value={tenantForm.commercial_name}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, commercial_name: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-rfc">RFC</Label>
              <Input
                id="tenant-rfc"
                className={inputClassName}
                disabled={isFormDisabled}
                placeholder="XAXX010101000"
                value={tenantForm.rfc}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, rfc: event.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Contacto y region</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-phone">Telefono</Label>
              <Input
                id="tenant-phone"
                className={inputClassName}
                disabled={isFormDisabled}
                placeholder="+52 55 1234 5678"
                value={tenantForm.phone}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-email">Correo electronico</Label>
              <Input
                id="tenant-email"
                type="email"
                className={inputClassName}
                disabled={isFormDisabled}
                placeholder="contacto@empresa.com"
                value={tenantForm.email}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Direccion</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label htmlFor="tenant-address-1">Direccion linea 1</Label>
              <Input
                id="tenant-address-1"
                className={inputClassName}
                disabled={isFormDisabled}
                placeholder="Av. Reforma 100"
                value={tenantForm.address_line1}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, address_line1: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label htmlFor="tenant-address-2">Direccion linea 2</Label>
              <Input
                id="tenant-address-2"
                className={inputClassName}
                disabled={isFormDisabled}
                placeholder="Piso 3, oficina 301"
                value={tenantForm.address_line2}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, address_line2: event.target.value }))}
              />
            </div>
                        <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-postal-code">Codigo postal</Label>
              <Input
                id="tenant-postal-code"
                className={inputClassName}
                disabled={isFormDisabled}
                placeholder="06000"
                value={tenantForm.postal_code}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, postal_code: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-city">Ciudad</Label>
              <Input
                id="tenant-city"
                className={inputClassName}
                disabled={isFormDisabled}
                placeholder="Ciudad de Mexico"
                value={tenantForm.city}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, city: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-state">Estado</Label>
              <Input
                id="tenant-state"
                className={inputClassName}
                disabled={isFormDisabled}
                placeholder="CDMX"
                value={tenantForm.state}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, state: event.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>
    </Tabs.Panel>
  );
}
