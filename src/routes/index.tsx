import { Dialog } from "@base-ui/react/dialog";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ConfirmDialog } from "#/components/ConfirmDialog";
import { ScrambleHover } from "#/components/ScrambleHover";
import {
	entryLabel,
	formatUploadedAt,
	mergeQuestions,
	useQuestionBank,
} from "#/lib/question-bank";
import {
	answersMatch,
	CHATBOT_QUESTION_TEMPLATE,
	formatTime,
	parseQuestions,
	type Question,
} from "#/lib/questions";

export const Route = createFileRoute("/")({ component: Home });

type Phase = "upload" | "setup" | "taking" | "results";
type TimerMode = "total" | "perQuestion";
/** How new questions combine with an already-loaded set. */
type LoadMode = "replace" | "append";

type TestConfig = {
	mode: TimerMode;
	/** Active countdown length in seconds (whole test, or each question). */
	durationSeconds: number;
};

function shuffleQuestions<T>(items: T[]): T[] {
	const next = [...items];
	for (let i = next.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[next[i], next[j]] = [next[j], next[i]];
	}
	return next;
}

function Home() {
	const [phase, setPhase] = useState<Phase>("upload");
	const [paste, setPaste] = useState("");
	const [pasteCount, setPasteCount] = useState<number | null>(null);
	const [pasteError, setPasteError] = useState<string | null>(null);
	const [pasteBlurred, setPasteBlurred] = useState(false);
	const [questions, setQuestions] = useState<Question[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);
	const [config, setConfig] = useState<TestConfig | null>(null);
	const [answers, setAnswers] = useState<Array<string | number | null>>([]);
	const [loadMode, setLoadMode] = useState<LoadMode>("replace");
	const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const pasteBlurOnChangeRef = useRef(false);
	const saveToBank = useQuestionBank((s) => s.save);

	function applyQuestions(
		next: Question[],
		opts: { fromBank?: boolean; mode?: LoadMode } = {},
	) {
		const mode = opts.mode ?? loadMode;
		const merged =
			mode === "append" && questions?.length
				? mergeQuestions(questions, next)
				: next;
		setQuestions(merged);
		setError(null);
		setPhase("setup");
		setConfig(null);
		setAnswers([]);
		setLoadMode("replace");

		// Reusing an existing bank set as-is — no new save.
		if (opts.fromBank && mode !== "append") {
			setSavedEntryId("bank");
			return;
		}

		const entry = saveToBank(merged);
		setSavedEntryId(entry?.id ?? null);
	}

	function syncPaste(text: string, opts: { blur?: boolean } = {}) {
		setPaste(text);
		if (!text.trim()) {
			setPasteCount(null);
			setPasteError(null);
			setPasteBlurred(false);
			return;
		}
		try {
			setPasteCount(parseQuestions(text).length);
			setPasteError(null);
			if (opts.blur) setPasteBlurred(true);
		} catch (err) {
			setPasteCount(null);
			setPasteError(err instanceof Error ? err.message : "Invalid JSON.");
			setPasteBlurred(false);
		}
	}

	function loadFromText(text: string, mode?: LoadMode) {
		try {
			const parsed = parseQuestions(text);
			syncPaste(text);
			applyQuestions(parsed, { mode });
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load questions.",
			);
			if ((mode ?? loadMode) !== "append") {
				setQuestions(null);
				setPhase("upload");
			}
		}
	}

	function handleFile(file: File) {
		const reader = new FileReader();
		reader.onload = () => {
			const text = typeof reader.result === "string" ? reader.result : "";
			loadFromText(text);
		};
		reader.onerror = () => {
			setError("Could not read the file.");
			if (loadMode !== "append") {
				setQuestions(null);
				setPhase("upload");
			}
		};
		reader.readAsText(file);
	}

	function startTest(nextConfig: TestConfig) {
		if (!questions?.length) return;
		const shuffled = shuffleQuestions(questions);
		setQuestions(shuffled);
		setConfig(nextConfig);
		setAnswers(Array.from({ length: shuffled.length }, () => null));
		setPhase("taking");
	}

	function finishTest(finalAnswers: Array<string | number | null>) {
		setAnswers(finalAnswers);
		setPhase("results");
	}

	function resetToUpload() {
		setPhase("upload");
		setQuestions(null);
		setConfig(null);
		setAnswers([]);
		setError(null);
		setLoadMode("replace");
		setSavedEntryId(null);
		setPaste("");
		setPasteCount(null);
		setPasteError(null);
		setPasteBlurred(false);
	}

	if (phase === "taking" && questions && config) {
		return (
			<QuizTaking
				questions={questions}
				config={config}
				initialAnswers={answers}
				onFinish={finishTest}
			/>
		);
	}

	if (phase === "results" && questions) {
		return (
			<QuizResults
				questions={questions}
				answers={answers}
				onRetake={() => setPhase("setup")}
				onNewQuestions={resetToUpload}
			/>
		);
	}

	const showUpload = phase === "upload" || !questions || loadMode === "append";

	return (
		<div className="w-full max-w-6xl p-8">
			
			<div className="flex items-center gap-2 text-3xl">
				<span className="font-thin text-red-600">✽</span>
				<h1 className="font-bold">
					<ScrambleHover text="Questionaitor" className="cursor-pointer" />
				</h1>
			</div>
			<p className="mt-2 text-base">
				Upload a list of questions as JSON (paste, click, or drag and drop).
			</p>

			{showUpload ? (
				<>
					{loadMode === "append" && questions?.length ? (
						<div className="mt-6 border-theme p-4">
							<p className="text-sm">
								Adding to the current set ({questions.length} question
								{questions.length === 1 ? "" : "s"}). Duplicates are skipped.
							</p>
							<button
								type="button"
								className="mt-3 border-theme px-3 py-1.5 text-sm"
								onClick={() => {
									setLoadMode("replace");
									setPhase("setup");
									setError(null);
								}}
							>
								Cancel — back to setup
							</button>
						</div>
					) : null}

					<section className="mt-8">
						<h2 className="text-xl font-semibold">Format sample</h2>
						<p className="mt-2 text-sm">
							Copy this into a chatbot so it knows the format.
						</p>
						<CopyTemplateButton />
					</section>

					<div className="mt-8">
						<div className="grid gap-8 lg:grid-cols-[1fr_16rem] lg:items-stretch">
							<div className="flex flex-col">
								<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
									<h2 className="text-xl font-semibold">Paste JSON</h2>
									{pasteError ? (
										<p className="text-sm font-medium text-danger">
											{pasteError}
										</p>
									) : null}
								</div>
								<div className="relative mt-3 flex min-h-0 flex-1 flex-col">
									<textarea
										className={`block w-full flex-1 border-theme p-3 font-mono text-sm ${
											pasteBlurred ? "select-none blur-sm" : ""
										} ${pasteError ? "!border-danger" : ""}`}
										value={paste}
										onChange={(e) => {
											const shouldBlur = pasteBlurOnChangeRef.current;
											pasteBlurOnChangeRef.current = false;
											syncPaste(e.target.value, { blur: shouldBlur });
										}}
										onPaste={() => {
											pasteBlurOnChangeRef.current = true;
										}}
										rows={12}
										readOnly={pasteBlurred}
										aria-invalid={pasteError !== null}
										aria-label={
											pasteBlurred && pasteCount !== null
												? `${pasteCount} questions pasted`
												: "Paste JSON"
										}
										placeholder={`[
  {
    "q": "Your question?",
    "choices": [4.25, 5, 3.67, 2],
    "ans": 4.25
  }
]`}
									/>
									{pasteBlurred && pasteCount !== null ? (
										<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
											<p className="text-lg font-semibold">
												{pasteCount} question
												{pasteCount === 1 ? "" : "s"} pasted
											</p>
											<button
												type="button"
												className="pointer-events-auto border-theme bg-bg px-3 py-1.5 text-sm"
												onClick={() => {
													setPaste("");
													setPasteCount(null);
													setPasteError(null);
													setPasteBlurred(false);
												}}
											>
												Clear
											</button>
										</div>
									) : null}
								</div>
								<button
									type="button"
									className="mt-3 border-theme bg-accent px-3 py-1.5 text-sm text-accent-fg disabled:opacity-40 lg:hidden"
									disabled={pasteCount === null}
									onClick={() => loadFromText(paste)}
								>
									Next
								</button>
							</div>

							<div className="flex flex-col">
								<h2 className="text-xl font-semibold">Upload file</h2>
								<section
									aria-label="File drop zone"
									className={`mt-3 flex flex-1 flex-col justify-center border-theme p-4 ${dragging ? "outline outline-2 outline-border -outline-offset-2" : ""}`}
									onDragEnter={(e) => {
										e.preventDefault();
										setDragging(true);
									}}
									onDragOver={(e) => {
										e.preventDefault();
										setDragging(true);
									}}
									onDragLeave={(e) => {
										e.preventDefault();
										setDragging(false);
									}}
									onDrop={(e) => {
										e.preventDefault();
										setDragging(false);
										const file = e.dataTransfer.files[0];
										if (file) handleFile(file);
									}}
								>
									<p className="text-sm">
										{dragging
											? "Drop the file here…"
											: "Drop a .json file here, or upload below."}
									</p>
									<button
										type="button"
										className="mt-3 border-theme px-3 py-1.5 text-sm"
										onClick={() => fileInputRef.current?.click()}
									>
										{loadMode === "append" ? "Add from file" : "Upload file"}
									</button>
									<input
										ref={fileInputRef}
										type="file"
										accept=".json,application/json,text/plain"
										className="hidden"
										onChange={(e) => {
											const file = e.target.files?.[0];
											if (file) handleFile(file);
											e.target.value = "";
										}}
									/>
								</section>
							</div>
						</div>
						<button
							type="button"
							className="mt-3 hidden border-theme bg-accent px-3 py-1.5 text-sm text-accent-fg disabled:opacity-40 lg:inline-block"
							disabled={pasteCount === null}
							onClick={() => loadFromText(paste)}
						>
							Next
						</button>
					</div>

					<QuestionBankPanel
						onUse={(selected) => {
							applyQuestions(selected, { fromBank: true });
						}}
						appendLabel={
							loadMode === "append" ? "Add selected to current set" : undefined
						}
					/>

					{error ? (
						<p className="mt-6 text-sm font-medium">Error: {error}</p>
					) : null}
				</>
			) : (
				<QuizSetup
					questions={questions}
					savedEntryId={savedEntryId}
					onSaved={(id) => setSavedEntryId(id)}
					onStart={startTest}
					onBack={resetToUpload}
					onAddMore={() => {
						setLoadMode("append");
						setPhase("upload");
						setError(null);
					}}
				/>
			)}
		</div>
	);
}

