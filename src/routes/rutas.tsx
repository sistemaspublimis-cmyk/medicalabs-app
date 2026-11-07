import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/med/shell";
import { PageTitle } from "@/components/med/ui";
import { useMed } from "@/lib/med/store";
import { addDays, driverIdFor, mondayOf, stopsForDriver, weekPlanned, weekSpan } from "@/lib/med/weeks";

export const Route = createFileRoute("/rutas")({
  component: RoutesPage,
});

function RoutesPage() {
  const clients = useMed((state) => state.clients);
  const people = useMed((state) => state.people);
  const plans = useMed((state) => state.weekPlans) ?? [];
  const setWeekDriver = useMed((state) => state.setWeekDriver);
  const assignWeekZone = useMed((state) => state.assignWeekZone);
  const clearWeekPlan = useMed((state) => state.clearWeekPlan);
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const drivers = people.filter((person) => person.kind === "driver");
  const planned = weekPlanned(week, plans);
  const zones = [...new Set(clients.map((client) => client.zone))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <Shell>
      <PageTitle title="Rutas" hint="Cada semana se reparte sola. El repartidor ve esas paradas como pendientes hasta entregarlas." />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setWeek(addDays(week, -7))} className="h-11 rounded-xl border border-line bg-card text-sm font-semibold">
          Anterior
        </button>
        <button type="button" onClick={() => setWeek(mondayOf(new Date()))} className="h-11 rounded-xl border border-line bg-card text-sm font-semibold">
          Esta
        </button>
        <button type="button" onClick={() => setWeek(addDays(week, 7))} className="h-11 rounded-xl border border-line bg-card text-sm font-semibold">
          Siguiente
        </button>
      </div>
      <p className="mt-3 font-semibold text-blue-deep">{weekSpan(week)}</p>
      <p className="mt-1 text-sm text-muted">
        {planned ? "Esta semana ya tiene reparto propio." : "Esta semana sigue la ruta fija de cada tienda. Al mover una, queda guardada."}
      </p>
      {planned ? (
        <button type="button" onClick={() => clearWeekPlan(week)} className="mt-3 h-11 rounded-xl border border-line bg-card px-4 text-sm font-semibold">
          Volver a la ruta fija
        </button>
      ) : null}
      <h2 className="mt-6 text-lg font-extrabold text-section">Pasar una zona</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {zones.map((zone) => (
          <li key={zone} className="rounded-2xl border border-line bg-card p-3">
            <label className="block text-sm font-semibold">
              {zone}
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value) assignWeekZone(week, zone, event.target.value);
                }}
                className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3"
              >
                <option value="">Asignar la zona a…</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
      {drivers.map((driver) => {
        const stops = stopsForDriver(week, driver.id, clients, plans);
        return (
          <section key={driver.id} className="mt-6">
            <h2 className="text-lg font-extrabold text-section">
              {driver.name}
              <span className="ml-2 text-sm font-semibold text-muted">{stops.length} paradas</span>
            </h2>
            <ul className="mt-2 flex flex-col gap-2">
              {stops.length === 0 ? <li className="text-sm text-muted">Sin paradas esta semana.</li> : null}
              {stops.map((stop) => (
                <li key={stop.id} className="rounded-2xl border border-line bg-card p-3">
                  <p className="font-semibold">{stop.store}</p>
                  <p className="text-sm text-muted">
                    {stop.zone} · {stop.address}
                  </p>
                  <label className="mt-2 block text-sm font-semibold">
                    Repartidor
                    <select
                      value={driverIdFor(week, stop.id, stop.driverId, plans)}
                      onChange={(event) => setWeekDriver(week, stop.id, event.target.value)}
                      className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3"
                    >
                      {drivers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Shell>
  );
}
