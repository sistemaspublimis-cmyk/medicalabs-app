import type { Product } from "@/lib/med/catalog";
import { dayFigures, spendForToday, type DaySpend } from "@/lib/med/cierre";
import { driverCompare, driverStatus, productCompare, sellerCompare } from "@/lib/med/report";
import type { JournalEntry, Order, Visit } from "@/lib/med/store";
import { dateFromKey, driverIdFor, onDay, shortDay, weekSpan, mondayOf, type WeekStop } from "@/lib/med/weeks";
import { lineSummary, orderTotals } from "@/lib/ruta/format";

type Person = { id: string; name: string; routeName: string; kind: string };
type Client = { id: string; store: string; zone: string; address: string; driverId: string; sellerId: string };

export type DayReportInput = {
  day: string;
  other: string;
  orders: Order[];
  visits: Visit[];
  people: Person[];
  clients: Client[];
  catalog: Product[];
  journal: JournalEntry[];
  weekPlans: WeekStop[];
  daySpend: DaySpend;
};

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cell(value: string | number): string {
  if (typeof value === "number" && Number.isFinite(value)) return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  return `<Cell><Data ss:Type="String">${xml(String(value))}</Data></Cell>`;
}

function sheet(name: string, rows: (string | number)[][]): string {
  const body = rows
    .map((row) => `<Row>${row.map((value) => cell(value)).join("")}</Row>`)
    .join("");
  return `<Worksheet ss:Name="${xml(name)}"><Table>${body}</Table></Worksheet>`;
}

function personName(people: Person[], id: string): string {
  return people.find((person) => person.id === id)?.name ?? "";
}

