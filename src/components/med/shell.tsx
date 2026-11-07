import { Link, useRouterState } from "@tanstack/react-router";
import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  LayoutGrid,
  MapPin,
  Menu,
  Receipt,
  Route,
  ScrollText,
  Settings,
  ShoppingBag,
  Truck,
  UserRound,
  UserPlus,
  Users,
  Wallet,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { accountByEmail } from "@/lib/med/accounts";
import { COMPANY, ROLE_META, type AccessId, type WorkspaceRole } from "@/lib/med/catalog";
import { clampPing, formatFixTime, pingMs, requestFieldFix } from "@/lib/med/locate";
import { isToday, nowLabel } from "@/lib/ruta/format";
import { lowOnRoute } from "@/lib/med/cierre";
import { fieldPersonId, operatingDriverId, operatingSellerId, sessionAccess, useHydrated, useMed } from "@/lib/med/store";
import { LocationDisclosure } from "@/components/med/location-disclosure";
import { BootScreen, SessionButton } from "@/components/med/login-panel";
import { NoticeBell } from "@/components/med/notice-bell";

const MENUS: Record<WorkspaceRole, { to: string; label: string; icon: LucideIcon; badge?: boolean; access: AccessId | "always" }[]> = {
  presale: [
    { to: "/", label: "Inicio", icon: BadgeCheck, access: "vender" },
    { to: "/pedidos", label: "Pedidos", icon: ClipboardList, badge: true, access: "pedidos" },
    { to: "/productos", label: "Productos", icon: LayoutGrid, access: "productos" },
    { to: "/catalogo", label: "Catálogo", icon: ShoppingBag, access: "catalogo" },
    { to: "/ventas", label: "Mis ventas", icon: Receipt, access: "always" },
    { to: "/clientes", label: "Clientes", icon: UserRound, access: "clientes" },
    { to: "/mapa", label: "Mapa", icon: MapPin, access: "clientes" },
    { to: "/transacciones", label: "Transacciones", icon: Receipt, access: "transacciones" },
    { to: "/finanzas", label: "Finanzas", icon: Wallet, access: "finanzas" },
    { to: "/config", label: "Configuración", icon: Settings, access: "always" },
    { to: "/ayuda", label: "Ayuda", icon: CircleHelp, access: "always" },
  ],
  driver: [
    { to: "/", label: "Inicio", icon: Truck, access: "entregar" },
    { to: "/mapa", label: "Mapa", icon: MapPin, access: "entregar" },
    { to: "/pedidos", label: "Pedidos", icon: ClipboardList, badge: true, access: "pedidos" },
    { to: "/catalogo", label: "Catálogo", icon: ShoppingBag, access: "catalogo" },
    { to: "/ventas", label: "Mis ventas", icon: Receipt, access: "always" },
    { to: "/clientes", label: "Clientes", icon: UserRound, access: "clientes" },
    { to: "/transacciones", label: "Transacciones", icon: Receipt, access: "transacciones" },
    { to: "/config", label: "Configuración", icon: Settings, access: "always" },
    { to: "/ayuda", label: "Ayuda", icon: CircleHelp, access: "always" },
  ],
  owner: [
    { to: "/", label: "Inicio", icon: BadgeCheck, access: "tablero" },
    { to: "/pedidos", label: "Pedidos", icon: ClipboardList, badge: true, access: "pedidos" },
    { to: "/productos", label: "Productos", icon: LayoutGrid, access: "productos" },
    { to: "/estadisticas", label: "Estadísticas", icon: BarChart3, access: "tablero" },
    { to: "/ventas", label: "Mis ventas", icon: Receipt, access: "always" },
    { to: "/finanzas", label: "Finanzas", icon: Wallet, access: "finanzas" },
    { to: "/clientes", label: "Clientes", icon: UserRound, access: "clientes" },
    { to: "/mapa", label: "Mapa", icon: MapPin, access: "tablero" },
    { to: "/inventario", label: "Inventario", icon: Warehouse, access: "inventario" },
    { to: "/personal", label: "Personal", icon: UserPlus, access: "personal" },
    { to: "/cierre", label: "Día", icon: CalendarDays, access: "tablero" },
    { to: "/rutas", label: "Rutas", icon: Route, access: "tablero" },
    { to: "/bitacora", label: "Bitácora", icon: ScrollText, access: "tablero" },
    { to: "/equipo", label: "Equipo", icon: Users, access: "always" },
    { to: "/config", label: "Configuración", icon: Settings, access: "always" },
    { to: "/ayuda", label: "Ayuda", icon: CircleHelp, access: "always" },
  ],
  manager: [],
  warehouse: [
    { to: "/inventario", label: "Inventario", icon: Warehouse, access: "inventario" },
    { to: "/productos", label: "Productos", icon: LayoutGrid, access: "productos" },
    { to: "/pedidos", label: "Pedidos", icon: ClipboardList, badge: true, access: "pedidos" },
    { to: "/config", label: "Configuración", icon: Settings, access: "always" },
    { to: "/ayuda", label: "Ayuda", icon: CircleHelp, access: "always" },
  ],
};

