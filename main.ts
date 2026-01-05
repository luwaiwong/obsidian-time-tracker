import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { TimeTrackerSettingTab } from "./src/settings";
import {
	TimeTrackerView,
	VIEW_TYPE_TIME_TRACKER,
} from "./src/views/TimeTrackerView";
import { AnalyticsView, VIEW_TYPE_ANALYTICS } from "./src/views/AnalyticsView";
import { ScheduleView, VIEW_TYPE_SCHEDULE } from "./src/views/ScheduleView";
import { CSVHandler } from "./src/utils/csvHandler";
import type {
	PluginSettings,
	TimesheetData,
	TimeRecord,
	Project,
} from "./src/types";
import { TimeTrackerCodeBlockProcessor } from "./src/codeBlockProcessor";
import { ImportModal } from "./src/modals/ImportSTTModal";

const DEFAULT_SETTINGS: PluginSettings = {
	timesheetPath: "timesheet.csv",
	settingsPath: "time-tracker-settings.json",

	retroactiveTrackingEnabled: false,
	showSeconds: true,
	showArchivedProjects: false,
	gridColumns: 3,
	defaultTimeRange: "week",
	customStartDate: Date.now(),
	customEndDate: Date.now(),
	showNotifications: true,
	inactivityReminderDuration: 3600,
	activityReminderDuration: 1800,
	embeddedRecentRecordsCount: 5,
	sortMode: "manual",
	categoryFilter: [],
};

export default class TimeTrackerPlugin extends Plugin {
	settings: PluginSettings;
	timesheetData: TimesheetData = {
		records: [],
		projects: [],
		categories: [],
	};
	csvHandler: CSVHandler;
	private timesheetFile: TFile | null = null;
	error: string | null = null;
	isLoading: boolean = true;

	// ----- OBSIDIAN FUNCTIONS -----
	async onload() {
		await this.loadSettings();
		this.csvHandler = new CSVHandler(this.app.vault);

		this.registerView(
			VIEW_TYPE_TIME_TRACKER,
			(leaf) => new TimeTrackerView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_ANALYTICS,
			(leaf) => new AnalyticsView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_SCHEDULE,
			(leaf) => new ScheduleView(leaf, this),
		);

		this.addRibbonIcon("clock", "Time Tracker", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-time-tracker",
			name: "Open Time Tracker",
			callback: () => this.activateView(),
		});
		this.addCommand({
			id: "open-analytics",
			name: "Open Analytics",
			callback: () => this.activateAnalyticsView(),
		});
		this.addCommand({
			id: "open-schedule",
			name: "Open Schedule",
			callback: () => this.activateScheduleView(),
		});
		this.addCommand({
			id: "toggle-last-timer",
			name: "Toggle Last Used Timer",
			callback: () => this.toggleLastTimer(),
		});
		this.addCommand({
			id: "import-STT-data",
			name: "Import Data from Simple Time Tracker",
			callback: () => new ImportModal(this.app, this).open(),
		});

		this.registerMarkdownCodeBlockProcessor(
			"time-tracker",
			(source, el, ctx) => {
				const processor = new TimeTrackerCodeBlockProcessor(this);
				processor.process(source, el, ctx);
			},
		);

		this.addSettingTab(new TimeTrackerSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(async () => {
			await this.loadTimesheet();
			this.activateView();
		});

		this.registerInterval(
			window.setInterval(() => this.saveTimesheet(), 5 * 60 * 1000),
		);
	}

	async onunload() {
		await this.saveTimesheet();
	}

	// ----- LOADING DATA -----
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadTimesheet() {
		this.isLoading = true;
		console.log("Loading timesheet...");
		try {
			const file = await this.app.vault.getAbstractFileByPath(
				this.settings.timesheetPath,
			);
			console.log("File found:", file);

			if (file instanceof TFile) {
				this.timesheetFile = file;
				this.timesheetData = await this.csvHandler.parseTimesheet(file);
			} else {
				this.timesheetFile = await this.csvHandler.createTimesheet(
					this.settings.timesheetPath,
				);
				this.timesheetData = await this.csvHandler.parseTimesheet(
					this.timesheetFile,
				);
			}
		} catch (err) {
			console.error("Error loading timesheet:", err);
			this.error = "Error loading Timesheet: " + err;
		} finally {
			this.isLoading = false;
			this.refreshViews();
		}
	}

