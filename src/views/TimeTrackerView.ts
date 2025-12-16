import { ItemView, WorkspaceLeaf } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import ProjectGrid from "../components/ProjectGrid.svelte";
import TimeHeader from "../components/TimeHeader.svelte";
import { ProjectModal } from "../modals/ProjectModal";
import { mount, unmount } from "svelte";

export const VIEW_TYPE_TIME_TRACKER = "time-tracker-view";

export class TimeTrackerView extends ItemView {
	plugin: TimeTrackerPlugin;
	private gridComponent: Record<string, unknown> | null = null;
	private headerComponent: Record<string, unknown> | null = null;

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

		const header = container.createDiv("time-tracker-header");

		this.headerComponent = mount(TimeHeader, {
			target: header,
			props: {
				plugin: this.plugin,
				runningTimers: this.plugin.runningTimers || [],
				onAddProject: () => {
					new ProjectModal(this.plugin.app, this.plugin, null, () => {
						this.refresh();
					}).open();
				},
				onOpenAnalytics: () => {
					this.plugin.activateAnalyticsView();
				},
				onOpenSettings: () => {
					// @ts-ignore - accessing internal Obsidian API
					this.plugin.app.setting.open();
					// @ts-ignore
					this.plugin.app.setting.openTabById("time-tracker");
				},
				onStopAll:
					this.plugin.runningTimers.length > 0
						? () => {
								this.plugin.stopAllTimers();
							}
						: undefined,
			},
		});

		const content = container.createDiv("time-tracker-content");

		this.gridComponent = mount(ProjectGrid, {
			target: content,
			props: {
				plugin: this.plugin,
				projects: this.plugin.timesheetData?.projects || [],
				runningTimers: this.plugin.runningTimers || [],
				gridColumns: this.plugin.settings?.gridColumns || 3,
			},
		});
	}

	async onClose() {
		if (this.headerComponent) {
			unmount(this.headerComponent);
			this.headerComponent = null;
		}
		if (this.gridComponent) {
			unmount(this.gridComponent);
			this.gridComponent = null;
		}
	}

	refresh() {
		this.onClose();
		this.onOpen();
	}
}