MENUS.manager = MENUS.owner.filter((item) => item.access !== "personal");

function requiredAccess(path: string, role: WorkspaceRole): AccessId | "always" {
  if (path === "/config" || path === "/ayuda" || path.startsWith("/privacidad")) return "always";
  if (path.startsWith("/cierre")) return "tablero";
  if (path.startsWith("/bitacora") || path.startsWith("/rendimiento") || path.startsWith("/estadisticas") || path.startsWith("/rutas")) return "tablero";
  if (path.startsWith("/inventario")) return "inventario";
  if (path.startsWith("/ventas")) return "always";
  const desk = role === "owner" || role === "manager";
  if (path.startsWith("/mapa")) {
    if (role === "driver") return "entregar";
    if (role === "presale") return "clientes";
    return "tablero";
  }
  if (path === "/" || path === "/dia") {
    if (desk) return "tablero";
    if (role === "driver") return "entregar";
    if (role === "warehouse") return "inventario";
    return "vender";
  }
  if (path.startsWith("/personal")) return "personal";
  if (path.startsWith("/pedidos")) return "pedidos";
  if (path.startsWith("/productos") || path.startsWith("/carga")) return "productos";
  if (path.startsWith("/catalogo")) return "catalogo";
  if (path.startsWith("/cliente")) return "clientes";
  if (path.startsWith("/transacciones")) return "transacciones";
  if (path.startsWith("/finanzas")) return "finanzas";
  return "always";
}

