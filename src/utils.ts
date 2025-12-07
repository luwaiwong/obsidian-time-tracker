/**
 * Utility functions for the time tracker plugin
 */

/**
 * Format duration in milliseconds to human-readable string
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
		} else {
			return `${minutes}:${String(seconds).padStart(2, "0")}`;
		}
	} else {
		// Without seconds, show in verbose format
		if (hours > 0) {
			return `${hours}h ${minutes}m ${seconds}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds}s`;
		} else {
			return `${seconds}s`;
		}
	}
}

/**
 * Convert Android color format to hex (for backwards compatibility when reading old data)
 */
export function androidColorToHex(color: number): string {
	const unsigned = color >>> 0;
	const hex = unsigned.toString(16).padStart(8, "0");
	return `#${hex.substring(2)}`;
}

/**
 * Get total duration for a project within a time range
 */
export function getProjectDuration(
	projectId: number,
	records: any[],
	startTime?: number,
	endTime?: number,
): number {
	return records
		.filter((r) => r.projectId === projectId)
		.filter((r) => {
			if (startTime && r.endTime < startTime) return false;
			if (endTime && r.startTime > endTime) return false;
			return true;
		})
		.reduce((total, record) => {
			const start = startTime
				? Math.max(record.startTime, startTime)
				: record.startTime;
			const end = endTime ? Math.min(record.endTime, endTime) : record.endTime;
			return total + (end - start);
		}, 0);
}

/**
 * Get time range boundaries
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
		case "week":
			const dayOfWeek = start.getDay();
			const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
			start.setDate(start.getDate() + diffToMonday);
			start.setHours(0, 0, 0, 0);
			end.setDate(start.getDate() + 6);
			end.setHours(23, 59, 59, 999);
			break;
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
 * Format date to readable string
 */
export function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleDateString();
}

/**
 * Format datetime to readable string
 */
export function formatDateTime(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleString();
}
