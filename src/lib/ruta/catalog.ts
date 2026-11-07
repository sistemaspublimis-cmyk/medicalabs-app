export type Seller = {
  id: string;
  name: string;
  routeName: string;
  vehicle: string;
  initials: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  unit: string;
};

export type ClientStop = {
  id: string;
  sellerId: string;
  store: string;
  contact: string;
  address: string;
  zone: string;
  phone: string;
  lat: number;
  lng: number;
};

export const ACTIVE_SELLER_ID = "ana";

export const SELLERS: Seller[] = [
  { id: "ana", name: "Ana Ríos", routeName: "Centro–Norte", vehicle: "NP-1842", initials: "AR" },
  { id: "luis", name: "Luis Ortega", routeName: "Poniente", vehicle: "NP-2201", initials: "LO" },
  { id: "marta", name: "Marta Salas", routeName: "Sur", vehicle: "NP-1766", initials: "MS" },
];

export const PRODUCTS: Product[] = [
  { id: "agua", sku: "BEB-01", name: "Agua 600 ml", category: "Bebidas", price: 96, unit: "cja 12" },
  { id: "coca", sku: "BEB-02", name: "Refresco 600 ml", category: "Bebidas", price: 168, unit: "cja 12" },
  { id: "leche", sku: "LAC-01", name: "Leche 1 L", category: "Lácteos", price: 24, unit: "pza" },
  { id: "cafe", sku: "ABA-04", name: "Café 400 g", category: "Abarrotes", price: 78, unit: "pza" },
  { id: "galletas", sku: "ABA-01", name: "Galletas María", category: "Abarrotes", price: 42, unit: "kg" },
  { id: "arroz", sku: "ABA-02", name: "Arroz 1 kg", category: "Abarrotes", price: 28, unit: "pza" },
  { id: "frijol", sku: "ABA-03", name: "Frijol 1 kg", category: "Abarrotes", price: 32, unit: "pza" },
  { id: "aceite", sku: "ABA-05", name: "Aceite 900 ml", category: "Abarrotes", price: 36, unit: "pza" },
  { id: "atun", sku: "ABA-06", name: "Atún lata", category: "Abarrotes", price: 312, unit: "cja 24" },
  { id: "detergente", sku: "LIM-01", name: "Detergente 1 kg", category: "Limpieza", price: 38, unit: "pza" },
  { id: "jabon", sku: "LIM-02", name: "Jabón barra", category: "Limpieza", price: 54, unit: "paq 10" },
  { id: "papel", sku: "LIM-03", name: "Papel higiénico", category: "Limpieza", price: 46, unit: "paq 4" },
];

