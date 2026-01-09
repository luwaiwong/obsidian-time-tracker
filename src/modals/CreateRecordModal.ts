import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Project, TimeRecord } from "../types";
import ProjectSelector from "../components/ProjectSelector.svelte";
import TimeSelector from "../components/TimeSelector.svelte";
import TextInput from "../components/TextInput.svelte";
import RecentRecords from "../components/RecentRecords.svelte";
import Cards from "../components/Cards.svelte";
import { mount, unmount } from "svelte";

export class CreateRecordModal extends Modal {
	plugin: TimeTrackerPlugin;
	onComplete: () => void;
	isSwitching: boolean;

	private titleInput: string = "";
	private selectedProject: Project | null = null;
	private lastRecord: TimeRecord | null = null;
	private startTime: Date;
	private endTime: Date | null = null;
	private gridComponent: Record<string, unknown> | null = null;
	private startTimeComponent: Record<string, unknown> | null = null;
	private endTimeComponent: Record<string, unknown> | null = null;
	private titleComponent: Record<string, unknown> | null = null;
	private recentRecordsComponent: Record<string, unknown> | null = null;
	private timeCardsComponent: Record<string, unknown> | null = null;
	private startTimeContainer: HTMLElement | null = null;
	private endTimeContainer: HTMLElement | null = null;
	private timeCardsContainer: HTMLElement | null = null;

