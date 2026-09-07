"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input } from "@heroui/react";
import { useRouter } from "next/navigation";
import { createCategory } from "@/api-implementations/categories";
import { createBranch, getPrimaryBranch } from "@/api-implementations/branches";
import { createCustomer } from "@/api-implementations/customers";
import {
  applyOnboardingTemplate,
  getOnboardingTemplates,
  getOnboardingDefaultCategories,
  updateOnboarding,
} from "@/api-implementations/onboarding";

type OnboardingFullscreenProps = {
  isOpen: boolean;
  tenantName: string;
  initialStep?: number;
  onCompleted: (nextState: { onboardingStep: number; onboardingCompleted: boolean }) => void;
  onStateChanged?: (nextState: { onboardingStep: number; onboardingCompleted: boolean }) => void;
};

export function OnboardingFullscreen({
  isOpen,
  tenantName,
  initialStep = 1,
  onCompleted,
  onStateChanged,
}: OnboardingFullscreenProps) {
  const router = useRouter();
  const normalizedInitialStep = useMemo(() => {
    if (!Number.isFinite(initialStep)) return 1;
    return Math.min(5, Math.max(1, Math.trunc(initialStep)));
  }, [initialStep]);

  const [step, setStep] = useState<number>(normalizedInitialStep);
  const [categoryInput, setCategoryInput] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<string[]>([]);
  const [storeForm, setStoreForm] = useState({
    name: "",
    phone: "",
    addressLine1: "",
    city: "",
    state: "",
  });
  const [customerForm, setCustomerForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedBusinessType, setSelectedBusinessType] = useState("TIENDA_ABARROTES");
  const [businessTypeOptions, setBusinessTypeOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [isLoadingBusinessTypes, setIsLoadingBusinessTypes] = useState(false);
  const [defaultCategorySuggestions, setDefaultCategorySuggestions] = useState<string[]>([]);
  const [hasExistingStore, setHasExistingStore] = useState(false);
  const [existingStoreName, setExistingStoreName] = useState<string | null>(null);

  const handleAuthError = (error: unknown) => {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const isAuthError =
      message.includes("401") ||
      message.includes("token invalido") ||
      message.includes("token de autorizacion requerido") ||
      message.includes("token expirado") ||
      message.includes("autenticacion");

    if (!isAuthError) {
      return false;
    }

    localStorage.removeItem("authToken");
    document.cookie = "authToken=; path=/; max-age=0; samesite=lax";
    router.replace("/signin");
    return true;
  };

  useEffect(() => {
    setStep(normalizedInitialStep);
  }, [normalizedInitialStep]);

  useEffect(() => {
    const loadBusinessTypes = async () => {
      try {
        setIsLoadingBusinessTypes(true);
        const response = await getOnboardingTemplates();
        const options = response.templates.map((template) => ({
          id: template.key,
          label: template.label,
        }));
        setBusinessTypeOptions(options);

        if (options.length > 0 && !options.some((option) => option.id === selectedBusinessType)) {
          setSelectedBusinessType(options[0].id);
        }
      } catch (error) {
        if (handleAuthError(error)) return;
        setBusinessTypeOptions([
          { id: "FERRETERIA", label: "Ferreteria" },
          { id: "TIENDA_ABARROTES", label: "Tienda de abarrotes" },
          { id: "FARMACIA", label: "Farmacia" },
          { id: "PAPELERIA", label: "Papeleria" },
          { id: "RESTAURANTE", label: "Restaurante" },
          { id: "SERVICIOS", label: "Servicios" },
        ]);
      } finally {
        setIsLoadingBusinessTypes(false);
      }
    };

    loadBusinessTypes();
  }, []);

  useEffect(() => {
    const loadDefaultCategories = async () => {
      if (!selectedBusinessType) {
        setDefaultCategorySuggestions([]);
        return;
      }

      try {
        const response = await getOnboardingDefaultCategories(selectedBusinessType);
        setDefaultCategorySuggestions(response.categories || []);
      } catch {
        setDefaultCategorySuggestions([]);
      }
    };

    loadDefaultCategories();
  }, [selectedBusinessType]);

  useEffect(() => {
    if (step !== 2 || categoryDrafts.length > 0 || defaultCategorySuggestions.length === 0) {
      return;
    }

    setCategoryDrafts(defaultCategorySuggestions);
  }, [step, categoryDrafts.length, defaultCategorySuggestions]);

  useEffect(() => {
    const loadExistingStore = async () => {
      if (step !== 3) {
        return;
      }

      try {
        const response = await getPrimaryBranch();
        if (!response.branch) {
          setHasExistingStore(false);
          setExistingStoreName(null);
          setStoreForm({
            name: "",
            phone: "",
            addressLine1: "",
            city: "",
            state: "",
          });
          return;
        }

        setHasExistingStore(true);
        setExistingStoreName(response.branch.name);
        setStoreForm({
          name: response.branch.name || "",
          phone: response.branch.phone || "",
          addressLine1: response.branch.addressLine1 || "",
          city: response.branch.city || "",
          state: response.branch.state || "",
        });
      } catch (error) {
        if (handleAuthError(error)) return;
        setHasExistingStore(false);
        setExistingStoreName(null);
      }
    };

    loadExistingStore();
  }, [step]);

  if (!isOpen) {
    return null;
  }

  const addCategoryDraft = () => {
    const nextName = categoryInput.trim();
    if (!nextName) return;

    setCategoryDrafts((previous) => {
      if (previous.some((item) => item.toLowerCase() === nextName.toLowerCase())) {
        return previous;
      }
      return [...previous, nextName];
    });
    setCategoryInput("");
  };

  const removeCategoryDraft = (name: string) => {
    setCategoryDrafts((previous) => previous.filter((item) => item !== name));
  };

  const moveStep = async (nextStep: number) => {
    const safeStep = Math.min(5, Math.max(1, Math.trunc(nextStep)));
    const response = await updateOnboarding({ onboardingStep: safeStep });
    setStep(safeStep);
    onStateChanged?.({
      onboardingStep: response.tenant.onboardingStep,
      onboardingCompleted: response.tenant.onboardingCompleted,
    });
  };

  const handleStart = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);

      const defaultDrafts = defaultCategorySuggestions;
      setCategoryDrafts(defaultDrafts);
      setCategoryInput("");

      await applyOnboardingTemplate({ businessType: selectedBusinessType });
      await moveStep(2);
    } catch (error) {
      if (handleAuthError(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "No se pudo iniciar onboarding.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCategories = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);

      for (const name of categoryDrafts) {
        try {
          await createCategory({ name, estatus: true });
        } catch (error) {
          const message = error instanceof Error ? error.message.toLowerCase() : "";
          const isDuplicate =
            message.includes("ya existe") ||
            message.includes("409") ||
            message.includes("duplic") ||
            message.includes("p2002");

          if (!isDuplicate) {
            throw error;
          }
        }
      }

      await moveStep(3);
    } catch (error) {
      if (handleAuthError(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron guardar las categorias.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipCategories = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await moveStep(3);
    } catch (error) {
      if (handleAuthError(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "No se pudo avanzar el onboarding.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStore = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);

      if (hasExistingStore) {
        await moveStep(4);
        return;
      }

      const name = storeForm.name.trim();
      if (!name) {
        setErrorMessage("El nombre de la sucursal es obligatorio.");
        return;
      }

      await createBranch({
        name,
        phone: storeForm.phone.trim() || undefined,
        addressLine1: storeForm.addressLine1.trim() || undefined,
        city: storeForm.city.trim() || undefined,
        state: storeForm.state.trim() || undefined,
        isActive: true,
      });

      await moveStep(4);
    } catch (error) {
      if (handleAuthError(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar la sucursal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipStore = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await moveStep(4);
    } catch (error) {
      if (handleAuthError(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "No se pudo avanzar el onboarding.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFirstCustomer = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);

      const fullName = customerForm.fullName.trim();
      if (!fullName) {
        await moveStep(5);
        return;
      }

      await createCustomer({
        fullName,
        phone: customerForm.phone.trim() || undefined,
        email: customerForm.email.trim() || undefined,
        notes: customerForm.notes.trim() || undefined,
        isActive: true,
      });

      await moveStep(5);
    } catch (error) {
      if (handleAuthError(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar el cliente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipFirstCustomer = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await moveStep(5);
    } catch (error) {
      if (handleAuthError(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "No se pudo avanzar el onboarding.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackStep = async () => {
    if (step <= 1) return;
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await moveStep(step - 1);
    } catch (error) {
      if (handleAuthError(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "No se pudo regresar al paso anterior.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinish = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      const response = await updateOnboarding({ onboardingStep: 5, onboardingCompleted: true });
      onCompleted({
        onboardingStep: response.tenant.onboardingStep,
        onboardingCompleted: response.tenant.onboardingCompleted,
      });
    } catch (error) {
      if (handleAuthError(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "No se pudo finalizar el onboarding.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipAll = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      const response = await updateOnboarding({ onboardingStep: 5, onboardingCompleted: true });
      onCompleted({
        onboardingStep: response.tenant.onboardingStep,
        onboardingCompleted: response.tenant.onboardingCompleted,
      });
    } catch (error) {
      if (handleAuthError(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "No se pudo omitir el onboarding.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-white">
      <div className="relative z-10 mx-auto flex h-full w-full max-w-4xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Onboarding</p>
              {step > 1 ? (
                <Button
                  size="sm"
                  onPress={handleBackStep}
                  isDisabled={isSaving}
                  className="rounded bg-white/80 px-3 py-1 text-xs text-gray-700 hover:bg-white"
                >
                  Atras
                </Button>
              ) : null}
            </div>
            <Button
              size="sm"
              onPress={handleSkipAll}
              isDisabled={isSaving}
              className="rounded bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
            >
              Saltar onboarding
            </Button>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Configuracion inicial</h2>
          <p className="mt-1 text-sm text-gray-600">
            Tenant: <span className="font-medium text-gray-900">{tenantName || "Sin nombre"}</span>
          </p>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className={`rounded-full px-3 py-2 text-center text-xs font-semibold ${
                  step >= item ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                Paso {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-xl bg-white/50 p-4 backdrop-blur-sm sm:p-10">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Bienvenido</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">Vamos a dejar tu negocio listo en minutos</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  Este asistente te ayuda a preconfigurar la app con valores sugeridos según tu tipo de negocio en
                  México. Después podrás editar todo desde Administración.
                </p>
              </div>

              <section className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                <p className="text-sm font-semibold text-blue-900">Selecciona tu tipo de negocio</p>
                <p className="text-sm text-blue-900/90">
                  Elegiremos una configuración inicial recomendada para tu operación diaria.
                </p>
                {isLoadingBusinessTypes ? (
                  <p className="text-xs text-blue-900/80">Cargando tipos de negocio...</p>
                ) : null}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {businessTypeOptions.map((option) => {
                    const isSelected = selectedBusinessType === option.id;
                    return (
                      <Button
                        key={option.id}
                        onPress={() => setSelectedBusinessType(option.id)}
                        className={`justify-start rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                            : "bg-white/90 text-blue-900 hover:bg-white"
                        }`}
                      >
                        {isSelected ? "✓ " : ""}{option.label}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-blue-900/80">
                  Configuración seleccionada:{" "}
                  <span className="font-semibold">
                    {businessTypeOptions.find((item) => item.id === selectedBusinessType)?.label}
                  </span>
                </p>
                <Button
                  onPress={handleStart}
                  isLoading={isSaving}
                  isDisabled={isSaving || !selectedBusinessType}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Continuar configuración
                </Button>
              </section>

              <section className="space-y-3 rounded-2xl border border-gray-200 bg-white/70 p-5">
                <p className="text-sm font-semibold text-slate-900">Prefiero hacerlo manual</p>
                <p className="text-sm text-slate-600">
                  Puedes omitir este asistente y configurar todo después. Esta acción no elimina información.
                </p>
                <Button
                  onPress={handleSkipAll}
                  isDisabled={isSaving}
                  className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Omitir onboarding
                </Button>
              </section>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Crea tus categorias</h3>
              <p className="text-sm text-gray-700">
                Agrega categorias base para organizar productos. Ejemplo: Bebidas, Tornilleria, Limpieza.
              </p>
              <p className="text-xs font-medium text-blue-700">
                Categorias sugeridas para{" "}
                {businessTypeOptions.find((item) => item.id === selectedBusinessType)?.label || "tu negocio"}.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  className="w-full rounded-full border-border/60 bg-white"
                  placeholder="Nombre de categoria"
                  value={categoryInput}
                  onChange={(event) => setCategoryInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCategoryDraft();
                    }
                  }}
                />
                <Button
                  onPress={addCategoryDraft}
                  className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
                >
                  Agregar
                </Button>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3">
                {categoryDrafts.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay categorias capturadas.</p>
                ) : (
                  <ul className="space-y-2">
                    {categoryDrafts.map((name) => (
                      <li key={name} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2">
                        <span className="text-sm text-gray-800">{name}</span>
                        <Button
                          size="sm"
                          onPress={() => removeCategoryDraft(name)}
                          className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                        >
                          Quitar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onPress={handleSkipCategories}
                  isDisabled={isSaving}
                  className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                >
                  Omitir por ahora
                </Button>
                <Button
                  onPress={handleSaveCategories}
                  isLoading={isSaving}
                  isDisabled={isSaving}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Guardar y continuar
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Configura tu sucursal principal</h3>
              <p className="text-sm text-gray-700">
                Registra una sucursal para operar inventario, ventas y movimientos desde el inicio.
              </p>

              {hasExistingStore ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Ya tienes una sucursal registrada: <span className="font-semibold">{existingStoreName || "Sucursal"}</span>.
                  Puedes continuar al siguiente paso.
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  className="rounded-full border-border/60 bg-white"
                  placeholder="Nombre de la sucursal *"
                  value={storeForm.name}
                  onChange={(event) => {
                    if (hasExistingStore) return;
                    setStoreForm((prev) => ({ ...prev, name: event.target.value }));
                  }}
                  isReadOnly={hasExistingStore}
                  isDisabled={hasExistingStore}
                />
                <Input
                  className="rounded-full border-border/60 bg-white"
                  placeholder="Telefono"
                  value={storeForm.phone}
                  onChange={(event) => {
                    if (hasExistingStore) return;
                    setStoreForm((prev) => ({ ...prev, phone: event.target.value }));
                  }}
                  isReadOnly={hasExistingStore}
                  isDisabled={hasExistingStore}
                />
                <Input
                  className="rounded-full border-border/60 bg-white sm:col-span-2"
                  placeholder="Direccion"
                  value={storeForm.addressLine1}
                  onChange={(event) => {
                    if (hasExistingStore) return;
                    setStoreForm((prev) => ({ ...prev, addressLine1: event.target.value }));
                  }}
                  isReadOnly={hasExistingStore}
                  isDisabled={hasExistingStore}
                />
                <Input
                  className="rounded-full border-border/60 bg-white"
                  placeholder="Ciudad"
                  value={storeForm.city}
                  onChange={(event) => {
                    if (hasExistingStore) return;
                    setStoreForm((prev) => ({ ...prev, city: event.target.value }));
                  }}
                  isReadOnly={hasExistingStore}
                  isDisabled={hasExistingStore}
                />
                <Input
                  className="rounded-full border-border/60 bg-white"
                  placeholder="Estado"
                  value={storeForm.state}
                  onChange={(event) => {
                    if (hasExistingStore) return;
                    setStoreForm((prev) => ({ ...prev, state: event.target.value }));
                  }}
                  isReadOnly={hasExistingStore}
                  isDisabled={hasExistingStore}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onPress={handleSkipStore}
                  isDisabled={isSaving}
                  className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                >
                  Omitir por ahora
                </Button>
                <Button
                  onPress={handleSaveStore}
                  isLoading={isSaving}
                  isDisabled={isSaving}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {hasExistingStore ? "Continuar" : "Guardar sucursal y continuar"}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Crea tu primer cliente (opcional)</h3>
              <p className="text-sm text-gray-700">
                Si quieres, registra un cliente inicial para comenzar ventas con historial y seguimiento.
                Si lo prefieres, puedes continuar sin crearlo en este momento.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  className="rounded-full border-border/60 bg-white sm:col-span-2"
                  placeholder="Nombre completo (opcional)"
                  value={customerForm.fullName}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, fullName: event.target.value }))}
                />
                <Input
                  className="rounded-full border-border/60 bg-white"
                  placeholder="Telefono"
                  value={customerForm.phone}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
                <Input
                  className="rounded-full border-border/60 bg-white"
                  placeholder="Correo electronico"
                  value={customerForm.email}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, email: event.target.value }))}
                />
                <Input
                  className="rounded-full border-border/60 bg-white sm:col-span-2"
                  placeholder="Notas (opcional)"
                  value={customerForm.notes}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onPress={handleSkipFirstCustomer}
                  isDisabled={isSaving}
                  className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                >
                  Omitir por ahora
                </Button>
                <Button
                  onPress={handleSaveFirstCustomer}
                  isLoading={isSaving}
                  isDisabled={isSaving}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Guardar cliente o continuar
                </Button>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Listo para usar</h3>
              <p className="text-sm text-gray-700">
                Tu configuracion inicial esta completa. Ya puedes navegar en la aplicacion y comenzar operaciones.
              </p>
              <Button
                onPress={handleFinish}
                isLoading={isSaving}
                isDisabled={isSaving}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Finalizar onboarding
              </Button>
            </div>
          ) : null}

          {errorMessage ? <p className="mt-4 text-sm font-medium text-red-600">{errorMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}