function CopyTemplateButton() {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(CHATBOT_QUESTION_TEMPLATE);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	}

	return (
		<button
			type="button"
			className="mt-3 border-theme px-3 py-1.5 text-sm"
			onClick={handleCopy}
		>
			{copied ? "Copied!" : "Copy template"}
		</button>
	);
}

type PendingConfirm =
	| { kind: "clear-bank" }
	| { kind: "clear-site" }
	| { kind: "delete"; id: string; label: string };

function QuestionBankPanel({
	onUse,
	appendLabel,
}: {
	onUse: (questions: Question[]) => void;
	appendLabel?: string;
}) {
	const entries = useQuestionBank((s) => s.entries);
	const remove = useQuestionBank((s) => s.remove);
	const rename = useQuestionBank((s) => s.rename);
	const clearBank = useQuestionBank((s) => s.clearBank);
	const clearAllSiteData = useQuestionBank((s) => s.clearAllSiteData);
	const save = useQuestionBank((s) => s.save);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [viewingId, setViewingId] = useState<string | null>(null);
	const [showAnswers, setShowAnswers] = useState(false);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
		null,
	);
	const renameInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (!renamingId) return;
		renameInputRef.current?.focus();
		renameInputRef.current?.select();
	}, [renamingId]);

	function beginRename(entry: (typeof entries)[number]) {
		setRenamingId(entry.id);
		setRenameValue(entry.name);
	}

	function commitRename() {
		if (!renamingId) return;
		rename(renamingId, renameValue);
		setRenamingId(null);
		setRenameValue("");
	}

	function cancelRename() {
		setRenamingId(null);
		setRenameValue("");
	}

	function toggle(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function selectedQuestions(): Question[] {
		const sets = entries
			.filter((entry) => selected.has(entry.id))
			.map((entry) => entry.questions);
		return mergeQuestions(...sets);
	}

	function handleMix() {
		const merged = selectedQuestions();
		if (!merged.length) return;
		save(merged, `Mixed · ${formatUploadedAt(new Date().toISOString())}`);
		onUse(merged);
		setSelected(new Set());
	}

	function handleUseSelected() {
		const merged = selectedQuestions();
		if (!merged.length) return;
		onUse(merged);
		setSelected(new Set());
	}

	function closeView() {
		setViewingId(null);
		setShowAnswers(false);
		if (renamingId === viewingId) cancelRename();
	}

	const viewingEntry = viewingId
		? (entries.find((entry) => entry.id === viewingId) ?? null)
		: null;
	const isRenamingView = Boolean(
		viewingEntry && renamingId === viewingEntry.id,
	);

	const confirmCopy =
		pendingConfirm?.kind === "clear-bank"
			? {
					title: "Clear question bank?",
					description: "Delete every saved question set from the bank?",
					confirmLabel: "Clear bank",
				}
			: pendingConfirm?.kind === "clear-site"
				? {
						title: "Clear all site data?",
						description:
							"Clear all local data for this website? This cannot be undone.",
						confirmLabel: "Clear all data",
					}
				: pendingConfirm?.kind === "delete"
					? {
							title: "Delete question set?",
							description: `Delete “${pendingConfirm.label}”? This cannot be undone.`,
							confirmLabel: "Delete",
						}
					: null;

	const confirmCopyRef = useRef(confirmCopy);
	if (confirmCopy) confirmCopyRef.current = confirmCopy;
	const visibleConfirm = confirmCopy ?? confirmCopyRef.current;

	function runPendingConfirm() {
		if (!pendingConfirm) return;
		if (pendingConfirm.kind === "clear-bank") {
			clearBank();
			setSelected(new Set());
			closeView();
			cancelRename();
			return;
		}
		if (pendingConfirm.kind === "clear-site") {
			clearAllSiteData();
			setSelected(new Set());
			closeView();
			cancelRename();
			return;
		}
		remove(pendingConfirm.id);
		setSelected((prev) => {
			const next = new Set(prev);
			next.delete(pendingConfirm.id);
			return next;
		});
		if (viewingId === pendingConfirm.id) closeView();
		if (renamingId === pendingConfirm.id) cancelRename();
	}

	return (
		<section className="mt-10 max-w-3xl">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-xl font-semibold">Question bank</h2>
					<p className="mt-1 text-sm">
						Your past questions, stored locally so you can retake or mix them.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						className="border-theme px-3 py-1.5 text-sm disabled:opacity-40"
						disabled={!entries.length}
						onClick={() => setPendingConfirm({ kind: "clear-bank" })}
					>
						Clear bank
					</button>
					<button
						type="button"
						className="border-theme px-3 py-1.5 text-sm"
						onClick={() => setPendingConfirm({ kind: "clear-site" })}
					>
						Clear all site data
					</button>
				</div>
			</div>

			{entries.length === 0 ? (
				<p className="mt-4 text-sm">
					No saved sets yet. Upload or paste to save.
				</p>
			) : (
				<>
					<ul className="mt-4 space-y-3">
						{entries.map((entry) => {
							const checked = selected.has(entry.id);
							const isRenaming = renamingId === entry.id;
							return (
								<li key={entry.id} className="border-theme p-3">
									<div className="flex flex-wrap items-start gap-3">
										<label className="mt-0.5 flex items-start gap-2 text-sm">
											<input
												type="checkbox"
												checked={checked}
												onChange={() => toggle(entry.id)}
											/>
											<span className="sr-only">
												Select {entryLabel(entry)}
											</span>
										</label>
										<div className="min-w-0 flex-1">
											{isRenaming ? (
												<label className="block text-sm">
													<span className="sr-only">Rename set</span>
													<input
														ref={renameInputRef}
														type="text"
														className="w-full max-w-md border-theme px-2 py-1.5 font-medium"
														value={renameValue}
														onChange={(e) => setRenameValue(e.target.value)}
														onKeyDown={(e) => {
															if (e.key === "Enter") {
																e.preventDefault();
																commitRename();
															}
															if (e.key === "Escape") {
																e.preventDefault();
																cancelRename();
															}
														}}
														placeholder={formatUploadedAt(entry.uploadedAt)}
													/>
												</label>
											) : (
												<p className="font-medium">{entryLabel(entry)}</p>
											)}
											<p className="mt-1 text-sm">
												{formatUploadedAt(entry.uploadedAt)} ·{" "}
												{entry.questions.length} question
												{entry.questions.length === 1 ? "" : "s"}
											</p>
										</div>
										<div className="flex flex-wrap gap-2">
											{isRenaming ? (
												<>
													<button
														type="button"
														className="border-theme bg-accent px-3 py-1.5 text-sm text-accent-fg"
														onClick={commitRename}
													>
														Save name
													</button>
													<button
														type="button"
														className="border-theme px-3 py-1.5 text-sm"
														onClick={cancelRename}
													>
														Cancel
													</button>
												</>
											) : (
												<>
													<button
														type="button"
														className="border-theme px-3 py-1.5 text-sm"
														onClick={() => beginRename(entry)}
													>
														Rename
													</button>
													<button
														type="button"
														className="border-theme px-3 py-1.5 text-sm"
														onClick={() => {
															setViewingId(entry.id);
															setShowAnswers(false);
														}}
													>
														View
													</button>
													<button
														type="button"
														className="border-theme px-3 py-1.5 text-sm"
														onClick={() => onUse(entry.questions)}
													>
														Use
													</button>
													<button
														type="button"
														className="border-theme px-3 py-1.5 text-sm"
														onClick={() =>
															setPendingConfirm({
																kind: "delete",
																id: entry.id,
																label: entryLabel(entry),
															})
														}
													>
														Delete
													</button>
												</>
											)}
										</div>
									</div>
								</li>
							);
						})}
					</ul>

					<div className="mt-4 flex flex-wrap gap-2">
						<button
							type="button"
							className="border-theme bg-accent px-3 py-1.5 text-sm text-accent-fg disabled:opacity-40"
							disabled={selected.size === 0}
							onClick={handleUseSelected}
						>
							{appendLabel ?? "Use selected"}
							{selected.size > 0 ? ` (${selected.size})` : ""}
						</button>
						<button
							type="button"
							className="border-theme px-3 py-1.5 text-sm disabled:opacity-40"
							disabled={selected.size < 2}
							onClick={handleMix}
						>
							Mix &amp; merge selected
						</button>
					</div>
				</>
			)}

			<Dialog.Root
				open={viewingEntry !== null}
				onOpenChange={(open, details) => {
					if (open) return;
					if (isRenamingView) {
						details.cancel();
						cancelRename();
						return;
					}
					closeView();
				}}
			>
				<Dialog.Portal>
					<Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
					<Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
						<Dialog.Popup className="flex max-h-[min(90vh,40rem)] w-full max-w-2xl flex-col border-theme bg-bg outline-none transition-[scale,opacity] duration-150 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0">
							{viewingEntry ? (
								<>
									<div className="flex flex-wrap items-start justify-between gap-3 border-theme-b p-4">
										<div className="min-w-0 flex-1">
											{isRenamingView ? (
												<>
													<Dialog.Title className="sr-only">
														Rename {entryLabel(viewingEntry)}
													</Dialog.Title>
													<label className="block text-sm">
														<span className="sr-only">Rename set</span>
														<input
															ref={renameInputRef}
															type="text"
															className="w-full max-w-md border-theme px-2 py-1.5 text-lg font-semibold"
															value={renameValue}
															onChange={(e) => setRenameValue(e.target.value)}
															onKeyDown={(e) => {
																if (e.key === "Enter") {
																	e.preventDefault();
																	commitRename();
																}
															}}
															placeholder={formatUploadedAt(
																viewingEntry.uploadedAt,
															)}
														/>
													</label>
												</>
											) : (
												<Dialog.Title className="text-lg font-semibold">
													{entryLabel(viewingEntry)}
												</Dialog.Title>
											)}
											<Dialog.Description className="mt-1 text-sm">
												{viewingEntry.questions.length} question
												{viewingEntry.questions.length === 1 ? "" : "s"}
											</Dialog.Description>
										</div>
										<div className="flex flex-wrap gap-2">
											{isRenamingView ? (
												<>
													<button
														type="button"
														className="border-theme bg-accent px-3 py-1.5 text-sm text-accent-fg"
														onClick={commitRename}
													>
														Save name
													</button>
													<button
														type="button"
														className="border-theme px-3 py-1.5 text-sm"
														onClick={cancelRename}
													>
														Cancel
													</button>
												</>
											) : (
												<button
													type="button"
													className="border-theme px-3 py-1.5 text-sm"
													onClick={() => beginRename(viewingEntry)}
												>
													Rename
												</button>
											)}
											<button
												type="button"
												className="border-theme px-3 py-1.5 text-sm"
												aria-pressed={showAnswers}
												onClick={() => setShowAnswers((prev) => !prev)}
											>
												{showAnswers ? "Hide answers" : "Show answers"}
											</button>
											<Dialog.Close className="border-theme px-3 py-1.5 text-sm">
												Close
											</Dialog.Close>
										</div>
									</div>
									<ol className="list-decimal space-y-4 overflow-y-auto p-4 pl-9">
										{viewingEntry.questions.map((question) => (
											<li
												key={`${question.q}::${String(question.ans)}`}
												className="text-sm"
											>
												<p className="font-medium">{question.q}</p>
												<ul className="mt-2 space-y-1">
													{question.choices.map((choice) => {
														const isAnswer =
															showAnswers &&
															String(choice) === String(question.ans);
														return (
															<li
																key={String(choice)}
																className={
																	isAnswer ? "font-semibold underline" : ""
																}
															>
																{String(choice)}
																{isAnswer ? " ← answer" : ""}
															</li>
														);
													})}
												</ul>
											</li>
										))}
									</ol>
								</>
							) : null}
						</Dialog.Popup>
					</Dialog.Viewport>
				</Dialog.Portal>
			</Dialog.Root>

			<ConfirmDialog
				open={pendingConfirm !== null}
				onOpenChange={(open) => {
					if (!open) setPendingConfirm(null);
				}}
				title={visibleConfirm?.title ?? ""}
				description={visibleConfirm?.description ?? ""}
				confirmLabel={visibleConfirm?.confirmLabel ?? "Confirm"}
				onConfirm={runPendingConfirm}
			/>
		</section>
	);
}

