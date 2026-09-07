"use client";

import { useEffect, useState } from "react";
import { Button, Card, Tabs } from "@heroui/react";
import { useSearchParams } from "next/navigation";
import { getMe } from "@/api-implementations/me";
import { getRoles } from "@/api-implementations/roles";
import { createUser } from "@/api-implementations/users";
import { createBranch, updateBranch } from "@/api-implementations/branches";
import { UsersTab } from "./components/users-tab";
import { RolesTab } from "./components/roles-tab";
import { StoresTab } from "./components/stores-tab";
import { CategoriesTab } from "./components/categories-tab";
import { TenantTab } from "./components/tenant-tab";
import { PermissionsTab } from "./components/permissions-tab";
import { SubscriptionTab } from "./components/subscription-tab";

const users = [
  { id: "USR-001", nombre: "Ana Lopez", correo: "ana@poszxor.com", rol: "Administrador", estado: "Activo" },
  { id: "USR-002", nombre: "Carlos Ruiz", correo: "carlos@poszxor.com", rol: "Cajero", estado: "Activo" },
  { id: "USR-003", nombre: "Marta Diaz", correo: "marta@poszxor.com", rol: "Supervisor", estado: "Inactivo" },
  { id: "USR-004", nombre: "Jorge Leon", correo: "jorge@poszxor.com", rol: "Inventario", estado: "Activo" },
];

const tenant = {
  id: "ten-001",
  legal_name: "POS Zxor SA de CV",
  commercial_name: "POS Zxor",
  rfc: "XAXX010101000",
  phone: "+52 55 4523 3953",
  email: "contacto@poszxor.com",
  country: "MX",
  timezone: "America/Mexico_City",
  address_line1: "Av. Reforma 100",
  address_line2: "Piso 3",
  city: "CDMX",
  state: "Ciudad de Mexico",
  postal_code: "06000",
  is_active: "1",
};

const permissionMatrix = [
  { modulo: "Dashboard", ver: true, crear: false, editar: false, eliminar: false, exportar: false },
  { modulo: "Productos y servicios", ver: true, crear: true, editar: true, eliminar: true, exportar: true },
  { modulo: "POS / Ordenes", ver: true, crear: true, editar: true, eliminar: false, exportar: true },
  { modulo: "Usuarios", ver: true, crear: true, editar: true, eliminar: true, exportar: false },
  { modulo: "Reportes", ver: true, crear: false, editar: false, eliminar: false, exportar: true },
];

