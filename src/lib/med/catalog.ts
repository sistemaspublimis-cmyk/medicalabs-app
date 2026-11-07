import { SHELF } from "@/lib/med/shelf";

export type Staff = {
  id: string;
  name: string;
  routeName: string;
  vehicle: string;
  initials: string;
  kind: "presale" | "driver";
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  /** Costo de compra por pieza, para el estado de resultados. */
  cost: number;
  /** Aviso cuando a bordo queda esta cantidad o menos. */
  minQty: number;
  unit: string;
  image: string;
  /** Texto del dueño. Quien vende lo ve; solo el dueño lo cambia. */
  description?: string;
};

export type StoreFix = {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: string;
};

export type ClientStop = {
  id: string;
  sellerId: string;
  driverId: string;
  store: string;
  contact: string;
  address: string;
  zone: string;
  phone: string;
  /** Dos fotos de la fachada, tomadas al dar de alta la tienda. */
  facade?: [string, string];
  /** Ubicación del teléfono en el momento de guardar. */
  fix?: StoreFix;
  /** Punto de referencia de la ruta. No es una lectura de GPS. */
  mapPin?: { lat: number; lng: number };
  /** Zona o ruta dibujada a la que el dueño sumó esta tienda. */
  areaId?: string;
};

export function clientMapPoint(client: ClientStop): { lat: number; lng: number; kind: "gps" | "ruta" } | null {
  if (client.fix && Number.isFinite(client.fix.lat) && Number.isFinite(client.fix.lng)) {
    return { lat: client.fix.lat, lng: client.fix.lng, kind: "gps" };
  }
  const pin = client.mapPin;
  if (pin && Number.isFinite(pin.lat) && Number.isFinite(pin.lng)) {
    return { lat: pin.lat, lng: pin.lng, kind: "ruta" };
  }
  return null;
}

export type WorkspaceRole = "owner" | "manager" | "presale" | "driver" | "warehouse";

export type AccessId =
  | "tablero"
  | "vender"
  | "entregar"
  | "pedidos"
  | "personal"
  | "productos"
  | "catalogo"
  | "clientes"
  | "transacciones"
  | "finanzas"
  | "inventario";

export const ACCESS_PRESETS: Record<WorkspaceRole, AccessId[]> = {
  owner: ["tablero", "pedidos", "personal", "productos", "clientes", "finanzas", "inventario"],
  manager: ["tablero", "pedidos", "productos", "clientes", "finanzas", "inventario"],
  presale: ["vender", "pedidos", "productos", "catalogo", "clientes", "transacciones", "finanzas"],
  driver: ["entregar", "pedidos", "catalogo", "clientes", "transacciones"],
  warehouse: ["inventario", "productos", "pedidos"],
};

export const ACCESS: { id: AccessId; label: string; roles: WorkspaceRole[] }[] = [
  { id: "tablero", label: "Tablero", roles: ["owner", "manager"] },
  { id: "vender", label: "Vender", roles: ["presale", "driver"] },
  { id: "entregar", label: "Entregar", roles: ["driver", "presale"] },
  { id: "pedidos", label: "Pedidos", roles: ["owner", "manager", "presale", "driver", "warehouse"] },
  { id: "personal", label: "Personal", roles: ["owner"] },
  { id: "productos", label: "Productos", roles: ["owner", "manager", "presale", "warehouse"] },
  { id: "catalogo", label: "Catálogo", roles: ["presale", "driver"] },
  { id: "clientes", label: "Clientes", roles: ["owner", "manager", "presale", "driver"] },
  { id: "transacciones", label: "Transacciones", roles: ["presale", "driver"] },
  { id: "finanzas", label: "Finanzas", roles: ["owner", "manager", "presale"] },
  { id: "inventario", label: "Inventario", roles: ["owner", "manager", "warehouse"] },
];

export type CrewMember = {
  id: string;
  name: string;
  phone: string;
  routeName: string;
  kind: WorkspaceRole;
  access: AccessId[];
  seeded: boolean;
  /** Gerente que ve a esta persona. Solo el dueño lo asigna. */
  leadId?: string | null;
  /** Correo para entrar. Lo pone el dueño al dar de alta. */
  email?: string;
  /** Contraseña de esa cuenta, en este teléfono. */
  password?: string;
};

