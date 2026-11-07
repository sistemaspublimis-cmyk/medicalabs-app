import { Settings2, Star, UserPlus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { clientById, clientMapPoint } from "@/lib/med/catalog";
import { OrderDetail } from "@/components/med/order-detail";
import { ProductMark } from "@/components/med/ui";
import { ViewPrefs } from "@/components/med/view-prefs";
import { displayName, OFF_SHELF, productOnHand } from "@/lib/med/field-day";
import { requestFieldFix } from "@/lib/med/locate";
import { distanceMeters, formatDistance, sortByNear } from "@/lib/med/near";
import { isToday, money, orderTotals, priceLabel, productName, type Line } from "@/lib/ruta/format";
import { fieldPersonId, operatingSellerId, storesForSeller, useMed, zoneSightOf, type Order } from "@/lib/med/store";

export function SellScreen() {
  const catalog = useMed((state) => state.catalog);
  const sellerId = useMed(operatingSellerId);
  const people = useMed((state) => state.people);
  const visits = useMed((state) => state.visits);
  const loads = useMed((state) => state.loads[sellerId] ?? {});
  const cart = useMed((state) => state.cart);
  const favorites = useMed((state) => state.favorites);
  const activeClientId = useMed((state) => state.activeClientId);
  const clients = useMed((state) => state.clients);
  const areas = useMed((state) => state.areas) ?? [];
  const zoneSight = useMed((state) => state.zoneSight);
  const nameStyle = useMed((state) => state.nameStyle);
  const stockScope = useMed((state) => state.stockScope);
  const locations = useMed((state) => state.locations);
  const role = useMed((state) => state.role);
  const addToCart = useMed((state) => state.addToCart);
  const setCartQty = useMed((state) => state.setCartQty);
  const toggleFavorite = useMed((state) => state.toggleFavorite);
  const setActiveClient = useMed((state) => state.setActiveClient);
  const placeCart = useMed((state) => state.placeCart);
  const orders = useMed((state) => state.orders);
  const productView = useMed((state) => state.productView);
  const [query, setQuery] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [picking, setPicking] = useState(false);
  const [vista, setVista] = useState(false);
  const [paying, setPaying] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Order | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog
      .filter((product) => {
        const stock = loads[product.id] ?? 0;
        if (stockScope === "disponibles" && !productOnHand(product.price, stock)) return false;
        if (onlyFav && !favorites.includes(product.id)) return false;
        if (!needle) return true;
        return `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const stocked = (loads[a.id] ?? 0) > 0 ? 0 : 1;
        const other = (loads[b.id] ?? 0) > 0 ? 0 : 1;
        if (stocked !== other) return stocked - other;
        return a.name.localeCompare(b.name, "es");
      });
  }, [catalog, favorites, loads, onlyFav, query, stockScope]);

  const lines: Line[] = cart.map((item) => {
    const product = catalog.find((entry) => entry.id === item.productId);
    return { productId: item.productId, qty: item.qty, price: product?.price ?? 0 };
  });
  const totals = orderTotals(lines, discount);
  const client = activeClientId ? (clients.find((item) => item.id === activeClientId) ?? clientById(activeClientId)) : undefined;
  const seller = people.find((person) => person.id === sellerId);
  const sight = zoneSightOf(zoneSight, sellerId);
  const stops = storesForSeller(sellerId, clients, areas, sight);
  const here = locations[fieldPersonId(role) ?? ""]?.[0] ?? null;
  const nearest = sortByNear(stops, here, (stop) => clientMapPoint(stop)).slice(0, 4);
  const seen = visits.filter((visit) => visit.sellerId === sellerId && isToday(visit.at)).length;

  if (saved) {
    return (
      <OrderDetail
        orderId={saved.id}
        title="Pedido guardado"
        closeLabel="Seguir vendiendo"
        onClose={() => setSaved(null)}
      />
    );
  }

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVista(true)}
            aria-label="Configuración de vista"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm font-extrabold text-blue-deep"
          >
            <Settings2 className="size-4" aria-hidden="true" />
            Vista
          </button>
        </div>
        <button
          type="button"
          aria-label="Elegir cliente"
          onClick={() => {
            setPicking(true);
            void requestFieldFix();
          }}
          className="grid size-14 place-items-center rounded-2xl bg-blue text-card"
        >
          <UserPlus className="size-6" aria-hidden="true" />
        </button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar producto o SKU"
        className="mt-3 h-11 w-full rounded-xl border border-line bg-card px-3 text-base outline-none focus-visible:outline-2 focus-visible:outline-blue"
      />

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Filter on={onlyFav} label="Favoritos" action={() => setOnlyFav((value) => !value)} />
        <Filter on={!onlyFav} label="Todos" action={() => setOnlyFav(false)} />
      </div>

      <button
        type="button"
        onClick={() => {
          setPicking(true);
          void requestFieldFix();
        }}
        className="mt-3 w-full rounded-2xl border border-line bg-card px-3 py-3 text-left"
      >
        <span className="block text-sm text-muted">
          {seller?.name ?? "Preventa"} · {seller?.routeName ?? "Ruta"} · {seen}/{stops.length} visitas
        </span>
        <span className="mt-1 block text-lg font-extrabold text-blue-deep">
          {client ? client.store : "Elige el cliente de esta venta"}
        </span>
        <span className="block text-sm text-muted">{client ? `${client.zone} · ${client.contact}` : "Sin cliente no se puede guardar el pedido."}</span>
      </button>

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Ningún producto coincide con esa búsqueda.</p>
      ) : null}

      {nearest.length > 0 ? (
        <div className="mt-3">
          <p className="text-sm font-semibold text-muted">
            {here ? "Tiendas más cercanas" : "Tiendas de la ruta. Activa la ubicación para ordenarlas por cercanía."}
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {nearest.map((stop) => {
              const point = clientMapPoint(stop);
              const away = here && point ? formatDistance(distanceMeters(here, point)) : "";
              const on = stop.id === activeClientId;
              return (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => setActiveClient(stop.id)}
                  className={"shrink-0 rounded-2xl border px-3 py-2 text-left " + (on ? "border-blue bg-blue-soft" : "border-line bg-card")}
                >
                  <span className="block max-w-40 truncate text-sm font-semibold">{stop.store}</span>
                  <span className="block text-xs text-muted">{away || stop.zone}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {productView === "tabla" ? (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-line text-xs font-semibold tracking-wide text-muted uppercase">
              <tr>
                <th className="px-3 py-3">Producto</th>
                <th className="px-3 py-3">Presentación</th>
                <th className="px-3 py-3">Precio</th>
                <th className="px-3 py-3">A bordo</th>
                <th className="px-3 py-3">Vendidas hoy</th>
                <th className="px-3 py-3">Pedido</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const count = cart.find((item) => item.productId === product.id)?.qty ?? 0;
                const stock = loads[product.id] ?? 0;
                const sold = orders
                  .filter((order) => order.sellerId === sellerId && isToday(order.createdAt) && order.delivery !== "failed")
                  .reduce((sum, order) => sum + (order.lines.find((line) => line.productId === product.id)?.qty ?? 0), 0);
                return (
                  <tr key={product.id} className={"border-b border-line last:border-0 " + (productOnHand(product.price, stock) ? "" : OFF_SHELF)}>
                    <td className="px-3 py-3 font-semibold">{displayName(product.name, nameStyle)}</td>
                    <td className="px-3 py-3">{product.unit}</td>
                    <td className="px-3 py-3 tabular-nums">{priceLabel(product.price)}</td>
                    <td className="px-3 py-3 font-extrabold tabular-nums">{Math.max(0, stock - count)}</td>
                    <td className="px-3 py-3 tabular-nums">{sold}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Step label={`Quitar ${product.name}`} disabled={count === 0} onClick={() => addToCart(product.id, -1)}>
                          −
                        </Step>
                        <span className="w-8 text-center font-bold tabular-nums">{count}</span>
                        <Step label={`Agregar ${product.name}`} disabled={count >= stock || product.price <= 0} onClick={() => addToCart(product.id, 1)} primary>
                          +
                        </Step>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
      <ul className={productView === "iconos" ? "mt-3 grid grid-cols-3 gap-1.5 sm:gap-2" : "mt-3 flex flex-col gap-2"}>
        {visible.map((product) => {
          const count = cart.find((item) => item.productId === product.id)?.qty ?? 0;
          const stock = loads[product.id] ?? 0;
          const fav = favorites.includes(product.id);
          const sold = orders
            .filter((order) => order.sellerId === sellerId && isToday(order.createdAt) && order.delivery !== "failed")
            .reduce((sum, order) => sum + (order.lines.find((line) => line.productId === product.id)?.qty ?? 0), 0);
          return (
            <li key={product.id} className={"min-w-0 rounded-2xl border " + (productView === "iconos" ? "p-1.5 sm:p-2 " : "p-3 ") + (productOnHand(product.price, stock) ? "border-line bg-card" : OFF_SHELF)}>
              <div className={productView === "iconos" ? "flex flex-col gap-2" : "flex gap-3"}>
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className={productView === "iconos" ? "aspect-square w-full rounded-xl object-cover" : "size-24 shrink-0 rounded-xl object-cover"}
                  />
                ) : (
                  <ProductMark name={product.name} image="" size={productView === "iconos" ? "aspect-square w-full" : "size-24"} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={"font-semibold leading-tight " + (productView === "iconos" ? "text-xs sm:text-sm" : "")}>{displayName(product.name, nameStyle)}</p>
                    <button
                      type="button"
                      aria-label={fav ? `Quitar favorito ${product.name}` : `Marcar favorito ${product.name}`}
                      onClick={() => toggleFavorite(product.id)}
                      className="grid size-11 shrink-0 place-items-center"
                    >
                      <Star className={"size-5 " + (fav ? "fill-blue text-blue" : "text-muted")} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="text-xs text-muted sm:text-sm">{nameStyle === "completo" ? `${product.unit} · ${product.category}` : product.unit}</p>
                  {product.description ? <p className="line-clamp-2 text-xs text-ink">{product.description}</p> : null}
                  <p className="text-lg font-extrabold text-blue-deep tabular-nums">{priceLabel(product.price)}</p>
                  <p className={"text-sm tabular-nums " + (stock > 0 && stock - count <= 3 ? "text-danger" : "text-muted")}>
                    {stock === 0 ? (product.minQty > 0 ? "Agotado" : "Sin cargar") : `A bordo ${Math.max(0, stock - count)}`} · hoy {sold}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Step label={`Quitar ${product.name}`} disabled={count === 0} onClick={() => addToCart(product.id, -1)}>
                      −
                    </Step>
                    <span className="w-8 text-center font-bold tabular-nums">{count}</span>
                    <Step label={`Agregar ${product.name}`} disabled={count >= stock || product.price <= 0} onClick={() => addToCart(product.id, 1)} primary>
                      +
                    </Step>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">
              {lines.length} {lines.length === 1 ? "partida" : "partidas"}
              {totals.off > 0 ? ` · −${money(totals.off)}` : ""}
            </p>
            <p className="text-2xl font-extrabold text-blue-deep tabular-nums">{money(totals.total)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!client) {
                setPicking(true);
                return;
              }
              setPaying(true);
            }}
            className="h-12 rounded-xl bg-blue px-5 font-semibold text-card"
          >
            {client ? "Revisar pedido" : "Elegir cliente"}
          </button>
        </div>
      </div>

      {vista ? (
        <Sheet title="Vista" onClose={() => setVista(false)}>
          <ViewPrefs withStep />
        </Sheet>
      ) : null}

      {picking ? (
        <Sheet title="Tiendas cercanas" onClose={() => setPicking(false)}>
          <p className="mb-3 text-sm text-muted">
            {here ? "De la más cercana a la más lejos." : "Sin ubicación todavía. Se muestran las de la ruta."}
          </p>
          {stops.length === 0 ? <p className="text-sm text-muted">Esta ruta todavía no tiene clientes.</p> : null}
          <ul className="flex flex-col gap-2">
            {sortByNear(stops, here, (stop) => clientMapPoint(stop)).map((stop) => {
              const visit = visits.find((item) => item.clientId === stop.id && isToday(item.at));
              const point = clientMapPoint(stop);
              const away = here && point ? formatDistance(distanceMeters(here, point)) : "";
              return (
                <li key={stop.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveClient(stop.id);
                      setPicking(false);
                    }}
                    className={
                      "w-full rounded-2xl border px-3 py-3 text-left " +
                      (stop.id === activeClientId ? "border-blue bg-blue-soft" : "border-line bg-card")
                    }
                  >
                    <span className="block font-semibold">{stop.store}</span>
                    <span className="block text-sm text-muted">
                      {away ? `${away} · ` : ""}
                      {stop.zone} · {visit ? visit.note : "Sin visita"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Sheet>
      ) : null}

      {paying && client ? (
        <Sheet title="Revisa antes de cerrar" onClose={() => setPaying(false)}>
          <p className="font-semibold">{client.store}</p>
          <p className="text-sm text-muted">
            {client.zone} · {client.contact}
          </p>
          <p className="mt-2 text-sm text-muted">Revisa el detalle. Puedes modificar las cantidades antes de cerrar la venta.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {lines.map((item) => {
              const product = catalog.find((entry) => entry.id === item.productId);
              const name = product?.name ?? productName(item.productId);
              return (
                <li key={item.productId} className="rounded-2xl border border-line bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{displayName(name, nameStyle)}</p>
                    <p className="font-extrabold tabular-nums">{money(item.qty * item.price)}</p>
                  </div>
                  <p className="text-sm text-muted">{money(item.price)} c/u</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Step label={`Quitar ${name}`} disabled={false} onClick={() => setCartQty(item.productId, item.qty - 1)}>
                      −
                    </Step>
                    <span className="w-8 text-center font-bold tabular-nums">{item.qty}</span>
                    <Step
                      label={`Agregar ${name}`}
                      disabled={item.qty >= (loads[item.productId] ?? 0)}
                      onClick={() => setCartQty(item.productId, item.qty + 1)}
                      primary
                    >
                      +
                    </Step>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm font-semibold">Descuento</p>
          <div className="mt-2 flex gap-2">
            {[0, 5, 10].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDiscount(value)}
                className={
                  "h-11 flex-1 rounded-xl text-sm font-semibold " +
                  (discount === value ? "bg-blue-deep text-card" : "border border-line bg-paper")
                }
              >
                {value === 0 ? "Ninguno" : `${value}%`}
              </button>
            ))}
          </div>
          <p className="mt-3 text-3xl font-extrabold text-blue-deep tabular-nums">{money(orderTotals(lines, discount).total)}</p>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          <button
            type="button"
            className="mt-3 h-12 w-full rounded-xl bg-blue font-semibold text-card"
            onClick={() => {
              const result = placeCart(discount);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setError(null);
              setPaying(false);
              setSaved(result.order);
            }}
          >
            Cerrar venta
          </button>
        </Sheet>
      ) : null}
    </div>
  );
}

function Filter({ on, label, action }: { on: boolean; label: string; action: () => void }) {
  return (
    <button
      type="button"
      onClick={action}
      className={"h-10 shrink-0 rounded-full px-3 text-sm font-semibold " + (on ? "bg-blue text-card" : "border border-line bg-card")}
    >
      {label}
    </button>
  );
}

function Step({
  children,
  label,
  disabled,
  onClick,
  primary = false,
}: {
  children: ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={
        "grid size-11 place-items-center rounded-xl text-lg font-bold disabled:opacity-40 " +
        (primary ? "bg-blue text-card" : "border border-line bg-paper")
      }
    >
      {children}
    </button>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/40" role="presentation" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-paper px-4 pt-4 pb-6"
        role="dialog"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-title">{title}</h2>
          <button type="button" onClick={onClose} className="h-11 px-2 font-semibold text-blue">
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

