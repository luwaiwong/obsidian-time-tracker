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
import { getRandomPresetColor } from "../utils/colorUtils";

export class CreateTimeblockModal extends Modal {
	plugin: TimeTrackerPlugin;
	onCreate: (timeblock: Timeblock) => void;

	private titleInput: string = "";
	private notesInput: string = "";
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
		initialStart: Date,
		initialEnd: Date,
		onCreate: (timeblock: Timeblock) => void,
	) {
		super(app);
		this.plugin = plugin;
		this.onCreate = onCreate;
		this.startTime = initialStart;
		this.endTime = initialEnd;
		this.customColor = getRandomPresetColor();
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("create-timeblock-modal");

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
				primaryButton: {
					text: "Create",
					onClick: () => this.save(),
					variant: "cta",
				},
				cancelButton: { onClick: () => this.close() },
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

		const timeblock = await this.plugin.createTimeblock({
			title: this.titleInput.trim(),
			startTime: this.startTime,
			endTime: this.endTime,
			color: this.customColor,
			notes: (this.notesInput ?? "").trim(),
		});

		this.onCreate(timeblock);
		this.close();
	}
}
