import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Project, TimeRecord } from "../types";
import ProjectSelector from "../components/ProjectSelector.svelte";
import { mount, unmount } from "svelte";
import TimeSelector from "../components/TimeSelector.svelte";
import TextInput from "../components/TextInput.svelte";
import Cards from "../components/Cards.svelte";
import { mountMiniTitle, mountSpacer } from "../utils/styleUtils";


export class EditRecordModal extends Modal {
	plugin: TimeTrackerPlugin;
	record: TimeRecord;
	onSave: () => void;

	private titleInput: string;
	private selectedProject: Project | null = null;
	private startTime: Date;
	private endTime: Date | null = null;

	private projectLabelContainer: HTMLElement;
	private projectLabelComponent: Record<string, unknown> | null = null;
	private gridComponent: Record<string, unknown> | null = null;

	private startTimeContainer: HTMLElement | null = null;
	private startTimeComponent: Record<string, unknown> | null = null;
	private endTimeComponent: Record<string, unknown> | null = null;
	private titleComponent: Record<string, unknown> | null = null;
	private titleLabelComponent: Record<string, unknown> | null = null;
	private timeCardsComponent: Record<string, unknown> | null = null;

	private timeCardsContainer: HTMLElement;
	private gridContainer: HTMLElement;
	private timeContainer: HTMLElement;
	private endTimeContainer: HTMLElement | null = null;
	private titleContainer: HTMLElement;
	private titleLabelContainer: HTMLElement;

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
		this.startTime = record.startTime;
		this.endTime = record.endTime ? record.endTime : null;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("edit-record-modal");

		// time info cards 
		this.scope.register([], "Enter", (e) => {
			e.preventDefault();
			this.save();
			return false;
		});
		
		this.timeCardsContainer = contentEl.createDiv();
		this.mountTimeCards();

		mountSpacer(contentEl, 16);

		// title
		this.titleLabelContainer = contentEl.createDiv();
		this.titleLabelContainer.style.margin = "0 16px 0px 0px";
		this.titleLabelComponent = mountMiniTitle(this.titleLabelContainer, "Title");
		this.titleContainer = contentEl.createDiv("title-input-container");
		this.titleComponent = mount(TextInput, {
			target: this.titleContainer,
			props: {
				value: this.titleInput,
				placeholder: "What were you working on?",
				style: "height: 40px; font-size: 1rem;",
				onInput: (value: string) => {
					this.titleInput = value;
				},
			},
		});
		
		this.timeContainer = contentEl.createDiv("time-grid-container");
		this.timeContainer.style.display = "flex";
		this.timeContainer.style.flexDirection = "column";
		this.timeContainer.style.gap = "8px";
		this.timeContainer.style.marginTop = "8px";

		this.startTimeContainer = contentEl.createDiv();
		this.timeContainer.appendChild(this.startTimeContainer);
		this.startTimeComponent = this.mountStartTimeComponent(this.startTimeContainer);

		if (this.record.endTime !== null) {
			this.endTimeContainer = contentEl.createDiv();
			this.timeContainer.appendChild(this.endTimeContainer);
			this.endTimeComponent = this.mountEndTimeComponent(this.endTimeContainer);
		}

		mountSpacer(contentEl, 8);

		// project selector
		this.projectLabelContainer = contentEl.createDiv()
		this.projectLabelContainer.style.margin = "0 16px 0px 0px";
		this.projectLabelComponent = mountMiniTitle(this.projectLabelContainer, "Project");
		this.gridContainer = contentEl.createDiv("project-grid-container");
		this.gridComponent = this.mountGridComponent(this.gridContainer);

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
		if (this.timeCardsComponent) {
			unmount(this.timeCardsComponent);
			this.timeCardsComponent = null;
		}
		if (this.titleLabelComponent) {
			unmount(this.titleLabelComponent);
			this.titleLabelComponent = null;
		}
		if (this.projectLabelComponent) {
			unmount(this.projectLabelComponent);
			this.projectLabelComponent = null;
		}
		const { contentEl } = this;
		contentEl.empty();
	}

	private mountTimeCards() {
		if (!this.timeCardsContainer) return;

		if (this.timeCardsComponent) {
			unmount(this.timeCardsComponent);
			this.timeCardsComponent = null;
		}
		this.timeCardsContainer.empty();

		this.timeCardsComponent = mount(Cards, {
			target: this.timeCardsContainer,
			props: {
				cards: [
					{ label: "Duration", value: this.endTime ? this.endTime.getTime() - this.startTime.getTime() : 0, isDate: false },
				],
			},
		});
	}	

	mountStartTimeComponent(container: HTMLElement) {
		return mount(TimeSelector, {
			target: container,
			props: {
				value: this.startTime,
				title: "Start Time",
				maxDate: this.endTime ?? undefined,
				customButton: {
					label: "Last",
					onClick: () => {
						// get last record
						const lastRecord = this.plugin.timesheetData.records.find(r => r.endTime !== null);
						if (lastRecord) {
							this.startTime = lastRecord.endTime!;
							this.mountTimeCards();
						}
					},
				},
				onChanged: (date: Date) => {
					this.startTime = date;
					this.mountTimeCards();
				},
			},
		});
	}

	mountEndTimeComponent(container: HTMLElement) {
		return mount(TimeSelector, {
			target: container,
			props: {
				value: this.endTime || new Date(),
				title: "End Time",
				minDate: this.startTime,
				customButton: {
					label: "Now",
					onClick: () => {
						this.endTime = new Date();
						this.mountTimeCards();
					},
				},
				onChanged: (date: Date) => {
					this.endTime = date;
					this.mountTimeCards();
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

		const newStart = this.startTime;
		const newEnd = this.endTime ?? null;

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