	constructor(
		app: App,
		plugin: TimeTrackerPlugin,
		onComplete: () => void,
		isSwitching: boolean = false,
		initialTitle: string = "",
		selectedProject: Project | null = null,
	) {
		super(app);
		this.plugin = plugin;
		this.onComplete = onComplete;
		this.selectedProject = selectedProject;
		this.isSwitching = isSwitching;
		this.titleInput = initialTitle;
		this.lastRecord = plugin.getLastStoppedRecord();

		// Set default times
		if (
			this.plugin.settings.retroactiveTrackingEnabled &&
			this.lastRecord?.endTime
		) {
			this.startTime = this.lastRecord.endTime;
			this.endTime = new Date();
		} else {
			this.startTime = new Date();
			this.endTime = null;
		}
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("create-record-modal");

		const modalTitle = this.plugin.settings.retroactiveTrackingEnabled
			? "Record Retroactively:"
			: "Start Record:";

		contentEl.createEl("h2", { text: modalTitle });

		this.scope.register([], "Enter", (e) => {
			e.preventDefault();
			this.save();
			return false;
		});
		

		// time info cards 
		this.timeCardsContainer = contentEl.createDiv();
		this.mountTimeCards();

		// recent records section
		const recentContainer = contentEl.createDiv();
		this.recentRecordsComponent = mount(RecentRecords, {
			target: recentContainer,
			props: {
				plugin: this.plugin,
				maxRecords: 3,
				onRefresh: () => {
					this.onComplete();
					this.close();
				},
			},
		});


		// time selectors
		const timeContainer = contentEl.createDiv("time-grid-container");
		timeContainer.style.display = "flex";
		timeContainer.style.flexDirection = "column";
		timeContainer.style.gap = "12px";
		timeContainer.style.marginTop = "4px";
		this.startTimeContainer = contentEl.createDiv();
		timeContainer.appendChild(this.startTimeContainer);
		this.startTimeComponent = this.mountStartTimeComponent(this.startTimeContainer);

		if (this.plugin.settings.retroactiveTrackingEnabled) {
			this.endTimeContainer = contentEl.createDiv();
			timeContainer.appendChild(this.endTimeContainer);
			this.endTimeComponent = this.mountEndTimeComponent(this.endTimeContainer);
		}

		// title section
		contentEl.createEl("h3", { text: "Title" });
		const titleDivider = contentEl.createEl("hr");
		titleDivider.style.cssText =
			"border: none; border-top: 1px solid var(--background-modifier-border); margin: 0 0 8px 0;";
		const titleContainer = contentEl.createDiv("title-input-container");
		this.titleComponent = mount(TextInput, {
			target: titleContainer,
			props: {
				value: this.titleInput,
				placeholder: "What are you working on?",
				style: "height: 40px; font-size: 1rem;",
				onInput: (value: string) => {
					this.titleInput = value;
				},
			},
		});
		
		// project section
		const projectLabel = contentEl.createEl("h3", { text: "Project" });
		const projectDivider = contentEl.createEl("hr");
		projectDivider.style.cssText =
			"border: none; border-top: 1px solid var(--background-modifier-border); margin: 0 0 8px 0;";
		const gridContainer = contentEl.createDiv("project-grid-container");

		this.gridComponent = this.mountGridComponent(gridContainer);


		// action buttons
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

		const actionText = this.plugin.settings.retroactiveTrackingEnabled
			? "Record"
			: "Start";
		const saveButton = buttonContainer.createEl("button", {
			text: actionText,
			cls: "mod-cta",
			attr: { type: "button" },
		});
		saveButton.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.save();
		});
	}

	private mountGridComponent(container: HTMLElement) {
		return mount(ProjectSelector, {
			target: container,
			props: {
				plugin: this.plugin,
				selectedProjectId: this.selectedProject?.id || null,
				selectionMode: true,
				dropdownMode: true,
				dropdownOpen: this.selectedProject ? false : true,
				onProjectClick: (project: Project) => {
					this.selectedProject = project;
					if (!this.titleInput) {
						this.autoFillTitle(project);
					}
					this.updateGrid(container);
				},
			},
		});
	}

	private mountStartTimeComponent(container: HTMLElement) {
		return mount(TimeSelector, {
			target: container,
			props: {
				value: this.startTime,
				title: "Start Time",
				maxDate: this.plugin.settings.retroactiveTrackingEnabled && this.endTime
					? this.endTime
					: undefined,
				customButton: this.lastRecord?.endTime ? {
					label: "Last",
					onClick: () => {
						if (this.lastRecord?.endTime) {
							this.startTime = this.lastRecord.endTime;
							this.mountTimeCards();
						}
					},
				} : undefined,
				onChanged: (date: Date) => {
					this.startTime = date;
					this.mountTimeCards();
				},
			},
		});
	}

	private mountEndTimeComponent(container: HTMLElement) {
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

	private updateGrid(container: HTMLElement): void {
		if (this.gridComponent) {
			unmount(this.gridComponent);
		}
		container.empty();
		this.gridComponent = this.mountGridComponent(container);
	}

	private mountTimeCards(): void {
		if (!this.timeCardsContainer) return;
		if (this.timeCardsComponent) {
			unmount(this.timeCardsComponent);
		}
		this.timeCardsContainer.empty();

		const cards: { label: string; value: number | Date; isDate?: boolean }[] = [];

		if (this.lastRecord?.endTime) {
			cards.push({ label: "Since Last", value: this.lastRecord.endTime, isDate: true });
		}

		if (this.plugin.settings.retroactiveTrackingEnabled && this.endTime) {
			cards.push({ label: "Duration", value: this.endTime.getTime() - this.startTime.getTime() });
			cards.push({ label: "Time Remaining", value: this.endTime, isDate: true });
		}

		this.timeCardsComponent = mount(Cards, {
			target: this.timeCardsContainer,
			props: { cards },
		});
	}

	private autoFillTitle(project: Project): void {
		const projectRecords = this.plugin.timesheetData.records
			.filter((r) => r.projectId === project.id && r.endTime !== null)
			.sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime());

		if (projectRecords.length > 0 && projectRecords[0].title) {
			this.titleInput = projectRecords[0].title;
		}
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
		if (this.recentRecordsComponent) {
			unmount(this.recentRecordsComponent);
			this.recentRecordsComponent = null;
		}
		if (this.timeCardsComponent) {
			unmount(this.timeCardsComponent);
			this.timeCardsComponent = null;
		}
		const { contentEl } = this;
		contentEl.empty();
	}

	async save(projectId: number = -1): Promise<void> {
		if (!this.startTime) {
			new Notice("Please set a start time");
			return;
		}

		if (this.selectedProject) {
			projectId = this.selectedProject.id;
		}


		if (this.plugin.settings.retroactiveTrackingEnabled) {
			// check end time
			if (this.endTime && this.endTime.getTime() < this.startTime.getTime()) {
				new Notice("End time must be after start time");
				return;
			}

			this.plugin.startTimer(projectId, this.titleInput.trim(), this.startTime, this.endTime ?? undefined);
		} else {
			// Start a new timer
			this.plugin.startTimer(projectId, this.titleInput, this.startTime, this.endTime ?? undefined);
		}

		this.onComplete();
		this.close();
	}
}
