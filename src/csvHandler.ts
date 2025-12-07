import { TFile, Vault } from "obsidian";
import type {
	Project,
	TimeRecord,
	Category,
	RecordTag,
	ProjectGoal,
	TimesheetData,
	CSVLineType,
} from "./types";

/**
 * Handles reading and writing the timesheet.csv file
 * Format is inspired by Simple Time Tracker app
 */
export class CSVHandler {
	constructor(private vault: Vault) {}

	/**
	 * Parse the timesheet.csv file into structured data
	 */
	async parseTimesheet(file: TFile): Promise<TimesheetData> {
		const content = await this.vault.read(file);
		const lines = content.split("\n").filter((line) => line.trim().length > 0);

		const data: TimesheetData = {
			projects: [],
			records: [],
			categories: [],
			projectCategories: new Map(),
			tags: [],
			recordTags: new Map(),
			goals: [],
			preferences: new Map(),
		};

		for (const line of lines) {
			const parts = this.parseCSVLine(line);
			if (parts.length === 0) continue;

			const type = parts[0] as CSVLineType;

			switch (type) {
				case "recordType":
					this.parseProject(parts, data);
					break;
				case "record":
					this.parseRecord(parts, data);
					break;
				case "category":
					this.parseCategory(parts, data);
					break;
				case "typeCategory":
					this.parseProjectCategory(parts, data);
					break;
				case "recordTag":
					this.parseTag(parts, data);
					break;
				case "recordToRecordTag":
					this.parseRecordTag(parts, data);
					break;
				case "recordTypeGoal":
					this.parseGoal(parts, data);
					break;
				case "prefs":
					this.parsePreference(parts, data);
					break;
			}
		}

		return data;
	}

	private parseProject(parts: string[], data: TimesheetData): void {
		// Format: recordType,id,name,icon,color,archived,order
		if (parts.length < 7) return;

		const id = parseInt(parts[1]);
		const name = parts[2];
		const icon = parts[3];
		const colorValue = parts[4];
		const archived = parts[5] === "1";
		const order = parts.length > 6 ? parseInt(parts[6]) : 0;

		// Determine if icon is emoji or text
		const iconType = this.isEmoji(icon) ? "emoji" : "text";

		// Convert color: if it's a number (old format), convert to hex; otherwise use as-is
		let color: string;
		if (colorValue.startsWith("#")) {
			color = colorValue;
		} else {
			const androidColor = parseInt(colorValue);
			color = CSVHandler.androidColorToHex(androidColor);
		}

		data.projects.push({
			id,
			name,
			icon,
			iconType,
			color,
			categoryId: -1, // will be set by typeCategory
			archived,
			order,
		});
	}

	private parseRecord(parts: string[], data: TimesheetData): void {
		// Format: record,id,projectId,startTime,endTime
		if (parts.length < 5) return;

		const id = parseInt(parts[1]);
		const projectId = parseInt(parts[2]);
		const startTime = parseInt(parts[3]);
		const endTime = parseInt(parts[4]);

		data.records.push({
			id,
			projectId,
			startTime,
			endTime,
			tags: [], // will be populated by recordToRecordTag
		});
	}

	private parseCategory(parts: string[], data: TimesheetData): void {
		// Format: category,id,name,color,order
		if (parts.length < 5) return;

		const id = parseInt(parts[1]);
		const name = parts[2];
		const colorValue = parts[3];
		const order = parts.length > 4 ? parseInt(parts[4]) : 0;

		// Convert color: if it's a number (old format), convert to hex; otherwise use as-is
		let color: string;
		if (colorValue.startsWith("#")) {
			color = colorValue;
		} else {
			const androidColor = parseInt(colorValue);
			color = CSVHandler.androidColorToHex(androidColor);
		}

		data.categories.push({
			id,
			name,
			color,
			order,
		});
	}

	private parseProjectCategory(parts: string[], data: TimesheetData): void {
		// Format: typeCategory,projectId,categoryId
		if (parts.length < 3) return;

		const projectId = parseInt(parts[1]);
		const categoryId = parseInt(parts[2]);

		data.projectCategories.set(projectId, categoryId);

		// Update the project's categoryId
		const project = data.projects.find((p) => p.id === projectId);
		if (project) {
			project.categoryId = categoryId;
		}
	}

	private parseTag(parts: string[], data: TimesheetData): void {
		// Format: recordTag,id,name,icon,color,archived
		if (parts.length < 6) return;

		const id = parseInt(parts[1]);
		const name = parts[2];
		const icon = parts[3];
		const colorValue = parts[4];
		const archived = parts[5] === "1";

		// Convert color: if it's a number (old format), convert to hex; otherwise use as-is
		let color: string;
		if (colorValue.startsWith("#")) {
			color = colorValue;
		} else {
			const androidColor = parseInt(colorValue);
			color = CSVHandler.androidColorToHex(androidColor);
		}

		data.tags.push({
			id,
			name,
			icon,
			color,
			archived,
		});
	}

