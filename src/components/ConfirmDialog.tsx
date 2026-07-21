import { AlertDialog } from "@base-ui/react/alert-dialog";

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	confirmLabel: string;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog.Root open={open} onOpenChange={onOpenChange}>
			<AlertDialog.Portal>
				<AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-black/50 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
				<AlertDialog.Popup className="fixed top-1/2 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border-theme bg-bg p-4 outline-none transition-[scale,opacity] duration-150 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0">
					<AlertDialog.Title className="text-lg font-semibold">
						{title}
					</AlertDialog.Title>
					<AlertDialog.Description className="mt-2 text-sm">
						{description}
					</AlertDialog.Description>
					<div className="mt-4 flex flex-wrap justify-end gap-2">
						<AlertDialog.Close className="border-theme px-3 py-1.5 text-sm">
							Cancel
						</AlertDialog.Close>
						<button
							type="button"
							className="border-theme bg-accent px-3 py-1.5 text-sm text-accent-fg"
							onClick={() => {
								onConfirm();
								onOpenChange(false);
							}}
						>
							{confirmLabel}
						</button>
					</div>
				</AlertDialog.Popup>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	);
}
