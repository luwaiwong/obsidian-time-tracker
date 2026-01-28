import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Project, TimeRecord } from "../types";
import ProjectSelector from "../components/ProjectSelector.svelte";
import ModalActionButtons from "../components/ModalActionButtons.svelte";
import { mount, unmount } from "svelte";
import TimeGrid from "../components/TimeGrid.svelte";
import TextInput from "../components/TextInput.svelte";
import Cards from "../components/Cards.svelte";
import { mountMiniTitle, mountSpacer } from "../utils/styleUtils";
import { CreateRecordModal } from "./CreateRecordModal";


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

	private timeGridComponent: Record<string, unknown> | null = null;
	private titleComponent: Record<string, unknown> | null = null;
	private titleLabelComponent: Record<string, unknown> | null = null;
	private timeCardsComponent: Record<string, unknown> | null = null;
	private actionButtonsComponent: Record<string, unknown> | null = null;

	private timeCardsContainer: HTMLElement;
	private gridContainer: HTMLElement;
	private timeContainer: HTMLElement;
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
			void this.save();
			return false;
		});
		
		this.timeCardsContainer = contentEl.createDiv();
		this.mountTimeCards();

		mountSpacer(contentEl, 16);

		// title
		this.titleLabelContainer = contentEl.createDiv();
		this.titleLabelContainer.setCssProps({ margin: "0 16px 4px 0px" });
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
		
		this.timeContainer = contentEl.createDiv();
		this.timeGridComponent = mount(TimeGrid, {
			target: this.timeContainer,
			props: {
				startTime: {
					value: this.startTime,
					title: "Start Time",
					maxDate: this.endTime ?? undefined,
					customButton: {
						label: "Last",
						onClick: () => {
							const lastRecord = this.plugin.timesheetData.records.find(r => r.endTime !== null);
							if (lastRecord) {
								this.startTime = lastRecord.endTime!;
								this.mountTimeCards();
								this.updateTimeGrid();
							}
						},
					},
					onChanged: (date: Date) => {
						this.startTime = date;
						this.mountTimeCards();
						this.updateTimeGrid();
					},
				},
				endTime: this.record.endTime !== null ? {
					value: this.endTime,
					title: "End Time",
					minDate: this.startTime,
					customButton: {
						label: "Now",
						onClick: () => {
							this.endTime = new Date();
							this.mountTimeCards();
							this.updateTimeGrid();
						},
					},
					onChanged: (date: Date) => {
						this.endTime = date;
						this.mountTimeCards();
						this.updateTimeGrid();
					},
				} : null,
				gap: "8px",
				marginTop: "8px",
			},
		});

		mountSpacer(contentEl, 8);

		// project selector
		this.projectLabelContainer = contentEl.createDiv()
		this.projectLabelContainer.setCssProps({ margin: "0 16px 4px 0px" });
		this.projectLabelComponent = mountMiniTitle(this.projectLabelContainer, "Project");
		this.gridContainer = contentEl.createDiv("project-grid-container");
		this.gridComponent = this.mountGridComponent(this.gridContainer);

		// action buttons
		const buttonContainer = contentEl.createDiv();
		this.actionButtonsComponent = mount(ModalActionButtons, {
			target: buttonContainer,
			props: {
				rightButtons: [
					{
						text: "Cancel",
						onClick: () => this.close(),
						variant: "default",
					},
					{
						text: "New Record",
						onClick: () => this.createNew(),
						variant: "default",
					},
					{
						text: "Save",
						onClick: () => this.save(),
						variant: "cta",
					},
				],
				leftButtons: [
					{ text: "Delete", onClick: () => this.delete(), variant: "warning" },
				],
			},
		});
	}

	private updateGrid(container: HTMLElement): void {
		if (this.gridComponent) {
			void unmount(this.gridComponent);
		}
		container.empty();
		this.gridComponent = this.mountGridComponent(this.gridContainer);
	}

	onClose() {
		if (this.gridComponent) {
			void unmount(this.gridComponent);
			this.gridComponent = null;
		}
		if (this.timeGridComponent) {
			void unmount(this.timeGridComponent);
			this.timeGridComponent = null;
		}
		if (this.titleComponent) {
			void unmount(this.titleComponent);
			this.titleComponent = null;
		}
		if (this.timeCardsComponent) {
			void unmount(this.timeCardsComponent);
			this.timeCardsComponent = null;
		}
		if (this.titleLabelComponent) {
			void unmount(this.titleLabelComponent);
			this.titleLabelComponent = null;
		}
		if (this.projectLabelComponent) {
			void unmount(this.projectLabelComponent);
			this.projectLabelComponent = null;
		}
		if (this.actionButtonsComponent) {
			void unmount(this.actionButtonsComponent);
			this.actionButtonsComponent = null;
		}
		const { contentEl } = this;
		contentEl.empty();
	}

	private mountTimeCards() {
		if (!this.timeCardsContainer) return;

		if (this.timeCardsComponent) {
			void unmount(this.timeCardsComponent);
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

	private updateTimeGrid(): void {
		if (this.timeGridComponent) {
			void unmount(this.timeGridComponent);
		}
		this.timeContainer.empty();
		this.timeGridComponent = mount(TimeGrid, {
			target: this.timeContainer,
			props: {
				startTime: {
					value: this.startTime,
					title: "Start Time",
					maxDate: this.endTime ?? undefined,
					customButton: {
						label: "Last",
						onClick: () => {
							const lastRecord = this.plugin.timesheetData.records.find(r => r.endTime !== null);
							if (lastRecord) {
								this.startTime = lastRecord.endTime!;
								this.mountTimeCards();
								this.updateTimeGrid();
							}
						},
					},
					onChanged: (date: Date) => {
						this.startTime = date;
						this.mountTimeCards();
						this.updateTimeGrid();
					},
				},
				endTime: this.record.endTime !== null ? {
					value: this.endTime,
					title: "End Time",
					minDate: this.startTime,
					customButton: {
						label: "Now",
						onClick: () => {
							this.endTime = new Date();
							this.mountTimeCards();
							this.updateTimeGrid();
						},
					},
					onChanged: (date: Date) => {
						this.endTime = date;
						this.mountTimeCards();
						this.updateTimeGrid();
					},
				} : null,
				gap: "8px",
				marginTop: "8px",
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

	createNew() {
		this.close();
		new CreateRecordModal(this.app, this.plugin, this.onSave, false, this.titleInput, this.selectedProject ? this.selectedProject : undefined).open();
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
