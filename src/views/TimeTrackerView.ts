import { App, ItemView, WorkspaceLeaf } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import ControlBar from "../components/ControlBar.svelte";
import Schedule from "../components/Schedule.svelte";
import { mount, unmount } from "svelte";
import { EditRecordModal } from "..//modals/EditRecordModal";
import { TimeRecord } from "src/types";

// stupid thing to hide error
interface AppWithSetting extends App {
	setting?: {
		open: () => void;
		openTabById: (id: string) => void;
	};
}

export const VIEW_TYPE_TIME_TRACKER = "time-tracker-view";

export class TimeTrackerView extends ItemView {
	plugin: TimeTrackerPlugin;
	private scheduleComponent: Record<string, unknown> | null = null;
	private summaryComponent: Record<string, unknown> | null = null;
	private headerComponent: Record<string, unknown> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TimeTrackerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_TIME_TRACKER;
	}

	getDisplayText(): string {
		return "Time tracker";
	}

	getIcon(): string {
		return "clock";
	}

	onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("time-tracker-view");

		// Show loading indicator if data is still loading
		if (this.plugin.isLoading) {
			const loadingDiv = container.createDiv("time-tracker-loading");
			loadingDiv.setText("Loading timesheet...");
			return Promise.resolve();
		}

		// Show error if there was a problem loading
		if (this.plugin.error) {
			const errorDiv = container.createDiv("time-tracker-error");
			errorDiv.setText(this.plugin.error);
			return Promise.resolve();
		}

		// Header with buttons and timer
		const header = container.createDiv("time-tracker-header");

		this.headerComponent = mount(ControlBar, {
			target: header,
			props: {
				plugin: this.plugin,
				runningTimers: this.plugin.runningTimers || [],
				onOpenAnalytics: () => {
					void this.plugin.activateAnalyticsView();
				},
				onOpenSettings: () => {
					const app = this.plugin.app as AppWithSetting;
					app.setting?.open();
					app.setting?.openTabById("time-tracker");
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
				onRefresh: () => {
					void this.onScheduleRefresh();
				},
				onOpenAnalytics: () => {
					void this.plugin.activateAnalyticsView();
				},
				onOpenSettings: () => {
					const app = this.plugin.app as AppWithSetting;
					app.setting?.open();
					app.setting?.openTabById("time-tracker");
				},
				onEditRecord: (record: TimeRecord) => {
					new EditRecordModal(
						this.plugin.app,
						this.plugin,
						record,
						() => {
							void this.refresh();
						},
					).open();
				},
			},
		});

		return Promise.resolve();
	}

	async onScheduleRefresh() {
		await this.plugin.loadTimesheet();
		this.refresh();
	}

	onClose() {
		if (this.headerComponent) {
			void unmount(this.headerComponent);
			this.headerComponent = null;
		}
		if (this.scheduleComponent) {
			void unmount(this.scheduleComponent);
			this.scheduleComponent = null;
		}
		if (this.summaryComponent) {
			void unmount(this.summaryComponent);
			this.summaryComponent = null;
		}
		return Promise.resolve();
	}

	refresh() {
		void this.onClose();
		void this.onOpen();
	}
}
