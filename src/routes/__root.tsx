import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { ThemeSwitcher } from "#/components/ThemeSwitcher";
import { applyThemeToDocument, useTheme } from "#/lib/theme";

import "../styles.css";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	const theme = useTheme((s) => s.theme);
	const mode = useTheme((s) => s.mode);

	useEffect(() => {
		applyThemeToDocument(theme, mode);
	}, [theme, mode]);

	return (
		<>
			<ThemeSwitcher />
			<Outlet />
			<TanStackDevtools
				config={{
					position: "bottom-right",
				}}
				plugins={[
					{
						name: "TanStack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
				]}
			/>
		</>
	);
}
