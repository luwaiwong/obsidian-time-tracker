import { App, Modal } from "obsidian";
import ModalActionButtons from "../components/ModalActionButtons.svelte";
import { mount, unmount } from "svelte";

export class ConfirmModal extends Modal {
	private message: string;
	private onConfirm: () => void;
	private actionButtonsComponent: Record<string, unknown> | null = null;

	constructor(app: App, message: string, onConfirm: () => void) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("confirm-modal");

		contentEl.createEl("p", { text: this.message });

		const buttonContainer = contentEl.createDiv();
		this.actionButtonsComponent = mount(ModalActionButtons, {
			target: buttonContainer,
			props: {
				primaryButton: {
					text: "Delete",
					onClick: () => {
						this.onConfirm();
						this.close();
					},
					variant: "warning",
				},
				cancelButton: { onClick: () => this.close() },
			},
		});
	}

	onClose() {
		if (this.actionButtonsComponent) {
			unmount(this.actionButtonsComponent);
			this.actionButtonsComponent = null;
		}
		this.contentEl.empty();
	}
}
