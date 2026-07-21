import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { THEME_IDS, THEME_LABELS, useTheme } from "#/lib/theme";

export function ThemeSwitcher() {
	const theme = useTheme((s) => s.theme);
	const mode = useTheme((s) => s.mode);
	const setTheme = useTheme((s) => s.setTheme);
	const setMode = useTheme((s) => s.setMode);
	const [menuOpen, setMenuOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	const isDark = mode === "dark";

	useEffect(() => {
		if (!menuOpen) return;

		function handlePointerDown(event: PointerEvent) {
			if (!rootRef.current?.contains(event.target as Node)) {
				setMenuOpen(false);
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") setMenuOpen(false);
		}

		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [menuOpen]);

	return (
		<div
			ref={rootRef}
			className="fixed top-3 right-3 z-40 flex items-center gap-2"
		>
			<button
				type="button"
				role="switch"
				aria-checked={isDark}
				aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
				className="relative h-6 w-10 shrink-0 border-theme bg-bg"
				onClick={() => setMode(isDark ? "light" : "dark")}
			>
				<span
					aria-hidden="true"
					className={`absolute top-0.5 left-0.5 size-4 bg-fg transition-transform ${
						isDark ? "translate-x-4" : "translate-x-0"
					}`}
				/>
			</button>

			<div className="relative">
				<button
					type="button"
					className="flex size-6 items-center justify-center border-theme bg-bg"
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					aria-label={`Theme: ${THEME_LABELS[theme]}`}
					onClick={() => setMenuOpen((open) => !open)}
				>
					<ChevronDown className="size-3.5" strokeWidth={2} />
				</button>

				{menuOpen ? (
					<div
						className="absolute top-full right-0 mt-1 min-w-28 border-theme bg-bg py-1"
						role="menu"
						aria-label="Theme"
					>
						{THEME_IDS.map((id) => {
							const selected = id === theme;
							return (
								<button
									key={id}
									type="button"
									role="menuitemradio"
									aria-checked={selected}
									className={`block w-full px-3 py-1.5 text-left text-sm ${
										selected ? "bg-accent text-accent-fg" : "hover:opacity-70"
									}`}
									onClick={() => {
										setTheme(id);
										setMenuOpen(false);
									}}
								>
									{THEME_LABELS[id]}
								</button>
							);
						})}
					</div>
				) : null}
			</div>
		</div>
	);
}
