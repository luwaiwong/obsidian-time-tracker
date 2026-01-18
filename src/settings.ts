import { App, PluginSettingTab, Setting } from "obsidian";
import type TimeTrackerPlugin from "../main";
import { CreateProjectModal } from "./modals/CreateProjectModal";
import { CreateCategoryModal } from "./modals/CreateCategoryModal";
import { ConfirmModal } from "./modals/ConfirmModal";
import ProjectSettingsGrid from "./components/ProjectSettingsGrid.svelte";
import { mount, unmount } from "svelte";
import { EditCategoryModal } from "./modals/EditCategoryModal";

export class TimeTrackerSettingTab extends PluginSettingTab {
	plugin: TimeTrackerPlugin;
	private projectGridComponent: Record<string, unknown> | null = null;

	constructor(app: App, plugin: TimeTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async refreshAndSavePlugin() {
		await this.plugin.saveSettings();
		this.plugin.refreshViews();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Clean up previous Svelte component
		if (this.projectGridComponent) {
			void unmount(this.projectGridComponent);
			this.projectGridComponent = null;
		}
		new Setting(containerEl).setName('File locations').setHeading();	

		// file location
		new Setting(containerEl)
			.setName("Timesheet file path")
			.setDesc("Path to the timesheet.csv file (relative to vault root)")
			.addText((text) =>
				text
					.setPlaceholder("Timesheet.csv".toLowerCase())
					.setValue(this.plugin.settings.timesheetPath)
					.onChange(async (value) => {
						this.plugin.settings.timesheetPath = value;
						await this.refreshAndSavePlugin();
					}),
			);

		new Setting(containerEl)
			.setName("Timeblocks file path")
			.setDesc("Path to the timeblocks.csv file for planned time blocks (relative to vault root)")
			.addText((text) =>
				text
					.setPlaceholder("Timeblocks.csv".toLowerCase())
					.setValue(this.plugin.settings.timeblocksPath)
					.onChange(async (value) => {
						this.plugin.settings.timeblocksPath = value;
						await this.refreshAndSavePlugin();
					}),
			);

		// tracking behavior section
		new Setting(containerEl).setName('Tracking behavior').setHeading();

		new Setting(containerEl)
			.setName("Enable retroactive tracking")
			.setDesc(
				"When starting a timer, automatically assign the gap since the last stopped timer to the new project.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.retroactiveTrackingEnabled)
					.onChange(async (value) => {
						this.plugin.settings.retroactiveTrackingEnabled = value;
						await this.refreshAndSavePlugin();
					}),
			);

		new Setting(containerEl)
			.setName("Enable timeblocking")
			.setDesc(
				"Allow creating planned time blocks by clicking on the schedule calendar.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableTimeblocking)
					.onChange(async (value) => {
						this.plugin.settings.enableTimeblocking = value;
						await this.refreshAndSavePlugin();
					}),
			);

		// display preferences section
		new Setting(containerEl).setName('Display preferences').setHeading();

		// new Setting(containerEl)
		// 	.setName("Show seconds")
		// 	.setDesc("Display seconds in timer durations")
		// 	.addToggle((toggle) =>
		// 		toggle
		// 			.setValue(this.plugin.settings.showSeconds)
		// 			.onChange(async (value) => {
		// 				this.plugin.settings.showSeconds = value;
		// 				await this.refreshAndSavePlugin();
		// 			}),
		// 	);

		// new Setting(containerEl)
		// 	.setName("Show archived projects")
		// 	.setDesc("Display archived projects in the grid view")
		// 	.addToggle((toggle) =>
		// 		toggle
		// 			.setValue(this.plugin.settings.showArchivedProjects)
		// 			.onChange(async (value) => {
		// 				this.plugin.settings.showArchivedProjects = value;
		// 				await this.refreshAndSavePlugin();
		// 			}),
		// 	);

		new Setting(containerEl)
			.setName("Grid columns")
			.setDesc("Number of columns in the project grid (1-6)")
			.addSlider((slider) =>
				slider
					.setLimits(1, 6, 1)
					.setValue(this.plugin.settings.gridColumns)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.gridColumns = value;
						await this.refreshAndSavePlugin();
					}),
			);

