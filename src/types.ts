/**
 * Core data types for the Integrated Time Tracker plugin
 */

export interface Project {
	id: number;
	name: string;
	icon: string; // emoji or text (e.g., "📚" or "MAT")
	iconType: "emoji" | "text"; // distinguish between emoji and text icons
	color: string; // hex color (e.g., "#4ECDC4")
	categoryId: number; // -1 for uncategorized
	archived: boolean;
	order: number; // for manual sorting
}

export interface TimeRecord {
	id: number;
	projectId: number;
	startTime: number; // timestamp in milliseconds
	endTime: number; // timestamp in milliseconds
	tags: number[]; // array of tag IDs
	comment?: string;
}

export interface Category {
	id: number;
	name: string;
	color: string; // hex color (e.g., "#4ECDC4")
	order: number;
}

export interface RecordTag {
	id: number;
	name: string;
	icon: string;
	color: string; // hex color (e.g., "#4ECDC4")
	archived: boolean;
}

export interface ProjectGoal {
	projectId: number;
	type: number; // 0 = daily, 1 = weekly, 2 = monthly
	targetSeconds: number;
	enabled: boolean;
}

export interface PluginSettings {
	// File location
	timesheetPath: string; // path to timesheet.csv

	// Tracking behavior
	multitaskingEnabled: boolean;
	retroactiveTrackingEnabled: boolean;

	// Display preferences
	showSeconds: boolean;
	showArchivedProjects: boolean;
	gridColumns: number; // number of columns in grid view

	// Analytics
	defaultTimeRange: "day" | "week" | "month" | "year" | "custom";
	customStartDate: number;
	customEndDate: number;

	// Notifications
	showNotifications: boolean;
	inactivityReminderDuration: number; // seconds
	activityReminderDuration: number; // seconds

	// Embedded tracker
	embeddedRecentLogsCount: number; // default 5

	// Sorting
	sortMode: "manual" | "category" | "name" | "recent";
	categoryFilter: number[]; // empty = show all
}

export interface RunningTimer {
	projectId: number;
	startTime: number;
}

export interface TimesheetData {
	projects: Project[];
	records: TimeRecord[];
	categories: Category[];
	projectCategories: Map<number, number>; // projectId -> categoryId
	tags: RecordTag[];
	recordTags: Map<number, number[]>; // recordId -> tagIds
	goals: ProjectGoal[];
	preferences: Map<string, string>; // flexible key-value storage
}

// Helper types for CSV parsing
export type CSVLineType =
	| "recordType" // Project definition
	| "record" // Time record
	| "category" // Category definition
	| "typeCategory" // Project-Category mapping
	| "recordTag" // Tag definition
	| "recordToRecordTag" // Record-Tag mapping
	| "recordTypeGoal" // Project goal
	| "prefs"; // Preferences

// Chart data types
export interface ChartDataPoint {
	label: string;
	value: number; // seconds
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
