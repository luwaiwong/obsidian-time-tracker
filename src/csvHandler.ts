import { TFile, Vault } from "obsidian";
import type {
	Project,
	TimeLog,
	Category,
	TimesheetData,
	CSVLineType,
} from "./types";

/**
 * Handles reading and writing the timesheet.csv file.
 *
 * CSV Format (human-readable):
 *   log,<id>,<projectName>,<startTime>,<endTime>,<title>
 *   project,<id>,<name>,<icon>,<color>,<archived>
 *   category,<id>,<name>,<color>,<archived>
 *
 * Times use ISO 8601 format (YYYY-MM-DDTHH:MM:SS).
 * Running timers have empty endTime field.
 */
export class CSVHandler {
	constructor(private vault: Vault) {}

	async parseTimesheet(file: TFile): Promise<TimesheetData> {
		const content = await this.vault.read(file);
		const lines = content
			.split("\n")
			.filter((line) => line.trim().length > 0);

		const data: TimesheetData = {
			logs: [],
			projects: [],
			categories: [],
		};

		for (const line of lines) {
			const parts = this.parseCSVLine(line);
			if (parts.length === 0) continue;

			const type = parts[0] as CSVLineType;

			switch (type) {
				case "log":
					this.parseLog(parts, data);
					break;
				case "project":
					this.parseProject(parts, data);
					break;
				case "category":
					this.parseCategory(parts, data);
					break;
			}
		}

		return data;
	}

	private parseLog(parts: string[], data: TimesheetData): void {
		// Format: log,id,projectName,startTime,endTime,title
		if (parts.length < 5) return;

		const id = parseInt(parts[1]);
		const projectName = parts[2];
		const startTimeStr = parts[3];
		const endTimeStr = parts[4];
		const title = parts.length > 5 ? parts[5] : "";

		const startTime = this.parseDateTime(startTimeStr);
		if (!startTime) return;

		// endTime can be empty for running timers
		const endTime = endTimeStr ? this.parseDateTime(endTimeStr) : null;

		data.logs.push({
			id,
			projectName,
			startTime,
			endTime,
			title,
		});
	}

	private parseProject(parts: string[], data: TimesheetData): void {
		// Format: project,id,name,icon,color,archived
		if (parts.length < 6) return;

		const id = parseInt(parts[1]);
		const name = parts[2];
		const icon = parts[3];
		const color = this.normalizeColor(parts[4]);
		const archived = parts[5] === "1" || parts[5].toLowerCase() === "true";

		const iconType = this.isEmoji(icon) ? "emoji" : "text";

		// Determine order and categoryId from existing projects
		const order = data.projects.length;

		data.projects.push({
			id,
			name,
			icon,
			iconType,
			color,
			categoryId: -1,
			archived,
			order,
		});
	}

	private parseCategory(parts: string[], data: TimesheetData): void {
		// Format: category,id,name,color,archived
		if (parts.length < 5) return;

		const id = parseInt(parts[1]);
		const name = parts[2];
		const color = this.normalizeColor(parts[3]);
		const archived = parts[4] === "1" || parts[4].toLowerCase() === "true";

		const order = data.categories.length;

		data.categories.push({
			id,
			name,
			color,
			archived,
			order,
		});
	}

	private parseDateTime(str: string): Date | null {
		if (!str || str.trim() === "") return null;

		// Try ISO format first
		const date = new Date(str);
		if (!isNaN(date.getTime())) {
			return date;
		}

		// Try milliseconds timestamp (backwards compatibility)
		const ms = parseInt(str);
		if (!isNaN(ms)) {
			return new Date(ms);
		}

		return null;
	}

	private formatDateTime(date: Date): string {
		// Format: YYYY-MM-DD HH:MM:SS (human readable)
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");

		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	}

	private normalizeColor(colorValue: string): string {
		if (colorValue.startsWith("#")) {
			return colorValue;
		}
		// Handle Android color format (backwards compatibility)
		const androidColor = parseInt(colorValue);
		if (!isNaN(androidColor)) {
			return CSVHandler.androidColorToHex(androidColor);
		}
		return colorValue;
	}

	private parseCSVLine(line: string): string[] {
		const result: string[] = [];
		let current = "";
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];

			if (char === '"') {
				if (inQuotes && line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = !inQuotes;
				}
			} else if (char === "," && !inQuotes) {
				result.push(current);
				current = "";
			} else {
				current += char;
			}
		}

		result.push(current);
		return result;
	}

	private escapeCSVField(field: string): string {
		if (
			field.includes(",") ||
			field.includes('"') ||
			field.includes("\n")
		) {
			return `"${field.replace(/"/g, '""')}"`;
		}
		return field;
	}

	async writeTimesheet(file: TFile, data: TimesheetData): Promise<void> {
		const lines: string[] = [];

		// Write categories first
		for (const category of data.categories) {
			lines.push(
				[
					"category",
					category.id,
					this.escapeCSVField(category.name),
					category.color,
					category.archived ? "1" : "0",
				].join(","),
			);
		}

		// Write projects
		for (const project of data.projects) {
			lines.push(
				[
					"project",
					project.id,
					this.escapeCSVField(project.name),
					this.escapeCSVField(project.icon),
					project.color,
					project.archived ? "1" : "0",
				].join(","),
			);
		}

		// Write logs
		for (const log of data.logs) {
			const startTimeStr = this.formatDateTime(log.startTime);
			const endTimeStr = log.endTime
				? this.formatDateTime(log.endTime)
				: "";

			lines.push(
				[
					"log",
					log.id,
					this.escapeCSVField(log.projectName),
					startTimeStr,
					endTimeStr,
					this.escapeCSVField(log.title),
				].join(","),
			);
		}

		const content = lines.join("\n");
		await this.vault.modify(file, content);
	}

	async createTimesheet(path: string): Promise<TFile> {
		const initialData: TimesheetData = {
			logs: [],
			projects: [],
			categories: [
				{
					id: 1,
					name: "Uncategorized",
					color: "#88C0D0",
					archived: false,
					order: 0,
				},
			],
		};

		const file = await this.vault.create(path, "");
		await this.writeTimesheet(file, initialData);
		return file;
	}

	private isEmoji(str: string): boolean {
		const emojiRegex =
			/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
		return emojiRegex.test(str);
	}

	static androidColorToHex(color: number): string {
		const unsigned = color >>> 0;
		const hex = unsigned.toString(16).padStart(8, "0");
		return `#${hex.substring(2)}`;
	}

	static getNextId(items: { id: number }[]): number {
		if (items.length === 0) return 1;
		return Math.max(...items.map((i) => i.id)) + 1;
	}
}
