import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/reportes")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/reportes" || location.pathname === "/reportes/") {
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  component: () => <Outlet />,
});
