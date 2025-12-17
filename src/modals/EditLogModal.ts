import { App, Modal, Setting, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { TimeLog } from "../types";

export class EditLogModal extends Modal {
	plugin: TimeTrackerPlugin;
	log: TimeLog;
	onSave: () => void;

	private titleInput: string;
	private startTimeInput: string;
	private endTimeInput: string;

	constructor(
		app: App,
		plugin: TimeTrackerPlugin,
		log: TimeLog,
		onSave: () => void,
	) {
		super(app);
		this.plugin = plugin;
		this.log = log;
		this.onSave = onSave;

		this.titleInput = log.title;
		this.startTimeInput = this.toDateTimeLocal(log.startTime);
		this.endTimeInput = log.endTime
			? this.toDateTimeLocal(log.endTime)
			: "";
	}

	private toDateTimeLocal(date: Date): string {
		const pad = (n: number) => n.toString().padStart(2, "0");
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: "Edit Log Entry" });

		new Setting(contentEl)
			.setName("Title")
			.setDesc("What were you working on?")
			.addText((text) =>
				text
					.setPlaceholder("Entry title...")
					.setValue(this.titleInput)
					.onChange((value) => {
						this.titleInput = value;
					}),
			);

		const startSetting = new Setting(contentEl)
			.setName("Start Time")
			.setDesc("When did you start?");
		const startInput = startSetting.controlEl.createEl("input", {
			type: "datetime-local",
			value: this.startTimeInput,
		});
		startInput.addEventListener("change", (e) => {
			this.startTimeInput = (e.target as HTMLInputElement).value;
		});

		const endSetting = new Setting(contentEl)
			.setName("End Time")
			.setDesc("When did you finish?");
		const endInput = endSetting.controlEl.createEl("input", {
			type: "datetime-local",
			value: this.endTimeInput,
		});
		endInput.addEventListener("change", (e) => {
			this.endTimeInput = (e.target as HTMLInputElement).value;
		});

		const buttonContainer = contentEl.createDiv("modal-button-container");
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "space-between";
		buttonContainer.style.gap = "8px";
		buttonContainer.style.marginTop = "20px";

		const deleteButton = buttonContainer.createEl("button", {
			text: "Delete",
			cls: "mod-warning",
			attr: { type: "button" },
		});
		deleteButton.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.delete();
		});

		const rightButtons = buttonContainer.createDiv();
		rightButtons.style.display = "flex";
		rightButtons.style.gap = "8px";

		const cancelButton = rightButtons.createEl("button", {
			text: "Cancel",
			attr: { type: "button" },
		});
		cancelButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.close();
		});

		const saveButton = rightButtons.createEl("button", {
			text: "Save",
			cls: "mod-cta",
			attr: { type: "button" },
		});
		saveButton.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.save();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	async save() {
		const index = this.plugin.timesheetData.logs.findIndex(
			(l) => l.id === this.log.id,
		);
		if (index === -1) {
			new Notice("Log entry not found");
			return;
		}

		const newStart = new Date(this.startTimeInput);
		const newEnd = this.endTimeInput ? new Date(this.endTimeInput) : null;

		if (isNaN(newStart.getTime())) {
			new Notice("Invalid start time");
			return;
		}

		if (newEnd && isNaN(newEnd.getTime())) {
			new Notice("Invalid end time");
			return;
		}

		if (newEnd && newEnd.getTime() < newStart.getTime()) {
			new Notice("End time must be after start time");
			return;
		}

		this.plugin.timesheetData.logs[index].title = this.titleInput.trim();
		this.plugin.timesheetData.logs[index].startTime = newStart;
		this.plugin.timesheetData.logs[index].endTime = newEnd;

		await this.plugin.saveTimesheet();
		this.plugin.refreshViews();
		this.onSave();
		this.close();
	}

	async delete() {
		const index = this.plugin.timesheetData.logs.findIndex(
			(l) => l.id === this.log.id,
		);
		if (index === -1) {
			new Notice("Log entry not found");
			return;
		}

		this.plugin.timesheetData.logs.splice(index, 1);
		await this.plugin.saveTimesheet();
		this.plugin.refreshViews();
		this.onSave();
		new Notice("Log entry deleted");
		this.close();
	}
}
