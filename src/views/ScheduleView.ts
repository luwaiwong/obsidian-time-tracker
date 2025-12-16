import { ItemView, WorkspaceLeaf } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import Schedule from "../components/Schedule.svelte";
import { mount, unmount } from "svelte";

export const VIEW_TYPE_SCHEDULE = "time-tracker-schedule";

export class ScheduleView extends ItemView {
	plugin: TimeTrackerPlugin;
	private component: Record<string, unknown> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TimeTrackerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_SCHEDULE;
	}

	getDisplayText(): string {
		return "Schedule";
	}

	getIcon(): string {
		return "calendar";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("time-tracker-schedule-view");

		this.component = mount(Schedule, {
			target: container,
			props: { plugin: this.plugin },
		});
	}

	async onClose() {
		if (this.component) {
			unmount(this.component);
			this.component = null;
		}
	}

	refresh() {
		this.onClose();
		this.onOpen();
	}
}
