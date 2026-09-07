"use client";

import { Button, Input, Label, Tabs } from "@heroui/react";
import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { getRoles, type Role } from "@/api-implementations/roles";
import { getUsers } from "@/api-implementations/users";
import { EstadoBadge, SectionHeader } from "./shared";

type UserItem = {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  estado: string;
};

type UsersTabProps = {
  users: UserItem[];
  openUserSheet: () => void;
  openUserSheetForEdit: (user: UserItem) => void;
  openBlockConfirm: (user: UserItem) => void;
  isUserSheetOpen: boolean;
  setIsUserSheetOpen: Dispatch<SetStateAction<boolean>>;
  editingUserId: string | null;
  userForm: {
    full_name: string;
    phone: string;
    password: string;
    confirm_password: string;
    role_id: string;
  };
  setUserForm: Dispatch<
    SetStateAction<{
      full_name: string;
      phone: string;
      password: string;
      confirm_password: string;
      role_id: string;
    }>
  >;
  handleUserSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  usersReloadKey: number;
};

export function UsersTab({
  users,
  openUserSheet,
  openUserSheetForEdit,
  openBlockConfirm,
  isUserSheetOpen,
  setIsUserSheetOpen,
  editingUserId,
  userForm,
  setUserForm,
  handleUserSubmit,
  usersReloadKey,
}: UsersTabProps) {
  const [apiUsers, setApiUsers] = useState<UserItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersErrorMessage, setUsersErrorMessage] = useState<string | null>(null);
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [rolesErrorMessage, setRolesErrorMessage] = useState<string | null>(null);
  const [hasTenant, setHasTenant] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [hasSubmittedForm, setHasSubmittedForm] = useState(false);
  const [formSubmitMessage, setFormSubmitMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      try {
        setIsLoadingUsers(true);
        const response = await getUsers();

        if (!isMounted) {
          return;
        }

        const mappedUsers: UserItem[] = response.users.map((user) => ({
          id: String(user.id),
          nombre: user.fullName,
          correo: user.phoneNumber || "Sin telefono",
          rol: user.role || "Sin rol",
          estado: "Activo",
        }));

        setApiUsers(mappedUsers);
        setUsersErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setApiUsers([]);
        setUsersErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los usuarios.");
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false);
        }
      }
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, [usersReloadKey]);

  useEffect(() => {
    let isMounted = true;

    const loadRoles = async () => {
      try {
        setIsLoadingRoles(true);
        const rolesResponse = await getRoles();

        if (!isMounted) {
          return;
        }

        setHasTenant(true);
        setRoleOptions(rolesResponse.roles);
        setRolesErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setRoleOptions([]);
        setHasTenant(false);
        setRolesErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los roles.");
      } finally {
        if (isMounted) {
          setIsLoadingRoles(false);
        }
      }
    };

    loadRoles();

    return () => {
      isMounted = false;
    };
  }, []);

  const sourceUsers = apiUsers.length > 0 ? apiUsers : users;
  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return sourceUsers;
    }

    return sourceUsers.filter(
      (user) =>
        user.nombre.toLowerCase().includes(normalizedSearch) ||
        user.correo.toLowerCase().includes(normalizedSearch),
    );
  }, [searchTerm, sourceUsers]);

  const isEditMode = Boolean(editingUserId);
  const fullNameError = hasSubmittedForm && !userForm.full_name.trim() ? "Nombre completo es requerido." : null;
  const phoneError = hasSubmittedForm && !userForm.phone.trim() ? "Telefono es requerido." : null;
  const passwordError =
    hasSubmittedForm && !isEditMode && userForm.password.length < 8
      ? "Contrasena debe tener al menos 8 caracteres."
      : null;
  const confirmPasswordError =
    hasSubmittedForm && !isEditMode && userForm.confirm_password.length < 8
      ? "Confirmar contrasena debe tener al menos 8 caracteres."
      : hasSubmittedForm && !isEditMode && userForm.password !== userForm.confirm_password
        ? "Las contrasenas no coinciden."
        : null;
  const hasValidationErrors = Boolean(fullNameError || phoneError || passwordError || confirmPasswordError);

  useEffect(() => {
    if (!isUserSheetOpen) {
      setHasSubmittedForm(false);
      setFormSubmitMessage(null);
    }
  }, [isUserSheetOpen]);

  const onSubmitUserForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmittedForm(true);
    setFormSubmitMessage(null);

    if (hasValidationErrors) {
      return;
    }

    setIsSubmittingForm(true);
    try {
      await Promise.resolve(handleUserSubmit(event));
    } catch (error) {
      setFormSubmitMessage(error instanceof Error ? error.message : "No se pudo guardar el usuario.");
    } finally {
      setIsSubmittingForm(false);
    }
  };

  return (
    <>
      <Tabs.Panel id="usuarios" className="pt-5">
        <div className="mb-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-indigo-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <SectionHeader title="Gestion de usuarios" subtitle="Asigna roles y controla estados de acceso." />
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
                  {sourceUsers.length} usuario(s)
                </span>
                {searchTerm.trim() ? (
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {filteredUsers.length} resultado(s)
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Input
                className="w-full rounded-full border-border/60 sm:min-w-[280px]"
                placeholder="Buscar por nombre o telefono..."
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
              <Button onPress={openUserSheet} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Nuevo usuario
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden min-w-[860px] grid-cols-5 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
            <p>Usuario</p>
            <p>Telefono</p>
            <p>Rol</p>
            <p>Estado</p>
            <p>Acciones</p>
          </div>
          {isLoadingUsers ? (
            <div className="px-4 py-4 text-sm text-gray-600">Cargando usuarios...</div>
          ) : null}
          {!isLoadingUsers && usersErrorMessage ? (
            <div className="px-4 py-4 text-sm text-red-600">{usersErrorMessage}</div>
          ) : null}
          {!isLoadingUsers && !usersErrorMessage && filteredUsers.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-600">
              {searchTerm.trim() ? "No hay coincidencias para la busqueda." : "No hay usuarios disponibles."}
            </div>
          ) : null}
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="grid min-w-0 gap-2 border-b border-gray-100 px-4 py-3 text-sm text-gray-800 transition-colors hover:bg-gray-50 md:min-w-[860px] md:grid-cols-5 md:items-center"
            >
              <p className="font-medium text-gray-900">{user.nombre}</p>
              <p>{user.correo}</p>
              <p>{user.rol}</p>
              <p><EstadoBadge valor={user.estado as "Activo" | "Inactivo"} /></p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onPress={() => openUserSheetForEdit(user)}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  onPress={() => openBlockConfirm(user)}
                  className="rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100"
                >
                  Bloquear
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Tabs.Panel>

      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          isUserSheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          if (!isSubmittingForm) {
            setIsUserSheetOpen(false);
          }
        }}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-2xl transition-transform sm:p-6 ${
          isUserSheetOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-5 border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {editingUserId ? "Editar usuario" : "Nuevo usuario"}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {editingUserId ? `ID: ${editingUserId}` : "Completa los datos para crear un nuevo usuario."}
              </p>
            </div>
            <Button
              type="button"
              onPress={() => setIsUserSheetOpen(false)}
              className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
              isDisabled={isSubmittingForm}
            >
              Cerrar
            </Button>
          </div>
        </div>

        <form onSubmit={onSubmitUserForm} className="space-y-5">
          {formSubmitMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-semibold">No se pudo guardar el usuario</p>
              <p className="mt-1">{formSubmitMessage}</p>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Datos basicos</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="user-full-name">Nombre completo</Label>
                <Input
                  id="user-full-name"
                  className="rounded-xl border-border/60"
                  placeholder="Juan Perez"
	                  value={userForm.full_name}
	                  onChange={(event) => setUserForm((prev) => ({ ...prev, full_name: event.target.value }))}
	                />
	                {fullNameError ? <p className="text-xs text-red-600">{fullNameError}</p> : null}
	              </div>
	              <div className="flex flex-col gap-1">
                <Label htmlFor="user-phone">Telefono</Label>
                <Input
                  id="user-phone"
                  className="rounded-xl border-border/60"
                  placeholder="5512345678"
	                  value={userForm.phone}
	                  onChange={(event) => setUserForm((prev) => ({ ...prev, phone: event.target.value }))}
	                />
	                {phoneError ? <p className="text-xs text-red-600">{phoneError}</p> : null}
	                <p className="text-xs text-gray-500">Solo numeros, sin espacios ni guiones.</p>
	              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Acceso</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="user-password">Contrasena</Label>
                <Input
                  id="user-password"
                  type="password"
                  className="rounded-xl border-border/60"
                  placeholder="StrongPass123"
	                  value={userForm.password}
	                  onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
	                />
	                {passwordError ? <p className="text-xs text-red-600">{passwordError}</p> : null}
	              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="user-confirm-password">Confirmar contrasena</Label>
                <Input
                  id="user-confirm-password"
                  type="password"
                  className="rounded-xl border-border/60"
                  placeholder="StrongPass123"
	                  value={userForm.confirm_password}
	                  onChange={(event) => setUserForm((prev) => ({ ...prev, confirm_password: event.target.value }))}
	                />
	                {confirmPasswordError ? <p className="text-xs text-red-600">{confirmPasswordError}</p> : null}
	              </div>
            </div>
          </div>

          {hasTenant ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="user-role-id">Rol (opcional)</Label>
              <select
                id="user-role-id"
                className="h-10 rounded-xl border border-default-200 bg-white px-3 text-sm text-gray-900 outline-hidden transition-colors focus:border-blue-500"
                value={userForm.role_id}
                onChange={(event) => setUserForm((prev) => ({ ...prev, role_id: event.target.value }))}
                disabled={isLoadingRoles}
              >
                <option value="">{isLoadingRoles ? "Cargando roles..." : "Selecciona un rol"}</option>
                {roleOptions.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {rolesErrorMessage ? <p className="text-xs text-red-600">{rolesErrorMessage}</p> : null}
            </div>
          ) : (
            <p className="text-xs text-amber-700">
              El rol opcional se habilita cuando el usuario pertenece a un tenant.
            </p>
          )}

          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-gray-100 bg-white pt-3">
            <Button
              type="button"
              onPress={() => setIsUserSheetOpen(false)}
              className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              isDisabled={isSubmittingForm}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              isLoading={isSubmittingForm}
              isDisabled={isSubmittingForm}
            >
              {editingUserId ? "Actualizar usuario" : "Guardar usuario"}
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}
