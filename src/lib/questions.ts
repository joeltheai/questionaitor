export type Question = {
	q: string;
	choices: Array<string | number>;
	ans: string | number;
};

function normalizeChoices(value: unknown): Array<string | number> | null {
	if (Array.isArray(value)) {
		return value as Array<string | number>;
	}
	return null;
}

export function parseQuestions(raw: string): Question[] {
	const trimmed = raw.trim();
	if (!trimmed) {
		throw new Error("Input is empty.");
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		// Allow a looser paste format: unquoted keys, single quotes, and
		// choices written as {a, b, c} instead of [a, b, c].
		// Only applied when strict JSON.parse fails, so colons inside
		// question strings (e.g. "…roll is:") are left alone.
		const normalized = trimmed
			.replace(/'/g, '"')
			.replace(/(\w+)\s*:/g, '"$1":')
			.replace(/"choices"\s*:\s*\{([^}]*)\}/g, (_, inner: string) => {
				return `"choices": [${inner}]`;
			});

		try {
			parsed = JSON.parse(normalized);
		} catch {
			throw new Error("Could not parse JSON. Check the format and try again.");
		}
	}

	const list = Array.isArray(parsed) ? parsed : [parsed];
	const questions: Question[] = [];

	for (let i = 0; i < list.length; i++) {
		const item = list[i];
		if (!item || typeof item !== "object") {
			throw new Error(`Item ${i + 1} is not an object.`);
		}

		const record = item as Record<string, unknown>;
		const q = record.q;
		const ans = record.ans;
		const choices = normalizeChoices(record.choices);

		if (typeof q !== "string" || !q.trim()) {
			throw new Error(`Item ${i + 1} is missing a valid "q" string.`);
		}
		if (choices === null || choices.length === 0) {
			throw new Error(`Item ${i + 1} needs a non-empty "choices" array.`);
		}
		if (ans === undefined || ans === null || ans === "") {
			throw new Error(`Item ${i + 1} is missing "ans".`);
		}

		questions.push({ q, choices, ans: ans as string | number });
	}

	return questions;
}

export function answersMatch(
	selected: string | number | null | undefined,
	correct: string | number,
): boolean {
	if (selected === null || selected === undefined) return false;
	return String(selected) === String(correct);
}

export function formatTime(totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const minutes = Math.floor(safe / 60);
	const seconds = safe % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
