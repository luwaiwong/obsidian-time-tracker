import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Project } from "../types";
import ColorPicker from "../components/ColorPicker.svelte";
import { mount, unmount } from "svelte";

export class EditProjectModal extends Modal {
	plugin: TimeTrackerPlugin;
	project: Project;
	onSave: () => void;

	private nameInput: string;
	private iconInput: string;
	private colorInput: string;
	private categoryId: number;

	private colorPickerComponent: Record<string, unknown> | null = null;
	private colorPickerContainer: HTMLElement | null = null;
	private headerEl: HTMLElement | null = null;
	private headerIconEl: HTMLElement | null = null;

	constructor(
		app: App,
		plugin: TimeTrackerPlugin,
		project: Project,
		onSave: () => void,
	) {
		super(app);
		this.plugin = plugin;
		this.project = project;
		this.onSave = onSave;

		this.nameInput = project.name;
		this.iconInput = project.icon;
		this.colorInput = project.color;
		this.categoryId = project.categoryId;
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

		this.headerIconEl = this.headerEl.createEl("span");
		this.headerIconEl.style.cssText = `
			font-size: 32px;
			color: white;
			text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
		`;
		this.headerIconEl.textContent = this.iconInput;

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

		// icon input
		const iconContainer = contentEl.createDiv();
		iconContainer.style.marginBottom = "16px";

		const iconLabel = iconContainer.createEl("label", { text: "Icon/Emoji" });
		iconLabel.style.cssText =
			"display: block; font-weight: 500; margin-bottom: 4px;";

		const iconInputEl = iconContainer.createEl("input", {
			type: "text",
			value: this.iconInput,
			placeholder: "Emoji or text",
		});
		iconInputEl.style.cssText =
			"width: 100%; padding: 8px; font-size: 16px;";
		iconInputEl.addEventListener("input", (e) => {
			this.iconInput = (e.target as HTMLInputElement).value;
			this.updateHeader();
		});

		// category dropdown
		const categoryContainer = contentEl.createDiv();
		categoryContainer.style.marginBottom = "16px";

		const categoryLabel = categoryContainer.createEl("label", {
			text: "Category",
		});
		categoryLabel.style.cssText =
			"display: block; font-weight: 500; margin-bottom: 4px;";

		const categorySelect = categoryContainer.createEl("select");
		categorySelect.style.cssText = "width: 100%; padding: 8px;";

		const uncategorizedOption = categorySelect.createEl("option", {
			text: "Uncategorized",
			value: "-1",
		});
		if (this.categoryId === -1) {
			uncategorizedOption.selected = true;
		}

		for (const category of this.plugin.timesheetData.categories) {
			if (category.id !== 1) {
				const option = categorySelect.createEl("option", {
					text: category.name,
					value: String(category.id),
				});
				if (category.id === this.categoryId) {
					option.selected = true;
				}
			}
		}

		categorySelect.addEventListener("change", (e) => {
			this.categoryId = parseInt((e.target as HTMLSelectElement).value);
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
			text: this.project.archived ? "Unarchive" : "Archive",
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
		if (this.headerIconEl) {
			this.headerIconEl.textContent = this.iconInput;
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
		if (!this.nameInput.trim() || !this.iconInput.trim()) {
			new Notice("Please enter both project name and icon");
			return;
		}

		this.project.name = this.nameInput.trim();
		this.project.icon = this.iconInput.trim();
		this.project.color = this.colorInput;
		this.project.categoryId = this.categoryId;

		this.plugin.editProject(this.project);
		
		this.onSave();
		this.close();
	}

	async delete() {
		if (
			!confirm(
				`Delete project "${this.project.name}"? All time records will be kept.`,
			)
		) {
			return;
		}

		this.plugin.timesheetData.projects =
			this.plugin.timesheetData.projects.filter(
				(p) => p.id !== this.project.id,
			);

		await this.plugin.saveTimesheet();
		this.plugin.refreshViews();
		this.onSave();
		new Notice(`Project "${this.project.name}" deleted`);
		this.close();
	}

	async toggleArchive() {
		this.project.archived = !this.project.archived;
		await this.plugin.saveTimesheet();
		this.plugin.refreshViews();
		this.onSave();
		new Notice(
			`Project "${this.project.name}" ${this.project.archived ? "archived" : "unarchived"}`,
		);
		this.close();
	}
}