function itemActive(path: string, to: string): boolean {
  if (to === "/") return path === "/";
  if (to === "/clientes") return path === "/clientes" || path.startsWith("/cliente");
  return path === to || path.startsWith(`${to}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const { isPending } = useCurrentUserState();
  const hydrated = useHydrated();
  if (isPending || !hydrated) return <BootScreen />;
  return (
    <SignInGate fallback={<Chrome>{children}</Chrome>}>
      <Chrome>{children}</Chrome>
    </SignInGate>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const role = useMed((state) => state.role);
  const accountEmail = useMed((state) => state.accountEmail);
  const orders = useMed((state) => state.orders);
  const sellerId = useMed(operatingSellerId);
  const driverId = useMed(operatingDriverId);
  const people = useMed((state) => state.people);
  const areas = useMed((state) => state.areas) ?? [];
  const consent = useMed((state) => state.locationConsent);
  const pingMinutes = clampPing(useMed((state) => state.pingMinutes));
  const setLocationConsent = useMed((state) => state.setLocationConsent);
  const uiScale = useMed((state) => state.uiScale);
  const noteIdle = useMed((state) => state.noteIdle);
  const [open, setOpen] = useState(false);
  const [reviewConsent, setReviewConsent] = useState(false);
  const [online, setOnline] = useState(true);
  const access = sessionAccess(role, people);
  const meta = ROLE_META[role];
  const account = accountByEmail(accountEmail);
  const name = accountEmail ? (account?.name ?? meta.label) : COMPANY;
  const sub = !accountEmail ? "Sin sesión" : account ? (role === "owner" ? account.sub : `${meta.label} · ${account.sub}`) : meta.sub;
  const menu = MENUS[role].filter((item) => item.access === "always" || access.includes(item.access));
  const needed = requiredAccess(path, role);
  const allowed = needed === "always" || access.includes(needed);

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

  useEffect(() => {
    setOpen(false);
  }, [path]);

  const fieldId = fieldPersonId(role);
  const assigned = fieldId != null && areas.some((area) => area.personId === fieldId);
  const sharesLocation = (role === "driver" || role === "presale") && !assigned;

  useEffect(() => {
    if (role !== "owner") return;
    noteIdle();
    const id = window.setInterval(() => noteIdle(), 60_000);
    return () => window.clearInterval(id);
  }, [noteIdle, role]);

  useEffect(() => {
    if (!sharesLocation || consent !== "granted") {
      useMed.getState().setLocate("idle", "");
      return;
    }
    const personId = fieldPersonId(role);
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const state = useMed.getState();
      const currentId = fieldPersonId(state.role);
      if (!currentId || currentId !== personId || state.locationConsent !== "granted") return;
      const last = state.locations[currentId]?.[0];
      const age = last ? Date.now() - Date.parse(last.at) : Number.POSITIVE_INFINITY;
      if (age >= pingMs(state.pingMinutes)) requestFieldFix();
    };
    tick();
    const id = window.setInterval(tick, pingMs(pingMinutes));
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [role, consent, sharesLocation, pingMinutes]);

  const badge =
    role === "driver"
      ? orders.filter((order) => order.driverId === driverId && isToday(order.createdAt) && order.delivery === "pending").length
      : role === "owner" || role === "manager"
        ? orders.filter((order) => isToday(order.createdAt) && order.delivery === "pending").length
        : orders.filter((order) => order.sellerId === sellerId && isToday(order.createdAt) && !order.synced).length;

  const zoomClass = uiScale === "compacta" ? "med-zoom-compacta" : uiScale === "grande" ? "med-zoom-grande" : "";

  return (
    <div className={"min-h-dvh bg-paper pb-[env(safe-area-inset-bottom)] text-ink " + zoomClass}>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b-2 border-teal bg-card px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setOpen(true)}
          className="grid size-11 place-items-center rounded-xl bg-blue-soft text-blue-deep"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <img src="/logo-marca.png?v=2" alt={COMPANY} className="size-10 shrink-0 object-contain sm:size-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold text-blue-deep">{name}</p>
          <p className="truncate text-sm text-muted">{sub}</p>
        </div>
        <NoticeBell />
        <SessionButton />
        <span className="sr-only">{online ? "En línea" : "Sin red"}</span>
      </header>
      <ClockBar />

      <StockAlerts />
      {accountEmail && role === "owner" ? <LowStockBanner /> : null}

      {open ? (
        <div className="fixed inset-0 z-40 bg-ink/40" onClick={() => setOpen(false)} role="presentation">
          <aside
            className="flex h-full w-[min(19rem,88vw)] flex-col bg-drawer text-drawer-ink shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Menú"
          >
            <div className="flex items-start justify-between gap-2 px-4 pt-5 pb-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold tracking-wide">{COMPANY}</p>
                <p className="truncate text-sm text-drawer-muted">{accountEmail ? name : "Sin sesión"}</p>
                {accountEmail ? <p className="truncate text-sm text-drawer-muted">{sub}</p> : null}
              </div>
              <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="grid size-11 place-items-center text-drawer-ink">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3">
            <nav aria-label="Secciones" className="mt-2">
              {accountEmail ? menu.map((item) => {
                const active = itemActive(path, item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={
                      "mb-1 flex h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold " +
                      (active ? "bg-drawer-on text-drawer-ink" : "text-drawer-ink")
                    }
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && badge > 0 ? (
                      <span className="grid min-w-7 place-items-center rounded-full bg-teal px-2 text-sm text-drawer">{badge}</span>
                    ) : null}
                  </Link>
                );
              }) : (
                <p className="px-3 py-4 text-sm text-drawer-muted">Entra con el punto de arriba para ver tu menú.</p>
              )}
            </nav>
            </div>

            <div className="bg-teal px-4 py-4 text-drawer">
              <p className="font-semibold">El día se guarda en este teléfono.</p>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-4">
        {sharesLocation ? (
          <FieldLocationGate
            puesto={role === "presale" ? "preventa" : "reparto"}
            consent={consent}
            review={reviewConsent}
            onAccept={() => {
              setLocationConsent("granted");
              setReviewConsent(false);
            }}
            onDecline={() => {
              setLocationConsent("denied");
              setReviewConsent(false);
            }}
            onReview={() => setReviewConsent(true)}
          />
        ) : null}
        {accountEmail ? (allowed ? children : <Denied />) : <SignedOut />}
      </main>
    </div>
  );
}

function ClockBar() {
  const [label, setLabel] = useState(() => nowLabel());
  useEffect(() => {
    const tick = () => setLabel(nowLabel());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <p className="border-b border-line bg-card px-4 py-2 text-sm font-semibold text-blue-deep capitalize">{label}</p>
  );
}

function FieldLocationGate({
  puesto,
  consent,
  review,
  onAccept,
  onDecline,
  onReview,
}: {
  puesto: "preventa" | "reparto";
  consent: "unknown" | "granted" | "denied";
  review: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onReview: () => void;
}) {
  if (consent === "unknown" || review) {
    return (
      <div className="mb-4">
        <LocationDisclosure puesto={puesto} onAccept={onAccept} onDecline={onDecline} />
      </div>
    );
  }
  if (consent === "denied") {
    return (
      <div className="mb-4 rounded-2xl border border-line bg-card p-3">
        <p className="text-sm text-ink">
          {puesto === "preventa"
            ? "No estás compartiendo la ubicación. El dueño no ve el punto de esta preventa."
            : "No estás compartiendo la ubicación. El dueño no ve el punto de esta unidad."}
        </p>
        <button type="button" onClick={onReview} className="mt-3 h-11 rounded-xl bg-blue px-4 font-semibold text-card">
          Compartir ubicación
        </button>
      </div>
    );
  }
  return null;
}

function LowStockBanner() {
  const catalog = useMed((state) => state.catalog);
  const loads = useMed((state) => state.loads);
  const people = useMed((state) => state.people);
  const lows = lowOnRoute(catalog, loads, people);
  if (lows.length === 0) return null;
  const names = [...new Set(lows.map((item) => item.name))];
  const text =
    names.length === 1
      ? `${names[0]} está por agotarse en la ruta.`
      : `${names.length} productos están por agotarse en la ruta.`;
  return (
    <div className="border-b border-line bg-card">
      <div className="mx-auto w-full max-w-5xl px-4 py-2">
        <Link to="/cierre" className="flex items-center justify-between gap-3 rounded-2xl bg-blue-soft px-3 py-3">
          <span className="text-sm font-semibold text-blue-deep">{text}</span>
          <span className="shrink-0 text-sm font-semibold text-blue-deep">Ver día</span>
        </Link>
      </div>
    </div>
  );
}

function StockAlerts() {
  const role = useMed((state) => state.role);
  const notices = useMed((state) => state.stockNotices);
  const people = useMed((state) => state.people);
  const markStockSeen = useMed((state) => state.markStockSeen);
  const unread = notices.filter((notice) => !notice.seen.includes(role));
  if (unread.length === 0) return null;
  return (
    <div className="border-b border-line bg-card" role="status">
      <div className="mx-auto w-full max-w-5xl px-4 py-3">
        <div className="rounded-2xl bg-blue px-4 py-3 text-card">
          <p className="font-extrabold">{unread.length === 1 ? "Se acabó un producto" : `Se acabaron ${unread.length} productos`}</p>
          <ul className="mt-1 text-sm">
            {unread.slice(0, 4).map((notice) => {
              const who = people.find((person) => person.id === notice.sellerId)?.name ?? "Una ruta";
              return (
                <li key={notice.id}>
                  {notice.name} se acabó en la ruta de {who}. {formatFixTime(notice.at)}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={markStockSeen} className="mt-3 h-11 rounded-xl bg-card px-4 font-semibold text-blue-deep">
            Enterado
          </button>
        </div>
      </div>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <img src="/logo.png?v=2" alt={COMPANY} className="w-full max-w-xs" />
      <h1 className="mt-4 text-2xl font-extrabold text-title">Medicalabs</h1>
      <p className="mt-2 text-sm text-muted">Toca el punto rojo de arriba para entrar. Verde es activo, amarillo es pausa y rojo es desconectado.</p>
    </div>
  );
}

function Denied() {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <h1 className="text-2xl font-extrabold text-title">Sin acceso</h1>
      <p className="mt-2 text-sm text-muted">Este puesto no abre esta sección. Solo el dueño ve la operación de todos.</p>
    </div>
  );
}

export function SessionChip() {
  const email = useMed((state) => state.accountEmail);
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <p className="font-semibold text-blue-deep">Datos de este dispositivo</p>
      <p className="mt-1 text-sm text-muted">
        Pedidos, visitas, tiendas y carga viven en este teléfono. La sesión{email ? ` de ${email}` : ""} también. Solo el dueño ve todas las rutas.
      </p>
    </div>
  );
}
