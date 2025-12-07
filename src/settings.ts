import { App, PluginSettingTab, Setting } from "obsidian";
import type TimeTrackerPlugin from "../main";
import { ProjectModal } from "./modals/ProjectModal";

export class TimeTrackerSettingTab extends PluginSettingTab {
	plugin: TimeTrackerPlugin;

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

		containerEl.createEl("h2", { text: "Time Tracker Settings" });

		// file location
		new Setting(containerEl)
			.setName("Timesheet file path")
			.setDesc("Path to the timesheet.csv file (relative to vault root)")
			.addText((text) =>
				text
					.setPlaceholder("timesheet.csv")
					.setValue(this.plugin.settings.timesheetPath)
					.onChange(async (value) => {
						this.plugin.settings.timesheetPath = value;
						await this.refreshAndSavePlugin();
					}),
			);

		// tracking behavior section
		containerEl.createEl("h3", { text: "Tracking Behavior" });

		new Setting(containerEl)
			.setName("Enable multitasking")
			.setDesc(
				"Allow multiple timers to run simultaneously. When disabled, starting a new timer stops the current one.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.multitaskingEnabled)
					.onChange(async (value) => {
						this.plugin.settings.multitaskingEnabled = value;
						await this.refreshAndSavePlugin();
					}),
			);
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

		// display preferences section
		containerEl.createEl("h3", { text: "Display Preferences" });

