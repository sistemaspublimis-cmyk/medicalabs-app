import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { accountByEmail, matchAccount } from "@/lib/med/accounts";
import {
  ACCESS_PRESETS,
  ACTIVE_DRIVER_ID,
  ACTIVE_SELLER_ID,
  CLIENTS,
  MANAGER_ID,
  WAREHOUSE_ID,
  morningLoad,
  PREVENTAS,
  PRODUCTS,
  SEED_CREW,
  type AccessId,
  type ClientStop,
  type CrewMember,
  type Product,
  type StoreFix,
  type WorkspaceRole,
} from "@/lib/med/catalog";
import type { DaySpend } from "@/lib/med/cierre";
import { clientInsideArea } from "@/lib/med/near";
import { materializeWeek, weekSpan, type WeekStop } from "@/lib/med/weeks";
import { isToday, lineSummary, money, orderTotals, todayKey, type Line } from "@/lib/ruta/format";

function sliceOf(state: unknown): Slice | null {
  if (!state || typeof state !== "object") return null;
  const row = state as Partial<Slice>;
  if (!row.role || !Array.isArray(row.people)) return null;
  return row as Slice;
}

function listedAccess(state: Slice | null, personId: string): AccessId[] {
  return state?.people.find((person) => person.id === personId)?.access ?? [];
}

function sessionCrew(slice: Slice | null): CrewMember | undefined {
  const id = slice?.sessionPersonId;
  if (!id) return undefined;
  return slice?.people.find((person) => person.id === id);
}

/** La preventa de la app es Ana, o la persona con la que se entró si el dueño la dio de alta. */
export function operatingSellerId(state?: unknown): string {
  const slice = sliceOf(state);
  const person = sessionCrew(slice);
  if (person && (person.kind === "presale" || person.access.includes("vender"))) return person.id;
  if (slice?.role === "driver" && listedAccess(slice, ACTIVE_DRIVER_ID).includes("vender")) return ACTIVE_DRIVER_ID;
  return ACTIVE_SELLER_ID;
}

/** El reparto de la app es Marta, o el repartidor con el que se entró. */
export function operatingDriverId(state?: unknown): string {
  const slice = sliceOf(state);
  const person = sessionCrew(slice);
  if (person && (person.kind === "driver" || person.access.includes("entregar"))) return person.id;
  if (slice?.role === "presale" && listedAccess(slice, ACTIVE_SELLER_ID).includes("entregar")) return ACTIVE_SELLER_ID;
  return ACTIVE_DRIVER_ID;
}

function canDeliver(state: Slice): boolean {
  if (state.role === "driver") return true;
  return state.role === "presale" && listedAccess(state, ACTIVE_SELLER_ID).includes("entregar");
}

/** Accesos del puesto más los que el dueño sumó en Personal. */
export function sessionAccess(role: WorkspaceRole, people: CrewMember[]): AccessId[] {
  const base = [...ACCESS_PRESETS[role]];
  const personId = fieldPersonId(role);
  if (!personId) return base;
  const extra = people.find((person) => person.id === personId)?.access ?? [];
  return [...new Set([...base, ...extra])];
}

/** Quién puede compartir el GPS en esta sesión. El dueño y almacén no. */
export function fieldPersonId(role: WorkspaceRole): string | null {
  const person = sessionCrew(sliceOf(useMed.getState()));
  if (person && (person.kind === "presale" || person.kind === "driver")) return person.id;
  if (role === "driver") return ACTIVE_DRIVER_ID;
  if (role === "presale") return ACTIVE_SELLER_ID;
  return null;
}

export type Visit = {
  id: string;
  clientId: string;
  sellerId: string;
  at: string;
  note: string;
};

export type DeliveryState = "pending" | "delivered" | "failed";

export type Order = {
  id: string;
  clientId: string;
  sellerId: string;
  driverId: string;
  createdAt: string;
  lines: Line[];
  discountPct: number;
  synced: boolean;
  delivery: DeliveryState;
  deliveryNote: string;
  /** Hora en que el repartidor pidió volver. El pedido sigue pendiente. */
  remindAt?: string | null;
  /** Dónde estaba quien hizo el pedido, si en ese momento hubo una lectura. */
  sellerFix?: { lat: number; lng: number; at: string } | null;
};

export type CartLine = { productId: string; qty: number };

export type DriverFix = {
  at: string;
  lat: number;
  lng: number;
  accuracy: number | null;
};

/** Zona de trabajo (área) o ruta (línea) que el dueño dibuja en el mapa. */
export type WorkArea = {
  id: string;
  name: string;
  kind: "zona" | "ruta";
  points: { lat: number; lng: number }[];
  personId: string | null;
  /** Color elegido por el dueño. Si falta, el mapa usa uno de la paleta. */
  color?: string;
};

export type LocateStatus = "idle" | "asking" | "saved" | "denied" | "unavailable";

export type LocationConsent = "unknown" | "granted" | "denied";

export type OwnerNotice = {
  id: string;
  at: string;
  orderId: string;
  driverId: string;
  sellerId?: string;
  clientId: string;
  /** pedido, entrega, incidencia, quieto, reabierto, sesion, jornada o stock. En stock y jornada, orderId lleva el texto corto. */
  kind?: "pedido" | "entrega" | "incidencia" | "quieto" | "reabierto" | "sesion" | "jornada" | "stock";
  read: boolean;
};

/** Aviso de que un producto llegó a cero en una ruta. Cada puesto lo marca por su lado. */
export type StockNotice = {
  id: string;
  at: string;
  productId: string;
  name: string;
  sellerId: string;
  seen: WorkspaceRole[];
};

export type ProductView = "lista" | "iconos" | "tabla";

export type NameStyle = "completo" | "corto";

export type StockScope = "todos" | "disponibles";

export type UiScale = "compacta" | "normal" | "grande";

/** tiendas: ve las de su zona. oculta: no las ve. zona: ve la zona que le toca. */
export type ZoneSight = "tiendas" | "oculta" | "zona";

export type SessionMark = {
  id: string;
  at: string;
  personId: string;
  name: string;
  role: WorkspaceRole;
};

export type ShiftPause = { from: string; to: string | null };

export type WorkShift = {
  id: string;
  personId: string;
  startedAt: string;
  endedAt: string | null;
  status: "working" | "paused" | "closed";
  pauses: ShiftPause[];
};

/** Aviso que publica el dueño. Si es fijo, nadie lo quita. */
export type Bulletin = {
  id: string;
  at: string;
  body: string;
  sticky: boolean;
  dismissedBy: string[];
};

/** Qué hizo alguien, y el lugar si en ese momento hubo una lectura. */
export type JournalKind =
  | "venta"
  | "visita"
  | "entrega"
  | "incidencia"
  | "recordatorio"
  | "tienda"
  | "carga"
  | "producto"
  | "personal"
  | "gasto"
  | "zona"
  | "ruta"
  | "sesion"
  | "jornada"
  | "aviso"
  | "inventario";
export type { WeekStop };

export type JournalEntry = {
  id: string;
  at: string;
  personId: string;
  kind: JournalKind;
  title: string;
  detail: string;
  place: string;
  lat: number | null;
  lng: number | null;
  ref: string;
};

/** Ronda de conteo. La abre el dueño y la captura almacén. */
export type InventoryRound = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  note: string;
};

export type InventoryLine = {
  id: string;
  roundId: string;
  at: string;
  productId: string;
  qty: number;
  personId: string;
};

type Slice = {
  role: WorkspaceRole;
  accountEmail: string | null;
  visits: Visit[];
  orders: Order[];
  loads: Record<string, Record<string, number>>;
  cart: CartLine[];
  favorites: string[];
  qtyStep: 1 | 6 | 12;
  activeClientId: string | null;
  people: CrewMember[];
  actingId: string | null;
  catalog: Product[];
  locations: Record<string, DriverFix[]>;
  locateStatus: LocateStatus;
  locateMessage: string;
  notices: OwnerNotice[];
  stockNotices: StockNotice[];
  productView: ProductView;
  /** Aceptación de la persona que tiene la sesión abierta. */
  locationConsent: LocationConsent;
  /** Aceptación de cada preventa o repartidor. El dueño solo ve a quien aceptó. */
  unitConsent: Record<string, LocationConsent>;
  daySpend: DaySpend;
  clients: ClientStop[];
  areas: WorkArea[];
  /** Movimientos del día: quién, qué hizo, cuándo y dónde. */
  journal: JournalEntry[];
  /** Reparto de tiendas por semana. Vacío: se usa el repartidor fijo de la tienda. */
  weekPlans: WeekStop[];
  /** La tienda que el mapa debe acercar después de registrarla. No se guarda en el teléfono. */
  mapFocusId: string | null;
  /** asignar: el dueño elige el repartidor de cada pedido. solo: uno recibe los que van saliendo. */
  dispatchMode: "asignar" | "solo";
  soloDriverId: string | null;
  /** Minutos para mandar el punto y para contarlo como en línea. */
  pingMinutes: number;
  companyName: string;
  /** Hora en que cada persona entra a la app. */
  sessions: SessionMark[];
  /** Periodo laboral de preventa y reparto. */
  shifts: WorkShift[];
  /** Avisos escritos por el dueño. */
  bulletins: Bulletin[];
  nameStyle: NameStyle;
  stockScope: StockScope;
  uiScale: UiScale;
  /** Cómo ve cada preventa las tiendas y la zona. */
  zoneSight: Record<string, ZoneSight>;
  /** Minutos sin movimiento antes de avisar al dueño, por persona. 0 no avisa. */
  idleByPerson: Record<string, number>;
  /** Quién entró. Las cuentas que crea el dueño no usan el id fijo de Ana o Marta. */
  sessionPersonId: string | null;
  /** Piezas en bodega. El relleno de ruta no las duplica. */
  warehouse: Record<string, number>;
  inventoryRounds: InventoryRound[];
  inventoryLines: InventoryLine[];
};

