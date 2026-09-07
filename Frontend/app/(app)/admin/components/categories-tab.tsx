"use client";

import { Button, Input, Label, Tabs } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { createCategory, getCategories, updateCategory } from "@/api-implementations/categories";
import { SectionHeader } from "./shared";

export type CategoryItem = {
  id: string;
  nombre: string;
  estatus: boolean;
  createdAt: string;
};

const parseEstatus = (value: unknown) =>
  value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";

export function CategoriesTab() {
  const [apiCategories, setApiCategories] = useState<CategoryItem[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoriesErrorMessage, setCategoriesErrorMessage] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryEstatus, setCategoryEstatus] = useState<"true" | "false">("true");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      try {
        setIsLoadingCategories(true);
        const categoriesResponse = await getCategories();

        if (!isMounted) {
          return;
        }
        setApiCategories(
          categoriesResponse.categories.map((category) => ({
            id: category.id,
            nombre: category.name,
            estatus: parseEstatus(category.estatus),
            createdAt: category.createdAt,
          })),
        );
        setCategoriesErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setApiCategories([]);
        setCategoriesErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las categorias.");
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    };

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  const sourceCategories = apiCategories.length > 0 ? apiCategories : [];
  const filteredCategories = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return sourceCategories;
    }

    return sourceCategories.filter((category) =>
      category.nombre.toLowerCase().includes(normalizedSearch),
    );
  }, [searchTerm, sourceCategories]);

  const openCreateSheet = () => {
    setEditingCategoryId(null);
    setCategoryName("");
    setCategoryEstatus("true");
    setIsSheetOpen(true);
  };

  const openEditSheet = (category: CategoryItem) => {
    setEditingCategoryId(category.id);
    setCategoryName(category.nombre);
    setCategoryEstatus(category.estatus ? "true" : "false");
    setIsSheetOpen(true);
  };

  const handleSubmitCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = categoryName.trim();
    if (!name) {
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingCategoryId) {
        const response = await updateCategory({
          id: editingCategoryId,
          name,
          estatus: categoryEstatus === "true",
        });
        const updated = response.category;

        setApiCategories((prev) =>
          prev.map((category) =>
            category.id === editingCategoryId
              ? { ...category, nombre: updated.name, estatus: parseEstatus(updated.estatus) }
              : category,
          ),
        );
      } else {
        const response = await createCategory({ name });
        const created = response.category;

        const newCategory: CategoryItem = {
          id: created.id,
          nombre: created.name,
          estatus: parseEstatus(created.estatus),
          createdAt: created.createdAt,
        };

        setApiCategories((prev) => [newCategory, ...prev]);
      }

      setCategoriesErrorMessage(null);
      setEditingCategoryId(null);
      setCategoryName("");
      setCategoryEstatus("true");
      setIsSheetOpen(false);
    } catch (error) {
      setCategoriesErrorMessage(
        error instanceof Error ? error.message : "No se pudo guardar la categoria.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Tabs.Panel id="categorias" className="pt-5">
      <div className="mb-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-indigo-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionHeader title="Categorias" subtitle="Gestion de categorias de productos y servicios." />
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
                {sourceCategories.length} categoria(s)
              </span>
              {searchTerm.trim() ? (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                  {filteredCategories.length} resultado(s)
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Input
              className="w-full rounded-full border-border/60 sm:min-w-[260px]"
              placeholder="Buscar categoria..."
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
              onPress={openCreateSheet}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Nueva categoria
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="hidden min-w-[720px] grid-cols-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
          <p>Nombre</p>
          <p>Estatus</p>
          <p>Creada</p>
          <p>Acciones</p>
        </div>
        {isLoadingCategories ? <div className="px-4 py-4 text-sm text-gray-600">Cargando categorias...</div> : null}
        {!isLoadingCategories && categoriesErrorMessage ? (
          <div className="px-4 py-4 text-sm text-red-600">{categoriesErrorMessage}</div>
        ) : null}
        {!isLoadingCategories && !categoriesErrorMessage && filteredCategories.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-600">
            {searchTerm.trim() ? "No hay coincidencias para la busqueda." : "No hay categorias disponibles."}
          </div>
        ) : null}
        {filteredCategories.map((category) => (
          <div
            key={category.id}
            className="grid min-w-0 gap-2 border-b border-gray-100 px-4 py-3 text-sm text-gray-800 transition-colors hover:bg-gray-50 md:min-w-[720px] md:grid-cols-4 md:items-center"
          >
            <p className="font-medium text-gray-900">{category.nombre}</p>
            <p>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  category.estatus ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                }`}
              >
                {category.estatus ? "Habilitada" : "Deshabilitada"}
              </span>
            </p>
            <p>{new Date(category.createdAt).toLocaleDateString("es-MX")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onPress={() => openEditSheet(category)}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
              >
                Editar
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          isSheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          if (!isSubmitting) {
            setIsSheetOpen(false);
          }
        }}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-2xl transition-transform sm:p-6 ${
          isSheetOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-5 border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {editingCategoryId ? "Editar categoria" : "Nueva categoria"}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {editingCategoryId ? `ID: ${editingCategoryId}` : "Crea una categoria para organizar productos."}
              </p>
            </div>
            <Button
              onPress={() => setIsSheetOpen(false)}
              className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
              isDisabled={isSubmitting}
            >
              Cerrar
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmitCategory} className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Datos de categoria</p>
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="category-name">Nombre *</Label>
                <Input
                  id="category-name"
                  className="rounded-xl border-border/60"
                  placeholder="Bebidas"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              {editingCategoryId ? (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="category-estatus">Estatus</Label>
                  <select
                    id="category-estatus"
                    className="h-10 rounded-xl border border-default-200 bg-white px-3 text-sm text-gray-900 outline-hidden transition-colors focus:border-blue-500"
                    value={categoryEstatus}
                    onChange={(event) => setCategoryEstatus(event.target.value as "true" | "false")}
                    disabled={isSubmitting}
                  >
                    <option value="true">Habilitada</option>
                    <option value="false">Deshabilitada</option>
                  </select>
                </div>
              ) : null}
            </div>
          </div>

          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-gray-100 bg-white pt-3">
            <Button
              type="button"
              onPress={() => setIsSheetOpen(false)}
              className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              isDisabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              isLoading={isSubmitting}
              isDisabled={!categoryName.trim() || isSubmitting}
            >
              {editingCategoryId ? "Actualizar categoria" : "Guardar categoria"}
            </Button>
          </div>
        </form>
      </aside>
    </Tabs.Panel>
  );
}