function QuizSetup({
	questions,
	savedEntryId,
	onSaved,
	onStart,
	onBack,
	onAddMore,
}: {
	questions: Question[];
	savedEntryId: string | null;
	onSaved: (id: string) => void;
	onStart: (config: TestConfig) => void;
	onBack: () => void;
	onAddMore: () => void;
}) {
	const questionCount = questions.length;
	const save = useQuestionBank((s) => s.save);
	const [mode, setMode] = useState<TimerMode>("total");
	const [minutes, setMinutes] = useState(10);
	const [seconds, setSeconds] = useState(0);
	const [setupError, setSetupError] = useState<string | null>(null);
	const [saveName, setSaveName] = useState("");

	const inputSeconds = minutes * 60 + seconds;
	const estimatedTotalSeconds =
		mode === "perQuestion" ? inputSeconds * questionCount : inputSeconds;

	function handleStart() {
		if (inputSeconds <= 0) {
			setSetupError("Set a timer greater than zero.");
			return;
		}
		setSetupError(null);
		onStart({ mode, durationSeconds: inputSeconds });
	}

	return (
		<section className="mt-8">
			<h2 className="text-xl font-semibold">Start test</h2>
			<p className="mt-2 text-sm">
				{questionCount} question{questionCount === 1 ? "" : "s"} loaded. Choose
				how the timer works, then begin.
			</p>

			<div className="mt-4 flex flex-wrap items-end gap-3">
				{savedEntryId ? (
					<p className="text-sm">Saved to the question bank.</p>
				) : (
					<>
						<label className="text-sm">
							Bank label (optional)
							<input
								type="text"
								className="mt-1 block w-56 border-theme px-2 py-1.5"
								value={saveName}
								onChange={(e) => setSaveName(e.target.value)}
								placeholder="e.g. Midterm set A"
							/>
						</label>
						<button
							type="button"
							className="border-theme px-3 py-1.5 text-sm"
							onClick={() => {
								const entry = save(questions, saveName);
								if (entry) onSaved(entry.id);
							}}
						>
							Save to bank
						</button>
					</>
				)}
				<button
					type="button"
					className="border-theme px-3 py-1.5 text-sm"
					onClick={onAddMore}
				>
					Add more questions
				</button>
			</div>

			<fieldset className="mt-6">
				<legend className="text-base font-medium">Timer mode</legend>
				<label className="mt-3 flex items-start gap-2 text-sm">
					<input
						type="radio"
						name="timer-mode"
						checked={mode === "total"}
						onChange={() => setMode("total")}
						className="mt-0.5"
					/>
					<span>
						<span className="font-medium">Total time</span>
						<span className="block text-sm">
							Set one countdown for the whole test. When it hits zero, the test
							ends.
						</span>
					</span>
				</label>
				<label className="mt-3 flex items-start gap-2 text-sm">
					<input
						type="radio"
						name="timer-mode"
						checked={mode === "perQuestion"}
						onChange={() => setMode("perQuestion")}
						className="mt-0.5"
					/>
					<span>
						<span className="font-medium">Time per question</span>
						<span className="block text-sm">
							Each question gets its own countdown. When time runs out, the
							screen flashes and you move to the next question.
						</span>
					</span>
				</label>
			</fieldset>

			<div className="mt-6">
				<p className="text-base font-medium">
					{mode === "total" ? "Total duration" : "Duration per question"}
				</p>
				<div className="mt-3 flex flex-wrap items-end gap-4">
					<label className="text-sm">
						Minutes
						<input
							type="number"
							min={0}
							className="mt-1 block w-24 border-theme px-2 py-1.5"
							value={minutes}
							onChange={(e) =>
								setMinutes(Math.max(0, Number(e.target.value) || 0))
							}
						/>
					</label>
					<label className="text-sm">
						Seconds
						<input
							type="number"
							min={0}
							max={59}
							className="mt-1 block w-24 border-theme px-2 py-1.5"
							value={seconds}
							onChange={(e) =>
								setSeconds(
									Math.min(59, Math.max(0, Number(e.target.value) || 0)),
								)
							}
						/>
					</label>
				</div>
				{mode === "perQuestion" && inputSeconds > 0 ? (
					<p className="mt-3 text-sm">
						Estimated total: {formatTime(estimatedTotalSeconds)} (
						{questionCount} × {formatTime(inputSeconds)})
					</p>
				) : null}
			</div>

			{setupError ? (
				<p className="mt-4 text-sm font-medium">Error: {setupError}</p>
			) : null}

			<div className="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					className="border-theme bg-accent px-3 py-1.5 text-sm text-accent-fg"
					onClick={handleStart}
				>
					Start test
				</button>
				<button
					type="button"
					className="border-theme px-3 py-1.5 text-sm"
					onClick={onBack}
				>
					Load different questions
				</button>
			</div>
		</section>
	);
}