	async saveTimesheet() {
		if (!this.timesheetFile) return;

		try {
			await this.csvHandler.writeTimesheet(
				this.timesheetFile,
				this.timesheetData,
			);
		} catch (err) {
			console.error("Error saving timesheet:", err);
			this.error = "Error saving Timesheet: " + err;
		}
	}

	get runningTimers(): TimeRecord[] {
		if (!this.timesheetData || !this.timesheetData.records) {
			return [];
		}
		return this.timesheetData.records.filter(
			(record) => record.endTime === null,
		);
	}

	// ----- RECORDS -----

	/*
	 * Start tracking time without a project
	 * Can only be used when retroactive mode is off
	 * @param title - The title of the task being tracked
	 */
	startTimerWithoutProject(title: string = "") {
		if (this.settings.retroactiveTrackingEnabled) {
			throw new Error(
				"Cannot start timer without project in retroactive mode",
			);
		}

		const now = new Date();

		this.stopAllTimers();

		// Create a new record with null endTime (running timer) and empty projectName
		const newRecord: TimeRecord = {
			id: CSVHandler.getNextId(this.timesheetData.records),
			projectId: -1,
			startTime: now,
			endTime: null,
			title: title,
		};
		this.timesheetData.records.push(newRecord);

		this.saveTimesheet();
		this.refreshViews();
	}

	/** Start tracking time for a project */
	startTimer(
		projectId: number = -1,
		title: string = "",
		startTime: Date = new Date(),
	) {
		const project = this.getProjectById(projectId);
		if (!project) return;

		const now = new Date();

		// for retroactive
		if (this.settings.retroactiveTrackingEnabled) {
			const lastRecord = this.getLastStoppedRecord();
			if (lastRecord && lastRecord.endTime) {
				const gap = now.getTime() - lastRecord.endTime.getTime();
				if (gap > 0) {
					if (lastRecord.projectId === project.id) {
						// Extend the last record
						const index = this.timesheetData.records.findIndex(
							(r) => r.id === lastRecord.id,
						);
						if (index !== -1) {
							this.timesheetData.records[index].endTime = now;
						}
					} else {
						// Create a new completed record for the gap
						const newRecord: TimeRecord = {
							id: CSVHandler.getNextId(
								this.timesheetData.records,
							),
							projectId: project.id,
							startTime: lastRecord.endTime,
							endTime: now,
							title: title,
						};
						this.timesheetData.records.push(newRecord);
					}
				}
			}
		} else {
			this.stopAllTimers();

			// Check if this project is already running
			const existingTimer = this.runningTimers.find(
				(t) => t.projectId === projectId,
			);

			if (existingTimer) {
				this.stopTimer(projectId);
			} else {
				// Create a new record with null endTime (running timer)
				const newRecord: TimeRecord = {
					id: CSVHandler.getNextId(this.timesheetData.records),
					projectId: project.id,
					startTime: now,
					endTime: null,
					title: "",
				};
				this.timesheetData.records.push(newRecord);
			}
		}

		this.saveTimesheet();
		this.refreshViews();
	}

	/** Stop a specific timer */
	stopTimer(projectId: number) {
		let recordIndex: number;

		if (projectId === -1) {
			// Stop timer without project (empty projectName)
			recordIndex = this.timesheetData.records.findIndex(
				(r) => r.projectId === -1 && r.endTime === null,
			);
		} else {
			const project = this.getProjectById(projectId);
			if (!project) return;

			recordIndex = this.timesheetData.records.findIndex(
				(r) => r.projectId === project.id && r.endTime === null,
			);
		}

		if (recordIndex === -1) return;

		this.timesheetData.records[recordIndex].endTime = new Date();

		this.saveTimesheet();
		this.refreshViews();
	}

	/*
	 * edit a specific record
	 * returns true if the record was successfully edited
	 */
	editRecord(id: number, changes: TimeRecord): boolean {
		const recordIndex = this.timesheetData.records.findIndex(
			(r) => r.id === id,
		);
		if (recordIndex === -1) return false;

		this.timesheetData.records[recordIndex] = {
			...this.timesheetData.records[recordIndex],
			...changes,
		};

		this.saveTimesheet();
		this.refreshViews();
		return true;
	}