	private parseRecordTag(parts: string[], data: TimesheetData): void {
		// Format: recordToRecordTag,recordId,tagId
		if (parts.length < 3) return;

		const recordId = parseInt(parts[1]);
		const tagId = parseInt(parts[2]);

		const tags = data.recordTags.get(recordId) || [];
		tags.push(tagId);
		data.recordTags.set(recordId, tags);

		// Update the record's tags array
		const record = data.records.find((r) => r.id === recordId);
		if (record) {
			record.tags = tags;
		}
	}

	private parseGoal(parts: string[], data: TimesheetData): void {
		// Format: recordTypeGoal,projectId,unused,type,targetSeconds,enabled,days,extra
		if (parts.length < 7) return;

		const projectId = parseInt(parts[1]);
		const type = parseInt(parts[3]); // Using index 3 for type
		const targetSeconds = parseInt(parts[4]);
		const enabled = parts[5] === "1";

		data.goals.push({
			projectId,
			type,
			targetSeconds,
			enabled,
		});
	}

	private parsePreference(parts: string[], data: TimesheetData): void {
		// Format: prefs,key,value
		if (parts.length < 3) return;

		const key = parts[1];
		const value = parts.slice(2).join(",");

		data.preferences.set(key, value);
	}

	/**
	 * Parse a CSV line, handling quoted fields
	 */
	private parseCSVLine(line: string): string[] {
		const result: string[] = [];
		let current = "";
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];

			if (char === '"') {
				inQuotes = !inQuotes;
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

	/**
	 * Escape a field for CSV format
	 */
	private escapeCSVField(field: string): string {
		if (field.includes(",") || field.includes('"') || field.includes("\n")) {
			return `"${field.replace(/"/g, '""')}"`;
		}
		return field;
	}

	/**
	 * Serialize timesheet data back to CSV format
	 */
	async writeTimesheet(file: TFile, data: TimesheetData): Promise<void> {
		const lines: string[] = [];

		// Write projects (recordType)
		for (const project of data.projects) {
			lines.push(
				`recordType,${project.id},${this.escapeCSVField(project.name)},${this.escapeCSVField(project.icon)},${project.color},${project.archived ? 1 : 0},${project.order}`,
			);
		}

		// Write records
		for (const record of data.records) {
			lines.push(
				`record,${record.id},${record.projectId},${record.startTime},${record.endTime}`,
			);
		}

		// Write categories
		for (const category of data.categories) {
			lines.push(
				`category,${category.id},${this.escapeCSVField(category.name)},${category.color},${category.order}`,
			);
		}

		// Write project-category mappings
		for (const [projectId, categoryId] of data.projectCategories.entries()) {
			lines.push(`typeCategory,${projectId},${categoryId}`);
		}

		// Write tags
		for (const tag of data.tags) {
			lines.push(
				`recordTag,${tag.id},${this.escapeCSVField(tag.name)},${this.escapeCSVField(tag.icon)},${tag.color},${tag.archived ? 1 : 0}`,
			);
		}

		// Write record-tag mappings
		for (const [recordId, tagIds] of data.recordTags.entries()) {
			for (const tagId of tagIds) {
				lines.push(`recordToRecordTag,${recordId},${tagId}`);
			}
		}

		// Write goals
		for (const goal of data.goals) {
			lines.push(
				`recordTypeGoal,${goal.projectId},0,${goal.type},${goal.targetSeconds},${goal.enabled ? 1 : 0},0000000,0`,
			);
		}

		// Write preferences
		for (const [key, value] of data.preferences.entries()) {
			lines.push(`prefs,${key},${this.escapeCSVField(value)}`);
		}

		const content = lines.join("\n");
		await this.vault.modify(file, content);
	}

	/**
	 * Create a new empty timesheet file
	 */
	async createTimesheet(path: string): Promise<TFile> {
		const initialData: TimesheetData = {
			projects: [],
			records: [],
			categories: [
				{ id: -1, name: "Uncategorized", color: "#88C0D0", order: 0 },
			],
			projectCategories: new Map(),
			tags: [],
			recordTags: new Map(),
			goals: [],
			preferences: new Map([
				["multitaskingEnabled", "0"],
				["retroactiveTrackingEnabled", "0"],
				["showSeconds", "1"],
				["gridColumns", "3"],
			]),
		};

		const file = await this.vault.create(path, "");
		await this.writeTimesheet(file, initialData);
		return file;
	}

	/**
	 * Check if a string is an emoji
	 */
	private isEmoji(str: string): boolean {
		const emojiRegex =
			/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
		return emojiRegex.test(str);
	}

	/**
	 * Convert Android color format to hex (for backwards compatibility when reading old data)
	 */
	static androidColorToHex(color: number): string {
		// Android color is in ARGB format as a signed integer
		const unsigned = color >>> 0; // Convert to unsigned
		const hex = unsigned.toString(16).padStart(8, "0");
		return `#${hex.substring(2)}`; // Remove alpha channel
	}

	/**
	 * Get next available ID for a given array
	 */
	static getNextId(items: { id: number }[]): number {
		if (items.length === 0) return 1;
		return Math.max(...items.map((i) => i.id)) + 1;
	}
}
