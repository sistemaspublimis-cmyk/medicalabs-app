import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Radio, RotateCcw, Route, Truck, Users, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ACTIVE_SELLER_ID, sellerById } from "@/lib/ruta/catalog";
import { useHydrated, useRuta } from "@/lib/ruta/store";

const NAV = [
  { to: "/", label: "Ruta", icon: Route },
  { to: "/carga", label: "Carga", icon: Truck },
  { to: "/dia", label: "Día", icon: BarChart3 },
  { to: "/equipo", label: "Equipo", icon: Users },
] as const;

function navActive(path: string, to: string): boolean {
  if (to === "/") return path === "/" || path.startsWith("/cliente") || path.startsWith("/pedido");
  return path === to;
}

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const hydrated = useHydrated();
  const role = useRuta((state) => state.role);
  const setRole = useRuta((state) => state.setRole);
  const reset = useRuta((state) => state.reset);
  const [online, setOnline] = useState(true);
  const [armed, setArmed] = useState(false);
  const seller = sellerById(ACTIVE_SELLER_ID);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-line bg-card md:flex md:flex-col md:px-4 md:py-6">
        <Brand />
        <nav aria-label="Secciones" className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.to} item={item} path={path} wide />
          ))}
        </nav>
        <p className="mt-auto pt-6 text-sm text-muted">Datos de demostración en este dispositivo.</p>
      </aside>

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="md:hidden">
              <Brand />
            </div>
            <div className="hidden md:block">
              <p className="font-display text-2xl leading-none">
                {role === "supervisor" ? "Torre de control" : seller?.routeName}
              </p>
              <p className="mt-1 text-sm text-muted">
                {role === "supervisor" ? "Las tres rutas de hoy" : `${seller?.name} · Unidad ${seller?.vehicle}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 rounded-full px-2 text-sm text-muted"
                onClick={() => {
                  if (!hydrated) return;
                  if (!armed) {
                    setArmed(true);
                    return;
                  }
                  reset();
                  setArmed(false);
                }}
              >
                <RotateCcw className="mr-1 inline size-3.5" aria-hidden="true" />
                {armed ? "Confirmar" : "Reiniciar"}
              </button>
              <span
                className={
                  "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-sm " +
                  (online ? "bg-teal-soft text-teal" : "bg-amber-soft text-amber")
                }
              >
                {online ? <Wifi className="size-3.5" aria-hidden="true" /> : <WifiOff className="size-3.5" aria-hidden="true" />}
                {online ? "En línea" : "Sin red"}
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted md:hidden">
            {role === "supervisor" ? "Torre de control" : `${seller?.routeName} · ${seller?.name}`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-line/70 p-1" role="group" aria-label="Modo de vista">
            <RoleButton active={role === "seller"} onClick={() => setRole("seller")} label="Vendedor" />
            <RoleButton active={role === "supervisor"} onClick={() => setRole("supervisor")} label="Supervisor" />
          </div>
          {!online ? (
            <p className="mt-2 text-sm text-amber">Los pedidos se quedan en el teléfono hasta que vuelva la señal.</p>
          ) : null}
        </header>

        <main className="flex-1 px-4 py-4 pb-24 md:px-8 md:pb-10">{children}</main>

        <nav
          aria-label="Secciones"
          className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 border-t border-line bg-card md:hidden"
        >
          {NAV.map((item) => (
            <NavLink key={item.to} item={item} path={path} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-xl bg-teal text-card">
        <Radio className="size-4" aria-hidden="true" />
      </span>
      <span className="font-display text-2xl leading-none tracking-tight">RutaCampo</span>
    </div>
  );
}

function RoleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        "h-10 rounded-lg text-sm font-semibold " +
        (active ? "bg-card text-ink shadow-sm" : "text-muted")
      }
    >
      {label}
    </button>
  );
}

function NavLink({
  item,
  path,
  wide = false,
}: {
  item: (typeof NAV)[number];
  path: string;
  wide?: boolean;
}) {
  const active = navActive(path, item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={
        (wide
          ? "flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold "
          : "flex flex-col items-center justify-center gap-0.5 text-xs font-semibold ") +
        (active ? "bg-teal-soft text-teal" : "text-muted")
      }
    >
      <Icon className="size-5" aria-hidden="true" />
      {item.label}
    </Link>
  );
}
