import { Plugin, TFile, WorkspaceLeaf, requestUrl } from "obsidian";
import { TimeTrackerSettingTab } from "./src/settings";
import {
	TimeTrackerView,
	VIEW_TYPE_TIME_TRACKER,
} from "./src/views/TimeTrackerView";
import { AnalyticsView, VIEW_TYPE_ANALYTICS } from "./src/views/AnalyticsView";
import { CSVHandler } from "./src/utils/csvHandler";
import { BackupHandler } from "./src/utils/backupHandler";
import type {
	PluginSettings,
	TimesheetData,
	TimeRecord,
	Project,
} from "./src/types";
import { TimeTrackerCodeBlockProcessor } from "./src/codeBlockProcessor";
import { ImportModal } from "./src/modals/ImportSTTModal";
import { ConflictResolverModal } from "./src/modals/ConflictResolverModal";
import { BackupViewerModal } from "./src/modals/BackupViewerModal";

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
	embeddedRecentRecordsCount: 5,
	sortMode: "name",
	categoryFilter: [],
	icsCalendars: [],
};

export default class TimeTrackerPlugin extends Plugin {
	settings: PluginSettings;
	timesheetData: TimesheetData = {
		records: [],
		projects: [],
		categories: [],
	};
	csvHandler: CSVHandler;
	backupHandler: BackupHandler;
	private timesheetFile: TFile | null = null;
	error: string | null = null;
	isLoading: boolean = true;

	// cache ics events, dont fetch every time schedule refreshed
	icsCache: { events: any[]; fetched: boolean; loading: boolean } = {
		events: [],
		fetched: false,
		loading: false,
	};
	// schedule view state (fix scroll position)
	scheduleState: { scrollTop: number } = { scrollTop: 0 };

	// ----- OBSIDIAN FUNCTIONS -----
	async onload() {
		await this.loadSettings();
		this.csvHandler = new CSVHandler(this.app.vault);
		this.backupHandler = new BackupHandler(this.app.vault);

		this.registerView(
			VIEW_TYPE_TIME_TRACKER,
			(leaf) => new TimeTrackerView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_ANALYTICS,
			(leaf) => new AnalyticsView(leaf, this),
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
			id: "toggle-last-timer",
			name: "Toggle Last Used Timer",
			callback: () => this.toggleLastTimer(),
		});
		this.addCommand({
			id: "import-STT-data",
			name: "Import Data from Simple Time Tracker",
			callback: () => new ImportModal(this.app, this).open(),
		});
		this.addCommand({
			id: "resolve-conflicts",
			name: "Resolve Conflicts",
			callback: () => new ConflictResolverModal(this.app, this).open(),
		});
		this.addCommand({
			id: "view-backups",
			name: "View Backups",
			callback: () => new BackupViewerModal(this.app, this).open(),
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
			await this.backupHandler.createBackup(this.settings.timesheetPath);
			this.activateView();
		});

		// backup every 3 hours
		this.registerInterval(
			window.setInterval(
				() => this.backupHandler.createBackup(this.settings.timesheetPath),
				3 * 60 * 60 * 1000,
			),
		);

		// reload timesheet when app comes back to foreground for mobile
		this.registerDomEvent(document, "visibilitychange", () => {
			if (document.visibilityState === "visible") {
				this.loadTimesheet();
			}
		});

		// reload timesheet every 30 seconds
		this.registerInterval(
			window.setInterval(() => this.loadTimesheet(), 0.5 * 60 * 1000),
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
		const hasExistingData =
			this.timesheetData.records.length > 0 ||
			this.timesheetData.projects.length > 0;

		// only show loading if no data exists yet
		if (!hasExistingData) {
			this.isLoading = true;
		}

		console.log("Loading timesheet...");
		try {
			const file = this.app.vault.getAbstractFileByPath(
				this.settings.timesheetPath,
			);
			console.log("File found:", file);

			let newData: TimesheetData;
			if (file instanceof TFile) {
				this.timesheetFile = file;
				newData = await this.csvHandler.parseTimesheet(file);
			} else {
				this.timesheetFile = await this.csvHandler.createTimesheet(
					this.settings.timesheetPath,
				);
				newData = await this.csvHandler.parseTimesheet(
					this.timesheetFile,
				);
			}

			// compare new data with current data, skip refresh if unchanged
			if (this.isTimesheetDataEqual(this.timesheetData, newData)) {
				console.log("Timesheet data unchanged, skipping refresh");
				this.isLoading = false;
				return;
			}

			this.timesheetData = newData;
			this.isLoading = false;
			this.refreshViews();
		} catch (err) {
			console.error("Error loading timesheet:", err);
			this.error = "Error loading Timesheet: " + err;
			this.isLoading = false;
			this.refreshViews();
		}
	}