function useCountdown(
	durationSeconds: number,
	onExpire: () => void,
	resetKey: number | string = 0,
) {
	const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
	const onExpireEvent = useEffectEvent(onExpire);

	const signature = `${durationSeconds}:${resetKey}`;
	const [prevSignature, setPrevSignature] = useState(signature);
	if (signature !== prevSignature) {
		setPrevSignature(signature);
		setSecondsLeft(durationSeconds);
	}

	// resetKey restarts the interval for per-question timers (not just durationSeconds).
	// biome-ignore lint/correctness/useExhaustiveDependencies: resetKey intentionally restarts the timer
	useEffect(() => {
		const endsAt = Date.now() + durationSeconds * 1000;
		let expired = false;

		const id = window.setInterval(() => {
			const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
			setSecondsLeft(left);
			if (left <= 0 && !expired) {
				expired = true;
				window.clearInterval(id);
				onExpireEvent();
			}
		}, 250);

		return () => {
			window.clearInterval(id);
		};
		// onExpireEvent is an Effect Event — stable and intentionally omitted.
	}, [durationSeconds, resetKey]);

	return secondsLeft;
}

function QuizTaking({
	questions,
	config,
	initialAnswers,
	onFinish,
}: {
	questions: Question[];
	config: TestConfig;
	initialAnswers: Array<string | number | null>;
	onFinish: (answers: Array<string | number | null>) => void;
}) {
	const [index, setIndex] = useState(0);
	const [answers, setAnswers] = useState(initialAnswers);
	const [flashing, setFlashing] = useState(false);
	const answersRef = useRef(answers);
	const flashTimeoutRef = useRef<number | null>(null);
	answersRef.current = answers;

	useEffect(() => {
		return () => {
			if (flashTimeoutRef.current !== null) {
				window.clearTimeout(flashTimeoutRef.current);
			}
		};
	}, []);

	const perQuestion = config.mode === "perQuestion";
	const secondsLeft = useCountdown(
		config.durationSeconds,
		() => {
			if (!perQuestion) {
				onFinish(answersRef.current);
				return;
			}
			setFlashing(true);
			if (flashTimeoutRef.current !== null) {
				window.clearTimeout(flashTimeoutRef.current);
			}
			flashTimeoutRef.current = window.setTimeout(() => {
				flashTimeoutRef.current = null;
				setFlashing(false);
				setIndex((i) => {
					if (i >= questions.length - 1) {
						onFinish(answersRef.current);
						return i;
					}
					return i + 1;
				});
			}, 550);
		},
		perQuestion ? index : 0,
	);

	const current = questions[index];
	const selected = answers[index];

	function selectChoice(choice: string | number) {
		if (flashing) return;
		setAnswers((prev) => {
			const next = [...prev];
			next[index] = choice;
			return next;
		});
	}

	function goNext() {
		if (flashing) return;
		if (index >= questions.length - 1) {
			onFinish(answers);
			return;
		}
		setIndex((i) => i + 1);
	}

	function goPrev() {
		if (flashing || index <= 0) return;
		setIndex((i) => i - 1);
	}

	const urgent = secondsLeft <= 10;

	return (
		<div className="min-h-screen">
			{flashing ? <div className="time-up-flash" aria-hidden="true" /> : null}
			<header className="sticky top-0 z-10 border-theme-b bg-bg px-4 py-3 pr-20">
				<div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
					<div className="text-sm">
						Question {index + 1} of {questions.length}
						{perQuestion ? (
							<span className="ml-2 text-sm opacity-70">· per question</span>
						) : null}
					</div>
					<p
						role="timer"
						className={`font-mono text-2xl font-bold tabular-nums ${urgent ? "underline" : ""}`}
						aria-live="polite"
					>
						{formatTime(secondsLeft)}
					</p>
				</div>
			</header>

			<main className="mx-auto max-w-3xl p-8">
				<h1 className="text-2xl font-bold leading-snug">{current.q}</h1>

				<fieldset className="mt-8">
					<legend className="sr-only">Choices</legend>
					<div className="space-y-3">
						{current.choices.map((choice) => {
							const isSelected =
								selected !== null && String(selected) === String(choice);
							return (
								<label
									key={String(choice)}
									className={`flex cursor-pointer items-center gap-3 border-theme px-4 py-3 text-base ${
										isSelected ? "bg-accent text-accent-fg" : ""
									} ${flashing ? "pointer-events-none" : ""}`}
								>
									<input
										type="radio"
										name={`q-${index}`}
										className="sr-only"
										checked={isSelected}
										onChange={() => selectChoice(choice)}
										disabled={flashing}
									/>
									<span>{String(choice)}</span>
								</label>
							);
						})}
					</div>
				</fieldset>

				<div className="mt-8 flex flex-wrap gap-3">
					<button
						type="button"
						className="border-theme px-3 py-1.5 text-sm disabled:opacity-40"
						onClick={goPrev}
						disabled={flashing || index === 0}
					>
						Previous
					</button>
					<button
						type="button"
						className="border-theme bg-accent px-3 py-1.5 text-sm text-accent-fg disabled:opacity-40"
						onClick={goNext}
						disabled={flashing}
					>
						{index >= questions.length - 1 ? "Submit test" : "Next"}
					</button>
					<button
						type="button"
						className="border-theme px-3 py-1.5 text-sm disabled:opacity-40"
						onClick={() => onFinish(answers)}
						disabled={flashing}
					>
						End early
					</button>
				</div>
			</main>
		</div>
	);
}