		new Setting(containerEl)
			.setName("Sort mode")
			.setDesc("How to sort projects in the grid")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("category", "By category")
					.addOption("color", "By color")
					.addOption("name", "By name")
					.addOption("recent", "Recently used")
					.setValue(this.plugin.settings.sortMode)
					.onChange(
						async (
							value: "category" | "color" | "name" | "recent",
						) => {
							this.plugin.settings.sortMode = value;
							await this.refreshAndSavePlugin();
						},
					),
			);

		// analytics section
		new Setting(containerEl).setName('Analytics').setHeading();

		new Setting(containerEl)
			.setName("Default time range")
			.setDesc("Default time range for analytics view")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("day", "Day")
					.addOption("week", "Week")
					.addOption("month", "Month")
					.addOption("year", "Year")
					.addOption("custom", "Custom")
					.setValue(this.plugin.settings.defaultTimeRange)
					.onChange(
						async (
							value: "day" | "week" | "month" | "year" | "custom",
						) => {
							this.plugin.settings.defaultTimeRange = value;
							await this.refreshAndSavePlugin();
						},
					),
			);

		// calendar integration section
		new Setting(containerEl).setName('Calendar integration').setHeading();
		new Setting(containerEl)
			.setName("Add new calendar")
			.setDesc("Add ICS calendar URLs to view them in the schedule view (e.g. https://calendar.google.com/calendar/ical/your@email.com/public/basic.ics)")
			.addButton((button) =>
				button
					.setButtonText("Add calendar")
					.setCta()
					.onClick(() => {
						this.plugin.settings.icsCalendars.push("");
						// invalidate cache so new calendar will be fetched
						this.plugin.icsCache.fetched = false;
						this.plugin.icsCache.events = [];
						this.display();
					}),
			);
		const calendarListContainer = containerEl.createDiv();
		this.renderCalendarList(calendarListContainer);

		// project management section
		new Setting(containerEl).setName('Project management').setHeading();

		// project settings component
		const projectsGridDiv = containerEl.createDiv(
			"time-tracker-projects-grid",
		);
		this.projectGridComponent = mount(ProjectSettingsGrid, {
			target: projectsGridDiv,
			props: {
				plugin: this.plugin,
				onUpdate: () => {
					// Refresh the grid when projects are updated
					this.display();
				},
			},
		});

		// Add new project button
		const addProjectDiv = containerEl.createDiv({ cls: "time-tracker-add-project" });
		new Setting(addProjectDiv)
			.setName("Add new project")
			.addButton((button) =>
				button
					.setButtonText("Add project")
					.setCta()
					.onClick(() => {
						new CreateProjectModal(
							this.app,
							this.plugin,
							null,
							() => {
								this.display();
							},
						).open();
					}),
			);

		// category management section
		new Setting(containerEl).setName('Category management').setHeading();

		const categoriesDiv = containerEl.createDiv("time-tracker-categories");
		this.displayCategories(categoriesDiv);

		new Setting(containerEl)
			.setName("Add new category")
			.addButton((button) =>
				button
					.setButtonText("Add category")
					.setCta()
					.onClick(() => {
						new CreateCategoryModal(this.app, this.plugin, () => {
							this.display();
						}).open();
					}),
			);
	}

	hide(): void {
		// Clean up Svelte component when settings tab is hidden
		if (this.projectGridComponent) {
			void unmount(this.projectGridComponent);
			this.projectGridComponent = null;
		}
	}

	private getCategoryName(categoryId: number): string {
		const category = this.plugin.timesheetData.categories.find(
			(c) => c.id === categoryId,
		);
		return category ? category.name : "Uncategorized";
	}

	private renderCalendarList(containerEl: HTMLElement) {
		containerEl.empty();

		this.plugin.settings.icsCalendars.forEach((val, index) => {
			new Setting(containerEl)
				.addText((text) =>
					text.setValue(val).onChange(async (newVal) => {
						this.plugin.settings.icsCalendars[index] = newVal;
						// invalidate cache so updated calendar will be fetched
						this.plugin.icsCache.fetched = false;
						this.plugin.icsCache.events = [];
						await this.plugin.saveSettings();
					})
				)
				.addExtraButton((btn) =>
					btn.setIcon("trash").onClick(async () => {
						this.plugin.settings.icsCalendars.splice(index, 1);
						// invalidate cache so removed calendar is no longer shown
						this.plugin.icsCache.fetched = false;
						this.plugin.icsCache.events = [];
						await this.plugin.saveSettings();
						this.renderCalendarList(containerEl);
					})
				);
		});
	}

	private displayCategories(containerEl: HTMLElement) {
		const categories = this.plugin.timesheetData.categories.filter(
			(c) => c.id !== 1,
		);

		if (categories.length === 0) {
			containerEl.createEl("p", {
				text: "No categories yet. Create one to organize your projects!",
			});
			return;
		}

		for (const category of categories) {
			const categoryDiv = containerEl.createDiv(
				"time-tracker-category-item",
			);

			new Setting(categoryDiv)
				.setName(category.name)
				.addColorPicker((colorPicker) =>
					colorPicker
						.setValue(category.color)
						.onChange(async (value) => {
							category.color = value;
							await this.plugin.categoryHandler.editCategory(category);
						}),
				)
				.addExtraButton((button) =>
					button
						.setIcon("pencil")
						.setTooltip("Rename category")
						.onClick(async () => {
							new EditCategoryModal(this.app, this.plugin, category, () => {
								this.display();
							}).open();
						}),
				)
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Delete category")
						.onClick(() => {
							new ConfirmModal(
								this.app,
								`Delete category "${category.name}"? Projects in this category will be moved to Uncategorized.`,
								() => {
									void (async () => {
										await this.deleteCategory(category.id);
										this.display();
									})();
								},
							).open();
						}),
				);
		}
	}

	private async deleteCategory(categoryId: number) {
		this.plugin.timesheetData.categories =
			this.plugin.timesheetData.categories.filter(
				(c) => c.id !== categoryId,
			);

		for (const project of this.plugin.timesheetData.projects) {
			if (project.categoryId === categoryId) {
				project.categoryId = -1;
			}
		}

		await this.plugin.saveTimesheet();
	}
}
