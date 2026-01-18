import TimeTrackerPlugin from "main";
import { App, Modal, Setting } from "obsidian";
import { FileSuggest } from "../utils/FolderSuggest";
import ModalActionButtons from "../components/ModalActionButtons.svelte";
import { mount, unmount } from "svelte";

export class ConflictResolverModal extends Modal {
	private plugin: TimeTrackerPlugin;
	private folderLocation: string;
	private actionButtonsComponent: Record<string, unknown> | null = null;

	constructor(app: App, plugin: TimeTrackerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void | Promise<void> {
		const { contentEl, modalEl } = this;
		modalEl.addClass("create-record-modal");

		contentEl.createEl("h2", { text: "Conflict resolver" });

		new Setting(contentEl)
			.setName("Conflicting file")
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

		const buttonContainer = contentEl.createDiv();
		this.actionButtonsComponent = mount(ModalActionButtons, {
			target: buttonContainer,
			props: {
				primaryButton: {
					text: "Resolve",
					onClick: () => {
						this.resolveConflict(this.folderLocation);
						this.close();
					},
					variant: "cta",
				},
			},
		});
	}

	onClose() {
		if (this.actionButtonsComponent) {
			void unmount(this.actionButtonsComponent);
			this.actionButtonsComponent = null;
		}
		this.contentEl.empty();
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
