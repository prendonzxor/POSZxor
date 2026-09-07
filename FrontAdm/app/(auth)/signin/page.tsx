"use client";

import { Button, FieldError, Input, Label, TextField, toast } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { signIn } from "@/api-implementations/signin";

export default function SignInPage() {
  const router = useRouter();
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

      toast.success("Inicio de sesion exitoso", {
        description: response.message || "Sesion iniciada correctamente.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });

      setTimeout(() => {
        router.push("/panel");
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
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_20px_70px_-30px_rgba(15,23,42,0.35)] sm:p-8"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Acceso tecnico</p>
      <h2 className="mt-4 text-2xl font-bold text-slate-900">Iniciar sesion</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Ingresa con tu telefono y contrasena para acceder como administrador o usuario tecnico.
      </p>

      <div className="mt-6 space-y-4">
        <TextField>
          <Label className="text-sm font-medium text-slate-800">Telefono</Label>
          <Input
            name="phoneNumber"
            type="tel"
            autoComplete="tel"
            className="w-full rounded-2xl border-slate-300/80"
            placeholder="Ej. 5551234567"
          />
          <FieldError className="text-xs" />
        </TextField>

        <TextField>
          <Label className="text-sm font-medium text-slate-800">Contrasena</Label>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-2xl border-slate-300/80"
            placeholder="Ingresa tu contrasena"
          />
          <FieldError className="text-xs" />
        </TextField>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Este acceso usa la misma autenticacion central del sistema principal para mantener una sola fuente de verdad.
      </p>

      <Button
        type="submit"
        isDisabled={isSubmitting}
        className="mt-6 h-11 w-full rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
      >
        {isSubmitting ? "Iniciando..." : "Iniciar sesion"}
      </Button>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Soporte</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href="/recovery"
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Recuperar contrasena
        </Link>
      </div>
    </form>
  );
}
