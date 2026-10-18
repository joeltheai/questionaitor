import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import { ThemeSwitcher } from "#/components/ThemeSwitcher";
import { applyThemeToDocument, useTheme } from "#/lib/theme";

import "../styles.css";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	const [showGreeting, setShowGreeting] = useState(true);
	const theme = useTheme((s) => s.theme);
	const mode = useTheme((s) => s.mode);

	useEffect(() => {
		applyThemeToDocument(theme, mode);
	}, [theme, mode]);

	return (
		<>
			{showGreeting ? (
				<div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
					<section
						role="dialog"
						aria-modal="true"
						aria-labelledby="welcome-greeting"
						className="w-full max-w-xl border-theme bg-bg p-8 text-center shadow-2xl"
					>
						<h1
							id="welcome-greeting"
							className="text-3xl font-bold leading-tight sm:text-5xl"
						>
							fuck you AK and fuck your shitty short film too. you lazy fuck
						</h1>
						<button
							type="button"
							className="mt-8 border-theme bg-accent px-5 py-2 text-sm text-accent-fg"
							autoFocus
							onClick={() => setShowGreeting(false)}
						>
							Enter site
						</button>
					</section>
				</div>
			) : null}
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
