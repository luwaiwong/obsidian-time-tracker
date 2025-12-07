import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import ProjectGrid from "../components/ProjectGrid.svelte";
import TimeTrackerSummary from "../components/TimeTrackerSummary.svelte";
import { ProjectModal } from "../modals/ProjectModal";
import { mount, unmount } from "svelte";

export const VIEW_TYPE_TIME_TRACKER = "time-tracker-view";

export class TimeTrackerView extends ItemView {
	plugin: TimeTrackerPlugin;
	private gridComponent: Record<string, any> | null = null;
	private summaryComponent: Record<string, any> | null = null;

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

		// Content area
		const content = container.createDiv("time-tracker-content");

		// show project grid
		this.gridComponent = mount(ProjectGrid, {
			target: content,
			props: {
				plugin: this.plugin,
				projects: this.plugin.timesheetData?.projects || [],
				runningTimers: this.plugin.runningTimers || [],
				gridColumns: this.plugin.settings?.gridColumns || 3,
			},
		});

		// footer with buttons
		const footer = container.createDiv("time-tracker-header");

		const buttonGroup = footer.createDiv("time-tracker-buttons");

		// Add Project button
		const addBtn = buttonGroup.createEl("button", {
			cls: "time-tracker-icon-button",
			attr: { "aria-label": "Add Project" },
		});
		setIcon(addBtn, "plus");
		addBtn.addEventListener("click", () => {
			new ProjectModal(this.plugin.app, this.plugin, null, () => {
				this.refresh();
			}).open();
		});

		// Analytics button
		const analyticsBtn = buttonGroup.createEl("button", {
			cls: "time-tracker-icon-button",
			attr: { "aria-label": "Open Analytics" },
		});
		setIcon(analyticsBtn, "bar-chart-2");
		analyticsBtn.addEventListener("click", () => {
			this.plugin.activateAnalyticsView();
		});

		// Settings button
		const settingsBtn = buttonGroup.createEl("button", {
			cls: "time-tracker-icon-button",
			attr: { "aria-label": "Open Settings" },
		});
		setIcon(settingsBtn, "settings");
		settingsBtn.addEventListener("click", () => {
			// @ts-ignore - accessing private API
			this.plugin.app.setting.open();
			// @ts-ignore - accessing private API
			this.plugin.app.setting.openTabById("integrated-time-tracker");
		});

		// Stop All button (only show when timers are running)
		if (this.plugin.runningTimers.length > 0) {
			const stopAllBtn = buttonGroup.createEl("button", {
				cls: "time-tracker-button time-tracker-stop-all",
				attr: { "aria-label": "Stop All Timers" },
			});
			setIcon(stopAllBtn, "square");
			stopAllBtn.createSpan({ text: "  Stop All" });
			stopAllBtn.addEventListener("click", () => {
				this.plugin.stopAllTimers();
			});
		}
	}

	async onClose() {
		if (this.gridComponent) {
			unmount(this.gridComponent);
			this.gridComponent = null;
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
