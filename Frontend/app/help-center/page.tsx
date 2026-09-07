import Link from "next/link";

const moduleDocs = [
  {
    route: "/dashboard",
    title: "Panel",
    description: "Pantalla principal para ver como va tu negocio en el dia.",
    actions: [
      "Ver cuanto vendiste hoy.",
      "Ver cuantas ventas hiciste.",
      "Revisar avisos importantes.",
    ],
  },
  {
    route: "/productsnservices",
    title: "Productos y servicios",
    description: "Aqui das de alta y editas lo que vendes.",
    actions: [
      "Agregar un producto o servicio nuevo.",
      "Cambiar precio, nombre o estado de un producto.",
      "Ir al inventario de un producto.",
    ],
  },
  {
    route: "/pos",
    title: "POS",
    description: "Pantalla para cobrar ventas en caja.",
    actions: [
      "Buscar y agregar productos al carrito.",
      "Elegir cliente o crear uno rapido.",
      "Cobrar en efectivo, tarjeta o transferencia.",
    ],
  },
  {
    route: "/orders",
    title: "Ordenes",
    description: "Lista de todas tus ventas registradas.",
    actions: [
      "Buscar una venta por numero o por cliente.",
      "Filtrar por pagada, pendiente o cancelada.",
      "Abrir una venta para ver su detalle.",
    ],
  },
  {
    route: "/orders/[id]",
    title: "Detalle de orden",
    description: "Detalle completo de una venta.",
    actions: [
      "Ver que productos se vendieron.",
      "Ver total, forma de pago y fecha.",
      "Regresar al listado de ventas.",
    ],
  },
  {
    route: "/customers",
    title: "Clientes",
    description: "Agenda de clientes para guardar sus datos.",
    actions: [
      "Agregar cliente nuevo.",
      "Editar telefono, correo y notas.",
      "Ver saldos o descuentos de cliente.",
    ],
  },
  {
    route: "/inventory",
    title: "Inventario y movimientos",
    description: "Control de existencias de tus productos.",
    actions: [
      "Ver cuanto producto tienes disponible.",
      "Actualizar cantidades.",
      "Revisar entradas y salidas.",
    ],
  },
  {
    route: "/admin",
    title: "Centro de administracion",
    description: "Configuraciones generales de tu cuenta y negocio.",
    actions: [
      "Actualizar datos del negocio.",
      "Cambiar plan y revisar limites.",
      "Crear usuarios y sucursales.",
    ],
  },
];

export default function HelpCenterPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Centro de ayuda</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Guia simple de uso de POS Zxor</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
            Esta guia esta escrita en palabras simples para cualquier persona. Te explica que hace cada pantalla y
            como usarla en el dia a dia.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400">
              Crear cuenta
            </Link>
            <Link href="/signin" className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Iniciar sesion
            </Link>
            <Link href="/" className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Volver al inicio
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-base font-bold text-white">1) Acceso</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>Crea tu cuenta por primera vez.</li>
              <li>Inicia sesion con tu telefono y contrasena.</li>
              <li>Si olvidas tu contrasena, usa recuperacion.</li>
            </ul>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-base font-bold text-white">2) Onboarding inicial</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>Elige el tipo de negocio.</li>
              <li>Agrega tus primeras categorias.</li>
              <li>Configura tu primera sucursal.</li>
            </ul>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-base font-bold text-white">3) Operacion diaria</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>Primero agrega tus productos.</li>
              <li>Despues cobra en caja.</li>
              <li>Finalmente revisa ventas, clientes e inventario.</li>
            </ul>
          </article>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-extrabold text-white">Mapa de modulos</h2>
          <p className="mt-2 text-sm text-slate-300">
            Estas son las pantallas mas importantes y para que sirven.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {moduleDocs.map((module) => (
              <article key={module.route} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-white">{module.title}</h3>
                  <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200">
                    {module.route}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{module.description}</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {module.actions.map((action) => (
                    <li key={action}>- {action}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold text-white">Administracion (explicado facil)</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <h3 className="font-semibold text-cyan-200">Cuenta (tenant)</h3>
              <p className="mt-2 text-sm text-slate-300">
                Aqui pones los datos de tu negocio: nombre, telefono, correo y direccion.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <h3 className="font-semibold text-cyan-200">Suscripcion</h3>
              <p className="mt-2 text-sm text-slate-300">
                Aqui puedes ver o cambiar tu plan.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <h3 className="font-semibold text-cyan-200">Usuarios</h3>
              <p className="mt-2 text-sm text-slate-300">
                Aqui creas usuarios para que tu equipo pueda entrar al sistema.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <h3 className="font-semibold text-cyan-200">Roles</h3>
              <p className="mt-2 text-sm text-slate-300">
                Aqui ves los tipos de acceso de cada usuario.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <h3 className="font-semibold text-cyan-200">Tiendas</h3>
              <p className="mt-2 text-sm text-slate-300">
                Aqui agregas una o varias sucursales.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <h3 className="font-semibold text-cyan-200">Categorias y permisos</h3>
              <p className="mt-2 text-sm text-slate-300">
                Aqui organizas categorias de productos y permisos de acceso.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-amber-300/25 bg-amber-400/10 p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold text-white">Recomendaciones importantes</h2>
          <ul className="mt-4 space-y-2 text-sm text-amber-100">
            <li>- Primero crea al menos una categoria para poder agregar productos.</li>
            <li>- Crea al menos una sucursal antes de mover inventario.</li>
            <li>- En caja, escribe minimo 2 letras para buscar cliente o producto.</li>
            <li>- Si la sesion vence, solo vuelve a iniciar sesion.</li>
          </ul>
        </section>

        <section id="soporte" className="mt-10 rounded-3xl border border-emerald-300/25 bg-emerald-400/10 p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold text-white">Soporte y contacto</h2>
          <p className="mt-2 text-sm text-emerald-100">
            Si necesitas ayuda para configuracion, errores operativos o capacitacion del equipo:
          </p>
          <ul className="mt-4 space-y-2 text-sm text-emerald-100">
            <li>- Portal de soporte: <a className="underline hover:no-underline" href="https://soporte.zxor.mx/" target="_blank" rel="noopener noreferrer">https://soporte.zxor.mx/</a></li>
            <li>- Email: contactodev@zxor.mx</li>
            <li>- Telefono: +52 55 1234 5678</li>
            <li>- WhatsApp: +52 55 8765 4321</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
