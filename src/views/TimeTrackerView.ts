import { ItemView, WorkspaceLeaf } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import ControlBar from "../components/ControlBar.svelte";
import Schedule from "../components/Schedule.svelte";
import { mount, unmount } from "svelte";
import { EditRecordModal } from "..//modals/EditRecordModal";
import { Project, TimeRecord } from "src/types";

export const VIEW_TYPE_TIME_TRACKER = "time-tracker-view";

export class TimeTrackerView extends ItemView {
	plugin: TimeTrackerPlugin;
	private scheduleComponent: Record<string, any> | null = null;
	private summaryComponent: Record<string, any> | null = null;
	private headerComponent: Record<string, any> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TimeTrackerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_TIME_TRACKER;
	}

	getDisplayText(): string {
		return "Time Tracker";
	}

	getIcon(): string {
		return "clock";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("time-tracker-view");

		// Show loading indicator if data is still loading
		if (this.plugin.isLoading) {
			const loadingDiv = container.createDiv("time-tracker-loading");
			loadingDiv.setText("Loading timesheet...");
			return;
		}

		// Show error if there was a problem loading
		if (this.plugin.error) {
			const errorDiv = container.createDiv("time-tracker-error");
			errorDiv.setText(this.plugin.error);
			return;
		}

		// Header with buttons and timer
		const header = container.createDiv("time-tracker-header");

		this.headerComponent = mount(ControlBar, {
			target: header,
			props: {
				plugin: this.plugin,
				runningTimers: this.plugin.runningTimers || [],
				onOpenAnalytics: () => {
					this.plugin.activateAnalyticsView();
				},
				onOpenSettings: () => {
					// @ts-ignore
					this.plugin.app.setting.open();
					// @ts-ignore
					this.plugin.app.setting.openTabById("time-tracker");
				},
				onRefresh: () => {
					this.refresh();
				},
			},
		});

		// Content area
		const content = container.createDiv("time-tracker-content");

		// show project schedule view
		this.scheduleComponent = mount(Schedule, {
			target: content,
			props: {
				plugin: this.plugin,
				onOpenAnalytics: () => {
					this.plugin.activateAnalyticsView();
				},
				onOpenSettings: () => {
					// @ts-ignore
					this.plugin.app.setting.open();
					// @ts-ignore
					this.plugin.app.setting.openTabById("time-tracker");
				},
				onEditRecord: (record: TimeRecord, project: Project) => {
					new EditRecordModal(
						this.plugin.app,
						this.plugin,
						record,
						() => {
							this.refresh();
						},
					).open();
				},
			},
		});
	}

	async onClose() {
		if (this.headerComponent) {
			unmount(this.headerComponent);
			this.headerComponent = null;
		}
		if (this.scheduleComponent) {
			unmount(this.scheduleComponent);
			this.scheduleComponent = null;
		}
		if (this.summaryComponent) {
			unmount(this.summaryComponent);
			this.summaryComponent = null;
		}
	}

	refresh() {
		this.onClose();
		this.onOpen();
	}
}
