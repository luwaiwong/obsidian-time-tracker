import type { MarkdownPostProcessorContext } from "obsidian";
import type TimeTrackerPlugin from "../main";
import EmbeddedTracker from "./components/EmbeddedTracker.svelte";
import { mount } from "svelte";

export class TimeTrackerCodeBlockProcessor {
	constructor(private plugin: TimeTrackerPlugin) {}

	process(
		source: string,
		el: HTMLElement,
		_ctx: MarkdownPostProcessorContext,
	) {
		const config = this.parseConfig(source);

		mount(EmbeddedTracker, {
			target: el,
			props: {
				plugin: this.plugin,
				config,
			},
		});
	}

	private parseConfig(source: string): EmbeddedTrackerConfig {
		const config: EmbeddedTrackerConfig = {
			type: "all",
			projectId: null,
			categoryId: null,
			recentRecords: 5,
			showRunningTimer: true,
			size: "normal",
		};

		const lines = source
			.split("\n")
			.filter((line) => line.trim().length > 0);

		for (const line of lines) {
			const [key, value] = line.split(":").map((s) => s.trim());

			switch (key.toLowerCase()) {
				case "type":
					config.type = value as "all" | "project" | "category";
					break;
				case "project":
					config.projectId = parseInt(value);
					config.type = "project";
					break;
				case "projectname": {
					const project = this.plugin.timesheetData.projects.find(
						(p) => p.name.toLowerCase() === value.toLowerCase(),
					);
					if (project) {
						config.projectId = project.id;
						config.type = "project";
					}
					break;
				}
				case "category":
					config.categoryId = parseInt(value);
					config.type = "category";
					break;
				case "categoryname": {
					const category = this.plugin.timesheetData.categories.find(
						(c) => c.name.toLowerCase() === value.toLowerCase(),
					);
					if (category) {
						config.categoryId = category.id;
						config.type = "category";
					}
					break;
				}
				case "recentrecords":
					config.recentRecords = parseInt(value);
					break;
				case "showtimer":
					config.showRunningTimer = value.toLowerCase() === "true";
					break;
				case "size":
					config.size = value as "small" | "normal" | "large";
					break;
			}
		}

		return config;
	}
}

export interface EmbeddedTrackerConfig {
	type: "all" | "project" | "category";
	projectId: number | null;
	categoryId: number | null;
	recentRecords: number;
	showRunningTimer: boolean;
	size: "small" | "normal" | "large";
}