export function buildDayWorkbook(input: DayReportInput): string {
  const when = dateFromKey(input.day);
  const expense = input.daySpend.day === input.day ? spendForToday(input.daySpend, when) : 0;
  const figures = dayFigures(input.orders, input.catalog, expense, when);
  const sellers = sellerCompare(input.orders, input.visits, input.people, input.clients, input.day, input.other);
  const drivers = driverCompare(input.orders, input.people, input.day, input.other);
  const products = productCompare(input.orders, input.catalog, input.day, input.other);
  const dayOrders = input.orders.filter((order) => onDay(order.createdAt, input.day));
  const week = mondayOf(when);
  const otherLabel = shortDay(input.other);

  const resumen: (string | number)[][] = [
    ["Medicalabs", "Reporte del día"],
    ["Día", input.day],
    ["Comparado con", input.other],
    ["Semana", weekSpan(week)],
    [],
    ["Concepto", "Valor"],
    ["Pedidos en la venta", figures.orders],
    ["Venta bruta", figures.gross],
    ["Descuentos", figures.discount],
    ["Venta neta", figures.net],
    ["Costo", figures.cost],
    ["Utilidad bruta", figures.grossProfit],
    ["Gastos", figures.expense],
    ["Resultado", figures.result],
    ["Cobrado", figures.collected],
    ["Por cobrar", figures.pendingAmount],
    ["Incidencias", figures.failedAmount],
    ["Piezas", figures.pieces],
    ["Ticket", figures.ticket],
  ];

  const pedidos: (string | number)[][] = [["Pedido", "Hora", "Tienda", "Zona", "Preventa", "Reparto", "Productos", "Total", "Entrega", "Nota"]];
  for (const order of dayOrders) {
    const client = input.clients.find((item) => item.id === order.clientId);
    const totals = orderTotals(order.lines, order.discountPct);
    const entrega = order.delivery === "delivered" ? "Entregado" : order.delivery === "failed" ? "No entregado" : "Pendiente";
    pedidos.push([
      order.id,
      order.createdAt,
      client?.store ?? order.clientId,
      client?.zone ?? "",
      personName(input.people, order.sellerId),
      personName(input.people, order.driverId),
      lineSummary(order.lines, input.catalog),
      order.delivery === "failed" ? 0 : totals.total,
      entrega,
      order.deliveryNote,
    ]);
  }

  const equipo: (string | number)[][] = [["Preventa", "Ruta", "Visitas", "Pedidos", "Venta", `Pedidos ${otherLabel}`, `Venta ${otherLabel}`, "Cambio de venta"]];
  for (const row of sellers) {
    equipo.push([row.name, row.routeName, row.visits, row.orders, row.sales, row.otherOrders, row.otherSales, row.sales - row.otherSales]);
  }

  const productos: (string | number)[][] = [["Producto", "Piezas", "Importe", `Piezas ${otherLabel}`, `Importe ${otherLabel}`, "Cambio de piezas"]];
  for (const row of products) productos.push([row.name, row.qty, row.amount, row.otherQty, row.otherAmount, row.qty - row.otherQty]);
  if (products.length === 0) productos.push(["Sin movimiento", 0, 0, 0, 0, 0]);

  const reparto: (string | number)[][] = [
    ["Repartidor", "Ruta", "Asignados", "Entregados", "Pendientes", "No entregados", "Importe entregado", `Entregados ${otherLabel}`, "Cambio", "Estado"],
  ];
  for (const row of drivers) {
    reparto.push([
      row.name,
      row.routeName,
      row.assigned,
      row.delivered,
      row.pending,
      row.failed,
      row.deliveredAmount,
      row.otherDelivered,
      row.delivered - row.otherDelivered,
      driverStatus(row),
    ]);
  }

  const pendientes: (string | number)[][] = [["Pedido", "Tienda", "Zona", "Repartidor", "Total", "Estado"]];
  for (const order of dayOrders.filter((item) => item.delivery !== "delivered")) {
    const client = input.clients.find((item) => item.id === order.clientId);
    pendientes.push([
      order.id,
      client?.store ?? order.clientId,
      client?.zone ?? "",
      personName(input.people, order.driverId),
      orderTotals(order.lines, order.discountPct).total,
      order.delivery === "failed" ? "No entregado" : "Pendiente",
    ]);
  }
  if (pendientes.length === 1) pendientes.push(["Sin pendientes", "", "", "", 0, ""]);

  const ruta: (string | number)[][] = [["Semana", "Tienda", "Zona", "Dirección", "Repartidor"]];
  for (const client of input.clients) {
    const driverId = driverIdFor(week, client.id, client.driverId, input.weekPlans);
    ruta.push([weekSpan(week), client.store, client.zone, client.address, personName(input.people, driverId)]);
  }

  const bitacora: (string | number)[][] = [["Hora", "Persona", "Qué hizo", "Detalle", "Lugar", "Latitud", "Longitud"]];
  for (const entry of input.journal.filter((item) => onDay(item.at, input.day))) {
    const who = entry.personId === "dueno" ? "Dueño" : personName(input.people, entry.personId);
    bitacora.push([entry.at, who, entry.title, entry.detail, entry.place, entry.lat ?? "", entry.lng ?? ""]);
  }
  if (bitacora.length === 1) bitacora.push(["Sin movimientos", "", "", "", "", "", ""]);

  const book = [
    sheet("Resumen", resumen),
    sheet("Pedidos", pedidos),
    sheet("Equipo", equipo),
    sheet("Productos", productos),
    sheet("Reparto", reparto),
    sheet("Pendientes", pendientes),
    sheet("Ruta", ruta),
    sheet("Bitacora", bitacora),
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${book}
</Workbook>`;
}

export async function downloadReport(filename: string, body: string): Promise<string> {
  const blob = new Blob([body], { type: "application/vnd.ms-excel" });
  const file = new File([blob], filename, { type: "application/vnd.ms-excel" });
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      const data: ShareData = { files: [file], title: filename };
      if (!navigator.canShare || navigator.canShare(data)) {
        await navigator.share(data);
        return "El Excel quedó listo para guardarse o abrirse.";
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "Se canceló la descarga.";
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "Se descargó el Excel de este día.";
}

export function reportFilename(day: string): string {
  return `Medicalabs-${day}.xls`;
}
