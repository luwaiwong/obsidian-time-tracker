/**
 * Utility functions for the time tracker plugin
 */

import { Attachment } from "svelte/attachments";
import type { TimeRecord } from "../types";
import { setIcon } from "obsidian";

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
 * Get total duration for a project within a time range
 * Works with the TimeRecord structure (uses projectName and Date objects)
 */
export function getProjectDuration(
	projectName: string,
	records: TimeRecord[],
	startTime?: number,
	endTime?: number,
): number {
	return records
		.filter((r) => r.projectName === projectName && r.endTime !== null)
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
 * Get total duration for a project by ID within a time range
 */
export function getProjectDurationById(
	projectId: number,
	records: TimeRecord[],
	projectsMap: Map<number, string>,
	startTime?: number,
	endTime?: number,
): number {
	const projectName = projectsMap.get(projectId);
	if (!projectName) return 0;
	return getProjectDuration(projectName, records, startTime, endTime);
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
 * Format date to readable string
 */
export function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleDateString();
}

/**
 * Format datetime to readable string
 */
export function formatDateTime(timestamp: number | Date): string {
	const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
	return date.toLocaleString();
}

/**
 * Format time of day (HH:MM)
 */
export function formatTimeOfDay(timestamp: number | Date): string {
	const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
	return date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}
