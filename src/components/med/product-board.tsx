import { useState, type ReactNode } from "react";
import { ProductMark } from "@/components/med/ui";
import type { Product } from "@/lib/med/catalog";
import { displayName, OFF_SHELF } from "@/lib/med/field-day";
import { isToday, money, orderTotals, priceLabel } from "@/lib/ruta/format";
import type { NameStyle, Order, ProductView } from "@/lib/med/store";

export function soldToday(orders: Order[], productId: string, sellerId?: string): number {
  return orders.reduce((sum, order) => {
    if (!isToday(order.createdAt) || order.delivery === "failed") return sum;
    if (sellerId && order.sellerId !== sellerId) return sum;
    return sum + (order.lines.find((line) => line.productId === productId)?.qty ?? 0);
  }, 0);
}

export type OfficeLine = { cost: number; piece: number; today: number; who: string };

export function officeOf(orders: Order[], product: Product, people: { id: string; name: string }[]): OfficeLine {
  const by = new Map<string, { name: string; qty: number }>();
  let today = 0;
  for (const order of orders) {
    if (!isToday(order.createdAt) || order.delivery === "failed") continue;
    const line = order.lines.find((item) => item.productId === product.id);
    if (!line || line.qty <= 0) continue;
    const totals = orderTotals(order.lines, order.discountPct);
    const gross = line.qty * line.price;
    const net = totals.sub === 0 ? 0 : (gross * totals.total) / totals.sub;
    if (product.cost > 0) today += net - line.qty * product.cost;
    const name = people.find((person) => person.id === order.sellerId)?.name.split(" ")[0] ?? "Preventa";
    const row = by.get(order.sellerId) ?? { name, qty: 0 };
    row.qty += line.qty;
    by.set(order.sellerId, row);
  }
  const who = [...by.values()].map((row) => `${row.name} ${row.qty}`).join(" · ");
  return {
    cost: product.cost,
    piece: product.price - product.cost,
    today: Math.round(today),
    who: who || "Nadie lo vendió hoy",
  };
}

export type ProductRow = {
  product: Product;
  qty: number;
  sold: number;
  warn: boolean;
  office?: OfficeLine;
};

export function ViewSwitch({ value, onChange }: { value: ProductView; onChange: (view: ProductView) => void }) {
  const options: { id: ProductView; label: string }[] = [
    { id: "lista", label: "Lista" },
    { id: "iconos", label: "Iconos" },
    { id: "tabla", label: "Tabla" },
  ];
  return (
    <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Vista de productos">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={
            "h-11 rounded-xl border text-sm font-semibold " +
            (value === option.id ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-card")
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function statusOf(row: ProductRow): { label: string; off: boolean } {
  if (row.product.price <= 0) return { label: "Precio por confirmar", off: true };
  if (row.qty <= 0 && (row.product.minQty ?? 0) <= 0 && row.sold <= 0) return { label: "Sin cargar", off: true };
  if (row.qty <= 0) return { label: "Agotado", off: true };
  if (row.warn) return { label: "Por agotarse", off: false };
  return { label: "Disponible", off: false };
}

function PriceField({ onSave }: { onSave: (price: number) => void }) {
  const [text, setText] = useState("");
  return (
    <label className="block text-xs font-semibold text-muted">
      Precio
      <input
        value={text}
        inputMode="decimal"
        placeholder="Precio"
        aria-label="Precio"
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const next = Math.round(Number(text));
          if (!Number.isFinite(next) || next <= 0) {
            setText("");
            return;
          }
          setText(String(next));
          onSave(next);
        }}
        className="mt-1 h-10 w-full min-w-20 rounded-lg border border-line bg-paper px-2 text-sm font-semibold text-ink"
      />
    </label>
  );
}

function CostField({ value, onSave }: { value: number; onSave: (cost: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <label className="block text-xs font-semibold text-muted">
      Costo
      <input
        value={text}
        inputMode="decimal"
        aria-label="Costo"
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const next = Math.round(Number(text));
          if (!Number.isFinite(next) || next < 0) {
            setText(String(value));
            return;
          }
          setText(String(next));
          if (next !== value) onSave(next);
        }}
        className="mt-1 h-10 w-full min-w-20 rounded-lg border border-line bg-paper px-2 text-sm font-semibold text-ink"
      />
    </label>
  );
}

function officeText(office: OfficeLine): string {
  const cost = office.cost > 0 ? `Costo ${money(office.cost)} · ganas ${money(office.piece)} por pieza` : "Costo sin anotar";
  return `${cost} · hoy ${money(office.today)} · ${office.who}`;
}

