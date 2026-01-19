import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { Timeblock } from "../types";
import TimeGrid from "../components/TimeGrid.svelte";
import TextInput from "../components/TextInput.svelte";
import TextArea from "../components/TextArea.svelte";
import ColorPicker from "../components/ColorPicker.svelte";
import ModalActionButtons from "../components/ModalActionButtons.svelte";
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
	private timeGridComponent: Record<string, unknown> | null = null;
	private colorPickerComponent: Record<string, unknown> | null = null;
	private colorLabelComponent: Record<string, unknown> | null = null;
	private actionButtonsComponent: Record<string, unknown> | null = null;
	private timeContainer: HTMLElement | null = null;

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
		this.startTime = new Date(timeblock.startTime);
		this.endTime = new Date(timeblock.endTime);
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
		titleLabelContainer.setCssProps({ margin: "0 0 4px" });
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
						void this.save();
					}
				},
			},
		});

		mountSpacer(contentEl, 12);

		// notes section
		const notesLabelContainer = contentEl.createDiv();
		notesLabelContainer.setCssProps({ margin: "0 0 4px" });
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
		this.timeContainer = contentEl.createDiv();
		this.timeGridComponent = mount(TimeGrid, {
			target: this.timeContainer,
			props: {
				startTime: {
					value: this.startTime,
					title: "Start Time",
					maxDate: this.endTime,
					onChanged: (date: Date) => {
						this.startTime = date;
						this.updateTimeGrid();
					},
				},
				endTime: {
					value: this.endTime,
					title: "End Time",
					minDate: this.startTime,
					onChanged: (date: Date) => {
						this.endTime = date;
						this.updateTimeGrid();
					},
				},
				gap: "8px",
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
		const buttonContainer = contentEl.createDiv();
		this.actionButtonsComponent = mount(ModalActionButtons, {
			target: buttonContainer,
			props: {
				leftButtons: [
					{ text: "Delete", onClick: () => this.delete(), variant: "warning" },
				],
				rightButtons: [
					{
						text: "Cancel",
						onClick: () => this.close(),
						variant: "default",
					},
					{
						text: "Save",
						onClick: () => this.save(),
						variant: "cta",
					},
				],
			},
		});
	}

	private updateTimeGrid(): void {
		if (this.timeGridComponent) {
			void unmount(this.timeGridComponent);
		}
		if (this.timeContainer) {
			this.timeContainer.empty();
			this.timeGridComponent = mount(TimeGrid, {
				target: this.timeContainer,
				props: {
					startTime: {
						value: this.startTime,
						title: "Start Time",
						maxDate: this.endTime,
						onChanged: (date: Date) => {
							this.startTime = date;
							this.updateTimeGrid();
						},
					},
					endTime: {
						value: this.endTime,
						title: "End Time",
						minDate: this.startTime,
						onChanged: (date: Date) => {
							this.endTime = date;
							this.updateTimeGrid();
						},
					},
					gap: "8px",
				},
			});
		}
	}

	onClose() {
		if (this.titleComponent) void unmount(this.titleComponent);
		if (this.titleLabelComponent) void unmount(this.titleLabelComponent);
		if (this.notesComponent) void unmount(this.notesComponent);
		if (this.notesLabelComponent) void unmount(this.notesLabelComponent);
		if (this.timeGridComponent) void unmount(this.timeGridComponent);
		if (this.colorPickerComponent) void unmount(this.colorPickerComponent);
		if (this.colorLabelComponent) void unmount(this.colorLabelComponent);
		if (this.actionButtonsComponent) void unmount(this.actionButtonsComponent);
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

		const notesValue = (this.notesInput ?? "").trim();
		const updated: Partial<Timeblock> = {
			title: this.titleInput.trim(),
			startTime: new Date(this.startTime),
			endTime: new Date(this.endTime),
			color: this.customColor,
			notes: notesValue,
		};

		await this.plugin.updateTimeblock(this.timeblock.id, updated);
		const fullUpdated: Timeblock = {
			...this.timeblock,
			...updated,
		};
		this.onUpdate(fullUpdated);
		this.close();
	}
	async delete() {
		const id = this.timeblock.id;
		await this.plugin.deleteTimeblock(id);
		new Notice("Timeblock deleted");
		this.onDelete(id);
		this.close();
	}
}
