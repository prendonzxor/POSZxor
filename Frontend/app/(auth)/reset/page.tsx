"use client";

import { Button, FieldError, Input, Label, TextField, toast } from "@heroui/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { resetPassword } from "@/api-implementations/recovery";

export default function ResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialPhoneNumber = searchParams.get("phoneNumber") || "";
  const initialCode = searchParams.get("code") || "";
  const token = searchParams.get("token") || "";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const phoneNumber = String(formData.get("phoneNumber") || "").trim();
    const code = String(formData.get("code") || "").trim();
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if ((!token && (!phoneNumber || !code)) || !newPassword || !confirmPassword) {
      toast.danger("Datos incompletos", {
        description: "Telefono, codigo y contrasena son requeridos.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.danger("Las contrasenas no coinciden", {
        description: "Confirma la misma contrasena antes de continuar.",
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
      const response = await resetPassword({
        phoneNumber,
        code,
        token,
        newPassword,
      });
      toast.success("Contrasena actualizada", {
        description: response.message || "Ya puedes iniciar sesion con tu nueva contrasena.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      setTimeout(() => {
        router.push("/signin");
      }, 500);
    } catch (error) {
      toast.danger("No se pudo restablecer", {
        description: error instanceof Error ? error.message : "Verifica el codigo e intenta nuevamente.",
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
    <div className="flex min-h-full items-center justify-center px-4 text-gray-900">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_60px_-24px_rgba(15,23,42,0.35)] sm:p-8"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 className="mt-4 text-2xl font-bold text-slate-900">Restablecer contrasena</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ingresa el codigo recibido y define una nueva contrasena segura.
        </p>

        {!token ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <TextField>
              <Label className="text-sm font-medium text-slate-800">Telefono</Label>
              <Input
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                defaultValue={initialPhoneNumber}
                className="w-full rounded-xl border-slate-300/80"
                placeholder="5551234567"
              />
              <FieldError className="text-xs" />
            </TextField>
            <TextField>
              <Label className="text-sm font-medium text-slate-800">Codigo</Label>
              <Input
                name="code"
                type="text"
                inputMode="numeric"
                defaultValue={initialCode}
                className="w-full rounded-xl border-slate-300/80 font-mono tracking-[0.25em]"
                placeholder="493821"
              />
              <FieldError className="text-xs" />
            </TextField>
          </div>
        ) : null}

        <div className={token ? "mt-6 space-y-4" : "mt-4 space-y-4"}>
          <TextField>
            <Label className="text-sm font-medium text-slate-800">Nueva contrasena</Label>
            <Input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-xl border-slate-300/80"
              placeholder="Minimo 8 caracteres"
            />
            <FieldError className="text-xs" />
          </TextField>
          <TextField>
            <Label className="text-sm font-medium text-slate-800">Confirmar contrasena</Label>
            <Input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-xl border-slate-300/80"
              placeholder="Repite la contrasena"
            />
            <FieldError className="text-xs" />
          </TextField>
        </div>

        <Button
          type="submit"
          isDisabled={isSubmitting}
          className="mt-6 h-11 w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
        >
          {isSubmitting ? "Guardando..." : "Guardar nueva contrasena"}
        </Button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">o</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <Link
          href="/recovery"
          className="block w-full rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Solicitar otro codigo
        </Link>
      </form>
    </div>
  );
}