	/** Stop all running timers */
	stopAllTimers() {
		const now = new Date();
		for (const record of this.timesheetData.records) {
			if (record.endTime === null) {
				record.endTime = now;
			}
		}

		this.saveTimesheet();
		this.refreshViews();
	}

	/** Get the last stopped record (completed, with endTime) */
	getLastStoppedRecord(): TimeRecord | null {
		const completedRecords = this.timesheetData.records.filter(
			(r) => r.endTime !== null,
		);
		if (completedRecords.length === 0) return null;

		return completedRecords.reduce((latest, record) => {
			if (!latest.endTime) return record;
			if (!record.endTime) return latest;
			return record.endTime.getTime() > latest.endTime.getTime()
				? record
				: latest;
		});
	}

	/** Toggle the last used timer */
	toggleLastTimer() {
		const lastRecord = this.getLastStoppedRecord();
		if (!lastRecord) return;

		const project = this.getProjectById(lastRecord.projectId);
		if (!project) return;

		const isRunning = this.runningTimers.some(
			(t) => t.projectId === project.id,
		);
		if (isRunning) {
			this.stopTimer(project.id);
		} else {
			this.startTimer(project.id);
		}
	}

	/** Check if a project is currently running */
	isProjectRunning(projectId: number): boolean {
		return this.runningTimers.some((t) => t.projectId === projectId);
	}

	/** Update a record's title */
	updateRecordTitle(recordId: number, title: string): void {
		const index = this.timesheetData.records.findIndex(
			(r) => r.id === recordId,
		);
		if (index !== -1) {
			this.timesheetData.records[index].title = title;
			this.saveTimesheet();
		}
	}

	/** Get the current running record (first one if multiple) */
	getCurrentRunningRecord(): TimeRecord | null {
		const timer = this.runningTimers[0];
		if (!timer) return null;
		return (
			this.timesheetData.records.find((r) => r.id === timer.id) || null
		);
	}

	/** Create a retroactive record entry */
	createRetroactiveRecord(projectId: number, title: string): void {
		const project = this.getProjectById(projectId);
		if (!project) return;

		const now = new Date();
		const lastRecord = this.getLastStoppedRecord();

		if (lastRecord?.endTime) {
			// Check if should extend
			if (
				lastRecord.projectId === projectId &&
				lastRecord.title === title
			) {
				const index = this.timesheetData.records.findIndex(
					(r) => r.id === lastRecord.id,
				);
				if (index !== -1) {
					this.timesheetData.records[index].endTime = now;
				}
			} else {
				// Create new completed record
				const newRecord: TimeRecord = {
					id: CSVHandler.getNextId(this.timesheetData.records),
					projectId: projectId,
					startTime: lastRecord.endTime,
					endTime: now,
					title: title,
				};
				this.timesheetData.records.push(newRecord);
			}
		}

		this.saveTimesheet();
		this.refreshViews();
	}

	// ----- PROJECT -----
	getProjectByName(name: string): Project | undefined {
		if (!this.timesheetData || !this.timesheetData.projects) {
			return undefined;
		}
		return this.timesheetData.projects.find((p) => p.name === name);
	}

	getProjectById(id: number): Project | undefined {
		if (!this.timesheetData || !this.timesheetData.projects) {
			return undefined;
		}
		return this.timesheetData.projects.find((p) => p.id === id);
	}

	// ----- VIEWS -----
	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_TIME_TRACKER);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({
					type: VIEW_TYPE_TIME_TRACKER,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async activateAnalyticsView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_ANALYTICS);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getLeaf(true);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_ANALYTICS,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async activateScheduleView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_SCHEDULE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getLeaf(true);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_SCHEDULE,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	/** Refresh all open views */
	refreshViews() {
		this.app.workspace
			.getLeavesOfType(VIEW_TYPE_TIME_TRACKER)
			.forEach((leaf) => {
				if (leaf.view instanceof TimeTrackerView) {
					leaf.view.refresh();
				}
			});

		this.app.workspace
			.getLeavesOfType(VIEW_TYPE_ANALYTICS)
			.forEach((leaf) => {
				if (leaf.view instanceof AnalyticsView) {
					leaf.view.refresh();
				}
			});

		this.app.workspace
			.getLeavesOfType(VIEW_TYPE_SCHEDULE)
			.forEach((leaf) => {
				if (leaf.view instanceof ScheduleView) {
					leaf.view.refresh();
				}
			});
	}
}