export const CLIENTS: ClientStop[] = [
  { id: "ana-1", sellerId: "ana", store: "Abarrotes Luna", contact: "Rosa Luna", address: "Morelos 412", zone: "Centro", phone: "81 1550 2104", lat: 25.671, lng: -100.309 },
  { id: "ana-2", sellerId: "ana", store: "Mini Super Don Pepe", contact: "José Peña", address: "Hidalgo 88", zone: "Obispado", phone: "81 8344 1190", lat: 25.678, lng: -100.345 },
  { id: "ana-3", sellerId: "ana", store: "Cremería La Vaquita", contact: "Irma Solís", address: "Simón Bolívar 15", zone: "Mitras", phone: "81 8120 7733", lat: 25.695, lng: -100.362 },
  { id: "ana-4", sellerId: "ana", store: "Miscelánea Rojas", contact: "Pedro Rojas", address: "Paseo de los Leones 901", zone: "Cumbres", phone: "81 1442 9088", lat: 25.732, lng: -100.392 },
  { id: "ana-5", sellerId: "ana", store: "Tienda La Esquina", contact: "Laura Méndez", address: "Juárez 230", zone: "San Nicolás", phone: "81 8356 4412", lat: 25.74, lng: -100.288 },
  { id: "ana-6", sellerId: "ana", store: "Depósito El Faro", contact: "Hugo Farías", address: "Raúl Salinas 44", zone: "Escobedo", phone: "81 1099 3321", lat: 25.795, lng: -100.32 },
  { id: "ana-7", sellerId: "ana", store: "Abarrotes Norte", contact: "Celia Garza", address: "Av. Las Puentes 120", zone: "San Nicolás", phone: "81 8221 6509", lat: 25.755, lng: -100.27 },
  { id: "ana-8", sellerId: "ana", store: "Miscelánea 5 de Mayo", contact: "Tomás Díaz", address: "5 de Mayo 77", zone: "Centro", phone: "81 8340 2281", lat: 25.669, lng: -100.316 },
  { id: "luis-1", sellerId: "luis", store: "Depósito Poniente", contact: "Raúl Nava", address: "Gonzalitos 1502", zone: "Mitras", phone: "81 1233 4401", lat: 25.7, lng: -100.37 },
  { id: "luis-2", sellerId: "luis", store: "Abarrotes García", contact: "Nina García", address: "Juárez 12", zone: "García", phone: "81 1551 0092", lat: 25.81, lng: -100.59 },
  { id: "luis-3", sellerId: "luis", store: "Mini Super Santa Catarina", contact: "Omar Cruz", address: "Manuel Ordoñez 300", zone: "Santa Catarina", phone: "81 8672 1145", lat: 25.67, lng: -100.46 },
  { id: "luis-4", sellerId: "luis", store: "Cremería San Pedro", contact: "Elena Paz", address: "Calzada del Valle 880", zone: "San Pedro", phone: "81 8338 7710", lat: 25.66, lng: -100.4 },
  { id: "luis-5", sellerId: "luis", store: "Miscelánea Cumbres", contact: "Iván Torres", address: "Paseo de los Leones 220", zone: "Cumbres", phone: "81 1400 8821", lat: 25.74, lng: -100.4 },
  { id: "luis-6", sellerId: "luis", store: "Tienda Lincoln", contact: "Sofía Leal", address: "Lincoln 640", zone: "Mitras", phone: "81 8122 0934", lat: 25.71, lng: -100.36 },
  { id: "marta-1", sellerId: "marta", store: "Abarrotes del Valle", contact: "Karla Vidal", address: "Constitución 540", zone: "Valle", phone: "81 8345 2208", lat: 25.65, lng: -100.29 },
  { id: "marta-2", sellerId: "marta", store: "Miscelánea Contry", contact: "Diego Sol", address: "Eugenio Garza Sada 2100", zone: "Contry", phone: "81 1355 6712", lat: 25.64, lng: -100.28 },
  { id: "marta-3", sellerId: "marta", store: "Depósito Sur", contact: "Patricia Alanís", address: "Revolución 90", zone: "Sur", phone: "81 8001 4490", lat: 25.63, lng: -100.3 },
  { id: "marta-4", sellerId: "marta", store: "Tienda Linda Vista", contact: "Héctor Ramos", address: "Lázaro Cárdenas 18", zone: "Linda Vista", phone: "81 8129 0033", lat: 25.68, lng: -100.27 },
  { id: "marta-5", sellerId: "marta", store: "Cremería Mederos", contact: "Luz Medina", address: "Mederos 410", zone: "Mederos", phone: "81 1558 7720", lat: 25.61, lng: -100.28 },
];

const MORNING_LOAD: Record<string, number> = {
  agua: 40,
  coca: 30,
  leche: 48,
  cafe: 18,
  galletas: 48,
  arroz: 40,
  frijol: 30,
  aceite: 36,
  atun: 12,
  detergente: 24,
  jabon: 20,
  papel: 24,
};

export function morningLoad(): Record<string, number> {
  return { ...MORNING_LOAD };
}

export function sellerById(id: string): Seller | undefined {
  return SELLERS.find((seller) => seller.id === id);
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
