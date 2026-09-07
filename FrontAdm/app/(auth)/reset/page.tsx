"use client";

import { Button, FieldError, Input, Label, TextField, toast } from "@heroui/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { resetPassword } from "@/api-implementations/reset-password";

export default function ResetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tokenFromQuery = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const token = String(formData.get("token") || "").trim();
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (!token || !newPassword || !confirmPassword) {
      toast.danger("Error en el formulario", {
        description: "Token, nueva contrasena y confirmacion son requeridos.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.danger("Error en el formulario", {
        description: "La contrasena y la confirmacion no coinciden.",
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
      const response = await resetPassword({ token, newPassword });

      toast.success("Contrasena actualizada", {
        description: response.message || "La contrasena se restablecio correctamente.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });

      setTimeout(() => {
        router.push("/signin");
      }, 700);
    } catch (error) {
      toast.danger("No se pudo restablecer", {
        description: error instanceof Error ? error.message : "No se pudo restablecer la contrasena.",
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
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-700">Restablecimiento</p>
      <h2 className="mt-4 text-2xl font-bold text-slate-900">Restablecer contrasena</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Usa el token generado por el backend para definir una nueva contrasena del usuario tecnico o administrador.
      </p>

      <div className="mt-6 space-y-4">
        <TextField>
          <Label className="text-sm font-medium text-slate-800">Token</Label>
          <Input
            name="token"
            type="text"
            defaultValue={tokenFromQuery}
            className="w-full rounded-2xl border-slate-300/80"
            placeholder="Pega el token de recuperacion"
          />
          <FieldError className="text-xs" />
        </TextField>

        <TextField>
          <Label className="text-sm font-medium text-slate-800">Nueva contrasena</Label>
          <Input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-2xl border-slate-300/80"
            placeholder="Ingresa la nueva contrasena"
          />
          <FieldError className="text-xs" />
        </TextField>

        <TextField>
          <Label className="text-sm font-medium text-slate-800">Confirmar contrasena</Label>
          <Input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-2xl border-slate-300/80"
            placeholder="Confirma la nueva contrasena"
          />
          <FieldError className="text-xs" />
        </TextField>
      </div>

      <Button
        type="submit"
        isDisabled={isSubmitting}
        className="mt-6 h-11 w-full rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
      >
        {isSubmitting ? "Actualizando..." : "Restablecer contrasena"}
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
