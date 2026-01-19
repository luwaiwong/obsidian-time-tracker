import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Project } from "../types";
import ColorPicker from "../components/ColorPicker.svelte";
import ModalActionButtons from "../components/ModalActionButtons.svelte";
import { ConfirmModal } from "./ConfirmModal";
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
	private actionButtonsComponent: Record<string, unknown> | null = null;
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
		this.headerEl = contentEl.createDiv({ cls: "modal-header-preview" });
		this.headerEl.style.backgroundColor = this.colorInput;

		this.headerIconEl = this.headerEl.createEl("span", { cls: "modal-header-icon" });
		this.headerIconEl.textContent = this.iconInput;

		// name input
		const nameContainer = contentEl.createDiv({ cls: "modal-input-container" });
		nameContainer.createEl("label", { text: "Name", cls: "modal-input-label" });

		const nameInputEl = nameContainer.createEl("input", {
			type: "text",
			value: this.nameInput,
			placeholder: "Project name",
			cls: "modal-input",
		});
		nameInputEl.addEventListener("input", (e) => {
			this.nameInput = (e.target as HTMLInputElement).value;
		});

		// icon input
		const iconContainer = contentEl.createDiv({ cls: "modal-input-container" });
		iconContainer.createEl("label", { text: "Icon/emoji", cls: "modal-input-label" });

		const iconInputEl = iconContainer.createEl("input", {
			type: "text",
			value: this.iconInput,
			placeholder: "Emoji or text",
			cls: "modal-input modal-input--icon",
		});
		iconInputEl.addEventListener("input", (e) => {
			this.iconInput = (e.target as HTMLInputElement).value;
			this.updateHeader();
		});

		// category dropdown
		const categoryContainer = contentEl.createDiv({ cls: "modal-input-container" });
		categoryContainer.createEl("label", { text: "Category", cls: "modal-input-label" });

		const categorySelect = categoryContainer.createEl("select", { cls: "modal-input" });

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
					{ text: this.project.archived ? "Unarchive" : "Archive", onClick: () => this.toggleArchive() },
				],
			},
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
			void unmount(this.colorPickerComponent);
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
			void unmount(this.colorPickerComponent);
			this.colorPickerComponent = null;
		}
		if (this.actionButtonsComponent) {
			void unmount(this.actionButtonsComponent);
			this.actionButtonsComponent = null;
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

		await this.plugin.editProject(this.project);
		
		this.onSave();
		this.close();
	}

	async delete() {
		new ConfirmModal(
			this.app,
			`Delete project "${this.project.name}"? All time records will be kept.`,
			() => {
				void (async () => {
				this.plugin.timesheetData.projects =
					this.plugin.timesheetData.projects.filter(
						(p) => p.id !== this.project.id,
					);

				await this.plugin.saveTimesheet();
				this.plugin.refreshViews();
				this.onSave();
				new Notice(`Project "${this.project.name}" deleted`);
				this.close();
			})();
			},
		).open();
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
