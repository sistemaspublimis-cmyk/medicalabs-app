import { createFileRoute, Navigate } from "@tanstack/react-router";
import { BootScreen, LoginPanel } from "@/components/med/login-panel";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <BootScreen />;
  if (user) return <Navigate to="/" />;
  return <LoginPanel />;
}
