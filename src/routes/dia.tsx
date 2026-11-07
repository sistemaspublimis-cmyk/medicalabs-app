import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dia")({
  component: () => <Navigate to="/finanzas" />,
});