export const SEED_CREW: CrewMember[] = [
  { id: "ana", name: "Ana Ríos", phone: "55 1200 1842", routeName: "Prev Coacalco", kind: "presale", access: [...ACCESS_PRESETS.presale], seeded: true },
  { id: "luis", name: "Luis Ortega", phone: "55 1200 2201", routeName: "Prev Tultitlán", kind: "presale", access: [...ACCESS_PRESETS.presale], seeded: true },
  { id: "marta", name: "Marta Salas", phone: "55 1200 1766", routeName: "Reparto norte", kind: "driver", access: [...ACCESS_PRESETS.driver], seeded: true },
  { id: "hugo", name: "Hugo Peña", phone: "55 1200 3090", routeName: "Reparto sur", kind: "driver", access: [...ACCESS_PRESETS.driver], seeded: true },
  { id: "gerente", name: "Gerente", phone: "55 1200 4400", routeName: "Oficina", kind: "manager", access: [...ACCESS_PRESETS.manager], seeded: true, leadId: null },
  {
    id: "almacen",
    name: "Almacén",
    phone: "55 1200 5500",
    routeName: "Bodega",
    kind: "warehouse",
    access: [...ACCESS_PRESETS.warehouse],
    seeded: true,
    leadId: null,
    email: "almacen@gmail.com",
  },
];

export const COMPANY = "Medicalabs";
export const BRANCH = "Coacalco";

export const ROLE_META: Record<WorkspaceRole, { label: string; hint: string; sub: string }> = {
  owner: { label: "Dueño", hint: "Ventas, equipo y finanzas de la distribuidora", sub: "Dirección" },
  manager: { label: "Gerente", hint: "Ve al equipo que el dueño le asigna. No cambia permisos ni datos.", sub: "Gerencia" },
  presale: { label: "Preventa", hint: "Tomas pedidos en la ruta del día", sub: "Prev Coacalco" },
  driver: { label: "Repartidor", hint: "Entregas los pedidos que ya se capturaron", sub: "Reparto norte" },
  warehouse: { label: "Almacén", hint: "Cuenta el inventario cuando el dueño lo pide", sub: "Bodega" },
};

export const WAREHOUSE_ID = "almacen";

export const MANAGER_ID = "gerente";

export const PREVENTAS: Staff[] = [
  { id: "ana", name: "Ana Ríos", routeName: "Prev Coacalco", vehicle: "NP-1842", initials: "AR", kind: "presale" },
  { id: "luis", name: "Luis Ortega", routeName: "Prev Tultitlán", vehicle: "NP-2201", initials: "LO", kind: "presale" },
];

export const DRIVERS: Staff[] = [
  { id: "marta", name: "Marta Salas", routeName: "Reparto norte", vehicle: "NP-1766", initials: "MS", kind: "driver" },
  { id: "hugo", name: "Hugo Peña", routeName: "Reparto sur", vehicle: "NP-3090", initials: "HP", kind: "driver" },
];

export const STAFF: Staff[] = [...PREVENTAS, ...DRIVERS];
export const ACTIVE_SELLER_ID = "ana";
export const ACTIVE_DRIVER_ID = "marta";

export const PRODUCTS: Product[] = [
  { id: "guantes", sku: "PRO-01", name: "Guantes nitrilo", category: "Protección", price: 186, cost: 112, minQty: 8, unit: "cja 100", image: "/products/guantes.jpg" },
  { id: "cubrebocas", sku: "PRO-02", name: "Cubrebocas quirúrgico", category: "Protección", price: 95, cost: 58, minQty: 8, unit: "cja 50", image: "/products/cubrebocas.jpg" },
  { id: "gel", sku: "ANT-01", name: "Gel antibacterial", category: "Antisepsia", price: 64, cost: 38, minQty: 8, unit: "pza 500 ml", image: "/products/gel.jpg" },
  { id: "alcohol", sku: "ANT-02", name: "Alcohol etílico", category: "Antisepsia", price: 78, cost: 46, minQty: 8, unit: "pza 1 L", image: "/products/alcohol.jpg" },
  { id: "gasas", sku: "CUR-01", name: "Gasas estériles", category: "Curación", price: 42, cost: 24, minQty: 8, unit: "paq 10", image: "/products/gasas.jpg" },
  { id: "suero", sku: "CUR-02", name: "Suero fisiológico", category: "Curación", price: 36, cost: 20, minQty: 8, unit: "pza 500 ml", image: "/products/suero.jpg" },
  { id: "jeringas", sku: "INS-01", name: "Jeringas 10 ml", category: "Insumos", price: 210, cost: 128, minQty: 8, unit: "cja 100", image: "/products/jeringas.jpg" },
  { id: "termometro", sku: "INS-02", name: "Termómetro digital", category: "Insumos", price: 149, cost: 90, minQty: 12, unit: "pza", image: "/products/termometro.jpg" },
  ...SHELF,
];

