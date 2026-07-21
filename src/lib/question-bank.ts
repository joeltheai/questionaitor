import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Question } from "#/lib/questions";
import { useTheme } from "#/lib/theme";

export type BankEntry = {
	id: string;
	/** ISO timestamp when this set was saved. */
	uploadedAt: string;
	/** Optional label; empty means show the formatted upload date. */
	name: string;
	questions: Question[];
};

type QuestionBankState = {
	entries: BankEntry[];
	save: (questions: Question[], name?: string) => BankEntry | null;
	rename: (id: string, name: string) => void;
	remove: (id: string) => void;
	clearBank: () => void;
	/** Wipe this store and every other localStorage key for the origin. */
	clearAllSiteData: () => void;
};

export function questionKey(question: Question): string {
	const choices = [...question.choices].map(String).sort().join("\0");
	return `${question.q.trim().toLowerCase()}\0${String(question.ans)}\0${choices}`;
}

/** Merge sets, dropping later duplicates of the same question. */
export function mergeQuestions(...sets: Question[][]): Question[] {
	const seen = new Set<string>();
	const merged: Question[] = [];
	for (const set of sets) {
		for (const question of set) {
			const key = questionKey(question);
			if (seen.has(key)) continue;
			seen.add(key);
			merged.push(question);
		}
	}
	return merged;
}

export function formatUploadedAt(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

export function entryLabel(entry: BankEntry): string {
	if (entry.name.trim()) return entry.name.trim();
	return formatUploadedAt(entry.uploadedAt);
}

export const useQuestionBank = create<QuestionBankState>()(
	persist(
		(set, get) => ({
			entries: [],

			save: (questions, name = "") => {
				if (!questions.length) return null;
				const entry: BankEntry = {
					id: crypto.randomUUID(),
					uploadedAt: new Date().toISOString(),
					name: name.trim(),
					questions,
				};
				set({ entries: [entry, ...get().entries] });
				return entry;
			},

			rename: (id, name) => {
				const trimmed = name.trim();
				set({
					entries: get().entries.map((entry) =>
						entry.id === id ? { ...entry, name: trimmed } : entry,
					),
				});
			},

			remove: (id) => {
				set({ entries: get().entries.filter((entry) => entry.id !== id) });
			},

			clearBank: () => {
				set({ entries: [] });
			},

			clearAllSiteData: () => {
				set({ entries: [] });
				localStorage.clear();
				// Re-seed theme defaults after wiping storage.
				useTheme.getState().reset();
			},
		}),
		{
			name: "questionaitor:question-bank",
			partialize: (state) => ({ entries: state.entries }),
		},
	),
);
