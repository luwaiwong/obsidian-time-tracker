import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Timeblock } from "../types";
import TimeSelector from "../components/TimeSelector.svelte";
import TextInput from "../components/TextInput.svelte";
import TextArea from "../components/TextArea.svelte";
import ColorPicker from "../components/ColorPicker.svelte";
import { mount, unmount } from "svelte";
import { mountMiniTitle, mountSpacer } from "../utils/styleUtils";

export class EditTimeblockModal extends Modal {
	plugin: TimeTrackerPlugin;
	timeblock: Timeblock;
	onUpdate: (timeblock: Timeblock) => void;
	onDelete: (id: number) => void;

	private titleInput: string;
	private notesInput: string;
	private customColor: string;
	private startTime: Date;
	private endTime: Date;

	private titleComponent: Record<string, unknown> | null = null;
	private titleLabelComponent: Record<string, unknown> | null = null;
	private notesComponent: Record<string, unknown> | null = null;
	private notesLabelComponent: Record<string, unknown> | null = null;
	private startTimeComponent: Record<string, unknown> | null = null;
	private endTimeComponent: Record<string, unknown> | null = null;
	private colorPickerComponent: Record<string, unknown> | null = null;
	private colorLabelComponent: Record<string, unknown> | null = null;

	constructor(
		app: App,
		plugin: TimeTrackerPlugin,
		timeblock: Timeblock,
		onUpdate: (timeblock: Timeblock) => void,
		onDelete: (id: number) => void,
	) {
		super(app);
		this.plugin = plugin;
		this.timeblock = timeblock;
		this.onUpdate = onUpdate;
		this.onDelete = onDelete;

		this.titleInput = timeblock.title;
		this.notesInput = timeblock.notes || "";
		this.startTime = timeblock.startTime;
		this.endTime = timeblock.endTime;
		this.customColor = timeblock.color;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("edit-timeblock-modal");

		this.scope.register([], "Enter", (e) => {
			// e.preventDefault();
			// this.save();
			// return false;
		});

		// title section
		const titleLabelContainer = contentEl.createDiv();
		titleLabelContainer.style.margin = "0 0 4px";
		this.titleLabelComponent = mountMiniTitle(titleLabelContainer, "Title");

		const titleContainer = contentEl.createDiv();
		this.titleComponent = mount(TextInput, {
			target: titleContainer,
			props: {
				value: this.titleInput,
				placeholder: "What are you planning?",
				style: "height: 40px; font-size: 1rem;",
				onInput: (value: string) => {
					this.titleInput = value;
				},
				onKeyDown: (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						this.save();
					}
				},
			},
		});

		mountSpacer(contentEl, 12);

		// notes section
		const notesLabelContainer = contentEl.createDiv();
		notesLabelContainer.style.margin = "0 0 4px";
		this.notesLabelComponent = mountMiniTitle(notesLabelContainer, "Notes");

		const notesContainer = contentEl.createDiv();
		this.notesComponent = mount(TextArea, {
			target: notesContainer,
			props: {
				value: this.notesInput,
				placeholder: "Add details...",
				style: "min-height: 80px;",
				onInput: (value: string) => {
					this.notesInput = value;
				},
			},
		});

		mountSpacer(contentEl, 12);

		// time selectors
		const timeContainer = contentEl.createDiv();
		timeContainer.style.display = "flex";
		timeContainer.style.flexDirection = "column";
		timeContainer.style.gap = "8px";

		const startContainer = contentEl.createDiv();
		timeContainer.appendChild(startContainer);
		this.startTimeComponent = mount(TimeSelector, {
			target: startContainer,
			props: {
				value: this.startTime,
				title: "Start Time",
				maxDate: this.endTime,
				onChanged: (date: Date) => {
					this.startTime = date;
				},
			},
		});

		const endContainer = contentEl.createDiv();
		timeContainer.appendChild(endContainer);
		this.endTimeComponent = mount(TimeSelector, {
			target: endContainer,
			props: {
				value: this.endTime,
				title: "End Time",
				minDate: this.startTime,
				onChanged: (date: Date) => {
					this.endTime = date;
				},
			},
		});

		mountSpacer(contentEl, 12);

		// color section
		const colorContainer = contentEl.createDiv();
		this.colorLabelComponent = mountMiniTitle(colorContainer, "Color");
		const pickerContainer = colorContainer.createDiv();
		this.colorPickerComponent = mount(ColorPicker, {
			target: pickerContainer,
			props: {
				value: this.customColor,
				onChange: (color: string) => {
					this.customColor = color;
				},
			},
		});

		mountSpacer(contentEl, 8);

		// action buttons
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
		deleteButton.addEventListener("click", () => this.delete());

		const rightButtons = buttonContainer.createDiv();
		rightButtons.style.display = "flex";
		rightButtons.style.gap = "8px";

		const cancelButton = rightButtons.createEl("button", {
			text: "Cancel",
			attr: { type: "button" },
		});
		cancelButton.addEventListener("click", () => this.close());

		const saveButton = rightButtons.createEl("button", {
			text: "Save",
			cls: "mod-cta",
			attr: { type: "button" },
		});
		saveButton.addEventListener("click", () => this.save());
	}

	onClose() {
		if (this.titleComponent) unmount(this.titleComponent);
		if (this.titleLabelComponent) unmount(this.titleLabelComponent);
		if (this.notesComponent) unmount(this.notesComponent);
		if (this.notesLabelComponent) unmount(this.notesLabelComponent);
		if (this.startTimeComponent) unmount(this.startTimeComponent);
		if (this.endTimeComponent) unmount(this.endTimeComponent);
		if (this.colorPickerComponent) unmount(this.colorPickerComponent);
		if (this.colorLabelComponent) unmount(this.colorLabelComponent);
		this.contentEl.empty();
	}

	async save() {
		if (!this.titleInput.trim()) {
			new Notice("Please enter a title");
			return;
		}

		if (this.endTime.getTime() <= this.startTime.getTime()) {
			new Notice("End time must be after start time");
			return;
		}

		const updated: Timeblock = {
			id: this.timeblock.id,
			title: this.titleInput.trim(),
			startTime: this.startTime,
			endTime: this.endTime,
			color: this.customColor,
			notes: this.notesInput.trim(),
		};

		this.plugin.updateTimeblock(this.timeblock.id, updated);
		this.onUpdate(updated);
		this.close();
	}
	async delete() {
		const id = this.timeblock.id;
		this.plugin.deleteTimeblock(id);
		new Notice("Timeblock deleted");
		this.onDelete(id);
		this.close();
	}
}
