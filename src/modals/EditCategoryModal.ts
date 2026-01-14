import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Category } from "../types";
import ColorPicker from "../components/ColorPicker.svelte";
import ModalActionButtons from "../components/ModalActionButtons.svelte";
import { ConfirmModal } from "./ConfirmModal";
import { mount, unmount } from "svelte";

export class EditCategoryModal extends Modal {
	plugin: TimeTrackerPlugin;
	category: Category;
	onSave: () => void;

	private nameInput: string;
	private colorInput: string;
	private archived: boolean;

	private colorPickerComponent: Record<string, unknown> | null = null;
	private colorPickerContainer: HTMLElement | null = null;
	private actionButtonsComponent: Record<string, unknown> | null = null;
	private headerEl: HTMLElement | null = null;
	private headerTextEl: HTMLElement | null = null;

	constructor(
		app: App,
		plugin: TimeTrackerPlugin,
		category: Category,
		onSave: () => void,
	) {
		super(app);
		this.plugin = plugin;
		this.category = category;
		this.onSave = onSave;

		this.nameInput = category.name;
		this.colorInput = category.color;
		this.archived = category.archived;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("edit-project-modal");

		// header with color and icon preview
		this.headerEl = contentEl.createDiv({ cls: "modal-header-preview" });
		this.headerEl.style.backgroundColor = this.colorInput;

		this.headerTextEl = this.headerEl.createEl("span", { cls: "modal-header-text" });
		this.headerTextEl.textContent = this.nameInput;

		// name input
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

		// color picker
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
					text: "Save",
					onClick: () => this.save(),
					variant: "cta",
				},
				cancelButton: { onClick: () => this.close() },
				leftButtons: [
					{ text: "Delete", onClick: () => this.delete(), variant: "warning" },
					{ text: this.category.archived ? "Unarchive" : "Archive", onClick: () => this.toggleArchive() },
				],
			},
		});
	}

	private updateHeader() {
		if (this.headerEl) {
			this.headerEl.style.backgroundColor = this.colorInput;
		}
		if (this.headerTextEl) {
			this.headerTextEl.textContent = this.nameInput;
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
					// Remount to update selected state
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
			new Notice("Please enter both project name and icon");
			return;
		}

		this.category.name = this.nameInput.trim();
		this.category.color = this.colorInput;
		this.category.archived = this.archived;

		await this.plugin.categoryHandler.editCategory(this.category);
		
		this.onSave();
		this.close();
	}

	async delete() {
		new ConfirmModal(
			this.app,
			`Delete category "${this.category.name}"? All projects in this category will be moved to Uncategorized.`,
			async () => {
				await this.plugin.categoryHandler.deleteCategory(this.category);
				this.plugin.refreshViews();
				this.onSave();
				new Notice(`Category "${this.category.name}" deleted`);
				this.close();
			},
		).open();
	}

	async toggleArchive() {
		this.category.archived = !this.category.archived;
		await this.plugin.categoryHandler.archiveCategory(this.category);
		this.plugin.refreshViews();
		this.onSave();
		new Notice(
			`Category "${this.category.name}" ${this.category.archived ? "archived" : "unarchived"}`,
		);
		this.close();
	}
}
