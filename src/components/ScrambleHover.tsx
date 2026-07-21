import { useEffect, useState } from "react";

const DEFAULT_CHARS =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+";

type ScrambleHoverProps = {
	text: string;
	scrambleSpeed?: number;
	maxIterations?: number;
	characters?: string;
	className?: string;
};

export function ScrambleHover({
	text,
	scrambleSpeed = 50,
	maxIterations = 8,
	characters = DEFAULT_CHARS,
	className,
}: ScrambleHoverProps) {
	const [displayText, setDisplayText] = useState(text);
	const [isHovering, setIsHovering] = useState(false);
	const [isScrambling, setIsScrambling] = useState(false);

	useEffect(() => {
		if (!isHovering) {
			setDisplayText(text);
			setIsScrambling(false);
			return;
		}

		setIsScrambling(true);
		let iteration = 0;
		const chars = characters.split("");

		const interval = setInterval(() => {
			iteration++;
			if (iteration >= maxIterations) {
				clearInterval(interval);
				setDisplayText(text);
				setIsScrambling(false);
				return;
			}

			setDisplayText(
				text
					.split("")
					.map((char) =>
						char === " "
							? " "
							: chars[Math.floor(Math.random() * chars.length)],
					)
					.join(""),
			);
		}, scrambleSpeed);

		return () => clearInterval(interval);
	}, [isHovering, text, characters, scrambleSpeed, maxIterations]);

	return (
		<span
			className={className}
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => setIsHovering(false)}
		>
			<span className="sr-only">{text}</span>
			<span aria-hidden="true" className="inline-block whitespace-pre">
				{displayText.split("").map((char, index) => (
					<span
						key={index}
						style={
							isScrambling && char !== " "
								? {
										color: `hsl(${(index * 36) % 360} 90% 55%)`,
									}
								: undefined
						}
					>
						{char}
					</span>
				))}
			</span>
		</span>
	);
}
