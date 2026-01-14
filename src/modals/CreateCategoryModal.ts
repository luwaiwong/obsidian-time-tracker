import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import ColorPicker from "../components/ColorPicker.svelte";
import ModalActionButtons from "../components/ModalActionButtons.svelte";
import { mount, unmount } from "svelte";
import { getRandomPresetColor } from "../utils/colorUtils";

export class CreateCategoryModal extends Modal {
	plugin: TimeTrackerPlugin;
	onSave: () => void;

	private nameInput: string = "";
	private colorInput: string;

	private colorPickerComponent: Record<string, unknown> | null = null;
	private colorPickerContainer: HTMLElement | null = null;
	private actionButtonsComponent: Record<string, unknown> | null = null;
	private headerEl: HTMLElement | null = null;

	constructor(app: App, plugin: TimeTrackerPlugin, onSave: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSave = onSave;
		this.colorInput = getRandomPresetColor();
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("create-category-modal");

		// Header with color preview
		this.headerEl = contentEl.createDiv({ cls: "modal-header-preview" });
		this.headerEl.style.backgroundColor = this.colorInput;

		const headerText = this.headerEl.createEl("span", { cls: "modal-header-text" });
		headerText.textContent = "New Category";

		// Name input
		const nameContainer = contentEl.createDiv({ cls: "modal-input-container" });
		nameContainer.createEl("label", { text: "Name", cls: "modal-input-label" });

		const nameInputEl = nameContainer.createEl("input", {
			type: "text",
			value: this.nameInput,
			placeholder: "Category name",
			cls: "modal-input",
		});
		nameInputEl.addEventListener("input", (e) => {
			this.nameInput = (e.target as HTMLInputElement).value;
		});

		// Color picker
		const colorContainer = contentEl.createDiv({ cls: "modal-input-container" });
		colorContainer.createEl("label", { text: "Color", cls: "modal-input-label modal-input-label--color" });

		this.colorPickerContainer = colorContainer.createDiv();
		this.mountColorPicker();

		// action buttons
		const buttonContainer = contentEl.createDiv();
		this.actionButtonsComponent = mount(ModalActionButtons, {
			target: buttonContainer,
			props: {
				primaryButton: {
					text: "Create",
					onClick: () => this.save(),
					variant: "cta",
				},
				cancelButton: { onClick: () => this.close() },
			},
		});
	}

	private updateHeader() {
		if (this.headerEl) {
			this.headerEl.style.backgroundColor = this.colorInput;
		}
	}

	private mountColorPicker() {
		if (!this.colorPickerContainer) return;

		if (this.colorPickerComponent) {
			unmount(this.colorPickerComponent);
		}

		this.colorPickerContainer.empty();

		this.colorPickerComponent = mount(ColorPicker, {
			target: this.colorPickerContainer,
			props: {
				value: this.colorInput,
				onChange: (color: string) => {
					this.colorInput = color;
					this.updateHeader();
					this.mountColorPicker();
				},
			},
		});
	}

	onClose() {
		if (this.colorPickerComponent) {
			unmount(this.colorPickerComponent);
			this.colorPickerComponent = null;
		}
		if (this.actionButtonsComponent) {
			unmount(this.actionButtonsComponent);
			this.actionButtonsComponent = null;
		}
		const { contentEl } = this;
		contentEl.empty();
	}

	async save() {
		if (!this.nameInput.trim()) {
			new Notice("Please enter a category name");
			return;
		}

		await this.plugin.categoryHandler.createCategory(this.nameInput.trim(), this.colorInput);
		this.plugin.refreshViews();
		this.onSave();
		this.close();
	}
}
