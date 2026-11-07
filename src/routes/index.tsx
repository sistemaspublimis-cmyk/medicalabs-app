import { createFileRoute, Link } from "@tanstack/react-router";
import { DriverBoard, OwnerBoard } from "@/components/med/boards";
import { SellScreen } from "@/components/med/sell";
import { Shell } from "@/components/med/shell";
import { sessionAccess, useMed } from "@/lib/med/store";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const role = useMed((state) => state.role);
  const people = useMed((state) => state.people);
  const access = sessionAccess(role, people);
  const canSell = role === "driver" && access.includes("vender");
  const canDeliver = role === "presale" && access.includes("entregar");
  const [extra, setExtra] = useState(false);
  const desk = role === "owner" || role === "manager";
  return (
    <Shell>
      {role === "warehouse" ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <h1 className="text-2xl font-extrabold text-title">Almacén</h1>
          <p className="mt-2 text-sm text-muted">Cuando el dueño pide inventario, anotas las piezas de bodega.</p>
          <Link to="/inventario" className="mt-4 flex h-12 items-center justify-center rounded-xl bg-teal font-semibold text-drawer">
            Ir a inventario
          </Link>
        </div>
      ) : null}
      {role === "warehouse" ? null : canSell || canDeliver ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={!extra} onClick={() => setExtra(false)} className={"h-11 rounded-xl font-semibold " + (!extra ? "bg-blue text-card" : "border border-line bg-card")}>
            {role === "driver" ? "Entregar" : "Vender"}
          </button>
          <button type="button" aria-pressed={extra} onClick={() => setExtra(true)} className={"h-11 rounded-xl font-semibold " + (extra ? "bg-section text-card" : "border border-line bg-card")}>
            {canSell ? "Vender" : "Entregar"}
          </button>
        </div>
      ) : null}
      {role === "warehouse" ? null : desk ? <OwnerBoard /> : role === "driver" ? (extra && canSell ? <SellScreen /> : <DriverBoard />) : extra && canDeliver ? <DriverBoard /> : <SellScreen />}
    </Shell>
  );
}
