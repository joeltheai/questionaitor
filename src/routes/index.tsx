import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
	answersMatch,
	formatTime,
	parseQuestions,
	type Question,
} from "#/lib/questions";

export const Route = createFileRoute("/")({ component: Home });

type Phase = "upload" | "setup" | "taking" | "results";
type TimerMode = "total" | "perQuestion";

type TestConfig = {
	mode: TimerMode;
	/** Full-test duration in seconds (already multiplied if per-question). */
	durationSeconds: number;
};

function Home() {
	const [phase, setPhase] = useState<Phase>("upload");
	const [paste, setPaste] = useState("");
	const [questions, setQuestions] = useState<Question[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);
	const [config, setConfig] = useState<TestConfig | null>(null);
	const [answers, setAnswers] = useState<Array<string | number | null>>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	function loadFromText(text: string) {
		try {
			const parsed = parseQuestions(text);
			setQuestions(parsed);
			setError(null);
			setPaste(text);
			setPhase("setup");
			setConfig(null);
			setAnswers([]);
		} catch (err) {
			setQuestions(null);
			setError(
				err instanceof Error ? err.message : "Failed to load questions.",
			);
			setPhase("upload");
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
			setQuestions(null);
			setPhase("upload");
		};
		reader.readAsText(file);
	}

	function startTest(nextConfig: TestConfig) {
		if (!questions?.length) return;
		setConfig(nextConfig);
		setAnswers(Array.from({ length: questions.length }, () => null));
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

	return (
		<div className="p-8 max-w-3xl">
			<h1 className="text-3xl font-bold">Questionaitor</h1>
			<p className="mt-2 text-base">
				Upload a list of questions as JSON (paste, click, or drag and drop).
			</p>

			{phase === "upload" || !questions ? (
				<>
					<section className="mt-8">
						<h2 className="text-xl font-semibold">Paste JSON</h2>
						<textarea
							className="mt-3 block w-full border border-black p-3 font-mono text-sm"
							value={paste}
							onChange={(e) => setPaste(e.target.value)}
							rows={12}
							placeholder={`[
  {
    "q": "Your question?",
    "choices": [4.25, 5, 3.67, 2],
    "ans": 4.25
  }
]`}
						/>
						<button
							type="button"
							className="mt-3 border border-black px-3 py-1.5 text-sm"
							onClick={() => loadFromText(paste)}
						>
							Load from paste
						</button>
					</section>

					<section className="mt-8">
						<h2 className="text-xl font-semibold">Upload file</h2>
						<section
							aria-label="File drop zone"
							className={`mt-3 border border-black p-6 ${dragging ? "border-2" : ""}`}
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
									: "Drag and drop a .json file here, or use the button below."}
							</p>
							<button
								type="button"
								className="mt-3 border border-black px-3 py-1.5 text-sm"
								onClick={() => fileInputRef.current?.click()}
							>
								Upload file
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
					</section>

					{error ? (
						<p className="mt-6 text-sm font-medium">Error: {error}</p>
					) : null}
				</>
			) : (
				<QuizSetup
					questionCount={questions.length}
					onStart={startTest}
					onBack={() => {
						setPhase("upload");
						setQuestions(null);
					}}
				/>
			)}
		</div>
	);
}

