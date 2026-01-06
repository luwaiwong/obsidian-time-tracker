import type { TimeRecord } from "../types";

/**
 * format duration in format hh:mm:ss
 */
export function formatDuration(
	ms: number,
	showSeconds: boolean = true,
): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (showSeconds) {
		if (hours > 0) {
			return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
		}
		return `${minutes}:${String(seconds).padStart(2, "0")}`;
	}

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	if (minutes > 0) {
		return `${minutes}m`;
	}
	return `${seconds}s`;
}

/**
 * format duration for timer display with h/m/s notation
 * - under 1 hour: shows 00m 00s
 * - 1-99 hours: shows 00h 00m
 * - 100+ hours: shows 000h
 */
export function formatNaturalDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	// 100+ hours: just show hours
	if (hours >= 100) {
		return `${hours}h`;
	}

	// 1+ hours: show hours and minutes
	if (hours > 0) {
		return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
	}

	// Under 1 hour: show minutes and seconds
	return `${String(minutes)}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * get total duration for a project within a time range
 */
export function getProjectDuration(
	projectId: number,
	records: TimeRecord[],
	startTime?: number,
	endTime?: number,
): number {
	return records
		.filter((r) => r.projectId === projectId && r.endTime !== null)
		.filter((r) => {
			const recordEnd = r.endTime!.getTime();
			const recordStart = r.startTime.getTime();
			if (startTime && recordEnd < startTime) return false;
			if (endTime && recordStart > endTime) return false;
			return true;
		})
		.reduce((total, record) => {
			const recordStart = record.startTime.getTime();
			const recordEnd = record.endTime!.getTime();
			const start = startTime
				? Math.max(recordStart, startTime)
				: recordStart;
			const end = endTime ? Math.min(recordEnd, endTime) : recordEnd;
			return total + (end - start);
		}, 0);
}

/**
 * get time range boundaries
 */
export function getTimeRange(
	range: "day" | "week" | "month" | "year",
	date: Date = new Date(),
): { start: number; end: number } {
	const start = new Date(date);
	const end = new Date(date);

	switch (range) {
		case "day":
			start.setHours(0, 0, 0, 0);
			end.setHours(23, 59, 59, 999);
			break;
		case "week": {
			const dayOfWeek = start.getDay();
			const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
			start.setDate(start.getDate() + diffToMonday);
			start.setHours(0, 0, 0, 0);
			end.setDate(start.getDate() + 6);
			end.setHours(23, 59, 59, 999);
			break;
		}
		case "month":
			start.setDate(1);
			start.setHours(0, 0, 0, 0);
			end.setMonth(end.getMonth() + 1);
			end.setDate(0);
			end.setHours(23, 59, 59, 999);
			break;
		case "year":
			start.setMonth(0, 1);
			start.setHours(0, 0, 0, 0);
			end.setMonth(11, 31);
			end.setHours(23, 59, 59, 999);
			break;
	}

	return { start: start.getTime(), end: end.getTime() };
}

/**
 * format date to readable string
 */
export function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleDateString();
}

/**
 * format datetime to readable string
 */
export function formatDateTime(timestamp: number | Date): string {
	const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
	return date.toLocaleString();
}

/**
 * format time of day (hh:mm)
 */
export function formatTimeOfDay(timestamp: number | Date): string {
	const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
	return date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}
