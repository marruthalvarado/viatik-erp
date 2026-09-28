import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/servicio-tecnico")({
  beforeLoad: ({ location }) => {
    if (
      location.pathname === "/servicio-tecnico" ||
      location.pathname === "/servicio-tecnico/"
    ) {
      throw redirect({ to: "/servicio-tecnico/ordenes", replace: true });
    }
  },
  component: () => <Outlet />,
});
