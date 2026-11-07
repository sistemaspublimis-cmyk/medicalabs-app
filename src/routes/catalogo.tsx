import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProductBoard, soldToday, ViewSwitch } from "@/components/med/product-board";
import { Shell } from "@/components/med/shell";
import { PageTitle } from "@/components/med/ui";
import { COMPANY } from "@/lib/med/catalog";
import { productOnHand } from "@/lib/med/field-day";
import { operatingSellerId, useMed } from "@/lib/med/store";

export const Route = createFileRoute("/catalogo")({
  component: CatalogPage,
});

function CatalogPage() {
  const role = useMed((state) => state.role);
  const catalog = useMed((state) => state.catalog);
  const orders = useMed((state) => state.orders);
  const sellerId = useMed(operatingSellerId);
  const load = useMed((state) => state.loads[sellerId] ?? {});
  const productView = useMed((state) => state.productView);
  const nameStyle = useMed((state) => state.nameStyle);
  const stockScope = useMed((state) => state.stockScope);
  const setProductView = useMed((state) => state.setProductView);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = catalog.filter((product) => {
    if (q && !`${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(q)) return false;
    if (stockScope !== "disponibles") return true;
    if (role === "driver") return product.price > 0;
    return productOnHand(product.price, load[product.id] ?? 0);
  });
  return (
    <Shell>
      <PageTitle
        title="Catálogo"
        hint={
          role === "driver"
            ? `${COMPANY}. Precios para consultar en la entrega.`
            : `${COMPANY}. Precios para mostrar al cliente y lo que aún llevas. Lo vendido se refleja al momento.`
        }
      />
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
        hideStock={role === "driver"}
        qtyLabel="A bordo"
        rows={visible.map((product) => {
          const qty = load[product.id] ?? 0;
          return {
            product,
            qty,
            sold: soldToday(orders, product.id, sellerId),
            warn: qty > 0 && qty <= (product.minQty ?? 8),
          };
        })}
      />
    </Shell>
  );
}