		new Setting(containerEl)
			.setName("Show seconds")
			.setDesc("Display seconds in timer durations")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSeconds)
					.onChange(async (value) => {
						this.plugin.settings.showSeconds = value;
						await this.refreshAndSavePlugin();
					}),
			);
		new Setting(containerEl)
			.setName("Show archived projects")
			.setDesc("Display archived projects in the grid view")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showArchivedProjects)
					.onChange(async (value) => {
						this.plugin.settings.showArchivedProjects = value;
						await this.refreshAndSavePlugin();
					}),
			);
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
					.addOption("manual", "Manual")
					.addOption("category", "By Category")
					.addOption("name", "By Name")
					.addOption("recent", "Recently Used")
					.setValue(this.plugin.settings.sortMode)
					.onChange(async (value: any) => {
						this.plugin.settings.sortMode = value;
						await this.refreshAndSavePlugin();
					}),
			);

		// analytics section
		containerEl.createEl("h3", { text: "Analytics" });

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
					.onChange(async (value: any) => {
						this.plugin.settings.defaultTimeRange = value;
						await this.refreshAndSavePlugin();
					}),
			);

		// notifications section
		containerEl.createEl("h3", { text: "Notifications" });

		new Setting(containerEl)
			.setName("Enable notifications")
			.setDesc("Show notifications for timer events")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showNotifications)
					.onChange(async (value) => {
						this.plugin.settings.showNotifications = value;
						await this.refreshAndSavePlugin();
					}),
			);
		new Setting(containerEl)
			.setName("Inactivity reminder")
			.setDesc("Remind after this many seconds of inactivity (0 to disable)")
			.addText((text) =>
				text
					.setPlaceholder("3600")
					.setValue(String(this.plugin.settings.inactivityReminderDuration))
					.onChange(async (value) => {
						const num = parseInt(value);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.inactivityReminderDuration = num;
							await this.refreshAndSavePlugin();
						}
					}),
			);
		new Setting(containerEl)
			.setName("Activity reminder")
			.setDesc(
				"Remind to take a break after this many seconds of activity (0 to disable)",
			)
			.addText((text) =>
				text
					.setPlaceholder("1800")
					.setValue(String(this.plugin.settings.activityReminderDuration))
					.onChange(async (value) => {
						const num = parseInt(value);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.activityReminderDuration = num;
							await this.refreshAndSavePlugin();
						}
					}),
			);

		// embedded tracker section
		containerEl.createEl("h3", { text: "Embedded Tracker" });

		new Setting(containerEl)
			.setName("Recent logs count")
			.setDesc("Number of recent time records to show in embedded trackers")
			.addSlider((slider) =>
				slider
					.setLimits(1, 20, 1)
					.setValue(this.plugin.settings.embeddedRecentLogsCount)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.embeddedRecentLogsCount = value;
						await this.refreshAndSavePlugin();
					}),
			);

		// project management section
		containerEl.createEl("h3", { text: "Project Management" });

		const projectsDiv = containerEl.createDiv("time-tracker-projects");
		this.displayProjects(projectsDiv);

		new Setting(containerEl).setName("Add new project").addButton((button) =>
			button
				.setButtonText("Add Project")
				.setCta()
				.onClick(() => {
					new ProjectModal(this.app, this.plugin, null, () => {
						this.display(); // Refresh the settings page
					}).open();
				}),
		);

		// category management section
		containerEl.createEl("h3", { text: "Category Management" });

		const categoriesDiv = containerEl.createDiv("time-tracker-categories");
		this.displayCategories(categoriesDiv);

		new Setting(containerEl).setName("Add new category").addButton((button) =>
			button
				.setButtonText("Add Category")
				.setCta()
				.onClick(async () => {
					await this.addNewCategory();
					this.display(); // Refresh the settings page
				}),
		);
	}

	private displayProjects(containerEl: HTMLElement) {
		const projects = this.plugin.timesheetData.projects;

		if (projects.length === 0) {
			containerEl.createEl("p", {
				text: "No projects yet. Create one to start tracking time!",
			});
			return;
		}

		for (const project of projects) {
			const projectDiv = containerEl.createDiv("time-tracker-project-item");

			const categoryName = this.getCategoryName(project.categoryId);

			new Setting(projectDiv)
				.setName(`${project.icon} ${project.name}`)
				.setDesc(
					`Category: ${categoryName}${project.archived ? " (Archived)" : ""}`,
				)
				.addExtraButton((button) =>
					button
						.setIcon("pencil")
						.setTooltip("Edit project")
						.onClick(() => {
							new ProjectModal(this.app, this.plugin, project, () => {
								this.display();
							}).open();
						}),
				)
				.addExtraButton((button) =>
					button
						.setIcon(project.archived ? "folder-open" : "archive")
						.setTooltip(project.archived ? "Unarchive" : "Archive")
						.onClick(async () => {
							project.archived = !project.archived;
							await this.plugin.saveTimesheet();
							this.plugin.refreshViews();
							this.display();
						}),
				)
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Delete project")
						.onClick(async () => {
							if (
								confirm(
									`Delete project "${project.name}"? All time records will be kept.`,
								)
							) {
								this.plugin.timesheetData.projects =
									this.plugin.timesheetData.projects.filter(
										(p) => p.id !== project.id,
									);
								this.plugin.timesheetData.projectCategories.delete(project.id);
								await this.plugin.saveTimesheet();
								this.plugin.refreshViews();
								this.display();
							}
						}),
				);
		}
	}

	private getCategoryName(categoryId: number): string {
		const category = this.plugin.timesheetData.categories.find(
			(c) => c.id === categoryId,
		);
		return category ? category.name : "Uncategorized";
	}

	private displayCategories(containerEl: HTMLElement) {
		const categories = this.plugin.timesheetData.categories.filter(
			(c) => c.id !== -1,
		); // Exclude "Uncategorized"

		if (categories.length === 0) {
			containerEl.createEl("p", {
				text: "No categories yet. Create one to organize your projects!",
			});
			return;
		}

		for (const category of categories) {
			const categoryDiv = containerEl.createDiv("time-tracker-category-item");

			new Setting(categoryDiv)
				.setName(category.name)
				.addColorPicker((colorPicker) =>
					colorPicker.setValue(category.color).onChange(async (value) => {
						category.color = value;
						await this.plugin.saveTimesheet();
					}),
				)
				.addExtraButton((button) =>
					button
						.setIcon("pencil")
						.setTooltip("Rename category")
						.onClick(async () => {
							const newName = prompt("Enter new category name:", category.name);
							if (newName && newName.trim()) {
								category.name = newName.trim();
								await this.plugin.saveTimesheet();
								this.display();
							}
						}),
				)
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Delete category")
						.onClick(async () => {
							if (
								confirm(
									`Delete category "${category.name}"? Projects in this category will be moved to Uncategorized.`,
								)
							) {
								await this.deleteCategory(category.id);
								this.display();
							}
						}),
				);
		}
	}

	private async addNewCategory() {
		const name = prompt("Enter category name:");
		if (!name || !name.trim()) return;

		const newId =
			Math.max(...this.plugin.timesheetData.categories.map((c) => c.id), 0) + 1;
		const newCategory = {
			id: newId,
			name: name.trim(),
			color: this.getRandomColor(),
			order: this.plugin.timesheetData.categories.length,
		};

		this.plugin.timesheetData.categories.push(newCategory);
		await this.plugin.saveTimesheet();
	}

	private async deleteCategory(categoryId: number) {
		// Remove category
		this.plugin.timesheetData.categories =
			this.plugin.timesheetData.categories.filter((c) => c.id !== categoryId);

		// Move projects to Uncategorized
		for (const project of this.plugin.timesheetData.projects) {
			if (project.categoryId === categoryId) {
				project.categoryId = -1;
			}
		}

		// Update projectCategories map
		this.plugin.timesheetData.projectCategories.delete(categoryId);

		await this.plugin.saveTimesheet();
	}

	private getRandomColor(): string {
		const colors = [
			"#FF6B6B",
			"#4ECDC4",
			"#45B7D1",
			"#FFA07A",
			"#98D8C8",
			"#F7DC6F",
			"#BB8FCE",
			"#85C1E2",
			"#F8B88B",
			"#52B788",
		];
		return colors[Math.floor(Math.random() * colors.length)];
	}
}
