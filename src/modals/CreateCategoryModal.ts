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
		this.headerEl = contentEl.createDiv();
		this.headerEl.style.cssText = `
			padding: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 8px;
			margin-bottom: 16px;
			background-color: ${this.colorInput};
		`;

		const headerText = this.headerEl.createEl("span");
		headerText.style.cssText = `
			font-size: 18px;
			font-weight: 600;
			color: white;
			text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
		`;
		headerText.textContent = "New Category";

		// Name input
		const nameContainer = contentEl.createDiv();
		nameContainer.style.marginBottom = "16px";

		const nameLabel = nameContainer.createEl("label", { text: "Name" });
		nameLabel.style.cssText =
			"display: block; font-weight: 500; margin-bottom: 4px;";

		const nameInputEl = nameContainer.createEl("input", {
			type: "text",
			value: this.nameInput,
			placeholder: "Category name",
		});
		nameInputEl.style.cssText = "width: 100%; padding: 8px;";
		nameInputEl.addEventListener("input", (e) => {
			this.nameInput = (e.target as HTMLInputElement).value;
		});

		// Color picker
		const colorContainer = contentEl.createDiv();
		colorContainer.style.marginBottom = "16px";

		const colorLabel = colorContainer.createEl("label", { text: "Color" });
		colorLabel.style.cssText =
			"display: block; font-weight: 500; margin-bottom: 8px;";

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
