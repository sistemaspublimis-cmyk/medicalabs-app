import { Bell } from "lucide-react";
import { useState } from "react";
import { OrderDetail } from "@/components/med/order-detail";
import { formatFixTime } from "@/lib/med/locate";
import { MANAGER_ID } from "@/lib/med/catalog";
import { fieldPersonId, useMed, type Bulletin, type OwnerNotice } from "@/lib/med/store";
import { storeName } from "@/lib/ruta/format";

function noticeLine(
  notice: OwnerNotice,
  people: { id: string; name: string }[],
  clients: { id: string; store: string }[],
): string {
  const who = people.find((person) => person.id === notice.sellerId)?.name ?? people.find((person) => person.id === notice.driverId)?.name ?? "Alguien";
  if (notice.kind === "quieto") return `${who} no se mueve en la app.`;
  if (notice.kind === "sesion") return `${who} inició sesión.`;
  if (notice.kind === "jornada") return `${who} ${notice.orderId || "cambió el periodo laboral"}.`;
  if (notice.kind === "stock") return `${notice.orderId || "Un producto cambió"} · ${who}.`;
  if (notice.kind === "reabierto") return `${people.find((person) => person.id === notice.driverId)?.name ?? "Reparto"} dejó pendiente de nuevo en ${storeName(notice.clientId, clients)}.`;
  const store = storeName(notice.clientId, clients);
  const driver = people.find((person) => person.id === notice.driverId)?.name ?? "Reparto";
  const seller = people.find((person) => person.id === notice.sellerId)?.name ?? "Preventa";
  if (notice.kind === "pedido") return `${seller} capturó un pedido en ${store}.`;
  if (notice.kind === "incidencia") return `${driver} no entregó en ${store}.`;
  return `${driver} entregó en ${store}.`;
}

export function NoticeBell() {
  const role = useMed((state) => state.role);
  const notices = useMed((state) => state.notices);
  const bulletins = useMed((state) => state.bulletins) ?? [];
  const people = useMed((state) => state.people);
  const clients = useMed((state) => state.clients);
  const markNoticesRead = useMed((state) => state.markNoticesRead);
  const postBulletin = useMed((state) => state.postBulletin);
  const dismissBulletin = useMed((state) => state.dismissBulletin);
  const viewer = fieldPersonId(role) ?? (role === "manager" ? MANAGER_ID : "dueno");
  const desk = role === "owner" || role === "manager";
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sticky, setSticky] = useState(false);
  const visibleBoards = bulletins.filter((item) => item.sticky || !item.dismissedBy.includes(viewer));
  const team = new Set(people.filter((person) => person.leadId === MANAGER_ID).map((person) => person.id));
  const visibleNotices =
    role === "manager"
      ? notices.filter((notice) => team.has(notice.sellerId ?? "") || team.has(notice.driverId) || notice.kind === "stock")
      : notices;
  const unread = desk ? visibleNotices.filter((notice) => !notice.read) : [];
  const count = unread.length + bulletins.filter((item) => !item.sticky && !item.dismissedBy.includes(viewer)).length;

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={count > 0 ? `Avisos, ${count} sin leer` : "Avisos"}
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-11 place-items-center rounded-xl bg-blue-soft text-blue-deep"
      >
        <Bell className="size-5" aria-hidden="true" />
        {count > 0 ? (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-blue px-1 text-xs font-bold text-card">
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <button type="button" aria-label="Cerrar avisos" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div
            className="fixed inset-x-3 top-16 z-50 flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl sm:inset-x-auto sm:right-3 sm:w-[24rem]"
            role="dialog"
            aria-label="Avisos"
          >
            <div className="border-b border-line px-3 py-3">
              <p className="font-extrabold text-blue-deep">Avisos</p>
            </div>
            <div className="overflow-y-auto">
              {role === "owner" ? (
                <form
                  className="border-b border-line px-3 py-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    postBulletin(text, sticky);
                    setText("");
                    setSticky(false);
                  }}
                >
                  <label className="block text-sm font-semibold">
                    Nuevo aviso
                    <textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      maxLength={240}
                      rows={2}
                      placeholder="Escríbelo para el equipo"
                      className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-base font-medium"
                    />
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={sticky} onChange={(event) => setSticky(event.target.checked)} />
                    El equipo no puede quitarlo. Tú sí.
                  </label>
                  <button type="submit" className="mt-2 h-11 w-full rounded-xl bg-blue font-semibold text-card">
                    Publicar
                  </button>
                </form>
              ) : null}
              <ul>
                {visibleBoards.map((item) => (
                  <BulletinRow
                    key={item.id}
                    item={item}
                    onDismiss={role === "owner" || !item.sticky ? () => dismissBulletin(item.id) : undefined}
                  />
                ))}
                {desk
                  ? visibleNotices.slice(0, 30).map((notice) => (
                      <li key={notice.id} className={"border-b border-line px-3 py-3 " + (notice.read ? "" : "bg-blue-soft/60")}>
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => {
                            const opens =
                              notice.kind === "pedido" ||
                              notice.kind === "entrega" ||
                              notice.kind === "incidencia" ||
                              notice.kind === "reabierto";
                            if (!opens || !notice.orderId) return;
                            setOrderId(notice.orderId);
                            setOpen(false);
                          }}
                        >
                          <p className={"break-words whitespace-normal " + (notice.read ? "text-base text-ink" : "text-base font-semibold text-ink")}>{noticeLine(notice, people, clients)}</p>
                          <p className="mt-1 text-xs text-muted">{formatFixTime(notice.at)}</p>
                        </button>
                      </li>
                    ))
                  : null}
                {visibleBoards.length === 0 && (!desk || visibleNotices.length === 0) ? (
                  <li className="px-3 py-4 text-sm text-muted">No hay avisos.</li>
                ) : null}
              </ul>
            </div>
            {desk && unread.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  markNoticesRead();
                }}
                className="h-12 border-t border-line font-semibold text-blue"
              >
                Marcar avisos como leídos
              </button>
            ) : null}
          </div>
        </>
      ) : null}
      {orderId ? <OrderDetail orderId={orderId} onClose={() => setOrderId(null)} /> : null}
    </div>
  );
}

function BulletinRow({ item, onDismiss }: { item: Bulletin; onDismiss?: () => void }) {
  return (
    <li className="border-b border-line px-3 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold break-words whitespace-pre-wrap text-ink">{item.body}</p>
          <p className="mt-1 text-xs text-muted">
            {formatFixTime(item.at)}
            {item.sticky ? " · Solo el dueño lo quita" : ""}
          </p>
        </div>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="h-8 px-2 text-sm font-semibold text-blue">
            Quitar
          </button>
        ) : null}
      </div>
    </li>
  );
}
