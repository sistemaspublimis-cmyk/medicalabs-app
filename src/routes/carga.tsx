import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Shell } from "@/components/med/shell";
import { ProductBoard, type ProductRow, soldToday, ViewSwitch } from "@/components/med/product-board";
import { PageTitle } from "@/components/med/ui";
import { staffById } from "@/lib/med/catalog";
import { productOnHand } from "@/lib/med/field-day";
import { money } from "@/lib/ruta/format";
import { operatingSellerId, useMed } from "@/lib/med/store";

export const Route = createFileRoute("/carga")({
  component: LoadPage,
});

function LoadPage() {
  const sellerId = useMed(operatingSellerId);
  const people = useMed((state) => state.people);
  const operator = people.find((person) => person.id === sellerId);
  const vehicle = staffById(sellerId)?.vehicle;
  const remaining = useMed((state) => state.loads[sellerId] ?? {});
  const orders = useMed((state) => state.orders);
  const setRemaining = useMed((state) => state.setRemaining);
  const productView = useMed((state) => state.productView);
  const nameStyle = useMed((state) => state.nameStyle);
  const stockScope = useMed((state) => state.stockScope);
  const setProductView = useMed((state) => state.setProductView);
  const role = useMed((state) => state.role);
  const locked = role !== "presale";
  const catalog = useMed((state) => state.catalog);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = catalog.filter((product) => {
    if (q && !`${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(q)) return false;
    if (stockScope !== "disponibles") return true;
    return productOnHand(product.price, remaining[product.id] ?? 0);
  });
  const units = catalog.reduce((sum, product) => sum + (remaining[product.id] ?? 0), 0);
  const value = catalog.reduce((sum, product) => sum + (remaining[product.id] ?? 0) * product.price, 0);

  return (
    <Shell>
      <PageTitle
        title="Carga a bordo"
        hint={`${operator?.name ?? "Preventa"}${vehicle ? ` · unidad ${vehicle}` : ""}. Ajusta si el físico no coincide.`}
      />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-line bg-card p-3">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Piezas</p>
          <p className="mt-1 text-3xl font-extrabold text-blue-deep tabular-nums">{units}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-3">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Valor</p>
          <p className="mt-1 text-3xl font-extrabold text-blue-deep tabular-nums">{money(value)}</p>
        </div>
      </div>
      <label className="mt-4 block text-sm font-semibold">
        Buscar
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, SKU o categoría"
          className="mt-1 h-12 w-full rounded-xl border border-line bg-card px-3 text-base font-medium"
        />
      </label>
      <ViewSwitch value={productView} onChange={setProductView} />
      <ProductBoard
        view={productView}
        nameStyle={nameStyle}
        qtyLabel="A bordo"
        rows={visible.map((product) => {
          const qty = remaining[product.id] ?? 0;
          return { product, qty, sold: soldToday(orders, product.id, sellerId), warn: qty > 0 && qty <= (product.minQty ?? 8) };
        })}
        trailing={(row) => <StockStep row={row} locked={locked} onChange={setRemaining} />}
      />
    </Shell>
  );
}

function StockStep({
  row,
  locked,
  onChange,
}: {
  row: ProductRow;
  locked: boolean;
  onChange: (productId: string, qty: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Bajar ${row.product.name}`}
        disabled={locked || row.qty === 0}
        onClick={() => onChange(row.product.id, row.qty - 1)}
        className="grid size-11 place-items-center rounded-xl border border-line disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="w-8 text-center font-bold tabular-nums">{row.qty}</span>
      <button
        type="button"
        aria-label={`Subir ${row.product.name}`}
        disabled={locked}
        onClick={() => onChange(row.product.id, row.qty + 1)}
        className="grid size-11 place-items-center rounded-xl bg-blue text-card disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
