import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMed } from "@/lib/med/store";

export const Route = createFileRoute("/pedido/$clientId")({
  component: OrderRedirect,
});

function OrderRedirect() {
  const { clientId } = Route.useParams();
  const setActiveClient = useMed((state) => state.setActiveClient);
  const client = useMed((state) => state.clients.find((item) => item.id === clientId));
  useEffect(() => {
    if (client) setActiveClient(client.id);
  }, [client, setActiveClient]);
  return <Navigate to="/" />;
}
