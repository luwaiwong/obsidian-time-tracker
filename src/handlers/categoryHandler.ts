import TimeTrackerPlugin from "main";
import { Category } from "src/types";

export class CategoryHandler {
	constructor(private plugin: TimeTrackerPlugin) {}

	async editCategory(category: Category) {
		this.plugin.timesheetData.categories = this.plugin.timesheetData.categories.map(c => c.id === category.id ? category : c);
		await this.plugin.saveTimesheet();
	}

    async createCategory(name: string, color: string) {
        const newId =
			Math.max(
				...this.plugin.timesheetData.categories.map((c) => c.id),
				0,
			) + 1;

		const newCategory = {
			id: newId,
			name: name.trim(),
			color: color,
			archived: false,
			order: this.plugin.timesheetData.categories.length,
		};

		this.plugin.timesheetData.categories.push(newCategory);
		await this.plugin.saveTimesheet();
        return newCategory;
    }

    async deleteCategory(category: Category) {
        this.plugin.timesheetData.categories = this.plugin.timesheetData.categories.filter(c => c.id !== category.id);
        await this.plugin.saveTimesheet();
    }

    async archiveCategory(category: Category) {
        this.plugin.timesheetData.categories = this.plugin.timesheetData.categories.map(c => c.id === category.id ? { ...c, archived: true } : c);
        await this.plugin.saveTimesheet();
    }
}