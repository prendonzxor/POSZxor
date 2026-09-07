"use client";

import { Button, FieldError, Input, Label, TextField, toast } from "@heroui/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { signIn } from "@/api-implementations/signin";

const AUTH_ROUTES = ["/signin", "/signup", "/recovery", "/reset"];

function isSafeInternalRedirect(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return false;
  }

  return !AUTH_ROUTES.some((route) => value === route || value.startsWith(`${route}/`));
}

export default function SignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const phoneNumber = String(formData.get("phoneNumber") || "").trim();
    const password = String(formData.get("password") || "");

    if (!phoneNumber || !password) {
      toast.danger("Error en el formulario", {
        description: "Telefono y contrasena son requeridos.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await signIn({ phoneNumber, password });
      localStorage.setItem("authToken", response.sessionToken);
      document.cookie = `authToken=${response.sessionToken}; path=/; max-age=1800; samesite=lax`;
      localStorage.removeItem("pendingSubscriptionCheckout");
      localStorage.removeItem("pendingSelectedPlanCode");

      toast.success("Inicio de sesion exitoso", {
        description: response.message || "Sesion iniciada correctamente.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      setTimeout(() => {
        const requestedRedirect = searchParams.get("redirect") || searchParams.get("redict") || "";
        const redirectTarget = isSafeInternalRedirect(requestedRedirect) ? requestedRedirect : "/dashboard";
        router.push(redirectTarget);
      }, 500);
    } catch (error) {
      toast.danger("No se pudo iniciar sesion", {
        description: error instanceof Error ? error.message : "No se pudo iniciar sesion.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center text-gray-900">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_60px_-24px_rgba(15,23,42,0.35)] sm:p-8"
      >
        <h2 className="mt-4 text-2xl font-bold text-slate-900">Iniciar sesion</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ingresa con tu telefono y contrasena para continuar.
        </p>

        <div className="mt-6 mb-4">
          <TextField>
            <Label className="text-sm font-medium text-slate-800">Telefono</Label>
            <Input
              name="phoneNumber"
              type="tel"
              autoComplete="tel"
              className="w-full rounded-xl border-slate-300/80"
              placeholder="Ej. 5551234567"
            />
            <FieldError className="text-xs" />
          </TextField>
        </div>
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="signin-password" className="text-sm font-medium text-slate-800">
              Contrasena
            </label>
          </div>
          <TextField>
            <Input
              id="signin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border-slate-300/80"
              placeholder="Ingresa tu contrasena"
            />
            <FieldError className="text-xs" />
          </TextField>
        </div>

        <p className="mb-6 text-xs text-slate-500">
          Al iniciar sesion, aceptas el uso seguro de tus datos en la plataforma.
        </p>

        <Button
          type="submit"
          isDisabled={isSubmitting}
          className="h-11 w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
        >
          {isSubmitting ? "Iniciando..." : "Iniciar sesion"}
        </Button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">o</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/signup"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            No tienes cuenta? Registrarse
          </Link>
          <Link
            href="/recovery"
            className="w-full rounded-xl border border-transparent px-4 py-2 text-center text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            Recuperar contrasena
          </Link>
        </div>
      </form>
    </div>
  );
}
