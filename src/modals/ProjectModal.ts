import { App, Modal, Setting, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Project } from "../types";
import { CSVHandler } from "../utils/csvHandler";

export class ProjectModal extends Modal {
	plugin: TimeTrackerPlugin;
	project: Project | null;
	onSave: () => void;

	private nameInput: string = "";
	private iconInput: string = "🕐";
	private colorInput: string = "#4ECDC4";
	private categoryId: number = -1;

	constructor(
		app: App,
		plugin: TimeTrackerPlugin,
		project: Project | null,
		onSave: () => void,
	) {
		super(app);
		this.plugin = plugin;
		this.project = project;
		this.onSave = onSave;

		if (project) {
			this.nameInput = project.name;
			this.iconInput = project.icon;
			this.colorInput = project.color;
			this.categoryId = project.categoryId;
		}
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h2", {
			text: this.project ? "Edit Project" : "New Project",
		});

		new Setting(contentEl)
			.setName("Project Name")
			.setDesc("The name of your project")
			.addText((text) =>
				text
					.setPlaceholder("e.g., Study Math")
					.setValue(this.nameInput)
					.onChange((value) => {
						this.nameInput = value;
					}),
			);

		new Setting(contentEl)
			.setName("Icon")
			.setDesc("Enter an emoji or text (e.g., 📚, MAT, 301)")
			.addText((text) =>
				text
					.setPlaceholder("📚")
					.setValue(this.iconInput)
					.onChange((value) => {
						this.iconInput = value;
					}),
			);

		new Setting(contentEl)
			.setName("Color")
			.setDesc("Pick a color for this project")
			.addColorPicker((color) =>
				color.setValue(this.colorInput).onChange((value) => {
					this.colorInput = value;
				}),
			);

		new Setting(contentEl)
			.setName("Category")
			.setDesc("Assign to a category (optional)")
			.addDropdown((dropdown) => {
				dropdown.addOption("-1", "Uncategorized");
				for (const category of this.plugin.timesheetData.categories) {
					if (category.id !== 1) {
						dropdown.addOption(String(category.id), category.name);
					}
				}
				dropdown.setValue(String(this.categoryId));
				dropdown.onChange((value) => {
					this.categoryId = parseInt(value);
				});
			});

		const buttonContainer = contentEl.createDiv("modal-button-container");
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.gap = "8px";
		buttonContainer.style.marginTop = "20px";

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
			attr: { type: "button" },
		});
		cancelButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.close();
		});

		const saveButton = buttonContainer.createEl("button", {
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

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	async save() {
		if (!this.nameInput.trim() || !this.iconInput.trim()) {
			new Notice("Please enter both project name and icon");
			return;
		}

		if (this.project) {
			const oldName = this.project.name;
			const newName = this.nameInput.trim();

			this.project.name = newName;
			this.project.icon = this.iconInput.trim();
			this.project.color = this.colorInput;
			this.project.categoryId = this.categoryId;

			// Update all records that reference the old project name
			if (oldName !== newName) {
				for (const record of this.plugin.timesheetData.records) {
					if (record.projectName === oldName) {
						record.projectName = newName;
					}
				}
			}
		} else {
			const newId = CSVHandler.getNextId(
				this.plugin.timesheetData.projects,
			);
			const newProject: Project = {
				id: newId,
				name: this.nameInput.trim(),
				icon: this.iconInput.trim(),
				color: this.colorInput,
				categoryId: this.categoryId,
				archived: false,
				order: this.plugin.timesheetData.projects.length,
			};

			this.plugin.timesheetData.projects.push(newProject);
		}

		await this.plugin.saveTimesheet();
		this.plugin.refreshViews();
		this.onSave();
		this.close();
	}
}
