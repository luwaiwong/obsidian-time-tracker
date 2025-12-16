import { TFile, Vault } from "obsidian";
import type { PluginSettings } from "./types";

/**
 * Handles reading and writing plugin settings to a JSON file.
 * Settings include UI preferences and behavior toggles.
 */
export class SettingsHandler {
	constructor(private vault: Vault) {}

	async loadSettings(path: string): Promise<Partial<PluginSettings>> {
		try {
			const file = this.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) {
				return {};
			}

			const content = await this.vault.read(file);
			return JSON.parse(content);
		} catch {
			return {};
		}
	}

	async saveSettings(path: string, settings: PluginSettings): Promise<void> {
		const content = JSON.stringify(settings, null, 2);

		const file = this.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			await this.vault.modify(file, content);
		} else {
			await this.vault.create(path, content);
		}
	}
}