function QuizSetup({
	questionCount,
	onStart,
	onBack,
}: {
	questionCount: number;
	onStart: (config: TestConfig) => void;
	onBack: () => void;
}) {
	const [mode, setMode] = useState<TimerMode>("total");
	const [minutes, setMinutes] = useState(10);
	const [seconds, setSeconds] = useState(0);
	const [setupError, setSetupError] = useState<string | null>(null);

	const inputSeconds = minutes * 60 + seconds;
	const totalSeconds =
		mode === "perQuestion" ? inputSeconds * questionCount : inputSeconds;

	function handleStart() {
		if (inputSeconds <= 0) {
			setSetupError("Set a timer greater than zero.");
			return;
		}
		setSetupError(null);
		// Always store the full-test duration. Per-question mode only
		// multiplies the input by question count to compute that total.
		onStart({ mode, durationSeconds: totalSeconds });
	}

	return (
		<section className="mt-8">
			<h2 className="text-xl font-semibold">Start test</h2>
			<p className="mt-2 text-sm">
				{questionCount} question{questionCount === 1 ? "" : "s"} loaded. Choose
				how the timer works, then begin.
			</p>

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
							Set one countdown for the whole test. When it hits zero, the
							test ends.
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
							Set a duration per question; total time is that times the number
							of questions. You can spend more or less on any question — the
							timer only ends the whole test when it hits zero.
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
							className="mt-1 block w-24 border border-black px-2 py-1.5"
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
							className="mt-1 block w-24 border border-black px-2 py-1.5"
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
						Total time: {formatTime(totalSeconds)} ({questionCount} ×{" "}
						{formatTime(inputSeconds)})
					</p>
				) : null}
			</div>

			{setupError ? (
				<p className="mt-4 text-sm font-medium">Error: {setupError}</p>
			) : null}

			<div className="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					className="border border-black bg-black px-3 py-1.5 text-sm text-white"
					onClick={handleStart}
				>
					Start test
				</button>
				<button
					type="button"
					className="border border-black px-3 py-1.5 text-sm"
					onClick={onBack}
				>
					Load different questions
				</button>
			</div>
		</section>
	);
}

function useCountdown(durationSeconds: number, onExpire: () => void) {
	const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
	const onExpireEvent = useEffectEvent(onExpire);

	const [prevDuration, setPrevDuration] = useState(durationSeconds);
	if (durationSeconds !== prevDuration) {
		setPrevDuration(durationSeconds);
		setSecondsLeft(durationSeconds);
	}

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
	}, [durationSeconds]);

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

	const secondsLeft = useCountdown(config.durationSeconds, () => {
		onFinish(answers);
	});

	const current = questions[index];
	const selected = answers[index];

	function selectChoice(choice: string | number) {
		setAnswers((prev) => {
			const next = [...prev];
			next[index] = choice;
			return next;
		});
	}

	function goNext() {
		if (index >= questions.length - 1) {
			onFinish(answers);
			return;
		}
		setIndex((i) => i + 1);
	}

	function goPrev() {
		if (index <= 0) return;
		setIndex((i) => i - 1);
	}

	const urgent = secondsLeft <= 10;

	return (
		<div className="min-h-screen">
			<header className="sticky top-0 z-10 border-b border-black bg-white px-4 py-3">
				<div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
					<div className="text-sm">
						Question {index + 1} of {questions.length}
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
									className={`flex cursor-pointer items-center gap-3 border border-black px-4 py-3 text-base ${
										isSelected ? "bg-black text-white" : ""
									}`}
								>
									<input
										type="radio"
										name={`q-${index}`}
										className="sr-only"
										checked={isSelected}
										onChange={() => selectChoice(choice)}
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
						className="border border-black px-3 py-1.5 text-sm disabled:opacity-40"
						onClick={goPrev}
						disabled={index === 0}
					>
						Previous
					</button>
					<button
						type="button"
						className="border border-black bg-black px-3 py-1.5 text-sm text-white"
						onClick={goNext}
					>
						{index >= questions.length - 1 ? "Submit test" : "Next"}
					</button>
					<button
						type="button"
						className="border border-black px-3 py-1.5 text-sm"
						onClick={() => onFinish(answers)}
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
					className="border border-black bg-black px-3 py-1.5 text-sm text-white"
					onClick={onRetake}
				>
					Retake with same questions
				</button>
				<button
					type="button"
					className="border border-black px-3 py-1.5 text-sm"
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
								className="text-base"
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
												className={`border border-black px-3 py-2 text-sm ${
													isCorrectChoice
														? "bg-black text-white"
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