type Actions = {
  setRole: (role: WorkspaceRole) => void;
  signInLocal: (email: string, password: string) => boolean;
  signOutLocal: () => void;
  startShift: () => void;
  pauseShift: () => void;
  resumeShift: () => void;
  endShift: () => void;
  setNameStyle: (style: NameStyle) => void;
  setStockScope: (scope: StockScope) => void;
  setUiScale: (scale: UiScale) => void;
  setZoneSight: (personId: string, sight: ZoneSight) => void;
  setPersonIdle: (personId: string, minutes: number) => void;
  noteIdle: () => void;
  postBulletin: (body: string, sticky: boolean) => void;
  dismissBulletin: (id: string) => void;
  undoDelivery: (orderId: string) => void;
  setCartQty: (productId: string, qty: number) => void;
  setMapFocus: (id: string | null) => void;
  setQtyStep: (step: 1 | 6 | 12) => void;
  toggleFavorite: (productId: string) => void;
  setActiveClient: (clientId: string | null) => void;
  addToCart: (productId: string, dir: 1 | -1) => void;
  clearCart: () => void;
  placeCart: (discountPct: number) => { ok: true; order: Order } | { ok: false; error: string };
  checkIn: (clientId: string, note: string) => void;
  markDelivery: (orderId: string, delivery: DeliveryState, note: string) => void;
  remindDelivery: (orderId: string, at: string) => void;
  setRemaining: (productId: string, qty: number) => void;
  syncMine: () => number;
  reset: () => void;
  savePerson: (input: {
    id?: string;
    name: string;
    phone: string;
    routeName: string;
    kind: WorkspaceRole;
    access: AccessId[];
    email?: string;
    password?: string;
  }) => string;
  removePerson: (id: string) => void;
  setActing: (id: string | null) => void;
  addProduct: (input: {
    name: string;
    category: string;
    unit: string;
    price: number;
    cost: number;
    qty: number;
    image?: string;
    description?: string;
  }) => { ok: true } | { ok: false; error: string };
  setProductCost: (productId: string, cost: number) => void;
  setProductPrice: (productId: string, price: number) => void;
  setProductDescription: (productId: string, description: string) => void;
  refillProduct: (productId: string, qty: number) => { ok: true } | { ok: false; error: string };
  openInventory: (note: string) => { ok: true } | { ok: false; error: string };
  closeInventory: () => void;
  setInventoryQty: (productId: string, qty: number) => { ok: true } | { ok: false; error: string };
  pinClient: (clientId: string, lat: number, lng: number) => void;
  blankData: () => void;
  setLead: (personId: string, leadId: string | null) => void;
  recordLocation: (fix: DriverFix) => void;
  setLocate: (status: LocateStatus, message: string) => void;
  markNoticesRead: () => void;
  markStockSeen: () => void;
  setProductView: (view: ProductView) => void;
  setLocationConsent: (value: LocationConsent) => void;
  setDaySpend: (amount: number, note: string) => void;
  saveWorkArea: (input: {
    name: string;
    kind: "zona" | "ruta";
    points: { lat: number; lng: number }[];
    personId: string | null;
  }) => { ok: true; id: string } | { ok: false; error: string };
  removeWorkArea: (id: string) => void;
  updateWorkArea: (
    id: string,
    input: {
      name: string;
      personId: string | null;
      kind?: "zona" | "ruta";
      points?: { lat: number; lng: number }[];
      color?: string | null;
    },
  ) => { ok: true } | { ok: false; error: string };
  assignClientToArea: (areaId: string, clientId: string) => void;
  clearClientArea: (clientId: string) => void;
  setWeekDriver: (week: string, clientId: string, driverId: string) => void;
  assignWeekZone: (week: string, zone: string, driverId: string) => void;
  clearWeekPlan: (week: string) => void;
  setDispatch: (mode: "asignar" | "solo", driverId?: string | null) => void;
  assignDriver: (orderId: string, driverId: string) => void;
  setDesk: (input: { pingMinutes?: number; companyName?: string }) => void;
  registerClient: (input: {
    store: string;
    contact: string;
    phone: string;
    address: string;
    zone: string;
    sellerId: string;
    driverId: string;
    facade: [string, string];
    fix?: StoreFix;
    mapPin?: { lat: number; lng: number };
  }) => { ok: true; id: string } | { ok: false; error: string };
};

function atHour(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function line(productId: string, qty: number, catalog: Product[] = PRODUCTS): Line {
  const product = catalog.find((item) => item.id === productId);
  return { productId, qty, price: product?.price ?? 0 };
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function alignOperator(current: Slice, patch: Partial<Slice>): Partial<Slice> {
  const prevSeller = operatingSellerId(current);
  const merged = { ...current, ...patch };
  const nextSeller = operatingSellerId(merged);
  const client = (current.clients ?? CLIENTS).find((item) => item.id === merged.activeClientId);
  const activeClientId = client && client.sellerId !== nextSeller ? null : merged.activeClientId;
  const cart = prevSeller === nextSeller ? merged.cart : [];
  return { ...patch, activeClientId, cart };
}

function applySales(load: Record<string, number>, orders: Order[], sellerId: string) {
  const next = { ...load };
  for (const order of orders) {
    if (order.sellerId !== sellerId) continue;
    for (const item of order.lines) next[item.productId] = Math.max(0, (next[item.productId] ?? 0) - item.qty);
  }
  return next;
}

function seed(): Slice {
  return {
    role: "owner",
    accountEmail: null,
    ...blankBooks(),
    qtyStep: 1,
    activeClientId: null,
    people: SEED_CREW.map((person) => ({ ...person, access: [...person.access] })),
    actingId: null,
    catalog: PRODUCTS.map((product) => ({ ...product, description: product.description ?? "" })),
    locateStatus: "idle",
    locateMessage: "",
    productView: "lista",
    locationConsent: "unknown",
    unitConsent: {},
    areas: [],
    mapFocusId: null,
    dispatchMode: "asignar",
    soloDriverId: null,
    pingMinutes: 9,
    companyName: "Medicalabs",
    nameStyle: "completo",
    stockScope: "todos",
    uiScale: "normal",
    zoneSight: {},
    idleByPerson: {},
    sessionPersonId: null,
  };
}

function pushNotice(current: OwnerNotice[], notice: OwnerNotice): OwnerNotice[] {
  return [notice, ...current].slice(0, 80);
}

function activity(input: {
  kind: NonNullable<OwnerNotice["kind"]>;
  sellerId?: string;
  driverId?: string;
  clientId?: string;
  orderId?: string;
  at?: string;
}): OwnerNotice {
  return {
    id: uid("N"),
    at: input.at ?? new Date().toISOString(),
    orderId: input.orderId ?? "",
    driverId: input.driverId ?? "",
    sellerId: input.sellerId ?? "",
    clientId: input.clientId ?? "",
    kind: input.kind,
    read: false,
  };
}

function stockWatch(
  sellerId: string,
  before: Record<string, number>,
  after: Record<string, number>,
  catalog: Product[],
): OwnerNotice[] {
  const notes: OwnerNotice[] = [];
  for (const product of catalog) {
    const prev = before[product.id] ?? 0;
    const nextQty = after[product.id] ?? 0;
    const floor = product.minQty ?? 0;
    const ended = prev > 0 && nextQty <= 0;
    const low = floor > 0 && prev > floor && nextQty > 0 && nextQty <= floor;
    if (!ended && !low) continue;
    notes.push(
      activity({
        kind: "stock",
        sellerId,
        clientId: product.id,
        orderId: ended ? `${product.name} se acabó` : `${product.name} está por terminarse`,
      }),
    );
  }
  return notes;
}

function withSellerFix(orders: Order[], personId: string, point: DriverFix): Order[] {
  const newest = orders.find((order) => {
    if (order.sellerFix) return false;
    if (order.sellerId !== personId && order.driverId !== personId) return false;
    const age = Date.now() - Date.parse(order.createdAt);
    return age >= 0 && age < 3 * 60 * 1000;
  });
  if (!newest) return orders;
  return orders.map((order) =>
    order.id === newest.id ? { ...order, sellerFix: { lat: point.lat, lng: point.lng, at: point.at } } : order,
  );
}

export function zoneSightOf(map: Record<string, ZoneSight> | undefined, personId: string): ZoneSight {
  const value = map?.[personId];
  return value === "oculta" || value === "zona" || value === "tiendas" ? value : "tiendas";
}

export function storesForSeller(
  sellerId: string,
  clients: ClientStop[],
  areas: WorkArea[],
  sight: ZoneSight,
): ClientStop[] {
  const mine = clients.filter((client) => client.sellerId === sellerId);
  const zones = areas.filter((area) => area.personId === sellerId && area.kind === "zona");
  const inZone = clients.filter((client) => zones.some((area) => area.id === client.areaId || clientInsideArea(area, client)));
  if (sight === "oculta") return mine;
  if (sight === "zona") return zones.length === 0 ? mine : inZone;
  const seen = new Set<string>();
  const both: ClientStop[] = [];
  for (const client of [...mine, ...inZone]) {
    if (seen.has(client.id)) continue;
    seen.add(client.id);
    both.push(client);
  }
  return both;
}

function sessionPerson(role: WorkspaceRole): { id: string; fallback: string } {
  if (role === "driver") return { id: ACTIVE_DRIVER_ID, fallback: "Reparto" };
  if (role === "presale") return { id: ACTIVE_SELLER_ID, fallback: "Preventa" };
  if (role === "manager") return { id: MANAGER_ID, fallback: "Gerente" };
  if (role === "warehouse") return { id: WAREHOUSE_ID, fallback: "Almacén" };
  return { id: "dueno", fallback: "Dueño" };
}

function blankBooks(): Pick<
  Slice,
  | "visits"
  | "orders"
  | "loads"
  | "cart"
  | "favorites"
  | "clients"
  | "journal"
  | "notices"
  | "stockNotices"
  | "locations"
  | "sessions"
  | "shifts"
  | "weekPlans"
  | "bulletins"
  | "daySpend"
  | "warehouse"
  | "inventoryRounds"
  | "inventoryLines"
> {
  return {
    visits: [],
    orders: [],
    loads: {},
    cart: [],
    favorites: [],
    clients: [],
    journal: [],
    notices: [],
    stockNotices: [],
    locations: {},
    sessions: [],
    shifts: [],
    weekPlans: [],
    bulletins: [],
    daySpend: { day: "", amount: 0, note: "" },
    warehouse: {},
    inventoryRounds: [],
    inventoryLines: [],
  };
}

function openShift(shifts: WorkShift[], personId: string): WorkShift | undefined {
  return shifts.find((shift) => shift.personId === personId && shift.status !== "closed");
}

function lastMoveAt(state: Slice, personId: string): number | null {
  const times: number[] = [];
  const push = (iso: string | null | undefined) => {
    if (!iso) return;
    const at = Date.parse(iso);
    if (Number.isFinite(at)) times.push(at);
  };
  for (const row of state.journal ?? []) {
    if (row.personId === personId) push(row.at);
  }
  for (const fix of state.locations?.[personId] ?? []) push(fix.at);
  for (const mark of state.sessions ?? []) {
    if (mark.personId === personId) push(mark.at);
  }
  for (const shift of state.shifts ?? []) {
    if (shift.personId !== personId) continue;
    push(shift.startedAt);
    push(shift.endedAt);
    for (const pause of shift.pauses) {
      push(pause.from);
      push(pause.to);
    }
  }
  if (times.length === 0) return null;
  return Math.max(...times);
}

function driverForNewOrder(state: Slice, clientDriverId: string): string {
  const drivers = state.people.filter((person) => person.kind === "driver");
  if (drivers.length === 1) return drivers[0].id;
  if (state.dispatchMode === "solo") {
    const chosen = drivers.find((person) => person.id === state.soloDriverId);
    return chosen?.id ?? drivers[0]?.id ?? clientDriverId;
  }
  if (clientDriverId && drivers.some((person) => person.id === clientDriverId)) return clientDriverId;
  return drivers[0]?.id ?? clientDriverId;
}

function cleanAreas(value: unknown): WorkArea[] {
  if (!Array.isArray(value)) return [];
  const areas: WorkArea[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<WorkArea>;
    if (row.kind !== "zona" && row.kind !== "ruta") continue;
    if (typeof row.name !== "string" || !row.name.trim()) continue;
    if (!Array.isArray(row.points)) continue;
    const points = row.points
      .filter((point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180)
      .slice(0, 40)
      .map((point) => ({ lat: point.lat, lng: point.lng }));
    if (points.length < (row.kind === "zona" ? 3 : 2)) continue;
    const color = typeof row.color === "string" && /^#[0-9a-fA-F]{6}$/.test(row.color) ? row.color.toLowerCase() : undefined;
    areas.push({
      id: typeof row.id === "string" && row.id ? row.id : uid("area").toLowerCase(),
      name: row.name.trim().slice(0, 40),
      kind: row.kind,
      points,
      personId: typeof row.personId === "string" && row.personId ? row.personId : null,
      ...(color ? { color } : {}),
    });
    if (areas.length >= 24) break;
  }
  return areas;
}

function cleanStock(value: unknown): StockNotice[] {
  if (!Array.isArray(value)) return [];
  const notes: StockNotice[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<StockNotice>;
    if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.productId !== "string") continue;
    const seen = Array.isArray(row.seen)
      ? row.seen.filter((role): role is WorkspaceRole => role === "owner" || role === "presale" || role === "driver")
      : [];
    notes.push({
      id: row.id,
      at: typeof row.at === "string" ? row.at : new Date().toISOString(),
      productId: row.productId,
      name: row.name.slice(0, 80),
      sellerId: typeof row.sellerId === "string" ? row.sellerId : "",
      seen,
    });
    if (notes.length >= 40) break;
  }
  return notes;
}

function cleanView(value: unknown): ProductView {
  return value === "iconos" || value === "tabla" || value === "lista" ? value : "lista";
}

const JOURNAL_KINDS = new Set<JournalKind>([
  "venta",
  "visita",
  "entrega",
  "incidencia",
  "recordatorio",
  "tienda",
  "carga",
  "producto",
  "personal",
  "gasto",
  "zona",
  "ruta",
  "sesion",
  "jornada",
  "aviso",
]);

function cleanJournal(value: unknown): JournalEntry[] {
  if (!Array.isArray(value)) return [];
  const rows: JournalEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<JournalEntry>;
    if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.kind !== "string") continue;
    if (!JOURNAL_KINDS.has(row.kind as JournalKind)) continue;
    const lat = typeof row.lat === "number" && Number.isFinite(row.lat) && Math.abs(row.lat) <= 90 ? row.lat : null;
    const lng = typeof row.lng === "number" && Number.isFinite(row.lng) && Math.abs(row.lng) <= 180 ? row.lng : null;
    rows.push({
      id: row.id,
      at: typeof row.at === "string" ? row.at : new Date().toISOString(),
      personId: typeof row.personId === "string" && row.personId ? row.personId : "dueno",
      kind: row.kind as JournalKind,
      title: row.title.slice(0, 120),
      detail: typeof row.detail === "string" ? row.detail.slice(0, 240) : "",
      place: typeof row.place === "string" ? row.place.slice(0, 80) : "",
      lat: lat != null && lng != null ? lat : null,
      lng: lat != null && lng != null ? lng : null,
      ref: typeof row.ref === "string" ? row.ref.slice(0, 40) : "",
    });
    if (rows.length >= 160) break;
  }
  return rows;
}

