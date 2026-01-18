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

export interface Timeblock {
	id: number;
	title: string;
	startTime: Date;
	endTime: Date;
	color: string;
	notes: string;
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
	timeblocksPath: string;
	settingsPath: string;

	retroactiveTrackingEnabled: boolean;
	enableTimeblocking: boolean;
	showSeconds: boolean;
	showArchivedProjects: boolean;
	gridColumns: number;
	defaultTimeRange: "day" | "week" | "month" | "year" | "custom";
	customStartDate: number;
	customEndDate: number;
	sortMode: "category" | "name" | "color" | "recent";
	categoryFilter: number[];
	icsCalendars: string[];
	scheduleZoom: number;
}

export interface TimesheetData {
	records: TimeRecord[];
	projects: Project[];
	categories: Category[];
}

export interface TimeblocksData {
	timeblocks: Timeblock[];
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

// calendar event types for FullCalendar
export interface IcsCalendarEvent {
	id: string;
	title: string;
	start: Date;
	end: Date;
	backgroundColor: string;
	borderColor: string;
	borderWidth: string;
	classNames: string[];
	extendedProps: {
		isIcs: true;
		description: string;
		location: string;
		url: string;
		color: string;
		sourceName: string;
	};
}

export interface TrackedCalendarEvent {
	id: string;
	title: string;
	start: Date;
	end: Date;
	backgroundColor: string;
	borderColor: string;
	extendedProps: {
		project: Project;
		duration: number;
		isRunning: boolean;
		record?: TimeRecord;
	};
}

export interface TimeblockCalendarEvent {
	id: string;
	title: string;
	start: Date;
	end: Date;
	backgroundColor: string;
	borderColor: string;
	classNames: string[];
	editable: boolean;
	durationEditable: boolean;
	extendedProps: {
		isTimeblock: true;
		timeblock: Timeblock;
		color: string;
		duration: number;
	};
}

export type CalendarEvent = IcsCalendarEvent | TrackedCalendarEvent | TimeblockCalendarEvent;
