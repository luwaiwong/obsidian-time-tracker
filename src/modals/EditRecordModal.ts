import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Project, TimeRecord } from "../types";
import ProjectSelector from "../components/ProjectSelector.svelte";
import { mount, unmount } from "svelte";
import TimeSelector from "../components/TimeSelector.svelte";
import TextInput from "../components/TextInput.svelte";

export class EditRecordModal extends Modal {
	plugin: TimeTrackerPlugin;
	record: TimeRecord;
	onSave: () => void;

	private titleInput: string;
	private selectedProject: Project | null = null;
	private startTimeInput: Date;
	private endTimeInput: Date | null = null;
	private gridComponent: Record<string, unknown> | null = null;
	private startTimeComponent: Record<string, unknown> | null = null;
	private endTimeComponent: Record<string, unknown> | null = null;
	private titleComponent: Record<string, unknown> | null = null;

	private gridContainer: HTMLElement;
	private timeContainer: HTMLElement;
	private startTimeContainer: HTMLElement | null = null;
	private endTimeContainer: HTMLElement | null = null;
	private titleContainer: HTMLElement;

	constructor(
		app: App,
		plugin: TimeTrackerPlugin,
		record: TimeRecord,
		onSave: () => void,
	) {
		super(app);
		this.plugin = plugin;
		this.record = record;
		this.onSave = onSave;

		this.titleInput = record.title;
		this.selectedProject = plugin.getProjectById(record.projectId) || null;
		this.startTimeInput = record.startTime;
		this.endTimeInput = record.endTime ? record.endTime : null;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("edit-record-modal");

		contentEl.createEl("h2", { text: "Edit Record Entry" });

		// title
		const titleLabel = contentEl.createEl("p", { text: "Title" });
		titleLabel.style.cssText =
			"font-size: 1.1rem; font-weight: 500; margin: 12px 0 4px 0;";

		const titleDivider = contentEl.createEl("hr");
		titleDivider.style.cssText =
			"border: none; border-top: 1px solid var(--background-modifier-border); margin: 0 0 8px 0;";

		this.titleContainer = contentEl.createDiv("title-input-container");
		this.titleComponent = mount(TextInput, {
			target: this.titleContainer,
			props: {
				value: this.titleInput,
				placeholder: "Title",
				style: "height: 40px; font-size: 1rem;",
				onInput: (value: string) => {
					this.titleInput = value;
				},
			},
		});

		// project selector
		const projectLabel = contentEl.createEl("p", { text: "Project" });
		projectLabel.style.cssText =
			"font-size: 1.1rem; font-weight: 500; margin: 12px 0 4px 0;";

		const projectDivider = contentEl.createEl("hr");
		projectDivider.style.cssText =
			"border: none; border-top: 1px solid var(--background-modifier-border); margin: 0 0 8px 0;";

		this.gridContainer = contentEl.createDiv("project-grid-container");
		this.gridComponent = this.mountGridComponent(this.gridContainer);

		// time selector
		const timeLabel = contentEl.createEl("p", { text: "Time" });
		timeLabel.style.cssText =
			"font-size: 1.1rem; font-weight: 500; margin: 12px 0 4px 0;";

		const timeDivider = contentEl.createEl("hr");
		timeDivider.style.cssText =
			"border: none; border-top: 1px solid var(--background-modifier-border); margin: 0 0 8px 0;";

		this.timeContainer = contentEl.createDiv("time-grid-container");
		this.timeContainer.style.display = "flex";
		this.timeContainer.style.flexDirection = "column";
		this.timeContainer.style.gap = "12px";

		this.startTimeContainer = contentEl.createDiv();
		this.timeContainer.appendChild(this.startTimeContainer);
		this.startTimeComponent = this.mountStartTimeComponent(this.startTimeContainer);

		if (this.record.endTime !== null) {
			this.endTimeContainer = contentEl.createDiv();
			this.timeContainer.appendChild(this.endTimeContainer);
			this.endTimeComponent = this.mountEndTimeComponent(this.endTimeContainer);
		}

		// bottom buttons
		const buttonContainer = contentEl.createDiv("modal-button-container");
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "space-between";
		buttonContainer.style.gap = "8px";
		buttonContainer.style.marginTop = "20px";

		const deleteButton = buttonContainer.createEl("button", {
			text: "Delete",
			cls: "mod-warning",
			attr: { type: "button" },
		});
		deleteButton.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.delete();
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

	private updateGrid(container: HTMLElement): void {
		if (this.gridComponent) {
			unmount(this.gridComponent);
		}
		container.empty();
		this.gridComponent = this.mountGridComponent(this.gridContainer);
	}

	onClose() {
		if (this.gridComponent) {
			unmount(this.gridComponent);
			this.gridComponent = null;
		}
		if (this.startTimeComponent) {
			unmount(this.startTimeComponent);
			this.startTimeComponent = null;
		}
		if (this.endTimeComponent) {
			unmount(this.endTimeComponent);
			this.endTimeComponent = null;
		}
		if (this.titleComponent) {
			unmount(this.titleComponent);
			this.titleComponent = null;
		}
		const { contentEl } = this;
		contentEl.empty();
	}

	mountStartTimeComponent(container: HTMLElement) {
		return mount(TimeSelector, {
			target: container,
			props: {
				value: this.startTimeInput,
				title: "Start Time",
				customButton: {
					label: "Now",
					onClick: () => {
						this.startTimeInput = new Date();
						if (this.startTimeComponent) {
							unmount(this.startTimeComponent);
						}
						container.empty();
						this.startTimeComponent = this.mountStartTimeComponent(container);
					},
				},
				onChanged: (date: Date) => {
					this.startTimeInput = date;
				},
			},
		});
	}

	mountEndTimeComponent(container: HTMLElement) {
		return mount(TimeSelector, {
			target: container,
			props: {
				value: this.endTimeInput || new Date(),
				title: "End Time",
				customButton: {
					label: "Now",
					onClick: () => {
						this.endTimeInput = new Date();
						if (this.endTimeComponent) {
							unmount(this.endTimeComponent);
						}
						container.empty();
						this.endTimeComponent = this.mountEndTimeComponent(container);
					},
				},
				onChanged: (date: Date) => {
					this.endTimeInput = date;
				},
			},
		});
	}

	mountGridComponent(container: HTMLElement) {
		return mount(ProjectSelector, {
			target: container,
			props: {
				plugin: this.plugin,
				selectedProjectId: this.selectedProject?.id || null,
				selectionMode: true,
				dropdownMode: true,
				onProjectClick: (project: Project) => {
					this.selectedProject = project;
					this.updateGrid(container);
				},
			},
		});
	}
	async save() {
		const index = this.plugin.timesheetData.records.findIndex(
			(r) => r.id === this.record.id,
		);
		if (index === -1) {
			new Notice("Record entry not found");
			return;
		}

		const newStart = this.startTimeInput;
		const newEnd = this.endTimeInput ?? null;

		if (isNaN(newStart.getTime())) {
			new Notice("Invalid start time");
			return;
		}

		if (newEnd && isNaN(newEnd.getTime())) {
			new Notice("Invalid end time");
			return;
		}

		if (newEnd && newEnd.getTime() < newStart.getTime()) {
			new Notice("End time must be after start time");
			return;
		}

		this.plugin.timesheetData.records[index].title = this.titleInput.trim();
		if (this.selectedProject) {
			this.plugin.timesheetData.records[index].projectId =
				this.selectedProject.id;
		}
		this.plugin.timesheetData.records[index].startTime = newStart;
		this.plugin.timesheetData.records[index].endTime = newEnd;

		await this.plugin.saveTimesheet();
		this.plugin.refreshViews();
		this.onSave();
		this.close();
	}

	async delete() {
		const index = this.plugin.timesheetData.records.findIndex(
			(r) => r.id === this.record.id,
		);
		if (index === -1) {
			new Notice("Record entry not found");
			return;
		}

		this.plugin.timesheetData.records.splice(index, 1);
		await this.plugin.saveTimesheet();
		this.plugin.refreshViews();
		this.onSave();
		new Notice("Record entry deleted");
		this.close();
	}
}
