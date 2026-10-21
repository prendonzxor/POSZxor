"use client";
import { useServerTime } from "./server-time-provider";
import { serverTimeZone } from "@/lib/server-time";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";

const features = [
  {
    title: "Ventas en segundos",
    text: "Cobra rapido, busca productos al instante y crea ordenes sin friccion.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 6h18" />
        <path d="M7 6V4h10v2" />
        <path d="M6 6l1 14h10l1-14" />
        <path d="M10 10v6" />
        <path d="M14 10v6" />
      </svg>
    ),
  },
  {
    title: "Inventario en tiempo real",
    text: "Controla existencias por sucursal, alertas de minimo y movimientos diarios.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 12l9 4 9-4" />
        <path d="M3 17l9 4 9-4" />
      </svg>
    ),
  },
  {
    title: "Analitica clara",
    text: "Visualiza ventas, ordenes y clientes con paneles listos para operar.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20v-4" />
      </svg>
    ),
  },
];

export default function Home() {
  const serverDate = useServerTime();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [cookieConsent, setCookieConsent] = useState<"accepted" | "rejected" | null>(null);
  const whatsappHref = `https://wa.me/525587654321?text=${encodeURIComponent(
    "Hola, me interesa una demo de POSZxor.",
  )}`;

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 320);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("cookieConsent");
    if (stored === "accepted" || stored === "rejected") {
      setCookieConsent(stored);
    }
  }, []);

  const handleCookieConsent = (value: "accepted" | "rejected") => {
    setCookieConsent(value);
    localStorage.setItem("cookieConsent", value);
    document.cookie = `cookie_consent=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.25),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(96,165,250,0.2),transparent_30%),radial-gradient(circle_at_60%_80%,rgba(14,165,233,0.2),transparent_35%)]" />
      <div className="bubble bubble-a" />
      <div className="bubble bubble-b" />
      <div className="bubble bubble-c" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#inicio" className="text-lg font-black tracking-wide text-cyan-300">POS Zxor</a>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#beneficios" className="hover:text-white">Beneficios</a>
            <a href="#modulos" className="hover:text-white">Modulos</a>
            <a href="#precios" className="hover:text-white">Precios</a>
            <a href="#contacto" className="hover:text-white">Contacto</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href="/help-center#soporte" className="hidden sm:block">
              <Button className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                Soporte
              </Button>
            </a>
            <a href="/help-center" className="hidden sm:block">
              <Button className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                Documentacion
              </Button>
            </a>
            <a href="/signin">
              <Button className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                Entrar
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main id="inicio" className="relative z-10">
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:pt-24">
          <div className="space-y-6">
            <p className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-200">
              POS para negocios reales
            </p>
            <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
              Vende mas rapido.
              <span className="block text-cyan-300">Controla todo en un solo lugar.</span>
            </h1>
            <p className="max-w-xl text-base text-slate-300 sm:text-lg">
              POSZxor unifica punto de venta, inventario, clientes y reportes para que tu equipo opere con confianza.
              Incluye app movil para operar en campo y version web 100% responsiva para desktop, tablet y celular.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M16.7 12.8c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.7-1.7-3.2-1.8-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.8-2.9-.8-1.5 0-2.9.9-3.6 2.2-1.6 2.7-.4 6.8 1.1 8.9.8 1 1.7 2.1 2.9 2.1s1.6-.7 3-.7 1.8.7 3 .7 2-.9 2.8-2c.9-1.2 1.3-2.3 1.3-2.4-.1 0-2.5-1-2.5-3.7zM13.8 6.1c.7-.8 1.1-1.8 1-2.9-1 .1-2 .7-2.7 1.5-.6.7-1.2 1.8-1 2.8 1 .1 2-.5 2.7-1.4z" />
                </svg>
                Disponible en iOS
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M17.6 7.8l1.3-2.2a.5.5 0 10-.9-.5l-1.4 2.3a10.7 10.7 0 00-9.2 0L6 5.1a.5.5 0 00-.9.5l1.3 2.2A9.1 9.1 0 002 14.5h20a9.1 9.1 0 00-4.4-6.7zM8.3 11.6a.9.9 0 110-1.8.9.9 0 010 1.8zm7.4 0a.9.9 0 110-1.8.9.9 0 010 1.8zM2 15.6v3.2c0 .9.7 1.7 1.7 1.7h.8v2a1.4 1.4 0 102.8 0v-2h9v2a1.4 1.4 0 102.8 0v-2h.8c.9 0 1.7-.8 1.7-1.7v-3.2H2z" />
                </svg>
                Disponible en Android
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/signup">
                <Button className="rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400">
                  Comenzar ahora
                </Button>
              </a>
              <a href="#beneficios">
                <Button className="rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                  Ver beneficios
                </Button>
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="glass-panel animate-float rounded-3xl border border-white/15 p-5 shadow-2xl shadow-cyan-900/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Resumen en vivo</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-300">Ventas hoy</p>
                  <p className="mt-1 text-2xl font-bold text-white">$24,850</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-300">Ordenes</p>
                  <p className="mt-1 text-2xl font-bold text-white">142</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-300">Clientes</p>
                  <p className="mt-1 text-2xl font-bold text-white">63</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-300">Stock critico</p>
                  <p className="mt-1 text-2xl font-bold text-amber-300">7</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="beneficios" className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Todo lo que tu operacion necesita</h2>
            <p className="mt-2 text-slate-300">
              Diseñado para caja, inventario y administracion en tiempo real, con experiencia movil y web adaptable.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="glass-panel rounded-2xl border border-white/10 p-5 transition-transform hover:-translate-y-1">
                <div className="mb-3 inline-flex rounded-xl bg-cyan-300/10 p-2 text-cyan-200">{feature.icon}</div>
                <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="modulos" className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
          <div className="glass-panel rounded-3xl border border-white/10 p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-3xl font-black text-cyan-300">+99.9%</p>
                <p className="mt-1 text-sm text-slate-300">Disponibilidad para tus operaciones diarias</p>
              </div>
              <div>
                <p className="text-3xl font-black text-cyan-300">+40%</p>
                <p className="mt-1 text-sm text-slate-300">Mejora estimada en velocidad de cobro</p>
              </div>
              <div>
                <p className="text-3xl font-black text-cyan-300">1 Panel</p>
                <p className="mt-1 text-sm text-slate-300">POS, inventario, clientes y ordenes conectados</p>
              </div>
            </div>
          </div>
        </section>

        <section id="precios" className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Planes para cada etapa</h2>
            <p className="mt-2 text-slate-300">Empieza simple y escala conforme crece tu operacion.</p> 
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="glass-panel rounded-2xl border border-white/10 p-6">
              <p className="text-sm font-semibold text-cyan-200">🟢 Basico</p>
              <p className="mt-2 text-3xl font-black text-white">$150</p>
              <p className="text-sm text-slate-300">MXN / mes</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                <li>Ideal para pequenos negocios que inician</li>
                <li>POS (ventas)</li>
                <li>Clientes</li>
                <li>Reportes basicos</li>
                <li>1 usuario</li>
                <li>1 sucursal</li>
                <li>Hasta 1,000 ordenes / mes</li>
                <li>Hasta 500 productos</li>
                <li>👉 Perfecto para negocios individuales</li>
              </ul>
              <a href="/signup" className="mt-6 block">
                <Button className="w-full rounded-full bg-white/10 text-white hover:bg-white/20">Elegir Basico</Button>
              </a>
            </article>

            <article className="rounded-2xl border border-cyan-300/40 bg-gradient-to-b from-cyan-500/20 to-slate-900/50 p-6 shadow-xl shadow-cyan-900/30">
              <p className="text-sm font-semibold text-cyan-200">🔵 Pro</p>
              <p className="mt-2 text-3xl font-black text-white">$399</p>
              <p className="text-sm text-slate-200">MXN / mes</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-100">
                <li>Para negocios en crecimiento</li>
                <li>Todo lo de Basico</li>
                <li>Hasta 5 usuarios</li>
                <li>Hasta 5,000 ordenes / mes</li>
                <li>Hasta 5,000 productos</li>
                <li>Reportes avanzados</li>
                <li>Gestion de personal</li>
                <li>1 sucursal</li>
                <li>👉 Aqui deberia estar el 70-80% de los usuarios</li>
              </ul>
              <a href="/signup" className="mt-6 block">
                <Button className="w-full rounded-full bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400">Elegir Pro</Button>
              </a>
            </article>

            <article className="glass-panel rounded-2xl border border-white/10 p-6">
              <p className="text-sm font-semibold text-cyan-200">🟣 Premium</p>
              <p className="mt-2 text-3xl font-black text-white">$599</p>
              <p className="text-sm text-slate-300">MXN / mes</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                <li>Para negocios que escalan</li>
                <li>Todo lo de Pro</li>
                <li>Multi-sucursal (sucursales) 🔥</li>
                <li>Usuarios ilimitados</li>
                <li>Ordenes ilimitadas</li>
                <li>Productos ilimitados</li>
                <li>Soporte prioritario</li>
                <li>Automatizacion por WhatsApp</li>
                <li>👉 Para negocios serios</li>
              </ul>
              <a href="#contacto" className="mt-6 block">
                <Button className="w-full rounded-full bg-white/10 text-white hover:bg-white/20">Elegir Premium</Button>
              </a>
            </article>
          </div>
        </section>

        <section id="contacto" className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="glass-panel rounded-2xl border border-white/10 p-6">
              <h3 className="text-xl font-bold text-white">Contacto comercial</h3>
              <p className="mt-2 text-sm text-slate-300">
                Nuestro equipo te ayuda a configurar POSZxor segun el tipo de negocio.
              </p>
              <ul className="mt-4 space-y-3 text-sm text-slate-200">
                <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  Email: <span className="font-semibold text-cyan-200">contactodev@zxor.mx</span>
                </li>
                <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  Telefono: <span className="font-semibold text-cyan-200">+52 55 1234 5678</span>
                </li>
                <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  WhatsApp: <span className="font-semibold text-cyan-200">+52 55 8765 4321</span>
                </li>
              </ul>
            </div>

            <div className="glass-panel rounded-2xl border border-white/10 p-6">
              <h3 className="text-xl font-bold text-white">Solicitar demo</h3>
              <p className="mt-2 text-sm text-slate-300">
                Escríbenos por WhatsApp y te mostramos el flujo completo.
              </p>
              <div className="mt-4">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="block">
                  <Button type="button" className="w-full rounded-full bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400">
                    Enviar por WhatsApp
                  </Button>
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-r from-cyan-500/20 to-sky-500/20 p-8 text-center">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Listo para digitalizar tu negocio?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-200 sm:text-base">
              Crea tu cuenta y empieza hoy mismo a vender con control total de tu operacion.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <a href="/signup">
                <Button className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-100">
                  Crear cuenta
                </Button>
              </a>
              <a href="/signin">
                <Button className="rounded-full border border-white/40 bg-transparent px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                  Iniciar sesion
                </Button>
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 bg-slate-950/60">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            <div>
              <p className="text-lg font-black tracking-wide text-cyan-300">POSZxor</p>
              <p className="mt-2 text-sm text-slate-300">
                Plataforma POS para operar ventas, inventario y administracion en un solo lugar.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">Producto</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li><a href="#beneficios" className="hover:text-white">Beneficios</a></li>
                <li><a href="#modulos" className="hover:text-white">Modulos</a></li>
                <li><a href="/signin" className="hover:text-white">Iniciar sesion</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">Empresa</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li><a href="#contacto" className="hover:text-white">Contacto</a></li>
                <li><a href="https://soporte.zxor.mx/" className="hover:text-white">Soporte</a></li>
                <li><a href="/help-center" className="hover:text-white">Centro de ayuda</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">Legal</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li><a href="#" className="hover:text-white">Privacidad</a></li>
                <li><a href="#" className="hover:text-white">Terminos</a></li>
                <li><a href="#" className="hover:text-white">Cookies</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 py-4 text-center text-xs text-slate-400">
            © {new Intl.DateTimeFormat("en", { timeZone: serverTimeZone(), year: "numeric" }).format(serverDate)} POSZxor. Todos los derechos reservados.
          </div>
        </footer>
      </main>

      <button
        type="button"
        aria-label="Volver al inicio"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-5 right-5 z-40 rounded-full border border-cyan-300/30 bg-slate-900/80 p-3 text-cyan-200 shadow-lg backdrop-blur transition-all hover:bg-slate-800 ${
          showScrollTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      </button>

      {cookieConsent === null ? (
        <div className="fixed bottom-5 left-5 z-40 w-[calc(100%-1.25rem)] max-w-md rounded-2xl border border-white/15 bg-slate-900/90 p-4 shadow-xl backdrop-blur">
          <p className="text-sm font-semibold text-white">Autorizacion de cookies</p>
          <p className="mt-1 text-xs text-slate-300">
            Usamos cookies para mejorar rendimiento, seguridad y experiencia de navegacion.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              onPress={() => handleCookieConsent("rejected")}
              className="rounded-full border border-white/20 bg-transparent px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
            >
              Rechazar
            </Button>
            <Button
              type="button"
              onPress={() => handleCookieConsent("accepted")}
              className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
            >
              Aceptar cookies
            </Button>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
      `}</style>
      <style jsx>{`
        .glass-panel {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
          backdrop-filter: blur(12px);
        }
        .bubble {
          position: absolute;
          border-radius: 999px;
          filter: blur(24px);
          opacity: 0.35;
          pointer-events: none;
          animation: drift 16s ease-in-out infinite;
        }
        .bubble-a {
          width: 220px;
          height: 220px;
          top: 14%;
          left: -70px;
          background: #22d3ee;
        }
        .bubble-b {
          width: 260px;
          height: 260px;
          top: 45%;
          right: -90px;
          background: #38bdf8;
          animation-delay: -4s;
        }
        .bubble-c {
          width: 180px;
          height: 180px;
          bottom: 10%;
          left: 30%;
          background: #60a5fa;
          animation-delay: -9s;
        }
        .animate-float {
          animation: float 7s ease-in-out infinite;
        }
        @keyframes drift {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-22px);
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
}
