import { App, Modal, Setting, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Category, Project, TimeRecord } from "../types";
import { CSVHandler } from "../handlers/csvHandler";

interface STTRecordType {
	id: number;
	name: string;
	icon: string;
	color: number;
	archived: boolean;
}

interface STTRecord {
	id: number;
	typeId: number;
	startTime: number;
	endTime: number;
	comment: string;
}

interface STTCategory {
	id: number;
	name: string;
	color: number;
}

interface STTTypeCategory {
	typeId: number;
	categoryId: number;
}

interface ParsedSTTData {
	recordTypes: STTRecordType[];
	records: STTRecord[];
	categories: STTCategory[];
	typeCategories: STTTypeCategory[];
}

export class ImportModal extends Modal {
	plugin: TimeTrackerPlugin;
	fileContent: string = "";

	constructor(app: App, plugin: TimeTrackerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("time-tracker-import-modal");

		contentEl.createEl("h2", { text: "Import from Simple Time Tracker" });

		contentEl.createEl("p", {
			text: "Paste the contents of your Simple Time Tracker backup file (.backup) below.",
			cls: "setting-item-description",
		});

		const textArea = contentEl.createEl("textarea", {
			cls: "time-tracker-import-textarea",
		});
		textArea.style.width = "100%";
		textArea.style.height = "200px";
		textArea.style.fontFamily = "monospace";
		textArea.style.fontSize = "12px";
		textArea.placeholder = "Paste backup file contents here...";

		textArea.addEventListener("input", () => {
			this.fileContent = textArea.value;
		});

		const buttonContainer = contentEl.createDiv("modal-button-container");
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.gap = "8px";
		buttonContainer.style.marginTop = "20px";

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
			attr: { type: "button" },
		});
		cancelButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.close();
		});

		const importButton = buttonContainer.createEl("button", {
			text: "Import",
			cls: "mod-cta",
			attr: { type: "button" },
		});
		importButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.doImport();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private parseSTTBackup(content: string): ParsedSTTData {
		const lines = content
			.split("\n")
			.filter((line) => line.trim().length > 0);

		const data: ParsedSTTData = {
			recordTypes: [],
			records: [],
			categories: [],
			typeCategories: [],
		};

		for (const line of lines) {
			const parts = line.split("\t");
			if (parts.length === 0) continue;

			const type = parts[0];

			switch (type) {
				case "recordType":
					this.parseRecordType(parts, data);
					break;
				case "record":
					this.parseRecord(parts, data);
					break;
				case "category":
					this.parseCategory(parts, data);
					break;
				case "typeCategory":
					this.parseTypeCategory(parts, data);
					break;
			}
		}

		return data;
	}

	private parseRecordType(parts: string[], data: ParsedSTTData): void {
		// Format: recordType	id	name	icon	color	archived	...
		if (parts.length < 6) return;

		const id = parseInt(parts[1]);
		const name = parts[2];
		const icon = parts[3];
		const color = parseInt(parts[4]);
		const archived = parts[5] === "1";

		data.recordTypes.push({ id, name, icon, color, archived });
	}

	private parseRecord(parts: string[], data: ParsedSTTData): void {
		// Format: record	id	typeId	startTime	endTime	comment
		if (parts.length < 5) return;

		const id = parseInt(parts[1]);
		const typeId = parseInt(parts[2]);
		const startTime = parseInt(parts[3]);
		const endTime = parseInt(parts[4]);
		const comment = parts.length > 5 ? parts[5] : "";

		data.records.push({ id, typeId, startTime, endTime, comment });
	}

	private parseCategory(parts: string[], data: ParsedSTTData): void {
		// Format: category	id	name	color	...
		if (parts.length < 4) return;

		const id = parseInt(parts[1]);
		const name = parts[2];
		const color = parseInt(parts[3]);

		data.categories.push({ id, name, color });
	}

	private parseTypeCategory(parts: string[], data: ParsedSTTData): void {
		// Format: typeCategory	typeId	categoryId
		if (parts.length < 3) return;

		const typeId = parseInt(parts[1]);
		const categoryId = parseInt(parts[2]);

		data.typeCategories.push({ typeId, categoryId });
	}

	private convertIcon(sttIcon: string): string {
		// Map common Simple Time Tracker icons to emoji equivalents
		const iconMap: Record<string, string> = {
			ic_account_balance_24px: "🏛️",
			ic_phone_iphone_24px: "📱",
			ic_public_24px: "🌐",
			ic_check_circle_24px: "✅",
			ic_electric_car_24px: "🚗",
			ic_airplanemode_active_24px: "✈️",
			ic_videogame_asset_24px: "🎮",
			ic_menu_book_24px: "📖",
			ic_sports_motorsports_24px: "🏍️",
			ic_keyboard_24px: "⌨️",
			ic_laptop_windows_24px: "💻",
			ic_train_24px: "🚆",
			ic_business_center_24px: "💼",
			ic_local_hospital_24px: "🏥",
			ic_audiotrack_24px: "🎸",
			ic_headset_24px: "🎧",
			ic_desktop_windows_24px: "🖥️",
			ic_fitness_center_24px: "🏋️",
			ic_assignment_24px: "📋",
			ic_park_24px: "🌳",
			ic_restaurant_menu_24px: "🍽️",
			ic_airline_seat_individual_suite_24px: "🛏️",
			ic_phone_android_24px: "📱",
			ic_chat_24px: "💬",
			ic_directions_car_24px: "🚗",
			ic_elderly_24px: "🚶",
			ic_wash_24px: "🧼",
			ic_airline_seat_recline_extra_24px: "💺",
			ic_group_24px: "👥",
			ic_motorcycle_24px: "🏍️",
			ic_schedule_24px: "⏰",
			ic_event_note_24px: "📅",
			ic_local_grocery_store_24px: "🛒",
			ic_query_builder_24px: "⏱️",
			ic_favorite_24px: "❤️",
		};

		// Check if it's a known icon
		if (iconMap[sttIcon]) {
			return iconMap[sttIcon];
		}

		// If it looks like a course code (3 digits), return it as-is
		if (/^\d{3}$/.test(sttIcon)) {
			return sttIcon;
		}

		// Default emoji
		return "📌";
	}

	private async doImport(): Promise<void> {
		if (!this.fileContent.trim()) {
			new Notice("Please paste the backup file contents");
			return;
		}

		try {
			const sttData = this.parseSTTBackup(this.fileContent);

			if (
				sttData.recordTypes.length === 0 &&
				sttData.records.length === 0
			) {
				new Notice("No valid data found in the backup file");
				return;
			}

			// Build category map (STT category id -> our category id)
			const categoryMap = new Map<number, number>();
			const existingCategories = this.plugin.timesheetData.categories;
			let nextCategoryId = CSVHandler.getNextId(existingCategories);

			// Import categories
			for (const sttCat of sttData.categories) {
				// Check if category already exists by name
				const existing = existingCategories.find(
					(c) => c.name.toLowerCase() === sttCat.name.toLowerCase(),
				);

				if (existing) {
					categoryMap.set(sttCat.id, existing.id);
				} else {
					const newCategory: Category = {
						id: nextCategoryId,
						name: sttCat.name,
						color: CSVHandler.androidColorToHex(sttCat.color),
						archived: false,
						order: existingCategories.length,
					};
					this.plugin.timesheetData.categories.push(newCategory);
					categoryMap.set(sttCat.id, nextCategoryId);
					nextCategoryId++;
				}
			}

			// Build typeCategory lookup (typeId -> categoryId)
			const typeCategoryMap = new Map<number, number>();
			for (const tc of sttData.typeCategories) {
				const mappedCategoryId = categoryMap.get(tc.categoryId);
				if (mappedCategoryId !== undefined) {
					typeCategoryMap.set(tc.typeId, mappedCategoryId);
				}
			}

			// Build project map (STT recordType id -> project name)
			const projectNameMap = new Map<number, string>();
			const existingProjects = this.plugin.timesheetData.projects;
			let nextProjectId = CSVHandler.getNextId(existingProjects);

			// Import projects (recordTypes)
			for (const rt of sttData.recordTypes) {
				// Check if project already exists by name
				const existing = existingProjects.find(
					(p) => p.name.toLowerCase() === rt.name.toLowerCase(),
				);

				if (existing) {
					projectNameMap.set(rt.id, existing.name);
				} else {
					const categoryId = typeCategoryMap.get(rt.id) ?? -1;
					const newProject: Project = {
						id: nextProjectId,
						name: rt.name,
						icon: this.convertIcon(rt.icon),
						color: CSVHandler.androidColorToHex(rt.color),
						categoryId: categoryId,
						archived: rt.archived,
						order: existingProjects.length,
					};
					this.plugin.timesheetData.projects.push(newProject);
					projectNameMap.set(rt.id, rt.name);
					nextProjectId++;
				}
			}

			// Import time records
			const existingRecords = this.plugin.timesheetData.records;
			let nextRecordId = CSVHandler.getNextId(existingRecords);
			let importedRecords = 0;

			for (const record of sttData.records) {
				const projectName = projectNameMap.get(record.typeId);
				if (!projectName) continue;

				// Look up project by name to get its ID
				const project = this.plugin.timesheetData.projects.find(
					(p) => p.name === projectName,
				);
				if (!project) continue;

				// Check for duplicate records (same project, same start time)
				const startTime = new Date(record.startTime);
				const isDuplicate = existingRecords.some(
					(r) =>
						r.projectId === project.id &&
						r.startTime.getTime() === startTime.getTime(),
				);

				if (!isDuplicate) {
					const newRecord: TimeRecord = {
						id: nextRecordId,
						projectId: project.id,
						startTime: startTime,
						endTime: new Date(record.endTime),
						title: record.comment || "",
					};
					this.plugin.timesheetData.records.push(newRecord);
					nextRecordId++;
					importedRecords++;
				}
			}

			await this.plugin.saveTimesheet();
			this.plugin.refreshViews();

			const categoriesImported = sttData.categories.length;
			const projectsImported = sttData.recordTypes.length;

			new Notice(
				`Imported ${importedRecords} time records, ${projectsImported} projects, ${categoriesImported} categories`,
			);

			this.close();
		} catch (err) {
			new Notice("Error importing data: " + (err as Error).message);
		}
	}
}
