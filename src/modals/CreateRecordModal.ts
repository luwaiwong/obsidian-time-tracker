import { App, Modal, Setting, Notice, setIcon } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Project, TimeRecord } from "../types";
import { ProjectModal } from "./ProjectModal";
import { CSVHandler } from "../utils/csvHandler";
import { formatDuration, formatDateTime } from "../utils/timeUtils";
import ProjectGrid from "../components/ProjectGrid.svelte";
import { mount, unmount } from "svelte";
import { title } from "process";

export class CreateRecordModal extends Modal {
	plugin: TimeTrackerPlugin;
	onComplete: () => void;
	isSwitching: boolean;

	private titleInput: string = "";
	private selectedProject: Project | null = null;
	private lastRecord: TimeRecord | null = null;
	private gridComponent: Record<string, unknown> | null = null;
	private titleInputEl: HTMLInputElement | null = null;

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
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("project-selector-modal");

		const title = this.plugin.settings.retroactiveTrackingEnabled
			? "Track Retroactively"
			: "Start Record";

		contentEl.createEl("h2", { text: title });

		// Show retroactive info if enabled
		if (
			this.plugin.settings.retroactiveTrackingEnabled &&
			this.lastRecord?.endTime
		) {
			const now = new Date();
			const gap = now.getTime() - this.lastRecord.endTime.getTime();
			const infoEl = contentEl.createDiv("retroactive-info");
			infoEl.setText(
				`Will fill: ${formatDateTime(this.lastRecord.endTime)} to now (${formatDuration(gap)})`,
			);
		}

		// Title input
		const titleSetting = new Setting(contentEl)
			.setName("Title")
			.setDesc("What are you working on?")
			.addText((text) => {
				this.titleInputEl = text.inputEl;
				text.setPlaceholder("Entry title...")
					.setValue(this.titleInput)
					.onChange((value) => {
						this.titleInput = value;
					});
			});

		// Repeat last button (if there's a last record)
		if (this.lastRecord) {
			const lastProject = this.plugin.getProjectById(
				this.lastRecord.projectId,
			);
			if (lastProject) {
				const repeatSetting = new Setting(contentEl);
				const repeatBtn = repeatSetting.controlEl.createEl("button", {
					cls: "mod-muted",
				});
				repeatBtn.style.display = "flex";
				repeatBtn.style.alignItems = "center";
				repeatBtn.style.gap = "8px";

				const iconSpan = repeatBtn.createSpan();
				setIcon(iconSpan, "repeat");

				repeatBtn.createSpan({
					text: `Repeat: ${lastProject.name}${this.lastRecord.title ? ` - ${this.lastRecord.title}` : ""}`,
				});

				repeatBtn.addEventListener("click", () => {
					this.selectedProject = lastProject;
					this.titleInput = this.lastRecord?.title || "";
					if (this.titleInputEl) {
						this.titleInputEl.value = this.titleInput;
					}
					this.save();
				});
			}
		}

		// Project grid label
		contentEl.createEl("div", {
			text: "Select Project",
			cls: "setting-item-name project-grid-label",
		});

		// Project grid container
		const gridContainer = contentEl.createDiv("project-grid-container");

		this.gridComponent = mount(ProjectGrid, {
			target: gridContainer,
			props: {
				plugin: this.plugin,
				selectedProjectId: this.selectedProject?.id || null,
				selectionMode: true,
				onProjectClick: (project: Project) => {
					this.selectedProject = project;
					// Auto-fill title from last record of same project if empty
					if (!this.titleInput) {
						this.autoFillTitle(project);
					}
					// Re-mount to show selection
					this.updateGrid(gridContainer);
				},
			},
		});

		// Create project button
		const createSetting = new Setting(contentEl);
		createSetting.addButton((btn) =>
			btn.setButtonText("New Project").onClick(() => {
				new ProjectModal(this.plugin.app, this.plugin, null, () => {
					this.plugin.refreshViews();
					// Refresh the grid
					this.updateGrid(gridContainer);
				}).open();
			}),
		);

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

	private updateGrid(container: HTMLElement): void {
		if (this.gridComponent) {
			unmount(this.gridComponent);
		}
		container.empty();
		this.gridComponent = mount(ProjectGrid, {
			target: container,
			props: {
				plugin: this.plugin,
				selectedProjectId: this.selectedProject?.id || null,
				selectionMode: true,
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

	private autoFillTitle(project: Project): void {
		const projectRecords = this.plugin.timesheetData.records
			.filter((r) => r.projectId === project.id && r.endTime !== null)
			.sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime());

		if (projectRecords.length > 0 && projectRecords[0].title) {
			this.titleInput = projectRecords[0].title;
			if (this.titleInputEl) {
				this.titleInputEl.value = this.titleInput;
			}
		}
	}

	onClose() {
		if (this.gridComponent) {
			unmount(this.gridComponent);
			this.gridComponent = null;
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

		this.plugin.startTimer(projectId, title);

		this.onComplete();
		this.close();
	}
}
