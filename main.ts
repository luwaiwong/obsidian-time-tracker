import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { TimeTrackerSettingTab } from "./src/settings";
import {
  TimeTrackerView,
  VIEW_TYPE_TIME_TRACKER,
} from "./src/views/TimeTrackerView";
import { AnalyticsView, VIEW_TYPE_ANALYTICS } from "./src/views/AnalyticsView";
import { CSVHandler } from "./src/csvHandler";
import type { PluginSettings, TimesheetData, RunningTimer } from "./src/types";
import { TimeTrackerCodeBlockProcessor } from "./src/codeBlockProcessor";

const DEFAULT_SETTINGS: PluginSettings = {
  timesheetPath: "timesheet.csv",
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
  runningTimers: RunningTimer[] = [];
  private timesheetFile: TFile | null = null;
  error: string | null = null;

  async onload() {
    // load settings & create/load timesheet
    await this.loadSettings();
    this.csvHandler = new CSVHandler(this.app.vault);
    await this.loadTimesheet();

    // register views
    this.registerView(
      VIEW_TYPE_TIME_TRACKER,
      (leaf) => new TimeTrackerView(leaf, this),
    );
    this.registerView(
      VIEW_TYPE_ANALYTICS,
      (leaf) => new AnalyticsView(leaf, this),
    );

    // ribbon Icon
    this.addRibbonIcon("clock", "Time Tracker", () => {
      this.activateView();
    });

    // Set hot commands
    this.addCommand({
      id: "open-time-tracker",
      name: "Open Time Tracker",
      callback: () => {
        this.activateView();
      },
    });
    this.addCommand({
      id: "open-analytics",
      name: "Open Analytics",
      callback: () => {
        this.activateAnalyticsView();
      },
    });
    this.addCommand({
      id: "toggle-last-timer",
      name: "Toggle Last Used Timer",
      callback: () => {
        this.toggleLastTimer();
      },
    });

    // for embedded trackers
    this.registerMarkdownCodeBlockProcessor(
      "time-tracker",
      (source, el, ctx) => {
        const processor = new TimeTrackerCodeBlockProcessor(this);
        processor.process(source, el, ctx);
      },
    );

    // Add settings tab
    this.addSettingTab(new TimeTrackerSettingTab(this.app, this));

    // Activate view on load if it was open before
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });

    // Auto-save every 5 minutes
    this.registerInterval(
      window.setInterval(() => this.saveTimesheet(), 5 * 60 * 1000),
    );
  }

  async onunload() {
    // Save timesheet on unload
    await this.saveTimesheet();

    // Clear any running timers
    this.runningTimers = [];
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
        console.log("Loading timesheet");
        this.timesheetFile = file;
        this.timesheetData = await this.csvHandler.parseTimesheet(file);
      } else {
        console.log("Timesheet file not found, creating new timesheet");
        // create new timesheet
        this.timesheetFile = await this.csvHandler.createTimesheet(
          this.settings.timesheetPath,
        );
        this.timesheetData = await this.csvHandler.parseTimesheet(
          this.timesheetFile,
        );
      }
    } catch (_error) {
      console.error("Error loading timesheet:", _error);

      this.error = "Error loading Timesheet: " + _error;
    }
  }

  async saveTimesheet() {
    if (!this.timesheetFile) return;

    try {
      await this.csvHandler.writeTimesheet(
        this.timesheetFile,
        this.timesheetData,
      );
    } catch (_error) {
      console.error("Error saving timesheet:", _error);
      this.error = "Error saving Timesheet: " + _error;
    }
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_TIME_TRACKER);

    // find or load leaf
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: VIEW_TYPE_TIME_TRACKER, active: true });
      }
    }

    // reveal leaf if found
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
      // open in main workspace
      leaf = workspace.getLeaf(true);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_ANALYTICS, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  /**
   * start tracking time for a project
   */
  startTimer(projectId: number, retroactive: boolean = false) {
    const now = Date.now();

    // for retroactive tracking
    if (retroactive && this.settings.retroactiveTrackingEnabled) {
      const lastRecord = this.getLastStoppedRecord();
      if (lastRecord) {
        const gap = now - lastRecord.endTime;
        if (gap > 0) {
          // merge entries if same project
          if (lastRecord.projectId == projectId) {
            const index = this.timesheetData.records.findIndex(
              (record) => record.id === lastRecord.id,
            );
            if (index !== -1) {
              this.timesheetData.records[index].endTime = now;
            }
          } else {
            // create a new record for the gap
            const newRecord = {
              id: CSVHandler.getNextId(this.timesheetData.records),
              projectId: projectId,
              startTime: lastRecord.endTime,
              endTime: now,
              tags: [],
            };
            this.timesheetData.records.push(newRecord);
          }
        }
      }
    } else {
      // Normal tracking
      if (!this.settings.multitaskingEnabled) {
        // Stop all running timers
        this.stopAllTimers();
      }

      // Check if this project is already running
      const existingTimer = this.runningTimers.find(
        (t) => t.projectId === projectId,
      );
      if (existingTimer) {
        // Stop this timer
        this.stopTimer(projectId);
      } else {
        // Start new timer
        this.runningTimers.push({ projectId, startTime: now });
      }
    }

    // save
    this.saveTimesheet();
    this.refreshViews();
  }

  /**
   * Stop a specific timer
   */
  stopTimer(projectId: number) {
    const timerIndex = this.runningTimers.findIndex(
      (t) => t.projectId === projectId,
    );
    if (timerIndex === -1) return;

    const timer = this.runningTimers[timerIndex];
    const now = Date.now();

    // Create a record
    const newRecord = {
      id: CSVHandler.getNextId(this.timesheetData.records),
      projectId: timer.projectId,
      startTime: timer.startTime,
      endTime: now,
      tags: [],
    };

    this.timesheetData.records.push(newRecord);
    this.runningTimers.splice(timerIndex, 1);

    this.saveTimesheet();
    this.refreshViews();
  }

  /**
   * stop all running timers
   */
  stopAllTimers() {
    const timers = [...this.runningTimers];
    for (const timer of timers) {
      this.stopTimer(timer.projectId);
    }
  }

  /**
   * get the last stopped record
   */
  getLastStoppedRecord() {
    const sorted = [...this.timesheetData.records].sort(
      (a, b) => b.endTime - a.endTime,
    );
    return sorted[0] || null;
  }

  /**
   * toggle the last used timer
   */
  toggleLastTimer() {
    const lastRecord = this.getLastStoppedRecord();
    if (!lastRecord) return;

    const isRunning = this.runningTimers.some(
      (t) => t.projectId === lastRecord.projectId,
    );
    if (isRunning) {
      this.stopTimer(lastRecord.projectId);
    } else {
      this.startTimer(lastRecord.projectId);
    }
  }

  /**
   * check if a project is currently running
   */
  isProjectRunning(projectId: number): boolean {
    return this.runningTimers.some((t) => t.projectId === projectId);
  }

  /**
   * get running timer for a project
   */
  getRunningTimer(projectId: number): RunningTimer | undefined {
    return this.runningTimers.find((t) => t.projectId === projectId);
  }

  /**
   * refresh all open views
   */
  refreshViews() {
    // trigger a refresh for all time tracker views
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_TIME_TRACKER)
      .forEach((leaf) => {
        if (leaf.view instanceof TimeTrackerView) {
          leaf.view.refresh();
        }
      });

    // trigger a refresh for all analytics views
    this.app.workspace.getLeavesOfType(VIEW_TYPE_ANALYTICS).forEach((leaf) => {
      if (leaf.view instanceof AnalyticsView) {
        leaf.view.refresh();
      }
    });
  }
}
