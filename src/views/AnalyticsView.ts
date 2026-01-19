import { ItemView, WorkspaceLeaf } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import Analytics from "../components/Analytics.svelte";
import { mount, unmount } from "svelte";

export const VIEW_TYPE_ANALYTICS = "time-tracker-analytics";

export class AnalyticsView extends ItemView {
	plugin: TimeTrackerPlugin;
	private component: Record<string, unknown> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TimeTrackerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ANALYTICS;
	}

	getDisplayText(): string {
		return "Analytics";
	}

	getIcon(): string {
		return "bar-chart";
	}

	onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("time-tracker-analytics-view");

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

		this.component = mount(Analytics, {
			target: container,
			props: {
				plugin: this.plugin,
			},
		});

		return Promise.resolve();
	}

	 onClose() {
		if (this.component) {
			void unmount(this.component);
			this.component = null;
		}
		return Promise.resolve();
	}

	refresh() {
		void this.onClose();
		void this.onOpen();
	}
}