export function ProductBoard({
  rows,
  view,
  qtyLabel,
  hideStock = false,
  nameStyle = "completo",
  trailing,
  onCost,
  onPrice,
}: {
  rows: ProductRow[];
  view: ProductView;
  qtyLabel: string;
  hideStock?: boolean;
  nameStyle?: NameStyle;
  trailing?: (row: ProductRow) => ReactNode;
  onCost?: (productId: string, cost: number) => void;
  onPrice?: (productId: string, price: number) => void;
}) {
  if (rows.length === 0) return <p className="mt-4 text-sm text-muted">No hay productos.</p>;
  if (view === "tabla") {
    return (
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className={"w-full text-left text-sm " + (onCost ? "min-w-[58rem]" : "min-w-[40rem]")}>
          <thead className="border-b border-line text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-3 py-3">Producto</th>
              <th className="px-3 py-3">SKU</th>
              <th className="px-3 py-3">Categoría</th>
              <th className="px-3 py-3">Presentación</th>
              <th className="px-3 py-3">Precio</th>
              {onCost ? <th className="px-3 py-3">Costo</th> : null}
              {onCost ? <th className="px-3 py-3">Ganancia</th> : null}
              {hideStock ? null : <th className="px-3 py-3">{qtyLabel}</th>}
              {hideStock ? null : <th className="px-3 py-3">Vendidas hoy</th>}
              {onCost ? <th className="px-3 py-3">Quién vendió</th> : null}
              {hideStock ? null : <th className="px-3 py-3">Estado</th>}
              {trailing ? <th className="px-3 py-3">Ajuste</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = statusOf(row);
              return (
                <tr key={row.product.id} className={"border-b border-line last:border-0 " + (!hideStock && status.off ? OFF_SHELF : "")}>
                  <td className="px-3 py-3 font-semibold text-blue-deep">{displayName(row.product.name, nameStyle)}</td>
                  <td className="px-3 py-3 tabular-nums">{row.product.sku}</td>
                  <td className="px-3 py-3">{row.product.category}</td>
                  <td className="px-3 py-3">{row.product.unit}</td>
                  <td className="px-3 py-3 font-semibold tabular-nums">
                    {onPrice && row.product.price <= 0 ? (
                      <PriceField onSave={(price) => onPrice(row.product.id, price)} />
                    ) : (
                      priceLabel(row.product.price)
                    )}
                  </td>
                  {onCost && row.office ? (
                    <td className="px-3 py-3">
                      <CostField value={row.office.cost} onSave={(cost) => onCost(row.product.id, cost)} />
                    </td>
                  ) : null}
                  {onCost && row.office ? (
                    <td className="px-3 py-3 tabular-nums">
                      {row.office.cost > 0 ? (
                        <>
                          <span className="block font-semibold">{money(row.office.piece)}</span>
                          <span className="text-muted">hoy {money(row.office.today)}</span>
                        </>
                      ) : (
                        <span className="text-muted">Sin costo</span>
                      )}
                    </td>
                  ) : null}
                  {hideStock ? null : <td className="px-3 py-3 font-extrabold tabular-nums">{row.qty}</td>}
                  {hideStock ? null : <td className="px-3 py-3 tabular-nums">{row.sold}</td>}
                  {onCost && row.office ? <td className="px-3 py-3">{row.office.who}</td> : null}
                  {hideStock ? null : (
                    <td className={"px-3 py-3 font-semibold " + (status.off || row.warn ? "text-danger" : "text-ok")}>{status.label}</td>
                  )}
                  {trailing ? <td className="px-3 py-3">{trailing(row)}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  if (view === "iconos") {
    return (
      <ul className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
        {rows.map((row) => {
          const status = statusOf(row);
          const off = !hideStock && status.off;
          return (
            <li
              key={row.product.id}
              className={"min-w-0 rounded-2xl border p-1.5 sm:p-2 " + (off ? OFF_SHELF : "border-line bg-card")}
            >
              <ProductMark name={row.product.name} image={row.product.image} size="aspect-square w-full" />
              <p className="mt-2 text-xs font-semibold leading-tight sm:text-sm">{displayName(row.product.name, nameStyle)}</p>
              {row.product.description ? <p className="line-clamp-2 text-xs text-muted">{row.product.description}</p> : null}
              <p className="text-xs text-muted sm:text-sm">
                {row.product.sku} · {row.product.unit}
              </p>
              {onPrice && row.product.price <= 0 ? (
                <PriceField onSave={(price) => onPrice(row.product.id, price)} />
              ) : (
                <p className="font-extrabold text-blue-deep tabular-nums">{priceLabel(row.product.price)}</p>
              )}
              {row.office ? <p className="text-sm text-muted">{officeText(row.office)}</p> : null}
              {onCost && row.office ? <CostField value={row.office.cost} onSave={(cost) => onCost(row.product.id, cost)} /> : null}
              {hideStock ? null : (
                <p className="text-sm tabular-nums">
                  {qtyLabel} {row.qty} · hoy {row.sold}
                </p>
              )}
              {hideStock ? null : (
                <p className={"text-sm font-semibold " + (status.off || row.warn ? "text-danger" : "text-ok")}>{status.label}</p>
              )}
              {trailing ? <div className="mt-2">{trailing(row)}</div> : null}
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {rows.map((row) => {
        const status = statusOf(row);
        return (
          <li
            key={row.product.id}
            className={"flex items-center gap-3 rounded-2xl border p-3 " + (!hideStock && status.off ? OFF_SHELF : "border-line bg-card")}
          >
            <ProductMark name={row.product.name} image={row.product.image} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{displayName(row.product.name, nameStyle)}</p>
              <p className="text-sm text-muted">
                {row.product.sku} · {row.product.category} · {row.product.unit}
              </p>
              {row.product.description ? <p className="text-sm text-ink">{row.product.description}</p> : null}
              {onPrice && row.product.price <= 0 ? (
                <PriceField onSave={(price) => onPrice(row.product.id, price)} />
              ) : (
                <p className="text-sm font-semibold text-blue-deep tabular-nums">{priceLabel(row.product.price)}</p>
              )}
              {row.office ? <p className="text-sm text-muted">{officeText(row.office)}</p> : null}
              {onCost && row.office ? (
                <div className="mt-2 max-w-28">
                  <CostField value={row.office.cost} onSave={(cost) => onCost(row.product.id, cost)} />
                </div>
              ) : null}
              {hideStock ? null : <p className="text-sm text-muted tabular-nums">Vendidas hoy {row.sold}</p>}
              {hideStock ? null : (
                <p className={"text-sm font-semibold " + (status.off || row.warn ? "text-danger" : "text-ok")}>{status.label}</p>
              )}
            </div>
            {hideStock || trailing ? (
              trailing?.(row)
            ) : (
              <div className="text-right">
                <p className="text-2xl font-extrabold text-blue-deep tabular-nums">{row.qty}</p>
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">{qtyLabel}</p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
