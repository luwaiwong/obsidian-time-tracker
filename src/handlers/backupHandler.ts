import { TFile, Vault } from "obsidian";

const BACKUP_FOLDER = ".timebackups";
const BACKUP_RETENTION_DAYS = 5;
const BACKUP_RETENTION_MS = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export class BackupHandler {
	constructor(private vault: Vault) {}

	private formatTimestamp(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");

		return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
	}

	private async checkBackupFolder(): Promise<boolean> {
		try {
			const folderExists = await this.vault.adapter.exists(BACKUP_FOLDER);
			if (!folderExists) {
				await this.vault.createFolder(BACKUP_FOLDER);
			}
			return true;
		} catch (err) {
			console.error("Error ensuring backup folder exists:", err);
			return false;
		}
	}

	async createBackup(timesheetPath: string): Promise<void> {
		try {
			const folderReady = await this.checkBackupFolder();
			if (!folderReady) {
				console.error("Backup folder not available, skipping backup");
				return;
			}

			const timesheetFile = this.vault.getAbstractFileByPath(timesheetPath);
			if (!(timesheetFile instanceof TFile)) {
				console.error("Timesheet file not found, skipping backup");
				return;
			}

			const content = await this.vault.read(timesheetFile);

			const backups = await this.listBackups();
			if (backups.length > 0) {
				const lastBackup = backups[0];
				try {
					const lastBackupContent = await this.vault.adapter.read(
						lastBackup.path,
					);
					if (content === lastBackupContent) {
						console.log(
							"Backup skipped: content is identical to last backup",
						);
						return;
					}
				} catch (err) {
					console.error("Error reading last backup for comparison:", err);
				}
			}

			const timestamp = this.formatTimestamp(new Date());
			const backupFilename = `timesheet-${timestamp}.csv`;
			const backupPath = `${BACKUP_FOLDER}/${backupFilename}`;

			await this.vault.create(backupPath, content);
			console.log(`Backup created: ${backupPath}`);

			await this.cleanupBackups();
		} catch (err) {
			console.error("Error creating backup:", err);
		}
	}

	async listBackups(): Promise<
		Array<{ path: string; name: string; size: number; mtime: number }>
	> {
		try {
			const folderExists = await this.vault.adapter.exists(BACKUP_FOLDER);
			if (!folderExists) {
				return [];
			}

			const files = await this.vault.adapter.list(BACKUP_FOLDER);
			if (!files.files) {
				return [];
			}

			const backupFiles: Array<{
				path: string;
				name: string;
				size: number;
				mtime: number;
			}> = [];
			for (const filePath of files.files) {
				if (!filePath.endsWith(".csv")) continue;
				const fullPath = filePath.startsWith(BACKUP_FOLDER)
					? filePath
					: `${BACKUP_FOLDER}/${filePath}`;

				try {
					const stat = await this.vault.adapter.stat(fullPath);
					if (!stat) continue;

					const fileName = fullPath.split("/").pop() || filePath;
					backupFiles.push({
						path: fullPath,
						name: fileName,
						size: stat.size || 0,
						mtime: stat.mtime || 0,
					});
				} catch (err) {
					console.error(`Error processing backup file ${fullPath}:`, err);
				}
			}

			backupFiles.sort((a, b) => b.mtime - a.mtime);
			return backupFiles;
		} catch (err) {
			console.error("Error listing backups:", err);
			return [];
		}
	}

	async cleanupBackups(): Promise<void> {
		try {
			const folderExists = await this.vault.adapter.exists(BACKUP_FOLDER);
			if (!folderExists) {
				return;
			}

			const cutoffTime = Date.now() - BACKUP_RETENTION_MS;
			const files = await this.vault.adapter.list(BACKUP_FOLDER);

			if (!files.files) {
				return;
			}

			for (const filePath of files.files) {
				try {
					const fullPath = filePath.startsWith(BACKUP_FOLDER)
						? filePath
						: `${BACKUP_FOLDER}/${filePath}`;
					const file = this.vault.getAbstractFileByPath(fullPath);
					if (file instanceof TFile) {
						const stat = await this.vault.adapter.stat(fullPath);
						if (stat && stat.mtime && stat.mtime < cutoffTime) {
							await this.vault.delete(file);
							console.log(`Deleted old backup: ${fullPath}`);
						}
					}
				} catch (err) {
					console.error(`Error deleting backup ${filePath}:`, err);
				}
			}
		} catch (err) {
			console.error("Error cleaning up old backups:", err);
		}
	}
}

