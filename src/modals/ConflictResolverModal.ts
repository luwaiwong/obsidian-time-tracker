import TimeTrackerPlugin from "main";
import { App, Modal, Setting } from "obsidian";
import { FileSuggest } from "../utils/FolderSuggest";

export class ConflictResolverModal extends Modal {
	private plugin: TimeTrackerPlugin;
	private folderLocation: string;

	constructor(app: App, plugin: TimeTrackerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void | Promise<void> {
		const { contentEl, modalEl } = this;
		modalEl.addClass("create-record-modal");

		contentEl.createEl("h2", { text: "Conflict Resolver" });

		new Setting(contentEl)
			.setName("Conflicting File")
			.setDesc("Choose a conflicting file.")
			.addSearch((search) => {
				search
					.setPlaceholder("Example: folder1/folder2")
					.setValue(this.folderLocation)
					.onChange(async (value) => {
						this.folderLocation = value;
						await this.plugin.saveSettings();
					});

				// Add folder suggestions
				new FileSuggest(this.app, search.inputEl);
			});

		new Setting(contentEl).addButton((button) => {
			button.setButtonText("Resolve").onClick(async () => {
				this.resolveConflict(this.folderLocation);
				this.close();
			});
		});
	}

	/*
	resolve strategy:
	- process file and extract records
	- find records with matching ids
		- whichever record has later end time, use that record
		- if current record has null end time, and other is filled, use new record
	- find records with no matching ids
		- if record does not overlap with anything, add it
	*/
	resolveConflict(folderLocation: string) {}
}
