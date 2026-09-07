"use client";

import { Button, FieldError, Input, Label, TextField, toast } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { requestPasswordRecovery } from "@/api-implementations/recovery";

export default function Recovery() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedPhone, setSubmittedPhone] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const phoneNumber = String(formData.get("phoneNumber") || "").trim();

    if (!phoneNumber) {
      toast.danger("Telefono requerido", {
        description: "Ingresa el telefono registrado en tu cuenta.",
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
      const response = await requestPasswordRecovery({ phoneNumber });
      setSubmittedPhone(phoneNumber);
      setRecoveryCode(response.recoveryCode || "");
      toast.success("Solicitud enviada", {
        description: response.message || "Revisa las instrucciones para recuperar tu contrasena.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } catch (error) {
      toast.danger("No se pudo enviar la solicitud", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
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
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </div>

        <h2 className="mt-4 text-2xl font-bold text-slate-900">Recuperar contrasena</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ingresa el telefono registrado. Si existe una cuenta, generaremos una solicitud de recuperacion.
        </p>

        {submittedPhone ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">Solicitud recibida</p>
            <p className="mt-1 text-sm text-emerald-800">
              Captura el codigo recibido para crear una nueva contrasena.
            </p>
            {recoveryCode ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Codigo de desarrollo
                </p>
                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-center font-mono text-xl font-bold tracking-[0.35em] text-slate-800">
                  {recoveryCode}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
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
        )}

        {submittedPhone ? (
          <div className="mt-6 flex flex-col gap-2">
            <Button
              type="button"
              onPress={() => {
                const query = new URLSearchParams({ phoneNumber: submittedPhone });
                if (recoveryCode) {
                  query.set("code", recoveryCode);
                }
                router.push(`/reset?${query.toString()}`);
              }}
              className="h-11 w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
            >
              Restablecer contrasena
            </Button>
            <Button
              type="button"
              onPress={() => {
                setSubmittedPhone("");
                setRecoveryCode("");
              }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Enviar otra solicitud
            </Button>
          </div>
        ) : (
          <Button
            type="submit"
            isDisabled={isSubmitting}
            className="h-11 w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
          >
            {isSubmitting ? "Enviando..." : "Enviar solicitud"}
          </Button>
        )}

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">o</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <Link
          href="/signin"
          className="block w-full rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Volver a iniciar sesion
        </Link>
      </form>
    </div>
  );
}