function visitsToJournal(visits: Visit[], clients: ClientStop[]): JournalEntry[] {
  return [...visits]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 160)
    .map((visit) => {
      const place = clients.find((client) => client.id === visit.clientId)?.store ?? "Cliente";
      const pedido = visit.note === "Pedido";
      return {
        id: `bit-${visit.id}`,
        at: visit.at,
        personId: visit.sellerId,
        kind: pedido ? "venta" : "visita",
        title: pedido ? `Tomó pedido en ${place}` : `Visitó ${place}`,
        detail: visit.note || "Visita",
        place,
        lat: null,
        lng: null,
        ref: visit.clientId,
      } satisfies JournalEntry;
    });
}

function actorId(state: Slice): string {
  return fieldPersonId(state.role) ?? "dueno";
}

function personPoint(state: Slice, personId: string): { lat: number; lng: number } | null {
  if (!personId || personId === "dueno") return null;
  if (state.unitConsent?.[personId] !== "granted") return null;
  const fix = state.locations?.[personId]?.[0];
  if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return null;
  const age = Date.now() - Date.parse(fix.at);
  if (!Number.isFinite(age) || age > 2 * 60 * 1000) return null;
  return { lat: fix.lat, lng: fix.lng };
}

type JournalDraft = {
  personId?: string;
  kind: JournalKind;
  title: string;
  detail: string;
  place: string;
  lat?: number | null;
  lng?: number | null;
  ref?: string;
};

function journalAfter(state: Slice, draft: JournalDraft): JournalEntry[] {
  const personId = draft.personId ?? actorId(state);
  const here = personPoint(state, personId);
  const lat = typeof draft.lat === "number" && Number.isFinite(draft.lat) ? draft.lat : (here?.lat ?? null);
  const lng = typeof draft.lng === "number" && Number.isFinite(draft.lng) ? draft.lng : (here?.lng ?? null);
  const entry: JournalEntry = {
    id: uid("bit").toLowerCase(),
    at: new Date().toISOString(),
    personId,
    kind: draft.kind,
    title: draft.title.slice(0, 120),
    detail: draft.detail.slice(0, 240),
    place: draft.place.slice(0, 80),
    lat: lat != null && lng != null ? lat : null,
    lng: lat != null && lng != null ? lng : null,
    ref: (draft.ref ?? "").slice(0, 40),
  };
  const current = state.journal ?? [];
  if (entry.kind === "carga" && entry.ref) {
    const last = current[0];
    const age = last ? Date.parse(entry.at) - Date.parse(last.at) : Number.POSITIVE_INFINITY;
    if (last && last.kind === "carga" && last.personId === entry.personId && last.ref === entry.ref && age >= 0 && age < 45_000) {
      return [{ ...entry, id: last.id }, ...current.slice(1)].slice(0, 160);
    }
  }
  return [entry, ...current].slice(0, 160);
}

function stampJournal(rows: JournalEntry[] | undefined, personId: string, point: DriverFix): JournalEntry[] {
  const list = rows ?? [];
  const head = list[0];
  if (!head || head.personId !== personId || head.lat != null) return list;
  const age = Date.now() - Date.parse(head.at);
  if (!Number.isFinite(age) || age < 0 || age > 3 * 60 * 1000) return list;
  return [{ ...head, lat: point.lat, lng: point.lng }, ...list.slice(1)];
}

function askWhere(): void {
  if (typeof window === "undefined") return;
  queueMicrotask(() => {
    void import("@/lib/med/locate").then((mod) => mod.requestFieldFix());
  });
}

function clientStore(state: Slice, clientId: string): string {
  return state.clients.find((client) => client.id === clientId)?.store ?? "Cliente";
}

function depletions(
  sellerId: string,
  before: Record<string, number>,
  after: Record<string, number>,
  catalog: Product[],
): StockNotice[] {
  const notes: StockNotice[] = [];
  for (const product of catalog) {
    const prev = before[product.id] ?? 0;
    const nextQty = after[product.id] ?? 0;
    if (prev > 0 && nextQty <= 0) {
      notes.push({
        id: uid("stk").toLowerCase(),
        at: new Date().toISOString(),
        productId: product.id,
        name: product.name,
        sellerId,
        seen: [],
      });
    }
  }
  return notes;
}

