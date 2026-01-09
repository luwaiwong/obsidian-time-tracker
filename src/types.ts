/**
 * CSV Format:
 *   record,<id>,<projectName>,<startTime>,<endTime>,<title>
 *   project,<id>,<name>,<icon>,<color>,<archived>
 *   category,<id>,<name>,<color>,<archived>
 *
 * Times are stored in ISO 8601 format for human readability.
 * Running timers have an empty endTime field.
 */

export interface Project {
	id: number;
	name: string;
	icon: string;
	color: string;
	categoryId: number;
	archived: boolean;
	order: number;
}

export interface TimeRecord {
	id: number;
	projectId: number;
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

	retroactiveTrackingEnabled: boolean;
	showSeconds: boolean;
	showArchivedProjects: boolean;
	gridColumns: number;
	defaultTimeRange: "day" | "week" | "month" | "year" | "custom";
	customStartDate: number;
	customEndDate: number;
	embeddedRecentRecordsCount: number;
	sortMode: "category" | "name" | "color" | "recent";
	categoryFilter: number[];
	icsCalendars: string[];
}

export interface TimesheetData {
	records: TimeRecord[];
	projects: Project[];
	categories: Category[];
}

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

export type CSVLineType = "record" | "project" | "category";
