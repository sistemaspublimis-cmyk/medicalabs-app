import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ACTIVE_DRIVER_ID } from "@/lib/med/catalog";
import { readStoreFix } from "@/lib/med/locate";
import { compressPhoto } from "@/lib/med/photo";
import { placeFromAddress } from "@/lib/med/place";
import { operatingDriverId, operatingSellerId, useMed } from "@/lib/med/store";

export function RegisterClient() {
  const role = useMed((state) => state.role);
  const people = useMed((state) => state.people);
  const sellerId = useMed(operatingSellerId);
  const mineId = useMed(operatingDriverId);
  const registerClient = useMed((state) => state.registerClient);
  const navigate = useNavigate();
  const presales = people.filter((person) => person.kind === "presale");
  const drivers = people.filter((person) => person.kind === "driver");
  const seller = presales.find((person) => person.id === sellerId);
  const [open, setOpen] = useState(false);
  const [store, setStore] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState("");
  const [pickedSeller, setPickedSeller] = useState(presales[0]?.id ?? "");
  const [driverId, setDriverId] = useState(drivers.find((person) => person.id === ACTIVE_DRIVER_ID)?.id ?? drivers[0]?.id ?? "");
  const [facade, setFacade] = useState<[string, string]>(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onPhoto(index: 0 | 1, file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const data = await compressPhoto(file);
      setFacade((current) => {
        const next: [string, string] = [current[0], current[1]];
        next[index] = data;
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo usar la foto.");
    }
  }

  return (
    <div className="mt-4">
      {open ? null : (
        <button type="button" onClick={() => setOpen(true)} className="h-12 w-full rounded-xl bg-blue font-semibold text-card">
          Registrar tienda
        </button>
      )}
      {open ? (
        <form
          className="rounded-2xl border border-line bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (saving) return;
            if (!facade[0] || !facade[1]) {
              setError("Toma las dos fotos de la fachada.");
              return;
            }
            setSaving(true);
            setError(null);
            void (async () => {
              const gps = await readStoreFix().catch(() => null);
              const located = gps ? null : await placeFromAddress(address, zone);
              if (!gps && !located) {
                setError("No hubo GPS y no se encontró la dirección. Revisa la calle y la zona.");
                setSaving(false);
                return;
              }
              const result = registerClient({
                store,
                contact,
                phone,
                address,
                zone,
                sellerId: role === "presale" ? sellerId : pickedSeller,
                driverId: role === "driver" ? mineId : driverId,
                facade,
                ...(gps ? { fix: gps } : located ? { mapPin: located } : {}),
              });
              if (!result.ok) {
                setError(result.error);
                setSaving(false);
                return;
              }
              void navigate({ to: "/mapa" });
            })();
          }}
        >
          <h2 className="text-lg font-extrabold text-section">Nueva tienda</h2>
          <p className="mt-1 text-sm text-muted">Al guardar, la tienda queda en el mapa. Si este teléfono da GPS, el punto es el de la puerta. Si no, se usa la dirección.</p>
          <label className="mt-3 block text-sm font-semibold">
            Tienda
            <input value={store} onChange={(event) => setStore(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium" />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            Contacto
            <input value={contact} onChange={(event) => setContact(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium" />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            Teléfono
            <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="55 0000 0000" className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium" />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            Dirección
            <input value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium" />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            Zona
            <input value={zone} onChange={(event) => setZone(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium" />
          </label>
          {role === "presale" ? (
            <p className="mt-3 text-sm text-muted">Queda en la ruta de {seller?.name ?? "esta preventa"}.</p>
          ) : (
            <label className="mt-3 block text-sm font-semibold">
              Preventa
              <select value={pickedSeller} onChange={(event) => setPickedSeller(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium">
                {presales.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {role === "driver" || drivers.length <= 1 ? (
            <p className="mt-3 text-sm text-muted">
              {drivers.length === 1 ? `El reparto queda con ${drivers[0]?.name ?? "el repartidor"}.` : "Queda en tu reparto."}
            </p>
          ) : (
            <label className="mt-3 block text-sm font-semibold">
              Reparto
              <select value={driverId} onChange={(event) => setDriverId(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium">
                {drivers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.routeName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {([0, 1] as const).map((index) => (
              <label key={index} className="block text-sm font-semibold">
                Fachada {index + 1}
                {facade[index] ? (
                  <img src={facade[index]} alt={`Fachada ${index + 1}`} className="mt-1 aspect-[3/4] w-full rounded-xl object-cover" />
                ) : (
                  <span className="mt-1 grid aspect-[3/4] place-items-center rounded-xl border border-dashed border-line text-center text-xs font-medium text-muted">
                    Foto de la fachada
                  </span>
                )}
                <input
                  name={`fachada-${index + 1}`}
                  aria-label={`Fachada ${index + 1}`}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-2 block w-full text-sm"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void onPhoto(index, file);
                  }}
                />
              </label>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <button type="submit" disabled={saving} className="mt-4 h-12 w-full rounded-xl bg-blue font-semibold text-card disabled:opacity-40">
            {saving ? "Ubicando la tienda…" : "Guardar y ver en el mapa"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setOpen(false)}
            className="mt-2 h-12 w-full rounded-xl border border-line font-semibold disabled:opacity-40"
          >
            Cancelar
          </button>
        </form>
      ) : null}
    </div>
  );
}
