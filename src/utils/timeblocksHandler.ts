import { TFile, Vault } from "obsidian";
import type { Timeblock, TimeblocksData } from "../types";

/**
 * Handles reading and writing the timeblocks.csv file.
 *
 * CSV Format:
 *   timeblock,<id>,<title>,<startTime>,<endTime>,<color>
 *
 * Times use ISO 8601 format (YYYY-MM-DD HH:MM:SS).
 */

export class TimeblocksHandler {
	constructor(private vault: Vault) {}

	async parseTimeblocks(file: TFile): Promise<TimeblocksData> {
		const content = await this.vault.read(file);
		return this.parseTimeblocksContent(content);
	}

	parseTimeblocksContent(content: string): TimeblocksData {
		const lines = content
			.split("\n")
			.filter((line) => line.trim().length > 0);

		const data: TimeblocksData = {
			timeblocks: [],
		};

		for (const line of lines) {
			const parts = this.parseCSVLine(line);
			if (parts.length === 0) continue;

			const type = parts[0];
			if (type === "timeblock") {
				this.parseTimeblock(parts, data);
			}
		}

		return data;
	}

	private parseTimeblock(parts: string[], data: TimeblocksData): void {
		// format: timeblock,id,title,startTime,endTime,color,notes
		if (parts.length < 6) return;

		const id = parseInt(parts[1]);
		const title = parts[2];
		const startTimeStr = parts[3];
		const endTimeStr = parts[4];
		const color = parts[5] || "#6b7280";
		const notes = parts.length > 6 ? parts[6] : "";

		const startTime = this.parseDateTime(startTimeStr);
		const endTime = this.parseDateTime(endTimeStr);
		if (!startTime || !endTime) return;

		data.timeblocks.push({
			id,
			title,
			startTime,
			endTime,
			color,
			notes,
		});
	}

	private parseDateTime(str: string): Date | null {
		if (!str || str.trim() === "") return null;

		const date = new Date(str);
		if (!isNaN(date.getTime())) {
			return date;
		}

		const ms = parseInt(str);
		if (!isNaN(ms)) {
			return new Date(ms);
		}

		return null;
	}

	private formatDateTime(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");

		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

	async writeTimeblocks(file: TFile, data: TimeblocksData): Promise<void> {
		const lines: string[] = [];

		for (const timeblock of data.timeblocks) {
			const startTimeStr = this.formatDateTime(timeblock.startTime);
			const endTimeStr = this.formatDateTime(timeblock.endTime);

			lines.push(
				[
					"timeblock",
					timeblock.id,
					this.escapeCSVField(timeblock.title),
					startTimeStr,
					endTimeStr,
					timeblock.color,
					this.escapeCSVField(timeblock.notes || ""),
				].join(","),
			);
		}

		const content = lines.join("\n");
		await this.vault.modify(file, content);
	}

	async createTimeblocks(path: string): Promise<TFile> {
		const initialData: TimeblocksData = {
			timeblocks: [],
		};

		const file = await this.vault.create(path, "");
		await this.writeTimeblocks(file, initialData);
		return file;
	}

	static getNextId(items: { id: number }[]): number {
		if (items.length === 0) return 1;
		return Math.max(...items.map((i) => i.id)) + 1;
	}
}