	private isTimesheetDataEqual(a: TimesheetData, b: TimesheetData): boolean {
		if (
			a.records.length !== b.records.length ||
			a.projects.length !== b.projects.length ||
			a.categories.length !== b.categories.length
		) {
			return false;
		}

		// compare records by stringifying (handles Date objects)
		const aRecords = JSON.stringify(a.records);
		const bRecords = JSON.stringify(b.records);
		if (aRecords !== bRecords) return false;

		const aProjects = JSON.stringify(a.projects);
		const bProjects = JSON.stringify(b.projects);
		if (aProjects !== bProjects) return false;

		const aCategories = JSON.stringify(a.categories);
		const bCategories = JSON.stringify(b.categories);
		if (aCategories !== bCategories) return false;

		return true;
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
	 * start tracking time without a project
	 * can only be used when retroactive mode is off
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
		// this.refreshViews();
	}

	/** start tracking time for a project */
	startTimer(
		projectId: number = -1,
		title: string = "",
		startTime?: Date,
		endTime?: Date,
	) {
		let project = this.getProjectById(projectId);
		if (projectId === -1) {
			project = undefined;
		}

		const now = new Date();

		// for retroactive
		if (this.settings.retroactiveTrackingEnabled) {
			console.log("Retroactive tracking enabled");
			const lastRecord = this.getLastStoppedRecord();
			if (lastRecord && lastRecord.endTime) {
				const gap = now.getTime() - lastRecord.endTime.getTime();
				if (gap > 0) {
					// extend record if the project is the same and start time is the same as last project end time(within 10 minutes)
					const startTimeSame = startTime ? Math.abs(lastRecord.endTime.getTime() - startTime.getTime()) < 10 * 60 * 1000 : true;
					if (project && lastRecord.projectId === project.id && startTimeSame) {
						const index = this.timesheetData.records.findIndex(
							(r) => r.id === lastRecord.id,
						);
						if (index !== -1) {
							this.timesheetData.records[index].endTime = endTime ?? now;
						}
					} 
					// otherwise we create a new record
					else {
						const newRecord: TimeRecord = {
							id: CSVHandler.getNextId(
								this.timesheetData.records,
							),
							projectId: project ? project.id : -1,
							startTime: startTime ?? lastRecord.endTime,
							endTime: endTime ?? now,
							title: title,
						};
						this.timesheetData.records.push(newRecord);
					}
				}
			}
		} else {
			this.stopAllTimers();

			// check if this project is already running
			const existingTimer = this.runningTimers.find(
				(t) => t.projectId === projectId,
			);

			if (existingTimer) {
				this.stopTimer(projectId);
			} else {
				// create a new record with null endTime (running timer)
				const newRecord: TimeRecord = {
					id: CSVHandler.getNextId(this.timesheetData.records),
					projectId: project ? project.id : -1,
					startTime: startTime ?? now,
					endTime: null,
					title: title,
				};
				this.timesheetData.records.push(newRecord);
			}
		}

		this.saveTimesheet();
		// this.refreshViews();
	}

	/** find record by ID and extend its time */
	repeatRecord(recordId: number, endTime: Date) {
		const record = this.timesheetData.records.find(
			(r) => r.id === recordId,
		);
		if (!record) return;

		record.endTime = endTime;
		this.saveTimesheet();
		this.refreshViews();
	}

	/** stop a specific timer */
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
		// this.refreshViews();
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
		// this.refreshViews();
		return true;
	}

	/** stop all running timers */
	stopAllTimers() {
		const now = new Date();
		for (const record of this.timesheetData.records) {
			if (record.endTime === null) {
				record.endTime = now;
			}
		}

		this.saveTimesheet();
		// this.refreshViews();
	}

	/** set the last stopped record (completed, with endTime) */
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

	/** toggle the last used timer */
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

	/** check if a project is currently running */
	isProjectRunning(projectId: number): boolean {
		return this.runningTimers.some((t) => t.projectId === projectId);
	}

	/** update a record's title */
	updateRecordTitle(recordId: number, title: string): void {
		const index = this.timesheetData.records.findIndex(
			(r) => r.id === recordId,
		);
		if (index !== -1) {
			this.timesheetData.records[index].title = title;
			this.saveTimesheet();
		}
	}

	/** get the current running record (first one if multiple) */
	getCurrentRunningRecord(): TimeRecord | null {
		const timer = this.runningTimers[0];
		if (!timer) return null;
		return (
			this.timesheetData.records.find((r) => r.id === timer.id) || null
		);
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

	async fetchUrl(url: string): Promise<string> {
		const response = await requestUrl({ url });
		return response.text;
	}

	editProject(project: Project): void {
		const index = this.timesheetData.projects.findIndex(
			(p) => p.id === project.id,
		);
		if (index !== -1) {
			this.timesheetData.projects[index] = project;
		}
		this.saveTimesheet();
		// this.refreshViews();
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
	}
}