function cleanWeeks(value: unknown): WeekStop[] {
  if (!Array.isArray(value)) return [];
  const rows: WeekStop[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<WeekStop>;
    if (typeof row.week !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.week)) continue;
    if (typeof row.clientId !== "string" || !row.clientId || typeof row.driverId !== "string" || !row.driverId) continue;
    const key = `${row.week}:${row.clientId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ week: row.week, clientId: row.clientId, driverId: row.driverId });
    if (rows.length >= 800) break;
  }
  return rows;
}

function replaceWeek(plans: WeekStop[], week: string, next: WeekStop[]): WeekStop[] {
  return [...plans.filter((row) => row.week !== week), ...next].slice(0, 800);
}

function cleanSessions(value: unknown): SessionMark[] {
  if (!Array.isArray(value)) return [];
  const rows: SessionMark[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<SessionMark>;
    if (typeof row.id !== "string" || typeof row.at !== "string" || typeof row.personId !== "string") continue;
    if (row.role !== "owner" && row.role !== "manager" && row.role !== "presale" && row.role !== "driver") continue;
    rows.push({
      id: row.id,
      at: row.at,
      personId: row.personId,
      name: typeof row.name === "string" ? row.name.slice(0, 80) : "Persona",
      role: row.role,
    });
    if (rows.length >= 200) break;
  }
  return rows;
}

function cleanShifts(value: unknown): WorkShift[] {
  if (!Array.isArray(value)) return [];
  const rows: WorkShift[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<WorkShift>;
    if (typeof row.id !== "string" || typeof row.personId !== "string" || typeof row.startedAt !== "string") continue;
    if (row.status !== "working" && row.status !== "paused" && row.status !== "closed") continue;
    const pauses: ShiftPause[] = [];
    if (Array.isArray(row.pauses)) {
      for (const pause of row.pauses) {
        if (!pause || typeof pause !== "object") continue;
        const from = (pause as ShiftPause).from;
        const to = (pause as ShiftPause).to;
        if (typeof from !== "string") continue;
        pauses.push({ from, to: typeof to === "string" ? to : null });
      }
    }
    rows.push({
      id: row.id,
      personId: row.personId,
      startedAt: row.startedAt,
      endedAt: typeof row.endedAt === "string" ? row.endedAt : null,
      status: row.status,
      pauses,
    });
    if (rows.length >= 120) break;
  }
  return rows;
}

function cleanBulletins(value: unknown): Bulletin[] {
  if (!Array.isArray(value)) return [];
  const rows: Bulletin[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<Bulletin>;
    if (typeof row.id !== "string" || typeof row.at !== "string" || typeof row.body !== "string") continue;
    rows.push({
      id: row.id,
      at: row.at,
      body: row.body.slice(0, 240),
      sticky: row.sticky === true,
      dismissedBy: Array.isArray(row.dismissedBy) ? row.dismissedBy.filter((id) => typeof id === "string").slice(0, 40) : [],
    });
    if (rows.length >= 40) break;
  }
  return rows;
}

function cleanSight(value: unknown): Record<string, ZoneSight> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, ZoneSight> = {};
  for (const [id, sight] of Object.entries(value as Record<string, unknown>)) {
    if (sight === "tiendas" || sight === "oculta" || sight === "zona") next[id] = sight;
  }
  return next;
}

function cleanIdle(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, number> = {};
  for (const [id, minutes] of Object.entries(value as Record<string, unknown>)) {
    const parsed = Math.round(Number(minutes));
    if (!Number.isFinite(parsed)) continue;
    next[id] = Math.min(240, Math.max(0, parsed));
  }
  return next;
}

function cleanConsent(value: unknown): Record<string, LocationConsent> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, LocationConsent> = {};
  for (const [id, consent] of Object.entries(value as Record<string, unknown>)) {
    if (consent === "granted" || consent === "denied" || consent === "unknown") next[id] = consent;
  }
  return next;
}

function foldMail(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function signInCrew(
  get: () => Slice & Actions,
  set: (partial: Partial<Slice>) => void,
  email: string,
  password: string,
): boolean {
  const key = foldMail(email);
  if (!key || password.length === 0) return false;
  const person = get().people.find((item) => item.email && foldMail(item.email) === key && item.password === password);
  if (!person) return false;
  const at = new Date().toISOString();
  const mark: SessionMark = { id: uid("S"), at, personId: person.id, name: person.name, role: person.kind };
  const actingId = person.kind === "presale" || person.kind === "driver" ? person.id : null;
  const loads = { ...get().loads };
  if (actingId && person.kind === "presale" && !loads[actingId]) loads[actingId] = morningLoad();
  const locationConsent = actingId ? (get().unitConsent?.[actingId] ?? "unknown") : "unknown";
  set({
    role: person.kind,
    actingId,
    loads,
    locationConsent,
    sessionPersonId: person.id,
    accountEmail: person.email ?? email.trim(),
    sessions: [mark, ...(get().sessions ?? [])].slice(0, 200),
    notices: pushNotice(
      get().notices ?? [],
      activity({
        kind: "sesion",
        sellerId: person.id,
        driverId: person.kind === "driver" ? person.id : "",
        orderId: "inició sesión",
        at,
      }),
    ),
    journal: journalAfter(get(), {
      personId: person.id,
      kind: "sesion",
      title: `${person.name} inició sesión`,
      detail: person.email ?? "",
      place: "App",
      ref: mark.id,
    }),
  });
  return true;
}

export const useMed = create<Slice & Actions>()(
  persist(
    (set, get) => ({
      ...seed(),
      setRole: (role) => {
        const who = sessionPerson(role);
        const actingId = role === "presale" || role === "driver" ? who.id : null;
        const loads = { ...get().loads };
        if (actingId && role === "presale" && !loads[actingId]) loads[actingId] = morningLoad();
        const personId = role === "driver" || role === "presale" ? who.id : null;
        const locationConsent = personId ? (get().unitConsent?.[personId] ?? "unknown") : "unknown";
        set(alignOperator(get(), { role, actingId, loads, locationConsent, sessionPersonId: who.id }));
      },
      signInLocal: (email, password) => {
        const account = matchAccount(email, password);
        if (!account) return signInCrew(get, set, email, password);
        get().setRole(account.role);
        const who = sessionPerson(account.role);
        const person = get().people.find((item) => item.id === who.id);
        const at = new Date().toISOString();
        const mark: SessionMark = {
          id: uid("S"),
          at,
          personId: who.id,
          name: person?.name ?? account.name ?? who.fallback,
          role: account.role,
        };
        const notices =
          account.role === "owner"
            ? (get().notices ?? [])
            : pushNotice(
                get().notices ?? [],
                activity({
                  kind: "sesion",
                  sellerId: who.id,
                  driverId: account.role === "driver" ? who.id : "",
                  orderId: "inició sesión",
                  at,
                }),
              );
        set({
          accountEmail: account.email,
          sessions: [mark, ...(get().sessions ?? [])].slice(0, 200),
          notices,
          journal: journalAfter(get(), {
            personId: who.id,
            kind: "sesion",
            title: `${mark.name} inició sesión`,
            detail: account.email,
            place: "App",
            ref: mark.id,
          }),
        });
        return true;
      },
      signOutLocal: () => set({ accountEmail: null, sessionPersonId: null }),
      startShift: () => {
        const personId = fieldPersonId(get().role);
        if (!personId) return;
        const shifts = get().shifts ?? [];
        if (openShift(shifts, personId)) return;
        const at = new Date().toISOString();
        const shift: WorkShift = {
          id: uid("J"),
          personId,
          startedAt: at,
          endedAt: null,
          status: "working",
          pauses: [],
        };
        const name = get().people.find((person) => person.id === personId)?.name ?? "La ruta";
        set({
          shifts: [shift, ...shifts].slice(0, 120),
          notices: pushNotice(get().notices ?? [], activity({ kind: "jornada", sellerId: personId, driverId: get().role === "driver" ? personId : "", orderId: "inició el periodo laboral", at })),
          journal: journalAfter(get(), {
            personId,
            kind: "jornada",
            title: `${name} inició el periodo laboral`,
            detail: "En ruta",
            place: "App",
            ref: shift.id,
          }),
        });
      },
      pauseShift: () => {
        const personId = fieldPersonId(get().role);
        if (!personId) return;
        const current = openShift(get().shifts ?? [], personId);
        if (!current || current.status !== "working") return;
        const at = new Date().toISOString();
        const next: WorkShift = { ...current, status: "paused", pauses: [...current.pauses, { from: at, to: null }] };
        const name = get().people.find((person) => person.id === personId)?.name ?? "La ruta";
        set({
          shifts: (get().shifts ?? []).map((shift) => (shift.id === current.id ? next : shift)),
          notices: pushNotice(get().notices ?? [], activity({ kind: "jornada", sellerId: personId, driverId: get().role === "driver" ? personId : "", orderId: "pausó el periodo laboral", at })),
          journal: journalAfter(get(), {
            personId,
            kind: "jornada",
            title: `${name} pausó el periodo laboral`,
            detail: "En pausa",
            place: "App",
            ref: current.id,
          }),
        });
      },
      resumeShift: () => {
        const personId = fieldPersonId(get().role);
        if (!personId) return;
        const current = openShift(get().shifts ?? [], personId);
        if (!current || current.status !== "paused") return;
        const at = new Date().toISOString();
        const pauses = current.pauses.map((pause, index) =>
          index === current.pauses.length - 1 && !pause.to ? { ...pause, to: at } : pause,
        );
        const name = get().people.find((person) => person.id === personId)?.name ?? "La ruta";
        set({
          shifts: (get().shifts ?? []).map((shift) =>
            shift.id === current.id ? { ...shift, status: "working", pauses } : shift,
          ),
          notices: pushNotice(get().notices ?? [], activity({ kind: "jornada", sellerId: personId, driverId: get().role === "driver" ? personId : "", orderId: "reactivó el periodo laboral", at })),
          journal: journalAfter(get(), {
            personId,
            kind: "jornada",
            title: `${name} reactivó el periodo laboral`,
            detail: "Otra vez en ruta",
            place: "App",
            ref: current.id,
          }),
        });
      },
      endShift: () => {
        const personId = fieldPersonId(get().role);
        if (!personId) return;
        const current = openShift(get().shifts ?? [], personId);
        if (!current) return;
        const at = new Date().toISOString();
        const pauses = current.pauses.map((pause, index) =>
          index === current.pauses.length - 1 && !pause.to ? { ...pause, to: at } : pause,
        );
        const name = get().people.find((person) => person.id === personId)?.name ?? "La ruta";
        set({
          shifts: (get().shifts ?? []).map((shift) =>
            shift.id === current.id ? { ...shift, status: "closed", endedAt: at, pauses } : shift,
          ),
          notices: pushNotice(get().notices ?? [], activity({ kind: "jornada", sellerId: personId, driverId: get().role === "driver" ? personId : "", orderId: "terminó el periodo laboral", at })),
          journal: journalAfter(get(), {
            personId,
            kind: "jornada",
            title: `${name} terminó el periodo laboral`,
            detail: "Cerrado",
            place: "App",
            ref: current.id,
          }),
        });
      },
      setNameStyle: (nameStyle) => set({ nameStyle }),
      setStockScope: (stockScope) => set({ stockScope }),
      setUiScale: (uiScale) => set({ uiScale }),
      setZoneSight: (personId, sight) => {
        if (get().role !== "owner") return;
        const person = get().people.find((item) => item.id === personId && item.kind === "presale");
        if (!person) return;
        if (sight !== "tiendas" && sight !== "oculta" && sight !== "zona") return;
        set({ zoneSight: { ...(get().zoneSight ?? {}), [personId]: sight } });
      },
      setPersonIdle: (personId, minutes) => {
        if (get().role !== "owner") return;
        const person = get().people.find((item) => item.id === personId && (item.kind === "presale" || item.kind === "driver"));
        if (!person) return;
        const value = Math.round(Number(minutes));
        if (!Number.isFinite(value)) return;
        const next = Math.min(240, Math.max(0, value));
        const idle = next === 0 ? 0 : Math.max(5, next);
        set({ idleByPerson: { ...(get().idleByPerson ?? {}), [personId]: idle } });
      },
      noteIdle: () => {
        if (get().role !== "owner") return;
        const now = Date.now();
        const notices = [...(get().notices ?? [])];
        let changed = false;
        for (const person of get().people) {
          if (person.kind !== "presale" && person.kind !== "driver") continue;
          const minutes = (get().idleByPerson ?? {})[person.id] ?? 30;
          if (minutes <= 0) continue;
          const moved = lastMoveAt(get(), person.id);
          if (moved == null) continue;
          const working = (get().shifts ?? []).some(
            (shift) => shift.personId === person.id && shift.status !== "closed" && isToday(shift.startedAt),
          );
          const entered = (get().sessions ?? []).some((mark) => mark.personId === person.id && isToday(mark.at));
          if (!working && !entered) continue;
          if (now - moved < minutes * 60_000) continue;
          const open = notices.some(
            (notice) => notice.kind === "quieto" && !notice.read && (notice.sellerId === person.id || notice.driverId === person.id) && Date.parse(notice.at) >= moved,
          );
          if (open) continue;
          notices.unshift({
            id: uid("N"),
            at: new Date().toISOString(),
            orderId: "",
            driverId: person.kind === "driver" ? person.id : "",
            sellerId: person.id,
            clientId: "",
            kind: "quieto",
            read: false,
          });
          changed = true;
        }
        if (changed) set({ notices: notices.slice(0, 80) });
      },
      postBulletin: (body, sticky) => {
        if (get().role !== "owner") return;
        const text = body.trim().slice(0, 240);
        if (!text) return;
        const bulletin: Bulletin = {
          id: uid("A"),
          at: new Date().toISOString(),
          body: text,
          sticky,
          dismissedBy: [],
        };
        set({
          bulletins: [bulletin, ...(get().bulletins ?? [])].slice(0, 40),
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "aviso",
            title: sticky ? "Publicó un aviso fijo" : "Publicó un aviso",
            detail: text,
            place: "App",
            ref: bulletin.id,
          }),
        });
      },
      dismissBulletin: (id) => {
        if (get().role === "owner") {
          set({ bulletins: (get().bulletins ?? []).filter((bulletin) => bulletin.id !== id) });
          return;
        }
        const who = fieldPersonId(get().role) ?? "dueno";
        set({
          bulletins: (get().bulletins ?? []).map((bulletin) => {
            if (bulletin.id !== id || bulletin.sticky || bulletin.dismissedBy.includes(who)) return bulletin;
            return { ...bulletin, dismissedBy: [...bulletin.dismissedBy, who] };
          }),
        });
      },
      setMapFocus: (mapFocusId) => set({ mapFocusId }),
      setQtyStep: (qtyStep) => set({ qtyStep }),
      toggleFavorite: (productId) => {
        const favorites = get().favorites.includes(productId)
          ? get().favorites.filter((id) => id !== productId)
          : [productId, ...get().favorites];
        set({ favorites });
      },
      setActiveClient: (activeClientId) => set({ activeClientId }),
      addToCart: (productId, dir) => {
        const product = get().catalog.find((item) => item.id === productId);
        if (dir > 0 && (product?.price ?? 0) <= 0) return;
        const sellerId = operatingSellerId(get());
        const step = get().qtyStep;
        const stock = get().loads[sellerId]?.[productId] ?? 0;
        const current = get().cart.find((item) => item.productId === productId)?.qty ?? 0;
        const next = Math.max(0, Math.min(stock, current + dir * step));
        const cart = get().cart.filter((item) => item.productId !== productId);
        if (next > 0) cart.push({ productId, qty: next });
        set({ cart });
      },
      setCartQty: (productId, qty) => {
        const product = get().catalog.find((item) => item.id === productId);
        if ((product?.price ?? 0) <= 0) return;
        const sellerId = operatingSellerId(get());
        const stock = get().loads[sellerId]?.[productId] ?? 0;
        const next = Math.max(0, Math.min(stock, Math.round(qty)));
        const cart = get().cart.filter((item) => item.productId !== productId);
        if (next > 0) cart.push({ productId, qty: next });
        set({ cart });
      },
      clearCart: () => set({ cart: [] }),
      placeCart: (discountPct) => {
        const sellerId = operatingSellerId(get());
        const sellerName = get().people.find((person) => person.id === sellerId)?.name ?? "esta ruta";
        const clientId = get().activeClientId;
        if (!clientId) return { ok: false, error: "Elige el cliente antes de cobrar." };
        const client = get().clients.find((item) => item.id === clientId);
        const sight = zoneSightOf(get().zoneSight, sellerId);
        const allowed = client
          ? storesForSeller(sellerId, get().clients, get().areas ?? [], sight).some((item) => item.id === client.id)
          : false;
        if (!client || !allowed) {
          return { ok: false, error: `Ese cliente no está en la ruta de ${sellerName}.` };
        }
        const picked = get().cart.filter((item) => item.qty > 0);
        if (picked.length === 0) return { ok: false, error: "Agrega al menos un producto." };
        const stock = get().loads[sellerId] ?? {};
        for (const item of picked) {
          if ((stock[item.productId] ?? 0) < item.qty) {
            const name = get().catalog.find((product) => product.id === item.productId)?.name ?? "Producto";
            return { ok: false, error: `No alcanza ${name} a bordo.` };
          }
        }
        const nextStock = { ...stock };
        const lines: Line[] = picked.map((item) => {
          nextStock[item.productId] = (nextStock[item.productId] ?? 0) - item.qty;
          return line(item.productId, item.qty, get().catalog);
        });
        const createdAt = new Date().toISOString();
        const here = personPoint(get(), sellerId);
        const order: Order = {
          id: uid("ML"),
          clientId,
          sellerId,
          driverId: driverForNewOrder(get(), client.driverId),
          createdAt,
          lines,
          discountPct,
          synced: false,
          delivery: "pending",
          deliveryNote: "",
          sellerFix: here ? { lat: here.lat, lng: here.lng, at: createdAt } : null,
        };
        const already = get().visits.some(
          (item) => item.clientId === clientId && item.sellerId === sellerId && isToday(item.at),
        );
        const visit: Visit = {
          id: uid("V"),
          clientId,
          sellerId,
          at: order.createdAt,
          note: "Pedido",
        };
        const gone = depletions(sellerId, stock, nextStock, get().catalog);
        const summary = lineSummary(lines, get().catalog);
        set({
          orders: [order, ...get().orders],
          loads: { ...get().loads, [sellerId]: nextStock },
          visits: already ? get().visits : [visit, ...get().visits],
          cart: [],
          stockNotices: [...gone, ...(get().stockNotices ?? [])].slice(0, 40),
          notices: [
            ...stockWatch(sellerId, stock, nextStock, get().catalog),
            activity({
              kind: "pedido",
              at: order.createdAt,
              orderId: order.id,
              driverId: order.driverId,
              sellerId,
              clientId,
            }),
            ...(get().notices ?? []),
          ].slice(0, 80),
          journal: journalAfter(get(), {
            personId: sellerId,
            kind: "venta",
            title: `Vendió en ${client.store}`,
            detail: `${summary} · ${money(orderTotals(lines, discountPct).total)}`,
            place: client.store,
            ref: order.id,
          }),
        });
        askWhere();
        return { ok: true, order };
      },
      checkIn: (clientId, note) => {
        const sellerId = operatingSellerId(get());
        const visit: Visit = {
          id: uid("V"),
          clientId,
          sellerId,
          at: new Date().toISOString(),
          note,
        };
        const visits = get().visits.filter(
          (item) => !(item.clientId === clientId && item.sellerId === sellerId && isToday(item.at)),
        );
        const place = clientStore(get(), clientId);
        set({
          visits: [visit, ...visits],
          journal: journalAfter(get(), {
            personId: sellerId,
            kind: "visita",
            title: `Visitó ${place}`,
            detail: note.trim().slice(0, 120) || "Visita",
            place,
            ref: clientId,
          }),
        });
        askWhere();
      },
      markDelivery: (orderId, delivery, note) => {
        if (!canDeliver(get())) return;
        const driverId = operatingDriverId(get());
        const previous = get().orders.find((order) => order.id === orderId && order.driverId === driverId);
        if (!previous || previous.delivery !== "pending") return;
        const next = { ...previous, delivery, deliveryNote: note, remindAt: null };
        const orders = get().orders.map((order) => (order.id === previous.id ? next : order));
        const notices = pushNotice(get().notices ?? [], {
          id: uid("N"),
          at: new Date().toISOString(),
          orderId: previous.id,
          driverId,
          sellerId: previous.sellerId,
          clientId: previous.clientId,
          kind: delivery === "delivered" ? "entrega" : "incidencia",
          read: false,
        });
        const place = clientStore(get(), previous.clientId);
        const summary = lineSummary(previous.lines, get().catalog);
        const journal = journalAfter(get(), {
          personId: driverId,
          kind: delivery === "delivered" ? "entrega" : "incidencia",
          title: delivery === "delivered" ? `Entregó en ${place}` : `No entregó en ${place}`,
          detail: delivery === "delivered" ? summary : `${note.trim() || "No se entregó"} · ${summary}. La pieza regresó a la preventa.`,
          place,
          ref: previous.id,
        });
        if (delivery !== "failed") {
          set({ orders, notices, journal });
          askWhere();
          return;
        }
        const stock = { ...(get().loads[previous.sellerId] ?? morningLoad()) };
        for (const item of previous.lines) stock[item.productId] = (stock[item.productId] ?? 0) + item.qty;
        set({ orders, notices, loads: { ...get().loads, [previous.sellerId]: stock }, journal });
        askWhere();
      },
      undoDelivery: (orderId) => {
        if (!canDeliver(get())) return;
        const driverId = operatingDriverId(get());
        const previous = get().orders.find((order) => order.id === orderId && order.driverId === driverId);
        if (!previous || previous.delivery !== "delivered") return;
        const place = clientStore(get(), previous.clientId);
        set({
          orders: get().orders.map((order) =>
            order.id === previous.id ? { ...order, delivery: "pending", deliveryNote: "" } : order,
          ),
          notices: pushNotice(get().notices ?? [], {
            id: uid("N"),
            at: new Date().toISOString(),
            orderId: previous.id,
            driverId,
            sellerId: previous.sellerId,
            clientId: previous.clientId,
            kind: "reabierto",
            read: false,
          }),
          journal: journalAfter(get(), {
            personId: driverId,
            kind: "entrega",
            title: `Dejó pendiente de nuevo en ${place}`,
            detail: "Aún no entregado",
            place,
            ref: previous.id,
          }),
        });
        askWhere();
      },
      remindDelivery: (orderId, at) => {
        if (!canDeliver(get())) return;
        const driverId = operatingDriverId(get());
        const previous = get().orders.find((order) => order.id === orderId && order.driverId === driverId);
        if (!previous || previous.delivery !== "pending") return;
        const when = new Date(at);
        if (Number.isNaN(when.getTime())) return;
        const place = clientStore(get(), previous.clientId);
        const label = when.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        set({
          orders: get().orders.map((order) =>
            order.id === previous.id ? { ...order, remindAt: when.toISOString(), deliveryNote: "Entregar más tarde" } : order,
          ),
          journal: journalAfter(get(), {
            personId: driverId,
            kind: "recordatorio",
            title: `Dejó para más tarde en ${place}`,
            detail: `Recordatorio ${label}`,
            place,
            ref: previous.id,
          }),
        });
        askWhere();
      },
      setRemaining: (productId, qty) => {
        const sellerId = operatingSellerId(get());
        const current = get().loads[sellerId] ?? morningLoad();
        const nextQty = Math.max(0, Math.round(qty));
        const prevQty = current[productId] ?? 0;
        if (nextQty === prevQty) return;
        const nextStock = { ...current, [productId]: nextQty };
        const gone = depletions(sellerId, current, nextStock, get().catalog);
        const productName = get().catalog.find((product) => product.id === productId)?.name ?? "Producto";
        const routeName = get().people.find((person) => person.id === sellerId)?.routeName || "la ruta";
        set({
          loads: { ...get().loads, [sellerId]: nextStock },
          stockNotices: [...gone, ...(get().stockNotices ?? [])].slice(0, 40),
          notices: [...stockWatch(sellerId, current, nextStock, get().catalog), ...(get().notices ?? [])].slice(0, 80),
          journal: journalAfter(get(), {
            personId: sellerId,
            kind: "carga",
            title: `Ajustó ${productName}`,
            detail: `Quedaron ${nextQty} a bordo`,
            place: routeName,
            ref: productId,
          }),
        });
        askWhere();
      },
      syncMine: () => {
        const sellerId = operatingSellerId(get());
        let count = 0;
        const orders = get().orders.map((order) => {
          if (order.sellerId === sellerId && isToday(order.createdAt) && !order.synced) {
            count += 1;
            return { ...order, synced: true };
          }
          return order;
        });
        if (count > 0) set({ orders });
        return count;
      },
      reset: () => {
        const account = accountByEmail(get().accountEmail);
        const fresh = seed();
        if (account) {
          fresh.accountEmail = account.email;
          fresh.role = account.role;
          fresh.actingId = account.role === "presale" ? ACTIVE_SELLER_ID : account.role === "driver" ? ACTIVE_DRIVER_ID : null;
        }
        set(fresh);
      },
      savePerson: (input) => {
        const name = input.name.trim();
        const access = input.access.filter((item, index, list) => list.indexOf(item) === index);
        const id = input.id ?? uid("P");
        const current = get().people.find((person) => person.id === id);
        const email = (input.email ?? current?.email ?? "").trim().toLowerCase();
        const password = input.password && input.password.length > 0 ? input.password : (current?.password ?? "");
        const next: CrewMember = {
          id,
          name,
          phone: input.phone.trim(),
          routeName: input.routeName.trim(),
          kind: input.kind,
          access,
          seeded: current?.seeded ?? false,
          leadId: current?.leadId ?? null,
          email: email || undefined,
          password: password || undefined,
        };
        const people = current
          ? get().people.map((person) => (person.id === id ? next : person))
          : [next, ...get().people];
        const loads = { ...get().loads };
        if ((next.kind === "presale" || next.access.includes("vender")) && !loads[id]) loads[id] = morningLoad();
        const puesto =
          next.kind === "driver"
            ? "reparto"
            : next.kind === "presale"
              ? "preventa"
              : next.kind === "manager"
                ? "gerente"
                : next.kind === "warehouse"
                  ? "almacén"
                  : "dueño";
        set({
          people,
          loads,
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "personal",
            title: current ? `Actualizó a ${name}` : `Agregó a ${name}`,
            detail: `${puesto}${next.routeName ? ` · ${next.routeName}` : ""}`,
            place: "Oficina",
            ref: id,
          }),
        });
        return id;
      },
      removePerson: (id) => {
        const person = get().people.find((item) => item.id === id);
        if (!person || person.seeded) return;
        set({
          people: get().people.filter((item) => item.id !== id),
          actingId: get().actingId === id ? null : get().actingId,
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "personal",
            title: `Quitó a ${person.name}`,
            detail: person.routeName || "Personal",
            place: "Oficina",
            ref: id,
          }),
        });
      },
      setActing: (id) => {
        if (!id) {
          set(alignOperator(get(), { actingId: null, role: "owner" }));
          return;
        }
        const person = get().people.find((item) => item.id === id);
        if (!person) return;
        const loads = { ...get().loads };
        if (person.kind === "presale" && !loads[person.id]) loads[person.id] = morningLoad();
        set(alignOperator(get(), { actingId: id, role: person.kind, loads }));
      },
      addProduct: (input) => {
        if (get().role !== "owner") return { ok: false, error: "Solo el dueño puede registrar productos." };
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Escribe el nombre." };
        const price = Math.round(input.price);
        const cost = Math.round(input.cost);
        const qty = Math.round(input.qty);
        if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "El precio tiene que ser mayor a cero." };
        if (!Number.isFinite(cost) || cost < 0) return { ok: false, error: "Escribe el costo. Puede ser cero." };
        if (!Number.isFinite(qty) || qty < 0) return { ok: false, error: "La cantidad no puede ser negativa." };
        const image = input.image?.startsWith("data:image/") ? input.image : "";
        if (image.length > 1_400_000) return { ok: false, error: "La imagen salió muy pesada. Elige otra." };
        const description = (input.description ?? "").trim().slice(0, 280);
        const id = uid("sku").toLowerCase();
        const product: Product = {
          id,
          sku: `ALT-${String(get().catalog.length + 1).padStart(2, "0")}`,
          name,
          category: input.category.trim() || "General",
          price,
          cost,
          minQty: 8,
          unit: input.unit.trim() || "pza",
          image,
          description,
        };
        const loads = { ...get().loads };
        const sellers = get().people.filter((person) => person.kind === "presale" || person.access.includes("vender"));
        const targets = sellers.length > 0 ? sellers : PREVENTAS;
        for (const seller of targets) {
          const current = loads[seller.id] ?? morningLoad();
          loads[seller.id] = { ...current, [id]: qty };
        }
        set({
          catalog: [product, ...get().catalog],
          loads,
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "producto",
            title: `Registró ${name}`,
            detail: `${product.sku} · precio ${money(price)} · costo ${money(cost)} · ${qty} piezas${description ? ` · ${description}` : ""}`,
            place: "Oficina",
            ref: id,
          }),
        });
        return { ok: true };
      },
      setProductDescription: (productId, description) => {
        if (get().role !== "owner") return;
        const text = description.trim().slice(0, 280);
        const product = get().catalog.find((item) => item.id === productId);
        if (!product || (product.description ?? "") === text) return;
        set({
          catalog: get().catalog.map((item) => (item.id === productId ? { ...item, description: text } : item)),
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "producto",
            title: `Describió ${product.name}`,
            detail: text || "Sin descripción",
            place: "Oficina",
            ref: productId,
          }),
        });
      },
      refillProduct: (productId, qty) => {
        if (get().role !== "owner") return { ok: false, error: "Solo el dueño puede rellenar." };
        const product = get().catalog.find((item) => item.id === productId);
        const amount = Math.round(qty);
        if (!product) return { ok: false, error: "Ese producto no está." };
        if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "La cantidad tiene que ser mayor a cero." };
        const sellers = get().people.filter((person) => person.kind === "presale" || person.access.includes("vender"));
        const loads = { ...get().loads };
        const warehouse = { ...(get().warehouse ?? {}) };
        if (sellers.length === 0) {
          warehouse[productId] = (warehouse[productId] ?? 0) + amount;
        } else {
          for (const seller of sellers) {
            const current = loads[seller.id] ?? {};
            loads[seller.id] = { ...current, [productId]: (current[productId] ?? 0) + amount };
          }
        }
        const where = sellers.length === 0 ? "almacén" : sellers.length === 1 ? sellers[0].name : `${sellers.length} rutas`;
        set({
          loads,
          warehouse,
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "carga",
            title: `Rellenó ${product.name}`,
            detail: `+${amount} para ${where}.`,
            place: "Todas las rutas",
            ref: productId,
          }),
        });
        return { ok: true };
      },
      openInventory: (note) => {
        if (get().role !== "owner") return { ok: false, error: "Solo el dueño pide el inventario." };
        if ((get().inventoryRounds ?? []).some((round) => !round.closedAt)) {
          return { ok: false, error: "Ya hay un inventario abierto." };
        }
        const round: InventoryRound = {
          id: uid("INV"),
          openedAt: new Date().toISOString(),
          closedAt: null,
          note: note.trim().slice(0, 120),
        };
        set({
          inventoryRounds: [round, ...(get().inventoryRounds ?? [])].slice(0, 40),
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "inventario",
            title: "Pidió inventario",
            detail: round.note || "Conteo de bodega",
            place: "Almacén",
            ref: round.id,
          }),
        });
        return { ok: true };
      },
      closeInventory: () => {
        if (get().role !== "owner") return;
        const open = (get().inventoryRounds ?? []).find((round) => !round.closedAt);
        if (!open) return;
        const at = new Date().toISOString();
        set({
          inventoryRounds: (get().inventoryRounds ?? []).map((round) => (round.id === open.id ? { ...round, closedAt: at } : round)),
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "inventario",
            title: "Cerró el inventario",
            detail: open.note || "Conteo de bodega",
            place: "Almacén",
            ref: open.id,
          }),
        });
      },
      setInventoryQty: (productId, qty) => {
        const role = get().role;
        if (role !== "warehouse" && role !== "owner") return { ok: false, error: "Solo almacén actualiza el conteo." };
        const open = (get().inventoryRounds ?? []).find((round) => !round.closedAt);
        if (!open) return { ok: false, error: "El dueño todavía no pide el inventario." };
        const product = get().catalog.find((item) => item.id === productId);
        const amount = Math.round(qty);
        if (!product) return { ok: false, error: "Ese producto no está." };
        if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "La cantidad no puede ser negativa." };
        const who = sessionPerson(role);
        const personId = get().sessionPersonId || who.id;
        const line: InventoryLine = {
          id: uid("C"),
          roundId: open.id,
          at: new Date().toISOString(),
          productId,
          qty: amount,
          personId,
        };
        set({
          warehouse: { ...(get().warehouse ?? {}), [productId]: amount },
          inventoryLines: [line, ...(get().inventoryLines ?? [])].slice(0, 400),
          journal: journalAfter(get(), {
            personId,
            kind: "inventario",
            title: `Contó ${product.name}`,
            detail: `${amount} ${product.unit || "pzas"}`,
            place: "Almacén",
            ref: line.id,
          }),
        });
        return { ok: true };
      },
      pinClient: (clientId, lat, lng) => {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const client = get().clients.find((item) => item.id === clientId);
        if (!client || client.fix) return;
        set({
          clients: get().clients.map((item) => (item.id === clientId ? { ...item, mapPin: { lat, lng } } : item)),
        });
      },
      blankData: () => {
        const kept = get();
        set({
          ...blankBooks(),
          cart: [],
          activeClientId: null,
          areas: [],
          mapFocusId: null,
          actingId: kept.role === "presale" ? ACTIVE_SELLER_ID : kept.role === "driver" ? ACTIVE_DRIVER_ID : null,
        });
      },
      setLead: (personId, leadId) => {
        if (get().role !== "owner") return;
        const person = get().people.find((item) => item.id === personId && (item.kind === "presale" || item.kind === "driver"));
        if (!person) return;
        const lead = leadId ? get().people.find((item) => item.id === leadId && item.kind === "manager") : null;
        if (leadId && !lead) return;
        set({
          people: get().people.map((item) => (item.id === person.id ? { ...item, leadId: lead?.id ?? null } : item)),
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "personal",
            title: lead ? `Dejó a ${person.name} con ${lead.name}` : `Quitó a ${person.name} del gerente`,
            detail: person.routeName || person.name,
            place: "Oficina",
            ref: person.id,
          }),
        });
      },
      setProductPrice: (productId, price) => {
        if (get().role !== "owner") return;
        const value = Math.round(price);
        if (!Number.isFinite(value) || value <= 0) return;
        const product = get().catalog.find((item) => item.id === productId);
        if (!product || product.price === value) return;
        set({
          catalog: get().catalog.map((item) => (item.id === productId ? { ...item, price: value } : item)),
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "producto",
            title: `Anotó el precio de ${product.name}`,
            detail: money(value),
            place: "Oficina",
            ref: productId,
          }),
        });
      },
      setProductCost: (productId, cost) => {
        if (get().role !== "owner") return;
        const value = Math.round(cost);
        if (!Number.isFinite(value) || value < 0) return;
        const product = get().catalog.find((item) => item.id === productId);
        if (!product || product.cost === value) return;
        set({
          catalog: get().catalog.map((item) => (item.id === productId ? { ...item, cost: value } : item)),
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "producto",
            title: `Anotó el costo de ${product.name}`,
            detail: `${money(value)} · ganancia ${money(product.price - value)} por pieza`,
            place: "Oficina",
            ref: productId,
          }),
        });
      },
      recordLocation: (fix) => {
        const personId = fieldPersonId(get().role);
        if (!personId || get().unitConsent?.[personId] !== "granted") return;
        if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return;
        if (Math.abs(fix.lat) > 90 || Math.abs(fix.lng) > 180) return;
        const prev = get().locations[personId] ?? [];
        const point: DriverFix = {
          at: fix.at || new Date().toISOString(),
          lat: fix.lat,
          lng: fix.lng,
          accuracy: Number.isFinite(fix.accuracy) ? fix.accuracy : null,
        };
        const latest = prev[0];
        const duplicate = latest != null && Date.now() - Date.parse(latest.at) < 2000;
        const trail = (duplicate ? [point, ...prev.slice(1)] : [point, ...prev]).slice(0, 48);
        set({
          locations: { ...get().locations, [personId]: trail },
          orders: withSellerFix(get().orders, personId, point),
          locateStatus: "saved",
          locateMessage: "",
          journal: stampJournal(get().journal, personId, point),
        });
      },
      setLocate: (locateStatus, locateMessage) => set({ locateStatus, locateMessage }),
      markNoticesRead: () => set({ notices: get().notices.map((notice) => ({ ...notice, read: true })) }),
      markStockSeen: () => {
        const role = get().role;
        set({
          stockNotices: (get().stockNotices ?? []).map((notice) =>
            notice.seen.includes(role) ? notice : { ...notice, seen: [...notice.seen, role] },
          ),
        });
      },
      setProductView: (productView) => set({ productView }),
      setLocationConsent: (locationConsent) => {
        const personId = fieldPersonId(get().role);
        if (!personId) return;
        set({ locationConsent, unitConsent: { ...(get().unitConsent ?? {}), [personId]: locationConsent } });
      },
      setDaySpend: (amount, note) => {
        if (get().role !== "owner") return;
        const value = Math.round(amount);
        if (!Number.isFinite(value) || value < 0) return;
        const noteText = note.trim().slice(0, 80);
        set({
          daySpend: { day: todayKey(), amount: value, note: noteText },
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "gasto",
            title: `Anotó un gasto de ${money(value)}`,
            detail: noteText || "Gasto del día",
            place: "Oficina",
            ref: todayKey(),
          }),
        });
      },
      registerClient: (input) => {
        const storeName = input.store.trim();
        const contact = input.contact.trim();
        const address = input.address.trim();
        const zone = input.zone.trim();
        const phone = input.phone.trim();
        if (!storeName || !contact || !address || !zone || !phone) {
          return { ok: false, error: "Completa los datos de la tienda." };
        }
        if (phone.replace(/\D/g, "").length < 10) return { ok: false, error: "El teléfono necesita 10 dígitos." };
        if (input.facade.length !== 2 || input.facade.some((photo) => !photo.startsWith("data:image/"))) {
          return { ok: false, error: "Toma las dos fotos de la fachada." };
        }
        if (input.facade[0].length + input.facade[1].length > 1_400_000) {
          return { ok: false, error: "Las fotos salieron muy pesadas. Tómalas de nuevo." };
        }
        const lat = input.fix?.lat ?? input.mapPin?.lat;
        const lng = input.fix?.lng ?? input.mapPin?.lng;
        if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          return { ok: false, error: "No se pudo ubicar la tienda." };
        }
        const sellerId = get().role === "presale" ? operatingSellerId(get()) : input.sellerId;
        const seller = get().people.find((person) => person.id === sellerId && person.kind === "presale");
        if (!seller) return { ok: false, error: "Elige la preventa de esta tienda." };
        const driverPick = get().role === "driver" ? operatingDriverId(get()) : input.driverId;
        const driver = get().people.find((person) => person.id === driverPick && person.kind === "driver");
        if (!driver) return { ok: false, error: "Elige el reparto." };
        const client: ClientStop = {
          id: uid("cli").toLowerCase(),
          sellerId: seller.id,
          driverId: driver.id,
          store: storeName,
          contact,
          address,
          zone,
          phone,
          facade: [input.facade[0], input.facade[1]],
          ...(input.fix
            ? {
                fix: {
                  lat,
                  lng,
                  accuracy: input.fix.accuracy != null && Number.isFinite(input.fix.accuracy) ? input.fix.accuracy : null,
                  at: input.fix.at || new Date().toISOString(),
                },
              }
            : { mapPin: { lat, lng } }),
        };
        const atDoor = Boolean(input.fix);
        set({
          clients: [client, ...get().clients],
          mapFocusId: client.id,
          journal: journalAfter(get(), {
            kind: "tienda",
            title: `Registró ${storeName}`,
            detail: atDoor ? "En la puerta, con el GPS del teléfono." : "Quedó el punto de la dirección.",
            place: storeName,
            lat,
            lng,
            ref: client.id,
          }),
        });
        askWhere();
        return { ok: true, id: client.id };
      },
      saveWorkArea: (input) => {
        if (get().role !== "owner") return { ok: false, error: "Solo el dueño puede crear zonas o rutas." };
        const name = input.name.trim().slice(0, 40);
        if (!name) return { ok: false, error: "Escribe el nombre." };
        const kind = input.kind === "ruta" ? "ruta" : "zona";
        const points = input.points
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180)
          .slice(0, 40);
        if (kind === "zona" && points.length < 3) return { ok: false, error: "Una zona necesita al menos tres puntos en el mapa." };
        if (kind === "ruta" && points.length < 2) return { ok: false, error: "Una ruta necesita al menos dos puntos en el mapa." };
        if (get().areas.length >= 24) return { ok: false, error: "Ya hay 24. Quita una para agregar otra." };
        const personId = input.personId && get().people.some((person) => person.id === input.personId) ? input.personId : null;
        const area: WorkArea = { id: uid("area").toLowerCase(), name, kind, points, personId };
        const mid = points[Math.floor(points.length / 2)];
        const assignee = personId ? get().people.find((person) => person.id === personId)?.name : "";
        set({
          areas: [area, ...get().areas],
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "zona",
            title: kind === "zona" ? `Creó la zona ${name}` : `Creó la ruta ${name}`,
            detail: assignee ? `Asignada a ${assignee}` : "Sin asignar",
            place: name,
            lat: mid?.lat,
            lng: mid?.lng,
            ref: area.id,
          }),
        });
        return { ok: true, id: area.id };
      },
      updateWorkArea: (id, input) => {
        if (get().role !== "owner") return { ok: false, error: "Solo el dueño puede editar zonas o rutas." };
        const current = get().areas.find((area) => area.id === id);
        if (!current) return { ok: false, error: "Esa zona ya no está." };
        const name = input.name.trim().slice(0, 40);
        if (!name) return { ok: false, error: "Escribe el nombre." };
        const kind = input.kind === "ruta" || input.kind === "zona" ? input.kind : current.kind;
        const raw = input.points ?? current.points;
        const points = raw
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180)
          .slice(0, 40);
        if (kind === "zona" && points.length < 3) return { ok: false, error: "Una zona necesita al menos tres puntos en el mapa." };
        if (kind === "ruta" && points.length < 2) return { ok: false, error: "Una ruta necesita al menos dos puntos en el mapa." };
        const personId = input.personId && get().people.some((person) => person.id === input.personId && person.kind !== "owner") ? input.personId : null;
        const nextColor = input.color === undefined ? current.color : input.color && /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color.toLowerCase() : undefined;
        const area: WorkArea = { ...current, name, kind, points, personId };
        if (nextColor) area.color = nextColor;
        else delete area.color;
        const pointsSame =
          current.points.length === points.length &&
          current.points.every((point, index) => point.lat === points[index]?.lat && point.lng === points[index]?.lng);
        const onlyColor =
          current.name === name &&
          current.kind === kind &&
          (current.personId ?? null) === personId &&
          pointsSame &&
          (current.color ?? null) !== (area.color ?? null);
        const assignee = personId ? get().people.find((person) => person.id === personId)?.name : "";
        set({
          areas: get().areas.map((item) => (item.id === id ? area : item)),
          journal: onlyColor
            ? get().journal
            : journalAfter(get(), {
                personId: "dueno",
                kind: kind === "zona" ? "zona" : "ruta",
                title: kind === "zona" ? `Editó la zona ${name}` : `Editó la ruta ${name}`,
                detail: assignee ? `Asignada a ${assignee}` : "Sin asignar",
                place: name,
                ref: id,
              }),
        });
        return { ok: true };
      },
      assignClientToArea: (areaId, clientId) => {
        if (get().role !== "owner") return;
        const area = get().areas.find((item) => item.id === areaId);
        const client = get().clients.find((item) => item.id === clientId);
        if (!area || !client) return;
        const person = area.personId ? get().people.find((item) => item.id === area.personId) : undefined;
        const next: ClientStop = { ...client, areaId: area.id };
        if (person?.kind === "presale") next.sellerId = person.id;
        if (person?.kind === "driver") next.driverId = person.id;
        set({
          clients: get().clients.map((item) => (item.id === client.id ? next : item)),
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: area.kind === "zona" ? "zona" : "ruta",
            title: `Sumó ${client.store} a ${area.name}`,
            detail: person ? `Quedó con ${person.name}` : "Sin asignar a una persona",
            place: client.store,
            ref: client.id,
          }),
        });
      },
      clearClientArea: (clientId) => {
        if (get().role !== "owner") return;
        const client = get().clients.find((item) => item.id === clientId);
        if (!client?.areaId) return;
        set({
          clients: get().clients.map((item) => (item.id === clientId ? { ...item, areaId: undefined } : item)),
        });
      },
      removeWorkArea: (id) => {
        if (get().role !== "owner") return;
        const area = get().areas.find((item) => item.id === id);
        set({
          areas: get().areas.filter((item) => item.id !== id),
          journal: area
            ? journalAfter(get(), {
                personId: "dueno",
                kind: "zona",
                title: area.kind === "zona" ? `Quitó la zona ${area.name}` : `Quitó la ruta ${area.name}`,
                detail: "Dejó de verse en el mapa",
                place: area.name,
                ref: area.id,
              })
            : get().journal,
        });
      },
      setDispatch: (mode, driverId) => {
        if (get().role !== "owner") return;
        if (mode === "asignar") {
          set({ dispatchMode: "asignar" });
          return;
        }
        const drivers = get().people.filter((person) => person.kind === "driver");
        const chosen = drivers.find((person) => person.id === driverId) ?? drivers[0];
        if (!chosen) {
          set({ dispatchMode: "solo", soloDriverId: null });
          return;
        }
        const orders = get().orders.map((order) =>
          isToday(order.createdAt) && order.delivery === "pending" ? { ...order, driverId: chosen.id } : order,
        );
        set({ dispatchMode: "solo", soloDriverId: chosen.id, orders });
      },
      assignDriver: (orderId, driverId) => {
        if (get().role !== "owner") return;
        if (driverId && !get().people.some((person) => person.id === driverId && person.kind === "driver")) return;
        set({
          orders: get().orders.map((order) =>
            order.id === orderId && order.delivery === "pending" ? { ...order, driverId } : order,
          ),
        });
      },
      setDesk: (input) => {
        if (get().role !== "owner") return;
        const patch: Partial<Slice> = {};
        if (input.pingMinutes != null) {
          const minutes = Math.round(Number(input.pingMinutes));
          patch.pingMinutes = Number.isFinite(minutes) ? Math.min(30, Math.max(3, minutes)) : 9;
        }
        if (typeof input.companyName === "string") {
          const name = input.companyName.trim().slice(0, 40);
          patch.companyName = name || "Medicalabs";
        }
        if (Object.keys(patch).length > 0) set(patch);
      },
      setWeekDriver: (week, clientId, driverId) => {
        if (get().role !== "owner") return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return;
        const client = get().clients.find((item) => item.id === clientId);
        const driver = get().people.find((person) => person.id === driverId && person.kind === "driver");
        if (!client || !driver) return;
        const current = materializeWeek(week, get().clients, get().weekPlans ?? []);
        if (current.find((row) => row.clientId === clientId)?.driverId === driver.id && (get().weekPlans ?? []).some((row) => row.week === week)) return;
        const next = current.map((row) => (row.clientId === clientId ? { ...row, driverId: driver.id } : row));
        if (!next.some((row) => row.clientId === clientId)) next.push({ week, clientId, driverId: driver.id });
        set({
          weekPlans: replaceWeek(get().weekPlans ?? [], week, next),
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "ruta",
            title: `Asignó ${client.store} a ${driver.name}`,
            detail: `Semana ${weekSpan(week)}`,
            place: client.store,
            ref: `${week}:${clientId}`,
          }),
        });
      },
      assignWeekZone: (week, zone, driverId) => {
        if (get().role !== "owner") return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return;
        const driver = get().people.find((person) => person.id === driverId && person.kind === "driver");
        const name = zone.trim();
        if (!driver || !name) return;
        const current = materializeWeek(week, get().clients, get().weekPlans ?? []);
        let moved = 0;
        const next = current.map((row) => {
          const client = get().clients.find((item) => item.id === row.clientId);
          if (!client || client.zone !== name || row.driverId === driver.id) return row;
          moved += 1;
          return { ...row, driverId: driver.id };
        });
        if (moved === 0) return;
        set({
          weekPlans: replaceWeek(get().weekPlans ?? [], week, next),
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "ruta",
            title: `Pasó ${name} a ${driver.name}`,
            detail: `${moved} ${moved === 1 ? "tienda" : "tiendas"} · semana ${weekSpan(week)}`,
            place: name,
            ref: `${week}:${name}`,
          }),
        });
      },
      clearWeekPlan: (week) => {
        if (get().role !== "owner") return;
        if (!(get().weekPlans ?? []).some((row) => row.week === week)) return;
        set({
          weekPlans: (get().weekPlans ?? []).filter((row) => row.week !== week),
          journal: journalAfter(get(), {
            personId: "dueno",
            kind: "ruta",
            title: "Volvió la semana a la ruta fija",
            detail: weekSpan(week),
            place: "Rutas",
            ref: week,
          }),
        });
      },
    }),
    {
      name: "medicalabs-v1",
      version: 19,
      skipHydration: true,
      migrate: (persisted, version) => {
        const state = persisted as Slice;
        let next: Slice =
          version < 2
            ? {
                ...state,
                people: state.people?.length ? state.people : SEED_CREW.map((person) => ({ ...person, access: [...person.access] })),
                actingId: state.actingId ?? null,
              }
            : state;
        if (version < 3 || !next.catalog?.length) {
          next = { ...next, catalog: PRODUCTS.map((product) => ({ ...product })) };
        }
        if (version < 4) {
          let actingId = next.actingId ?? null;
          if (next.role === "presale" && !actingId) actingId = ACTIVE_SELLER_ID;
          if (next.role === "driver" && !actingId) actingId = ACTIVE_DRIVER_ID;
          const loads = { ...(next.loads ?? {}) };
          for (const person of next.people ?? []) {
            if (person.kind === "presale" && !loads[person.id]) loads[person.id] = morningLoad();
          }
          next = { ...next, actingId, loads };
        }
        if (version < 5) {
          next = { ...next, locations: next.locations ?? {} };
        }
        if (version < 6) {
          next = { ...next, notices: next.notices ?? [] };
        }
        if (version < 7) {
          next = { ...next, locationConsent: next.locationConsent ?? "unknown" };
        }
        if (version < 8) {
          next = {
            ...next,
            catalog: (next.catalog ?? PRODUCTS).map((product) => {
              const seed = PRODUCTS.find((item) => item.id === product.id);
              return {
                ...product,
                cost: Number.isFinite(product.cost) ? product.cost : (seed?.cost ?? Math.round(product.price * 0.6)),
                minQty: Number.isFinite(product.minQty) ? product.minQty : (seed?.minQty ?? 8),
              };
            }),
            daySpend: next.daySpend ?? { day: "", amount: 0, note: "" },
          };
        }
        if (version < 9) {
          const pins = new Map(CLIENTS.filter((client) => client.mapPin).map((client) => [client.id, client.mapPin!]));
          const current = next.clients ?? [];
          const have = new Set(current.map((client) => client.id));
          const clients = current.map((client) => {
            if (client.fix || client.mapPin) return client;
            const pin = pins.get(client.id);
            return pin ? { ...client, mapPin: { lat: pin.lat, lng: pin.lng } } : client;
          });
          for (const client of CLIENTS) {
            if (!have.has(client.id)) clients.push({ ...client });
          }
          next = {
            ...next,
            accountEmail: null,
            locationConsent: next.locationConsent ?? "unknown",
            clients,
          };
        }
        if (version < 15) {
          const current = next.catalog ?? [];
          const have = new Set(current.map((product) => product.id));
          const added = PRODUCTS.filter((product) => !have.has(product.id)).map((product) => ({ ...product }));
          next = { ...next, catalog: [...current, ...added] };
        }
        next = { ...next, areas: cleanAreas(next.areas) };
        const unitConsent = cleanConsent(next.unitConsent);
        if (version < 11) {
          const carried = next.locationConsent === "granted" || next.locationConsent === "denied" ? next.locationConsent : null;
          if (carried && !unitConsent[ACTIVE_DRIVER_ID]) unitConsent[ACTIVE_DRIVER_ID] = carried;
        }
        const activeId = next.role === "driver" ? ACTIVE_DRIVER_ID : next.role === "presale" ? ACTIVE_SELLER_ID : null;
        const kept = cleanJournal(next.journal);
        next = {
          ...next,
          unitConsent,
          locationConsent: activeId ? (unitConsent[activeId] ?? "unknown") : "unknown",
          stockNotices: cleanStock(next.stockNotices),
          productView: cleanView(next.productView),
          journal: version < 13 && kept.length === 0 ? visitsToJournal(next.visits ?? [], next.clients ?? []) : kept,
          weekPlans: cleanWeeks(next.weekPlans),
        };
        if (version < 16) {
          next = {
            ...next,
            dispatchMode: next.dispatchMode === "solo" ? "solo" : "asignar",
            soloDriverId: next.soloDriverId ?? null,
            notices: (next.notices ?? []).map((notice) => ({ ...notice, kind: notice.kind ?? "entrega" })),
          };
        }
        if (version < 18) {
          const people = [...(next.people ?? [])];
          if (!people.some((person) => person.id === MANAGER_ID)) {
            const seed = SEED_CREW.find((person) => person.id === MANAGER_ID);
            if (seed) people.push({ ...seed, access: [...seed.access], leadId: null });
          }
          next = {
            ...next,
            people: people.map((person) => ({ ...person, leadId: person.leadId ?? null })),
          };
        }
        if (version < 19) {
          const people = [...(next.people ?? [])];
          if (!people.some((person) => person.kind === "warehouse")) {
            const seed = SEED_CREW.find((person) => person.id === WAREHOUSE_ID);
            if (seed) people.push({ ...seed, access: [...seed.access], leadId: null });
          }
          next = {
            ...next,
            ...blankBooks(),
            people,
            areas: [],
            catalog: (next.catalog ?? []).map((product) => ({ ...product, description: product.description ?? "" })),
            sessionPersonId: null,
          };
        }
        next = {
          ...next,
          warehouse: next.warehouse ?? {},
          inventoryRounds: Array.isArray(next.inventoryRounds) ? next.inventoryRounds : [],
          inventoryLines: Array.isArray(next.inventoryLines) ? next.inventoryLines : [],
          sessionPersonId: next.sessionPersonId ?? null,
          catalog: (next.catalog ?? []).map((product) => ({ ...product, description: product.description ?? "" })),
        };
        next = {
          ...next,
          sessions: cleanSessions(next.sessions),
          shifts: cleanShifts(next.shifts),
          bulletins: cleanBulletins(next.bulletins),
          nameStyle: next.nameStyle === "corto" ? "corto" : "completo",
          stockScope: next.stockScope === "disponibles" ? "disponibles" : "todos",
          uiScale: next.uiScale === "compacta" || next.uiScale === "grande" ? next.uiScale : "normal",
          zoneSight: cleanSight(next.zoneSight),
          idleByPerson: cleanIdle(next.idleByPerson),
        };
        return next;
      },
      partialize: (state) => ({
        role: state.role,
        accountEmail: state.accountEmail,
        visits: state.visits,
        orders: state.orders,
        loads: state.loads,
        cart: state.cart,
        favorites: state.favorites,
        qtyStep: state.qtyStep,
        activeClientId: state.activeClientId,
        people: state.people,
        actingId: state.actingId,
        catalog: state.catalog,
        locations: state.locations,
        notices: state.notices,
        stockNotices: state.stockNotices,
        productView: state.productView,
        locationConsent: state.locationConsent,
        unitConsent: state.unitConsent,
        daySpend: state.daySpend,
        clients: state.clients,
        areas: state.areas,
        journal: state.journal,
        weekPlans: state.weekPlans,
        dispatchMode: state.dispatchMode,
        soloDriverId: state.soloDriverId,
        pingMinutes: state.pingMinutes,
        companyName: state.companyName,
        sessions: state.sessions,
        shifts: state.shifts,
        bulletins: state.bulletins,
        nameStyle: state.nameStyle,
        stockScope: state.stockScope,
        uiScale: state.uiScale,
        zoneSight: state.zoneSight,
        idleByPerson: state.idleByPerson,
        sessionPersonId: state.sessionPersonId,
        warehouse: state.warehouse,
        inventoryRounds: state.inventoryRounds,
        inventoryLines: state.inventoryLines,
      }),
    },
  ),
);

export function useHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.resolve(useMed.persist.rehydrate()).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}
