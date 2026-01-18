import { App, Modal, Notice } from "obsidian";
import type TimeTrackerPlugin from "../../main";
import type { TimeRecord, Project } from "../types";
import { CSVHandler } from "../handlers/csvHandler";
import { BackupHandler } from "../handlers/backupHandler";
import BackupCard from "../components/BackupCard.svelte";
import { mount, unmount } from "svelte";

export class BackupViewerModal extends Modal {
	plugin: TimeTrackerPlugin;
	backupHandler: BackupHandler;
	csvHandler: CSVHandler;
	private cardComponents: Array<Record<string, unknown>> = [];
	private backupListContainer: HTMLElement | null = null;

	constructor(app: App, plugin: TimeTrackerPlugin) {
		super(app);
		this.plugin = plugin;
		this.backupHandler = new BackupHandler(this.app.vault);
		this.csvHandler = new CSVHandler(this.app.vault);
	}

	async onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("backup-viewer-modal");

		contentEl.createEl("h2", { text: "Timesheet backups" });

		const backups = await this.backupHandler.listBackups();

		if (backups.length === 0) {
			contentEl.createEl("p", {
				text: "No backups found. Backups are created automatically every 3 hours.",
				cls: "backup-empty-state",
			});
			return;
		}

		this.backupListContainer = contentEl.createDiv("backup-list-container");
		this.backupListContainer.setCssProps({
			display: "flex",
			flexDirection: "column",
			gap: "12px",
			marginTop: "16px",
		});

		await this.renderBackups(backups);
	}

	private async renderBackups(
		backups: Array<{ path: string; name: string; size: number; mtime: number }>,
	) {
		if (!this.backupListContainer) return;

		for (const component of this.cardComponents) {
			void unmount(component);
		}
		this.cardComponents = [];
		this.backupListContainer.empty();

		for (const backupInfo of backups) {
			const cardContainer = this.backupListContainer.createDiv();
			const component = mount(BackupCard, {
				target: cardContainer,
				props: {
					backupPath: backupInfo.path,
					backupName: backupInfo.name,
					backupSize: backupInfo.size,
					backupMtime: backupInfo.mtime,
					plugin: this.plugin,
					onExpand: (path: string) => this.parseBackupFile(path),
					onUse: (path: string) => this.useBackup(path),
					onDelete: (path: string) => this.deleteBackup(path),
				},
			});
			this.cardComponents.push(component);
		}
	}

	private async useBackup(backupPath: string): Promise<void> {
		try {
			const content = await this.app.vault.adapter.read(backupPath);
			const data = this.csvHandler.parseTimesheetContent(content);

			this.plugin.timesheetData = {
				records: data.records,
				projects: data.projects,
				categories: data.categories,
			};

			await this.plugin.saveTimesheet();
			this.plugin.refreshViews();

			new Notice("Backup restored successfully");
			this.close();
		} catch (err) {
			new Notice("Error restoring backup: " + err);
		}
	}

	private async deleteBackup(backupPath: string): Promise<void> {
		try {
			await this.app.vault.adapter.remove(backupPath);
			new Notice("Backup deleted successfully");

			const backups = await this.backupHandler.listBackups();
			await this.renderBackups(backups);
		} catch (err) {
			new Notice("Error deleting backup: " + err);
		}
	}

	private async parseBackupFile(
		backupPath: string,
	): Promise<{ records: TimeRecord[]; projects: Project[] }> {
		const content = await this.app.vault.adapter.read(backupPath);
		const data = this.csvHandler.parseTimesheetContent(content);
		return {
			records: data.records,
			projects: data.projects,
		};
	}

	onClose() {
		for (const component of this.cardComponents) {
			void unmount(component);
		}
		this.cardComponents = [];
		const { contentEl } = this;
		contentEl.empty();
	}
}