function QuizResults({
	questions,
	answers,
	onRetake,
	onNewQuestions,
}: {
	questions: Question[];
	answers: Array<string | number | null>;
	onRetake: () => void;
	onNewQuestions: () => void;
}) {
	const score = questions.reduce((sum, question, i) => {
		return sum + (answersMatch(answers[i], question.ans) ? 1 : 0);
	}, 0);
	const percent = Math.round((score / questions.length) * 100);

	return (
		<div className="mx-auto max-w-3xl p-8">
			<h1 className="text-3xl font-bold">Results</h1>
			<p className="mt-3 text-xl">
				Score: {score} / {questions.length} ({percent}%)
			</p>

			<div className="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					className="border-theme bg-accent px-3 py-1.5 text-sm text-accent-fg"
					onClick={onRetake}
				>
					Retake with same questions
				</button>
				<button
					type="button"
					className="border-theme px-3 py-1.5 text-sm"
					onClick={onNewQuestions}
				>
					Load new questions
				</button>
			</div>

			<section className="mt-10">
				<h2 className="text-xl font-semibold">Review</h2>
				<ol className="mt-4 list-decimal space-y-6 pl-5">
					{questions.map((question, i) => {
						const selected = answers[i];
						const correct = answersMatch(selected, question.ans);
						const unanswered = selected === null || selected === undefined;

						return (
							<li
								key={`${question.q}::${String(question.ans)}`}
								className={`rounded-theme border-2 p-4 text-base ${
									correct ? "border-success" : "border-danger"
								}`}
							>
								<div className="font-medium">{question.q}</div>
								<p className="mt-2 text-sm font-semibold">
									{unanswered
										? "Unanswered — incorrect"
										: correct
											? "Correct"
											: "Incorrect"}
								</p>
								<ul className="mt-3 space-y-2">
									{question.choices.map((choice) => {
										const isCorrectChoice =
											String(choice) === String(question.ans);
										const isUserChoice =
											selected !== null &&
											selected !== undefined &&
											String(choice) === String(selected);

										let mark = "";
										if (isCorrectChoice && isUserChoice) {
											mark = " ← your answer (correct)";
										} else if (isCorrectChoice) {
											mark = " ← correct answer";
										} else if (isUserChoice) {
											mark = " ← your answer";
										}

										return (
											<li
												key={String(choice)}
												className={`border-theme px-3 py-2 text-sm ${
													isCorrectChoice
														? "bg-accent text-accent-fg"
														: isUserChoice
															? "underline"
															: ""
												}`}
											>
												{String(choice)}
												{mark}
											</li>
										);
									})}
								</ul>
							</li>
						);
					})}
				</ol>
			</section>
		</div>
	);
}
