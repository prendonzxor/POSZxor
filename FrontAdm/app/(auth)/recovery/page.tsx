"use client";

import { Button, FieldError, Input, Label, TextField, toast } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { recoveryPassword } from "@/api-implementations/recovery-password";

export default function RecoveryPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const phoneNumber = String(formData.get("phoneNumber") || "").trim();

    if (!phoneNumber) {
      toast.danger("Error en el formulario", {
        description: "Telefono es requerido.",
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
      const response = await recoveryPassword({ phoneNumber });
      setResetToken(response.resetToken || null);

      toast.success("Solicitud enviada", {
        description: response.message || "Se genero la recuperacion de contrasena.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } catch (error) {
      toast.danger("No se pudo procesar la solicitud", {
        description: error instanceof Error ? error.message : "No se pudo generar la recuperacion.",
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
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Recuperacion</p>
      <h2 className="mt-4 text-2xl font-bold text-slate-900">Recuperar contrasena</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Ingresa el telefono del usuario tecnico o administrador para generar un token temporal de restablecimiento.
      </p>

      <div className="mt-6">
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
      </div>

      {resetToken ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Token de recuperacion</p>
          <p className="mt-1 break-all font-mono text-xs">{resetToken}</p>
          <button
            type="button"
            onClick={() => {
              router.push(`/reset?token=${encodeURIComponent(resetToken)}`);
            }}
            className="mt-3 text-sm font-semibold text-amber-700 underline underline-offset-4"
          >
            Ir a restablecer contrasena
          </button>
        </div>
      ) : null}

      <Button
        type="submit"
        isDisabled={isSubmitting}
        className="mt-6 h-11 w-full rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
      >
        {isSubmitting ? "Generando..." : "Generar recuperacion"}
      </Button>

      <div className="mt-5 flex flex-col gap-2">
        <Link
          href="/signin"
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Volver a iniciar sesion
        </Link>
      </div>
    </form>
  );
}
