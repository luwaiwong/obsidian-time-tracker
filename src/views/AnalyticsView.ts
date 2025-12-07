import { ItemView, WorkspaceLeaf } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import Analytics from "../components/Analytics.svelte";
import { mount, unmount } from "svelte";

export const VIEW_TYPE_ANALYTICS = "time-tracker-analytics";

export class AnalyticsView extends ItemView {
	plugin: TimeTrackerPlugin;
	private component: Record<string, any> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TimeTrackerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ANALYTICS;
	}

	getDisplayText(): string {
		return "Time Analytics";
	}

	getIcon(): string {
		return "bar-chart";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("time-tracker-analytics-view");

		this.component = mount(Analytics, {
			target: container,
			props: {
				plugin: this.plugin,
			},
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
