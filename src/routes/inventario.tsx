import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/med/shell";
import { PageTitle } from "@/components/med/ui";
import { formatFixTime } from "@/lib/med/locate";
import { useMed } from "@/lib/med/store";
import { money } from "@/lib/ruta/format";

export const Route = createFileRoute("/inventario")({
  component: InventoryPage,
});

function InventoryPage() {
  const role = useMed((state) => state.role);
  const catalog = useMed((state) => state.catalog);
  const loads = useMed((state) => state.loads);
  const warehouse = useMed((state) => state.warehouse) ?? {};
  const rounds = useMed((state) => state.inventoryRounds) ?? [];
  const lines = useMed((state) => state.inventoryLines) ?? [];
  const people = useMed((state) => state.people);
  const openInventory = useMed((state) => state.openInventory);
  const closeInventory = useMed((state) => state.closeInventory);
  const setInventoryQty = useMed((state) => state.setInventoryQty);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const open = rounds.find((round) => !round.closedAt);
  const owner = role === "owner";
  const canCount = role === "warehouse" || role === "owner";
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const list = catalog.filter((product) => {
      if (!q) return (warehouse[product.id] ?? 0) > 0 || Boolean(open);
      return `${product.name} ${product.sku}`.toLowerCase().includes(q);
    });
    return list.slice(0, 40);
  }, [catalog, open, q, warehouse]);
  const value = stockMoney(catalog, loads, warehouse);

  return (
    <Shell>
      <PageTitle
        title="Inventario"
        hint={owner ? "Pides el conteo. Almacén anota lo que hay en bodega y queda el historial." : "Cuando el dueño pide inventario, anotas las piezas de bodega."}
      />
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-3">
          <p className="text-sm text-muted">Total en dinero</p>
          <p className="text-2xl font-extrabold text-teal tabular-nums">{money(value.total)}</p>
          <p className="text-sm text-muted">{value.pieces} piezas · rutas y bodega</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-3">
          <p className="text-sm text-muted">En rutas</p>
          <p className="text-xl font-extrabold tabular-nums">{money(value.routes)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-3">
          <p className="text-sm text-muted">En almacén</p>
          <p className="text-xl font-extrabold tabular-nums">{money(value.house)}</p>
        </div>
      </div>
      {owner ? (
        <form
          className="mt-4 rounded-2xl border border-line bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const result = openInventory(note);
            setError(result.ok ? "" : result.error);
            if (result.ok) setNote("");
          }}
        >
          <p className="font-semibold">Pedir inventario</p>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Conteo de bodega"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base"
          />
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          <button type="submit" className="mt-3 h-12 w-full rounded-xl bg-teal font-semibold text-drawer-ink">
            Avisar a almacén
          </button>
          {open ? (
            <button type="button" onClick={closeInventory} className="mt-2 h-12 w-full rounded-xl border border-line font-semibold">
              Cerrar este conteo
            </button>
          ) : null}
        </form>
      ) : null}
      <p className="mt-4 text-sm font-semibold">{open ? `Conteo abierto${open.note ? `: ${open.note}` : ""}` : "No hay un conteo abierto."}</p>
      {canCount && open ? (
        <label className="mt-3 block text-sm font-semibold">
          Buscar producto
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o SKU" className="mt-1 h-12 w-full rounded-xl border border-line bg-card px-3 text-base" />
        </label>
      ) : null}
      <ul className="mt-3 flex flex-col gap-2">
        {canCount && open
          ? rows.map((product) => (
              <CountRow key={product.id} productId={product.id} name={product.name} unit={product.unit} qty={warehouse[product.id] ?? 0} onSave={setInventoryQty} />
            ))
          : null}
        {canCount && open && rows.length === 0 ? <li className="text-sm text-muted">Ningún producto coincide.</li> : null}
      </ul>
      <h2 className="mt-8 text-lg font-extrabold text-section">Historial</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {rounds.length === 0 ? <li className="text-sm text-muted">Todavía no hay conteos.</li> : null}
        {rounds.map((round) => {
          const taken = lines.filter((line) => line.roundId === round.id);
          return (
            <li key={round.id} className="rounded-2xl border border-line bg-card p-3">
              <p className="font-semibold">{round.note || "Inventario"}</p>
              <p className="text-sm text-muted">
                {formatFixTime(round.openedAt)}
                {round.closedAt ? ` · cerrado ${formatFixTime(round.closedAt)}` : " · abierto"}
                {` · ${taken.length} ${taken.length === 1 ? "captura" : "capturas"}`}
              </p>
              <ul className="mt-2 text-sm">
                {taken.slice(0, 8).map((line) => {
                  const product = catalog.find((item) => item.id === line.productId);
                  const who = people.find((person) => person.id === line.personId)?.name ?? "Almacén";
                  return (
                    <li key={line.id}>
                      {product?.name ?? "Producto"} · {line.qty} · {who}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

function CountRow({
  productId,
  name,
  unit,
  qty,
  onSave,
}: {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  onSave: (productId: string, qty: number) => { ok: boolean; error?: string };
}) {
  const [text, setText] = useState(String(qty));
  const [msg, setMsg] = useState("");
  return (
    <li className="rounded-2xl border border-line bg-card p-3">
      <p className="font-semibold">{name}</p>
      <p className="text-sm text-muted">
        En bodega {qty} {unit}
      </p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const result = onSave(productId, Number(text));
          setMsg(result.ok ? "Guardado" : (result.error ?? "No se guardó"));
        }}
      >
        <input value={text} onChange={(event) => setText(event.target.value)} inputMode="numeric" aria-label={`Cantidad de ${name}`} className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3" />
        <button type="submit" className="h-11 rounded-xl bg-teal px-3 font-semibold text-drawer-ink">
          Anotar
        </button>
      </form>
      {msg ? <p className="mt-1 text-sm text-muted">{msg}</p> : null}
    </li>
  );
}

function stockMoney(
  catalog: { id: string; price: number }[],
  loads: Record<string, Record<string, number>>,
  warehouse: Record<string, number>,
) {
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
  return { routes, house, total: routes + house, pieces };
}
