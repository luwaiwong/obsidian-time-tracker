import { TFile, Vault } from "obsidian";
import type {
	TimesheetData,
	CSVLineType,
} from "../types";

/**
 * Handles reading and writing the timesheet.csv file.
 *
 * CSV Format:
 *   record,<id>,<projectName>,<startTime>,<endTime>,<title>
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
		return this.parseTimesheetContent(content);
	}

	parseTimesheetContent(content: string): TimesheetData {
		const lines = content
			.split("\n")
			.filter((line) => line.trim().length > 0);

		const data: TimesheetData = {
			records: [],
			projects: [],
			categories: [],
		};

		for (const line of lines) {
			const parts = this.parseCSVLine(line);
			if (parts.length === 0) continue;

			const type = parts[0] as CSVLineType;

			switch (type) {
				case "record":
					this.parseRecord(parts, data);
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

	private parseRecord(parts: string[], data: TimesheetData): void {
		// Format: record,id,projectName,startTime,endTime,title
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

		// Look up project by name to get its ID (-1 if not found or empty)
		const project = data.projects.find((p) => p.name === projectName);
		const projectId = project?.id ?? -1;

		data.records.push({
			id,
			projectId,
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
		let categoryId = parseInt(parts[6]);
		if (isNaN(categoryId)) {
			categoryId = -1;
		}
		// Determine order and categoryId from existing projects
		const order = data.projects.length;

		data.projects.push({
			id,
			name,
			icon,
			color,
			categoryId,
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
					project.categoryId,
				].join(","),
			);
		}

		// Write records
		for (const record of data.records) {
			const startTimeStr = this.formatDateTime(record.startTime);
			const endTimeStr = record.endTime
				? this.formatDateTime(record.endTime)
				: "";

			// Look up project name from projectId
			const project = data.projects.find(
				(p) => p.id === record.projectId,
			);
			const projectName = project?.name ?? "";

			lines.push(
				[
					"record",
					record.id,
					this.escapeCSVField(projectName),
					startTimeStr,
					endTimeStr,
					this.escapeCSVField(record.title),
				].join(","),
			);
		}

		const content = lines.join("\n");
		await this.vault.process(file, () => content);
	}

	async createTimesheet(path: string): Promise<TFile> {
		const initialData: TimesheetData = {
			records: [],
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
