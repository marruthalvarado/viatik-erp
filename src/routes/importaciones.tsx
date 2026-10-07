import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/importaciones")({
  beforeLoad: ({ location }) => {
    if (
      location.pathname === "/importaciones" ||
      location.pathname === "/importaciones/"
    ) {
      throw redirect({ to: "/importaciones/costeos", replace: true });
    }
  },
  component: () => <Outlet />,
});