export const CLIENTS: ClientStop[] = [
  { id: "ana-1", sellerId: "ana", driverId: "marta", store: "Farmacia La Luz", contact: "Rosa Luna", address: "Av. López Portillo 120", zone: "Coacalco Centro", phone: "55 5120 2104", mapPin: { lat: 19.6322, lng: -99.1018 } },
  { id: "ana-2", sellerId: "ana", driverId: "marta", store: "Consultorio Dr. Peña", contact: "José Peña", address: "Villa de las Flores 88", zone: "Villa de las Flores", phone: "55 5344 1190", mapPin: { lat: 19.646, lng: -99.0982 } },
  { id: "ana-3", sellerId: "ana", driverId: "hugo", store: "Laboratorio Clínica Sur", contact: "Irma Solís", address: "San Francisco 15", zone: "San Francisco", phone: "55 5120 7733", mapPin: { lat: 19.6164, lng: -99.1094 } },
  { id: "ana-4", sellerId: "ana", driverId: "hugo", store: "Farmacia Guadalupana", contact: "Pedro Rojas", address: "Bosques del Valle 901", zone: "Bosques", phone: "55 1442 9088", mapPin: { lat: 19.624, lng: -99.0802 } },
  { id: "ana-5", sellerId: "ana", driverId: "marta", store: "Dental Rojas", contact: "Laura Méndez", address: "Potrero 230", zone: "Potrero", phone: "55 5356 4412", mapPin: { lat: 19.6394, lng: -99.1136 } },
  { id: "ana-6", sellerId: "ana", driverId: "hugo", store: "Clínica San Rafael", contact: "Hugo Farías", address: "Santa María 44", zone: "Santa María", phone: "55 1099 3321", mapPin: { lat: 19.6276, lng: -99.0896 } },
  { id: "ana-7", sellerId: "ana", driverId: "marta", store: "Farmacia Morelos", contact: "Celia Garza", address: "Morelos 77", zone: "Coacalco Centro", phone: "55 5221 6509", mapPin: { lat: 19.6356, lng: -99.0954 } },
  { id: "ana-8", sellerId: "ana", driverId: "hugo", store: "Consultorio Dra. Nava", contact: "Tomás Díaz", address: "5 de Mayo 19", zone: "Villa", phone: "55 5340 2281", mapPin: { lat: 19.649, lng: -99.0888 } },
  { id: "luis-1", sellerId: "luis", driverId: "hugo", store: "Farmacia del Parque", contact: "Raúl Nava", address: "Sierra 150", zone: "Tultitlán", phone: "55 1233 4401", mapPin: { lat: 19.6468, lng: -99.1686 } },
  { id: "luis-2", sellerId: "luis", driverId: "hugo", store: "Laboratorio Norte", contact: "Nina García", address: "Juárez 12", zone: "Tultitlán", phone: "55 1551 0092", mapPin: { lat: 19.656, lng: -99.1574 } },
  { id: "luis-3", sellerId: "luis", driverId: "marta", store: "Consultorio Leal", contact: "Sofía Leal", address: "Lincoln 64", zone: "Cuautitlán", phone: "55 8122 0934", mapPin: { lat: 19.6702, lng: -99.181 } },
  { id: "luis-4", sellerId: "luis", driverId: "marta", store: "Farmacia San Mateo", contact: "Elena Paz", address: "Valle 880", zone: "Melchor Ocampo", phone: "55 8338 7710", mapPin: { lat: 19.7054, lng: -99.1466 } },
];

const MORNING_LOAD: Record<string, number> = {
  guantes: 24,
  cubrebocas: 30,
  gel: 40,
  alcohol: 36,
  gasas: 48,
  suero: 40,
  jeringas: 16,
  termometro: 12,
};

export function morningLoad(): Record<string, number> {
  return { ...MORNING_LOAD };
}

export function staffById(id: string): Staff | undefined {
  return STAFF.find((person) => person.id === id);
}

export function clientById(id: string): ClientStop | undefined {
  return CLIENTS.find((client) => client.id === id);
}

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

export function clientsFor(sellerId: string): ClientStop[] {
  return CLIENTS.filter((client) => client.sellerId === sellerId);
}
