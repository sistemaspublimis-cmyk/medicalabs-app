import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Shell } from "@/components/med/shell";
import { officeOf, ProductBoard, soldToday, ViewSwitch } from "@/components/med/product-board";
import { PageTitle, Stat } from "@/components/med/ui";
import { lowOnRoute } from "@/lib/med/cierre";
import { compressPhoto } from "@/lib/med/photo";
import { productOnHand } from "@/lib/med/field-day";
import { operatingSellerId, useMed } from "@/lib/med/store";
import { money } from "@/lib/ruta/format";

export const Route = createFileRoute("/productos")({
  component: ProductsPage,
});

function ProductsPage() {
  const role = useMed((state) => state.role);
  const people = useMed((state) => state.people);
  const loads = useMed((state) => state.loads);
  const sellerId = useMed(operatingSellerId);
  const catalog = useMed((state) => state.catalog);
  const orders = useMed((state) => state.orders);
  const productView = useMed((state) => state.productView);
  const nameStyle = useMed((state) => state.nameStyle);
  const stockScope = useMed((state) => state.stockScope);
  const setProductView = useMed((state) => state.setProductView);
  const addProduct = useMed((state) => state.addProduct);
  const setProductCost = useMed((state) => state.setProductCost);
  const setProductPrice = useMed((state) => state.setProductPrice);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [qty, setQty] = useState("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const canEdit = role === "owner";
  const owner = role === "owner" || role === "manager";
  const lows = lowOnRoute(catalog, loads, people);
  const seller = people.find((person) => person.id === sellerId);
  const presales = people.filter((person) => person.kind === "presale");
  const q = query.trim().toLowerCase();
  const visible = catalog.filter((product) => {
    if (q && !`${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(q)) return false;
    if (stockScope !== "disponibles") return true;
    const qty = owner
      ? presales.reduce((sum, person) => sum + (loads[person.id]?.[product.id] ?? 0), 0)
      : (loads[sellerId]?.[product.id] ?? 0);
    return productOnHand(product.price, qty);
  });

  return (
    <Shell>
      <PageTitle
        title="Productos"
        hint={
          canEdit
            ? "El surtido trae su foto y el precio de anaquel. Anota el costo, registra piezas y rellena la carga. Se ve al momento en todas las cuentas de este teléfono."
            : owner
              ? "Ves el surtido y la carga. Solo el dueño registra, cambia precios o rellena."
            : `A bordo de ${seller?.name ?? "la preventa"}. Lo vendido baja al momento. Lista, iconos o tabla.`
        }
      />
      {canEdit && !open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-4 h-12 w-full rounded-xl bg-blue font-semibold text-card">
          Registrar producto
        </button>
      ) : null}
      {saved && !open ? <p className="mt-3 text-sm text-ok">Producto registrado y cargado en las unidades.</p> : null}
      {canEdit && open ? (
        <form
          className="mt-4 rounded-2xl border border-line bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const result = addProduct({
              name,
              category,
              unit,
              price: Number(price),
              cost: Number(cost),
              qty: Number(qty),
              image,
              description,
            });
            if (!result.ok) {
              setSaved(false);
              setError(result.error);
              return;
            }
            setName("");
            setCategory("");
            setUnit("");
            setPrice("");
            setCost("");
            setQty("");
            setImage("");
            setDescription("");
            if (photoRef.current) photoRef.current.value = "";
            setError(null);
            setSaved(true);
            setOpen(false);
          }}
        >
          <h2 className="text-lg font-extrabold text-section">Registrar producto</h2>
          <label className="mt-3 block text-sm font-semibold">
            Nombre
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Cubre zapatos"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block text-sm font-semibold">
              Categoría
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Protección"
                className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
              />
            </label>
            <label className="block text-sm font-semibold">
              Presentación
              <input
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="cja 100"
                className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
              />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block text-sm font-semibold">
              Precio
              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                inputMode="decimal"
                placeholder="120"
                className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
              />
            </label>
            <label className="block text-sm font-semibold">
              Costo
              <input
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                inputMode="decimal"
                placeholder="70"
                className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
              />
            </label>
          </div>
          <label className="mt-3 block text-sm font-semibold">
            Descripción
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Para qué es, presentación o nota de venta"
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-base font-medium"
            />
          </label>
          <div className="mt-3">
            <label className="block text-sm font-semibold">
              Cantidad
              <input
                value={qty}
                onChange={(event) => setQty(event.target.value)}
                inputMode="numeric"
                placeholder="24"
                className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
              />
            </label>
          </div>
          <label className="mt-3 block text-sm font-semibold">
            Imagen
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  setImage("");
                  return;
                }
                if (!file.type.startsWith("image/")) {
                  setImage("");
                  event.target.value = "";
                  setSaved(false);
                  setError("Elige una imagen.");
                  return;
                }
                void compressPhoto(file)
                  .then((data) => {
                    setImage(data);
                    setError(null);
                  })
                  .catch(() => {
                    setImage("");
                    event.target.value = "";
                    setSaved(false);
                    setError("Esa imagen no se pudo leer.");
                  });
              }}
              className="mt-1 block w-full text-sm file:mr-3 file:h-11 file:rounded-xl file:border-0 file:bg-blue-soft file:px-3 file:font-semibold file:text-blue-deep"
            />
          </label>
          {image ? <img src={image} alt="" className="mt-2 size-24 rounded-xl object-cover" /> : null}
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          {saved ? <p className="mt-3 text-sm text-ok">Producto registrado y cargado en las unidades.</p> : null}
          <button type="submit" className="mt-4 h-12 w-full rounded-xl bg-blue font-semibold text-card">
            Guardar producto
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setImage("");
              if (photoRef.current) photoRef.current.value = "";
            }}
            className="mt-2 h-12 w-full rounded-xl border border-line font-semibold"
          >
            Cancelar
          </button>
        </form>
      ) : role === "presale" ? (
        <Link to="/carga" className="mt-3 inline-flex h-11 items-center font-semibold text-blue">
          Ajustar carga a bordo
        </Link>
      ) : null}
      {owner ? <StockMoney /> : null}
      {owner ? (
        <div className="mt-4">
          <Stat
            label="Ganancia de hoy"
            value={money(
              catalog.reduce((sum, product) => sum + officeOf(orders, product, people).today, 0),
            )}
            hint="El surtido llega sin costo. Anótalo en cada pieza. Una incidencia no entra."
          />
        </div>
      ) : null}
      <label className="mt-4 block text-sm font-semibold">
        Buscar
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, SKU o categoría"
          className="mt-1 h-12 w-full rounded-xl border border-line bg-card px-3 text-base font-medium"
        />
      </label>
      <p className="mt-2 text-sm text-muted">
        {visible.length} de {catalog.length} productos
      </p>
      <ViewSwitch value={productView} onChange={setProductView} />
      {visible.length === 0 ? <p className="mt-4 text-sm text-muted">Ningún producto coincide con la búsqueda.</p> : null}
      <ProductBoard
        view={productView}
        nameStyle={nameStyle}
        qtyLabel={owner ? "En rutas" : "A bordo"}
        onCost={canEdit ? setProductCost : undefined}
        onPrice={canEdit ? setProductPrice : undefined}
        trailing={canEdit ? (row) => (
          <div className="flex flex-col gap-2">
            <Refill productId={row.product.id} />
            <DescriptionEdit productId={row.product.id} text={row.product.description ?? ""} />
          </div>
        ) : undefined}
        rows={visible.map((product) => {
          const qty = owner
            ? presales.reduce((sum, person) => sum + (loads[person.id]?.[product.id] ?? 0), 0)
            : (loads[sellerId]?.[product.id] ?? 0);
          return {
            product,
            qty,
            sold: soldToday(orders, product.id, owner ? undefined : sellerId),
            warn: owner ? lows.some((item) => item.productId === product.id) : qty > 0 && qty <= (product.minQty ?? 8),
            office: owner ? officeOf(orders, product, people) : undefined,
          };
        })}
      />
    </Shell>
  );
}

function StockMoney() {
  const catalog = useMed((state) => state.catalog);
  const loads = useMed((state) => state.loads);
  const warehouse = useMed((state) => state.warehouse) ?? {};
  let routes = 0;
  let house = 0;
  let pieces = 0;
  for (const product of catalog) {
    let onRoute = 0;
    for (const load of Object.values(loads)) onRoute += load[product.id] ?? 0;
    const bodega = warehouse[product.id] ?? 0;
    routes += onRoute * product.price;
    house += bodega * product.price;
    pieces += onRoute + bodega;
  }
  return (
    <div className="mt-4">
      <Stat label="Stock en dinero" value={money(routes + house)} hint={`${pieces} piezas. Rutas ${money(routes)} · almacén ${money(house)}.`} />
    </div>
  );
}

function DescriptionEdit({ productId, text }: { productId: string; text: string }) {
  const setProductDescription = useMed((state) => state.setProductDescription);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(text);
  if (!open) {
    return (
      <button type="button" onClick={() => { setDraft(text); setOpen(true); }} className="h-11 rounded-xl border border-line px-3 text-sm font-semibold text-section">
        Descripción
      </button>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setProductDescription(productId, draft);
        setOpen(false);
      }}
    >
      <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={280} rows={3} aria-label="Descripción del producto" className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
      <button type="submit" className="mt-2 h-11 w-full rounded-xl bg-section font-semibold text-card">
        Guardar descripción
      </button>
    </form>
  );
}

function Refill({ productId }: { productId: string }) {
  const refillProduct = useMed((state) => state.refillProduct);
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("12");
  const [note, setNote] = useState("");
  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-xl border border-line px-3 text-sm font-semibold text-section">
          Rellenar
        </button>
        {note ? <p className="mt-1 text-sm font-semibold text-section">{note}</p> : null}
      </div>
    );
  }
  return (
    <form
      className="mt-2"
      onSubmit={(event) => {
        event.preventDefault();
        const result = refillProduct(productId, Number(qty));
        setNote(result.ok ? "Se sumó a todas las rutas." : result.error);
        if (result.ok) setOpen(false);
      }}
    >
      <p className="text-sm text-muted">La misma cantidad entra a todas las rutas. No se elige persona.</p>
      <input
        value={qty}
        onChange={(event) => setQty(event.target.value)}
        inputMode="numeric"
        aria-label="Cantidad a rellenar"
        className="mt-2 h-11 w-full rounded-xl border border-line bg-paper px-3 text-base"
      />
      <button type="submit" className="mt-2 h-11 w-full rounded-xl bg-section font-semibold text-card">
        Rellenar para todos
      </button>
      {note ? <p className="mt-1 text-sm text-hint">{note}</p> : null}
    </form>
  );
}
