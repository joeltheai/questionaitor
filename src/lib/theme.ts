import { create } from "zustand";
import { persist } from "zustand/middleware";

export const THEME_IDS = ["minimal", "terminal"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const COLOR_MODES = ["light", "dark"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const THEME_LABELS: Record<ThemeId, string> = {
	minimal: "Minimal",
	terminal: "Terminal",
};

export const COLOR_MODE_LABELS: Record<ColorMode, string> = {
	light: "Light",
	dark: "Dark",
};

export const THEME_STORAGE_KEY = "questionaitor:theme";

type ThemeState = {
	theme: ThemeId;
	mode: ColorMode;
	setTheme: (theme: ThemeId) => void;
	setMode: (mode: ColorMode) => void;
	/** Reset to defaults and re-persist (e.g. after clearAllSiteData). */
	reset: () => void;
};

export function applyThemeToDocument(theme: ThemeId, mode: ColorMode) {
	const root = document.documentElement;
	root.dataset.theme = theme;
	root.dataset.mode = mode;
	root.style.colorScheme = mode;
}

function isThemeId(value: unknown): value is ThemeId {
	return THEME_IDS.includes(value as ThemeId);
}

function isColorMode(value: unknown): value is ColorMode {
	return COLOR_MODES.includes(value as ColorMode);
}

/** Read persisted theme before React hydrates (also used by the FOUC script). */
export function readStoredTheme(): { theme: ThemeId; mode: ColorMode } {
	try {
		const raw = localStorage.getItem(THEME_STORAGE_KEY);
		if (!raw) return { theme: "minimal", mode: "light" };
		const parsed = JSON.parse(raw) as {
			state?: { theme?: unknown; mode?: unknown };
		};
		const theme = isThemeId(parsed.state?.theme)
			? parsed.state.theme
			: "minimal";
		const mode = isColorMode(parsed.state?.mode) ? parsed.state.mode : "light";
		return { theme, mode };
	} catch {
		return { theme: "minimal", mode: "light" };
	}
}

export const useTheme = create<ThemeState>()(
	persist(
		(set) => {
			const initial =
				typeof window !== "undefined"
					? readStoredTheme()
					: { theme: "minimal" as ThemeId, mode: "light" as ColorMode };

			return {
				theme: initial.theme,
				mode: initial.mode,

				setTheme: (theme) => {
					set((state) => {
						applyThemeToDocument(theme, state.mode);
						return { theme };
					});
				},

				setMode: (mode) => {
					set((state) => {
						applyThemeToDocument(state.theme, mode);
						return { mode };
					});
				},

				reset: () => {
					applyThemeToDocument("minimal", "light");
					set({ theme: "minimal", mode: "light" });
				},
			};
		},
		{
			name: THEME_STORAGE_KEY,
			partialize: (state) => ({ theme: state.theme, mode: state.mode }),
			onRehydrateStorage: () => (state) => {
				if (!state) return;
				applyThemeToDocument(state.theme, state.mode);
			},
		},
	),
);
