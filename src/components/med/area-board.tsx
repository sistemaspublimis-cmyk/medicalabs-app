import { Link } from "@tanstack/react-router";
import { clientsForArea } from "@/lib/med/near";
import { useMed, type WorkArea } from "@/lib/med/store";

export function AreaBoard({
  areas,
  canEdit,
  onRedraw,
}: {
  areas: WorkArea[];
  canEdit: boolean;
  onRedraw?: (area: WorkArea) => void;
}) {
  const people = useMed((state) => state.people);
  const clients = useMed((state) => state.clients);
  const updateWorkArea = useMed((state) => state.updateWorkArea);
  const assignClientToArea = useMed((state) => state.assignClientToArea);
  const clearClientArea = useMed((state) => state.clearClientArea);
  const removeWorkArea = useMed((state) => state.removeWorkArea);
  if (areas.length === 0) return null;
  const crew = people.filter((person) => person.kind === "presale" || person.kind === "driver");
  return (
    <section className="mt-4">
      <h2 className="text-lg font-extrabold text-section">Zonas y rutas</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {areas.map((area) => {
          const person = people.find((item) => item.id === area.personId);
          const inside = clientsForArea(area, clients);
          const listed = new Set(inside.map((row) => row.client.id));
          const extras = clients.filter((client) => !listed.has(client.id));
          return (
            <li key={area.id} className="rounded-2xl border border-line bg-card px-4 py-3">
              {canEdit ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    updateWorkArea(area.id, {
                      name: String(data.get("name") ?? ""),
                      personId: String(data.get("person") ?? "") || null,
                    });
                  }}
                >
                  <label className="block text-sm font-semibold">
                    Nombre
                    <input
                      name="name"
                      defaultValue={area.name}
                      maxLength={40}
                      className="mt-1 h-11 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Preventa o repartidor
                    <select
                      name="person"
                      defaultValue={area.personId ?? ""}
                      className="mt-1 h-11 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
                    >
                      <option value="">Sin asignar</option>
                      {crew.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.kind === "presale" ? "Preventa" : "Reparto"} · {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="h-11 rounded-xl bg-blue font-semibold text-card">
                    Guardar zona
                  </button>
                </form>
              ) : (
                <>
                  <p className="font-semibold text-blue-deep">{area.name}</p>
                  <p className="text-sm text-muted">{person ? person.name : "Sin asignar"}</p>
                </>
              )}
              <p className="mt-2 text-sm text-muted">
                {area.kind === "zona" ? "Zona de trabajo" : "Ruta"} · {area.points.length} puntos
                {person ? "" : ""}
              </p>
              <p className="mt-3 text-sm font-semibold">Clientes en esta {area.kind === "zona" ? "zona" : "ruta"}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {inside.length === 0 ? <li className="text-sm text-muted">Todavía no hay tiendas aquí.</li> : null}
                {inside.map((row) => (
                  <li key={row.client.id} className="flex items-start justify-between gap-2 text-sm">
                    <span>
                      <span className="font-semibold">{row.client.store}</span>
                      <span className="block text-muted">
                        {row.client.address || row.client.zone}
                        {row.inside ? "" : " · Sumada a la lista"}
                      </span>
                    </span>
                    {canEdit && row.client.areaId === area.id ? (
                      <button type="button" onClick={() => clearClientArea(row.client.id)} className="shrink-0 font-semibold text-danger">
                        Quitar
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {canEdit ? (
                <label className="mt-3 block text-sm font-semibold">
                  Agregar cliente
                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value) assignClientToArea(area.id, event.target.value);
                    }}
                    className="mt-1 h-11 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
                  >
                    <option value="">Elegir tienda</option>
                    {extras.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.store}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {canEdit ? (
                <div className="mt-3 flex flex-wrap gap-x-4">
                  {onRedraw ? (
                    <button type="button" onClick={() => onRedraw(area)} className="h-11 font-semibold text-blue">
                      Redibujar
                    </button>
                  ) : null}
                  <Link to="/rutas" className="inline-flex h-11 items-center font-semibold text-blue">
                    Rutas
                  </Link>
                  <Link to="/rendimiento" className="inline-flex h-11 items-center font-semibold text-blue">
                    Rendimiento
                  </Link>
                  <button type="button" onClick={() => removeWorkArea(area.id)} className="h-11 font-semibold text-danger">
                    Quitar
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
