import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { TimeTrackerSettingTab } from "./src/settings";
import {
	TimeTrackerView,
	VIEW_TYPE_TIME_TRACKER,
} from "./src/views/TimeTrackerView";
import { AnalyticsView, VIEW_TYPE_ANALYTICS } from "./src/views/AnalyticsView";
import { ScheduleView, VIEW_TYPE_SCHEDULE } from "./src/views/ScheduleView";
import { CSVHandler } from "./src/csvHandler";
import type {
	PluginSettings,
	TimesheetData,
	RunningTimer,
	TimeLog,
	Project,
} from "./src/types";
import { TimeTrackerCodeBlockProcessor } from "./src/codeBlockProcessor";

const DEFAULT_SETTINGS: PluginSettings = {
	timesheetPath: "timesheet.csv",
	settingsPath: "time-tracker-settings.json",
	multitaskingEnabled: false,
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
	embeddedRecentLogsCount: 5,
	sortMode: "manual",
	categoryFilter: [],
};

export default class TimeTrackerPlugin extends Plugin {
	settings: PluginSettings;
	timesheetData: TimesheetData;
	csvHandler: CSVHandler;
	private timesheetFile: TFile | null = null;
	error: string | null = null;

	async onload() {
		await this.loadSettings();
		this.csvHandler = new CSVHandler(this.app.vault);
		await this.loadTimesheet();

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

		this.registerMarkdownCodeBlockProcessor(
			"time-tracker",
			(source, el, ctx) => {
				const processor = new TimeTrackerCodeBlockProcessor(this);
				processor.process(source, el, ctx);
			},
		);

		this.addSettingTab(new TimeTrackerSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.activateView();
		});

		this.registerInterval(
			window.setInterval(() => this.saveTimesheet(), 5 * 60 * 1000),
		);
	}

	async onunload() {
		await this.saveTimesheet();
	}

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
		try {
			const file = this.app.vault.getAbstractFileByPath(
				this.settings.timesheetPath,
			);

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

	/** Get running timers derived from logs with null endTime */
	get runningTimers(): RunningTimer[] {
		return this.timesheetData.logs
			.filter((log) => log.endTime === null)
			.map((log) => {
				const project = this.getProjectByName(log.projectName);
				return {
					projectId: project?.id ?? -1,
					projectName: log.projectName,
					startTime: log.startTime,
					logId: log.id,
				};
			});
	}

	getProjectByName(name: string): Project | undefined {
		return this.timesheetData.projects.find((p) => p.name === name);
	}

	getProjectById(id: number): Project | undefined {
		return this.timesheetData.projects.find((p) => p.id === id);
	}

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

	/** Start tracking time for a project */
	startTimer(projectId: number, retroactive: boolean = false) {
		const project = this.getProjectById(projectId);
		if (!project) return;

		const now = new Date();

		if (retroactive && this.settings.retroactiveTrackingEnabled) {
			const lastLog = this.getLastStoppedLog();
			if (lastLog && lastLog.endTime) {
				const gap = now.getTime() - lastLog.endTime.getTime();
				if (gap > 0) {
					if (lastLog.projectName === project.name) {
						// Extend the last log
						const index = this.timesheetData.logs.findIndex(
							(l) => l.id === lastLog.id,
						);
						if (index !== -1) {
							this.timesheetData.logs[index].endTime = now;
						}
					} else {
						// Create a new completed log for the gap
						const newLog: TimeLog = {
							id: CSVHandler.getNextId(this.timesheetData.logs),
							projectName: project.name,
							startTime: lastLog.endTime,
							endTime: now,
							title: "",
						};
						this.timesheetData.logs.push(newLog);
					}
				}
			}
		} else {
			if (!this.settings.multitaskingEnabled) {
				this.stopAllTimers();
			}

			// Check if this project is already running
			const existingTimer = this.runningTimers.find(
				(t) => t.projectId === projectId,
			);
			if (existingTimer) {
				this.stopTimer(projectId);
			} else {
				// Create a new log with null endTime (running timer)
				const newLog: TimeLog = {
					id: CSVHandler.getNextId(this.timesheetData.logs),
					projectName: project.name,
					startTime: now,
					endTime: null,
					title: "",
				};
				this.timesheetData.logs.push(newLog);
			}
		}

		this.saveTimesheet();
		this.refreshViews();
	}

	/** Stop a specific timer */
	stopTimer(projectId: number) {
		const project = this.getProjectById(projectId);
		if (!project) return;

		const logIndex = this.timesheetData.logs.findIndex(
			(l) => l.projectName === project.name && l.endTime === null,
		);

		if (logIndex === -1) return;

		this.timesheetData.logs[logIndex].endTime = new Date();

		this.saveTimesheet();
		this.refreshViews();
	}

	/** Stop all running timers */
	stopAllTimers() {
		const now = new Date();
		for (const log of this.timesheetData.logs) {
			if (log.endTime === null) {
				log.endTime = now;
			}
		}

		this.saveTimesheet();
		this.refreshViews();
	}

	/** Get the last stopped log (completed, with endTime) */
	getLastStoppedLog(): TimeLog | null {
		const completedLogs = this.timesheetData.logs.filter(
			(l) => l.endTime !== null,
		);
		if (completedLogs.length === 0) return null;

		return completedLogs.reduce((latest, log) => {
			if (!latest.endTime) return log;
			if (!log.endTime) return latest;
			return log.endTime.getTime() > latest.endTime.getTime()
				? log
				: latest;
		});
	}

	/** Toggle the last used timer */
	toggleLastTimer() {
		const lastLog = this.getLastStoppedLog();
		if (!lastLog) return;

		const project = this.getProjectByName(lastLog.projectName);
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

	/** Get running timer for a project */
	getRunningTimer(projectId: number): RunningTimer | undefined {
		return this.runningTimers.find((t) => t.projectId === projectId);
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
