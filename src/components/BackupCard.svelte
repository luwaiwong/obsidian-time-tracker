<script lang="ts">
	import { formatDateTime } from "../utils/timeUtils";
	import BackupRecordsTable from "./BackupRecordsTable.svelte";
	import type { TimeRecord, Project } from "../types";
	import type TimeTrackerPlugin from "../../main";
	import { icon } from "../utils/styleUtils";

	interface Props {
		backupPath: string;
		backupName: string;
		backupSize: number;
		backupMtime: number;
		plugin: TimeTrackerPlugin;
		onExpand: (path: string) => Promise<{
			records: TimeRecord[];
			projects: Project[];
		}>;
		onUse: (path: string) => Promise<void>;
		onDelete: (path: string) => Promise<void>;
	}

	let {
		backupPath,
		backupName,
		backupSize,
		backupMtime,
		plugin,
		onExpand,
		onUse,
		onDelete,
	}: Props = $props();

	let isExpanded = $state(false);
	let isLoading = $state(false);
	let error: string | null = $state(null);
	let backupData: { records: TimeRecord[]; projects: Project[] } | null =
		$state(null);

	const iconName = $derived(isExpanded ? "chevron-down" : "chevron-right");

	const formatFileSize = (bytes: number): string => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	const sizeStr = $derived(formatFileSize(backupSize));
	const fileDate = $derived(formatDateTime(backupMtime));

	async function handleToggle() {
		if (isExpanded) {
			isExpanded = false;
			return;
		}

		isExpanded = true;

		if (backupData) {
			return;
		}

		isLoading = true;
		error = null;

		try {
			backupData = await onExpand(backupPath);
		} catch (err) {
			console.error("Error loading backup data:", err);
			error = "Error loading backup data";
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="border border-(--background-modifier-border) rounded">
	<button
		type="button"
		class="p-3 cursor-pointer w-full text-left"
		onclick={handleToggle}
	>
		<div class="flex w-full justify-between items-center gap-4">
			<div class="flex items-center gap-4">
			<span
				class="inline-flex items-center text-(--text-muted) shrink-0"
				{@attach icon(iconName)}
			></span>
			<span class="font-medium">{backupName}</span>
			</div>
			<div class="flex items-center gap-4 text-sm text-(--text-muted)">
				<span class="whitespace-nowrap">{fileDate}</span>
				<span class="whitespace-nowrap">{sizeStr}</span>
			</div>
		</div>
	</button>
	{#if isExpanded}
		<div class="px-3 pb-3 border-t border-(--background-modifier-border)">
			{#if isLoading}
				<p class="text-(--text-muted) italic pt-3">Loading...</p>
			{:else if error}
				<p class="text-(--text-error) italic pt-3">{error}</p>
			{:else if backupData}
				<div class="pt-3 space-y-3">
					<BackupRecordsTable
						records={backupData.records}
						projects={backupData.projects}
						plugin={plugin}
					/>
					<div class="flex justify-between gap-2 pt-2">
						<button
							type="button"
							class="px-3 py-1.5 rounded text-sm text-white hover:opacity-90 transition-opacity"
							style="background-color: var(--text-error);"
							onclick={async () => {
								if (
									confirm(
										"Are you sure you want to delete this backup? This action cannot be undone.",
									)
								) {
									await onDelete(backupPath);
								}
							}}
						>
							Delete
						</button>
						<button
							type="button"
							class="px-3 py-1.5 rounded text-sm border border-(--background-modifier-border) hover:bg-(--background-modifier-hover) transition-colors"
							onclick={async () => {
								if (
									confirm(
										"Are you sure you want to restore this backup? This will replace your current timesheet data.",
									)
								) {
									await onUse(backupPath);
								}
							}}
						>
							Apply
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

