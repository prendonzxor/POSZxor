"use client";

import { Button } from "@heroui/react";
import type { Dispatch, FormEvent, SetStateAction } from "react";

type InventoryFormState = {
  tenant_id: string;
  branch_id: string;
  product_id: string;
  product_name: string;
  qty_on_hand: string;
  reorder_level: string;
  updated_at: string;
};

type InventoryFormCardProps = {
  form: InventoryFormState;
  setForm: Dispatch<SetStateAction<InventoryFormState>>;
  branchOptions: Array<{ id: string; name: string }>;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function InventoryFormCard({ form, setForm, branchOptions, handleSubmit }: InventoryFormCardProps) {
  const branchId = String(form.branch_id ?? "");
  const productId = String(form.product_id ?? "");
  const canSubmit = branchId.trim().length > 0 && productId.trim().length > 0;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Ajuste de inventario</h2>
        <p className="mt-1 text-sm text-gray-600">
          Selecciona sucursal y producto para registrar existencias y nivel minimo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ubicacion</p>
          <div className="mt-2 flex flex-col gap-1">
            <label htmlFor="branch_id" className="text-sm font-medium text-gray-800">Sucursal</label>
            <select
              id="branch_id"
              className="h-10 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              value={form.branch_id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, branch_id: event.target.value }))
              }
            >
              <option value="">Selecciona una sucursal</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Producto</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="product_id" className="text-sm font-medium text-gray-800">ID de producto</label>
              <input
                id="product_id"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                placeholder="prd-001"
                value={form.product_id}
                readOnly
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="product_name" className="text-sm font-medium text-gray-800">Nombre del producto</label>
              <input
                id="product_name"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                placeholder="Se autocompleta al capturar el ID"
                value={form.product_name}
                readOnly
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="qty_on_hand" className="text-sm font-medium text-gray-800">Existencia actual</label>
          <input
            id="qty_on_hand"
            type="number"
            step="0.001"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="0.000"
            value={form.qty_on_hand}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, qty_on_hand: event.target.value }))
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="reorder_level" className="text-sm font-medium text-gray-800">Nivel minimo</label>
          <input
            id="reorder_level"
            type="number"
            step="0.001"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="0.000"
            value={form.reorder_level}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, reorder_level: event.target.value }))
            }
          />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label htmlFor="updated_at" className="text-sm font-medium text-gray-800">Fecha de actualizacion</label>
          <input
            id="updated_at"
            type="datetime-local"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={form.updated_at}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, updated_at: event.target.value }))
            }
          />
        </div>

        <div className="mt-1 md:col-span-2">
          <Button
            type="submit"
            isDisabled={!canSubmit}
            className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Guardar inventario
          </Button>
        </div>
      </form>
    </section>
  );
}