export default function AdminPage() {
  const searchParams = useSearchParams();
  const [isUserSheetOpen, setIsUserSheetOpen] = useState(false);
  const [isStoreSheetOpen, setIsStoreSheetOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
  const [userToBlock, setUserToBlock] = useState<(typeof users)[number] | null>(null);
  const [roles, setRoles] = useState<{ nombre: string; usuarios: number; descripcion: string }[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [rolesErrorMessage, setRolesErrorMessage] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [usersReloadKey, setUsersReloadKey] = useState(0);
  const [storesReloadKey, setStoresReloadKey] = useState(0);

  const [userForm, setUserForm] = useState({
    full_name: "",
    phone: "",
    password: "",
    confirm_password: "",
    role_id: "",
  });

  const [storeForm, setStoreForm] = useState({
    name: "",
    phone: "",
    addressLine1: "",
    city: "",
    state: "",
    isActive: true,
  });

  const openUserSheet = () => {
    setEditingUserId(null);
    setUserForm({
      full_name: "",
      phone: "",
      password: "",
      confirm_password: "",
      role_id: "",
    });
    setIsUserSheetOpen(true);
  };

  const openUserSheetForEdit = (user: (typeof users)[number]) => {
    setEditingUserId(user.id);
    setUserForm({
      full_name: user.nombre,
      phone: user.correo,
      password: "",
      confirm_password: "",
      role_id: "",
    });
    setIsUserSheetOpen(true);
  };

  const openStoreSheet = () => {
    setEditingStoreId(null);
    setStoreForm({
      name: "",
      phone: "",
      addressLine1: "",
      city: "",
      state: "",
      isActive: true,
    });
    setIsStoreSheetOpen(true);
  };

  const openBlockConfirm = (user: (typeof users)[number]) => {
    setUserToBlock(user);
    setIsBlockConfirmOpen(true);
  };

  const handleUserSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingUserId) {
      setEditingUserId(null);
      setIsUserSheetOpen(false);
      return;
    }

    try {
      await createUser({
        fullName: userForm.full_name.trim(),
        phoneNumber: userForm.phone.trim(),
        password: userForm.password,
        confirmPassword: userForm.confirm_password,
        roleId: userForm.role_id.trim() || undefined,
      });

      setUserForm({
        full_name: "",
        phone: "",
        password: "",
        confirm_password: "",
        role_id: "",
      });
      setEditingUserId(null);
      setIsUserSheetOpen(false);
      setUsersReloadKey((prev) => prev + 1);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "No se pudo crear el usuario.");
    }
  };

  const handleStoreSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      if (editingStoreId) {
        await updateBranch({
          id: editingStoreId,
          name: storeForm.name.trim(),
          phone: storeForm.phone.trim() || undefined,
          addressLine1: storeForm.addressLine1.trim() || undefined,
          city: storeForm.city.trim() || undefined,
          state: storeForm.state.trim() || undefined,
          isActive: storeForm.isActive,
        });
      } else {
        await createBranch({
          name: storeForm.name.trim(),
          phone: storeForm.phone.trim() || undefined,
          addressLine1: storeForm.addressLine1.trim() || undefined,
          city: storeForm.city.trim() || undefined,
          state: storeForm.state.trim() || undefined,
          isActive: storeForm.isActive,
        });
      }

      setEditingStoreId(null);
      setIsStoreSheetOpen(false);
      setStoresReloadKey((prev) => prev + 1);
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo guardar la sucursal.");
    }
  };

  const confirmBlockUser = () => {
    setIsBlockConfirmOpen(false);
    setUserToBlock(null);
  };

  useEffect(() => {
    let isMounted = true;

    const loadRoles = async () => {
      try {
        setIsLoadingRoles(true);
        const meResponse = await getMe();
        const rolesResponse = await getRoles();

        if (!isMounted) {
          return;
        }

        setCurrentUserRole(meResponse.role);
        setRoles(
          rolesResponse.roles.map((role) => ({
            nombre: role.name,
            usuarios: 0,
            descripcion: "Perfil de acceso",
          })),
        );
        setRolesErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setRoles([]);
        setCurrentUserRole(null);
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

  const tabClassName =
    "rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white";
  const isAdministrador = currentUserRole?.toLowerCase() === "administrador";
  const tabParam = (searchParams.get("tab") || "").toLowerCase();
  const allowedTabs = ["tenant", "suscripcion", "usuarios", "roles", "tiendas", "categorias", "permisos"] as const;
  const requestedTab = (allowedTabs.includes(tabParam as (typeof allowedTabs)[number]) ? tabParam : "") as
    | (typeof allowedTabs)[number]
    | "";
  const defaultTab = requestedTab === "usuarios" && !isAdministrador
    ? "tenant"
    : requestedTab || (isAdministrador ? "usuarios" : "tenant");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Centro de administracion</h1>
          <p className="mt-2 text-sm text-gray-600">
            Organiza usuarios, roles, permisos, tiendas y categorias desde un flujo centralizado.
          </p>
        </div>
      </div>

      <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <Tabs defaultSelectedKey={defaultTab} className="w-full">
          <div className="overflow-x-auto">
            <Tabs.ListContainer>
              <Tabs.List aria-label="Secciones de administracion" className="min-w-max">
                <Tabs.Tab id="tenant" className={tabClassName}>Cuenta</Tabs.Tab>
                <Tabs.Tab id="suscripcion" className={tabClassName}>Suscripcion</Tabs.Tab>
                {isAdministrador ? <Tabs.Tab id="usuarios" className={tabClassName}>Usuarios</Tabs.Tab> : null}
                <Tabs.Tab id="roles" className={tabClassName}>Roles</Tabs.Tab>
                <Tabs.Tab id="tiendas" className={tabClassName}>Tiendas</Tabs.Tab>
                <Tabs.Tab id="categorias" className={tabClassName}>Categorias</Tabs.Tab>
                <Tabs.Tab id="permisos" className={tabClassName}>Permisos</Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </div>

          <TenantTab tenant={tenant} />
          <SubscriptionTab />
          {isAdministrador ? (
            <UsersTab
              users={users}
              openUserSheet={openUserSheet}
              openUserSheetForEdit={openUserSheetForEdit}
              openBlockConfirm={openBlockConfirm}
              isUserSheetOpen={isUserSheetOpen}
              setIsUserSheetOpen={setIsUserSheetOpen}
              editingUserId={editingUserId}
              userForm={userForm}
              setUserForm={setUserForm}
              handleUserSubmit={handleUserSubmit}
              usersReloadKey={usersReloadKey}
            />
          ) : null}
          <RolesTab roles={roles} isLoading={isLoadingRoles} errorMessage={rolesErrorMessage} />
          <StoresTab
            openStoreSheet={openStoreSheet}
            isStoreSheetOpen={isStoreSheetOpen}
            setIsStoreSheetOpen={setIsStoreSheetOpen}
            storeForm={storeForm}
            setStoreForm={setStoreForm}
            handleStoreSubmit={handleStoreSubmit}
            storesReloadKey={storesReloadKey}
            editingStoreId={editingStoreId}
            setEditingStoreId={setEditingStoreId}
          />
          <CategoriesTab />
          <PermissionsTab permissionMatrix={permissionMatrix} />
        </Tabs>
      </Card>

      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity ${
          isBlockConfirmOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsBlockConfirmOpen(false)}
      />
      <div
        className={`fixed inset-0 z-[70] flex items-center justify-center p-4 transition-all ${
          isBlockConfirmOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <Card className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
          <h3 className="text-lg font-semibold text-gray-900">Confirmar bloqueo</h3>
          <p className="mt-2 text-sm text-gray-600">
            {userToBlock
              ? `Seguro que deseas bloquear a ${userToBlock.nombre}?`
              : "Seguro que deseas bloquear este usuario?"}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              onPress={() => setIsBlockConfirmOpen(false)}
              className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
            >
              Cancelar
            </Button>
            <Button
              onPress={confirmBlockUser}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Confirmar bloqueo
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
