import { App, Modal, Notice, setIcon } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Project, TimeRecord } from "../types";
import { ProjectModal } from "./ProjectModal";
import ProjectSelector from "../components/ProjectSelector.svelte";
import TimeSelector from "../components/TimeSelector.svelte";
import TextInput from "../components/TextInput.svelte";
import { mount, unmount } from "svelte";
import { formatDuration, formatDateTime } from "../utils/timeUtils";

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
	private timeComponent: Record<string, unknown> | null = null;
	private titleComponent: Record<string, unknown> | null = null;

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
			? "Track Retroactively"
			: "Start Record";

		contentEl.createEl("h2", { text: modalTitle });

		// Title section
		const titleLabel = contentEl.createEl("p", { text: "Title" });
		titleLabel.style.cssText =
			"font-size: 1.1rem; font-weight: 500; margin: 12px 0 4px 0;";
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

		// Repeat last button (if there's a last record)
		if (this.lastRecord) {
			const lastProject = this.plugin.getProjectById(
				this.lastRecord.projectId,
			);
			if (lastProject) {
				const repeatContainer = contentEl.createDiv();
				repeatContainer.style.cssText = "margin: 8px 0;";
				const repeatBtn = repeatContainer.createEl("button", {
					cls: "mod-muted",
				});
				repeatBtn.style.display = "flex";
				repeatBtn.style.alignItems = "center";
				repeatBtn.style.gap = "8px";
				repeatBtn.style.width = "100%";

				const iconSpan = repeatBtn.createSpan();
				setIcon(iconSpan, "repeat");

				repeatBtn.createSpan({
					text: `Repeat: ${lastProject.name}${this.lastRecord.title ? ` - ${this.lastRecord.title}` : ""}`,
				});

				repeatBtn.addEventListener("click", () => {
					this.selectedProject = lastProject;
					this.titleInput = this.lastRecord?.title || "";
					this.save();
				});
			}
		}

		// Project section
		const projectLabel = contentEl.createEl("p", { text: "Project" });
		projectLabel.style.cssText =
			"font-size: 1.1rem; font-weight: 500; margin: 12px 0 4px 0;";
		const projectDivider = contentEl.createEl("hr");
		projectDivider.style.cssText =
			"border: none; border-top: 1px solid var(--background-modifier-border); margin: 0 0 8px 0;";
		const gridContainer = contentEl.createDiv("project-grid-container");

		this.gridComponent = this.mountGridComponent(gridContainer);

		// Time section (only show for retroactive tracking)
		if (this.plugin.settings.retroactiveTrackingEnabled) {
			const timeLabel = contentEl.createEl("p", { text: "Time" });
			timeLabel.style.cssText =
				"font-size: 1.1rem; font-weight: 500; margin: 12px 0 4px 0;";
			const timeDivider = contentEl.createEl("hr");
			timeDivider.style.cssText =
				"border: none; border-top: 1px solid var(--background-modifier-border); margin: 0 0 8px 0;";
			const timeContainer = contentEl.createDiv("time-grid-container");

			this.timeComponent = mount(TimeSelector, {
				target: timeContainer,
				props: {
					startDate: this.startTime,
					endDate: this.endTime,
					showEnd: true,
					onStartChanged: (date: Date) => {
						this.startTime = date;
					},
					onEndChanged: (date: Date) => {
						this.endTime = date;
					},
				},
			});
		}

		// Action buttons
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
			? "Record Time"
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
				dropdownOpen: true,
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

	private updateGrid(container: HTMLElement): void {
		if (this.gridComponent) {
			unmount(this.gridComponent);
		}
		container.empty();
		this.gridComponent = this.mountGridComponent(container);
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
		if (this.timeComponent) {
			unmount(this.timeComponent);
			this.timeComponent = null;
		}
		if (this.titleComponent) {
			unmount(this.titleComponent);
			this.titleComponent = null;
		}
		const { contentEl } = this;
		contentEl.empty();
	}

	async save(projectId: number = -1): Promise<void> {
		if (!this.selectedProject && projectId === -1) {
			new Notice("Please select a project");
			return;
		}

		if (this.selectedProject) {
			projectId = this.selectedProject.id;
		}

		if (this.plugin.settings.retroactiveTrackingEnabled) {
			// Create a completed record
			if (!this.endTime) {
				new Notice("Please set an end time");
				return;
			}

			if (this.endTime.getTime() < this.startTime.getTime()) {
				new Notice("End time must be after start time");
				return;
			}

			const newRecord: TimeRecord = {
				id: Date.now(),
				projectId: projectId,
				title: this.titleInput.trim(),
				startTime: this.startTime,
				endTime: this.endTime,
			};

			this.plugin.timesheetData.records.push(newRecord);
			await this.plugin.saveTimesheet();
			this.plugin.refreshViews();
		} else {
			// Start a new timer
			this.plugin.startTimer(projectId, this.titleInput);
		}

		this.onComplete();
		this.close();
	}
}
