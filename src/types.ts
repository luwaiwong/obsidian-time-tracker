/**
 * Core data types for the Integrated Time Tracker plugin
 *
 * CSV Format:
 *   log,<id>,<projectName>,<startTime>,<endTime>,<title>
 *   project,<id>,<name>,<icon>,<color>,<archived>
 *   category,<id>,<name>,<color>,<archived>
 *
 * Times are stored in ISO 8601 format for human readability.
 * Running timers have an empty endTime field.
 */

/** A project that can be tracked */
export interface Project {
	id: number;
	name: string;
	icon: string;
	iconType: "emoji" | "text";
	color: string;
	categoryId: number;
	archived: boolean;
	order: number;
}

/** A time log entry - supports running timers (endTime = null) */
export interface TimeLog {
	id: number;
	projectName: string;
	startTime: Date;
	endTime: Date | null;
	title: string;
}

/** A category for organizing projects */
export interface Category {
	id: number;
	name: string;
	color: string;
	archived: boolean;
	order: number;
}

/** Plugin settings stored in separate JSON file */
export interface PluginSettings {
	timesheetPath: string;
	settingsPath: string;
	multitaskingEnabled: boolean;
	retroactiveTrackingEnabled: boolean;
	showSeconds: boolean;
	showArchivedProjects: boolean;
	gridColumns: number;
	defaultTimeRange: "day" | "week" | "month" | "year" | "custom";
	customStartDate: number;
	customEndDate: number;
	showNotifications: boolean;
	inactivityReminderDuration: number;
	activityReminderDuration: number;
	embeddedRecentLogsCount: number;
	sortMode: "manual" | "category" | "name" | "recent";
	categoryFilter: number[];
}

/** Timesheet data stored in CSV */
export interface TimesheetData {
	logs: TimeLog[];
	projects: Project[];
	categories: Category[];
}

/** Running timer - derived from logs with null endTime */
export interface RunningTimer {
	projectId: number;
	projectName: string;
	startTime: Date;
	logId: number;
}

/** Chart data types */
export interface ChartDataPoint {
	label: string;
	value: number;
	color: string;
}

export interface TimelineEntry {
	projectId: number;
	projectName: string;
	startTime: number;
	endTime: number;
	duration: number;
	color: string;
}

/** CSV line types for parsing */
export type CSVLineType = "log" | "project" | "category";
