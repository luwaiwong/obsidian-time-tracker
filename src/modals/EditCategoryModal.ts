import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Category, Project } from "../types";
import ColorPicker from "../components/ColorPicker.svelte";
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
		this.headerEl = contentEl.createDiv();
		this.headerEl.style.cssText = `
			padding: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 8px;
			margin-bottom: 16px;
			margin-top: 8px;
			background-color: ${this.colorInput};
		`;

		this.headerTextEl = this.headerEl.createEl("span");
		this.headerTextEl.style.cssText = `
			font-size: 18px;
			font-weight: 600;
			color: white;
			text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
		`;
		this.headerTextEl.textContent = this.nameInput;

		// name input
		const nameContainer = contentEl.createDiv();
		nameContainer.style.marginBottom = "16px";

		const nameLabel = nameContainer.createEl("label", { text: "Name" });
		nameLabel.style.cssText =
			"display: block; font-weight: 500; margin-bottom: 4px;";

		const nameInputEl = nameContainer.createEl("input", {
			type: "text",
			value: this.nameInput,
			placeholder: "Project name",
		});
		nameInputEl.style.cssText = "width: 100%; padding: 8px;";
		nameInputEl.addEventListener("input", (e) => {
			this.nameInput = (e.target as HTMLInputElement).value;
		});

		// color picker
		const colorContainer = contentEl.createDiv();
		colorContainer.style.marginBottom = "16px";

		const colorLabel = colorContainer.createEl("label", { text: "Color" });
		colorLabel.style.cssText =
			"display: block; font-weight: 500; margin-bottom: 8px;";

		this.colorPickerContainer = colorContainer.createDiv();
		this.mountColorPicker();

		// bottom buttons
		const buttonContainer = contentEl.createDiv("modal-button-container");
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "space-between";
		buttonContainer.style.gap = "8px";
		buttonContainer.style.marginTop = "20px";

		const leftButtons = buttonContainer.createDiv();
		leftButtons.style.display = "flex";
		leftButtons.style.gap = "8px";

		const deleteButton = leftButtons.createEl("button", {
			text: "Delete",
			cls: "mod-warning",
			attr: { type: "button" },
		});
		deleteButton.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.delete();
		});

		const archiveButton = leftButtons.createEl("button", {
			text: this.category.archived ? "Unarchive" : "Archive",
			attr: { type: "button" },
		});
		archiveButton.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.toggleArchive();
		});

		const rightButtons = buttonContainer.createDiv();
		rightButtons.style.display = "flex";
		rightButtons.style.gap = "8px";

		const cancelButton = rightButtons.createEl("button", {
			text: "Cancel",
			attr: { type: "button" },
		});
		cancelButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.close();
		});

		const saveButton = rightButtons.createEl("button", {
			text: "Save",
			cls: "mod-cta",
			attr: { type: "button" },
		});
		saveButton.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.save();
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
		if (
			!confirm(
				`Delete category "${this.category.name}"? All projects in this category will be moved to Uncategorized.`,
			)
		) {
			return;
		}

		await this.plugin.categoryHandler.deleteCategory(this.category);
		this.plugin.refreshViews();
		this.onSave();
		new Notice(`Category "${this.category.name}" deleted`);
		this.close();
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
