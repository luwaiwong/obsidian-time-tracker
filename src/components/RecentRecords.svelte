<script lang="ts">
	import type TimeTrackerPlugin from "../../main";
	import type { TimeRecord } from "../types";
	import {
		formatNaturalDuration,
		getRecordDuration,
	} from "../utils/timeUtils";
	import { icon } from "../utils/styleUtils";
	import { EditRecordModal } from "../modals/EditRecordModal";
	import { CSVHandler } from "../utils/csvHandler";
	import MiniTitle from "./MiniTitle.svelte";

	interface Props {
		plugin: TimeTrackerPlugin;
		onRefresh?: () => void;
		maxRecords?: number;
	}

	let {
		plugin,
		onRefresh = () => {},
		maxRecords,
	}: Props = $props();

	let recentRecords = $derived(
		plugin.timesheetData.records
			.filter((r) => r.endTime !== null)
			.sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime())
			.slice(0, maxRecords ?? plugin.settings.embeddedRecentRecordsCount ?? 3),
	);

	function handleRepeat(record: TimeRecord): void {
		const project = plugin.getProjectById(record.projectId);

		if (plugin.settings.retroactiveTrackingEnabled) {
			const lastRecord = plugin.getLastStoppedRecord();
			if (
				lastRecord &&
				lastRecord.projectId === record.projectId &&
				lastRecord.title === record.title
			) {
				const index = plugin.timesheetData.records.findIndex(
					(r) => r.id === lastRecord.id,
				);
				if (index !== -1) {
					plugin.timesheetData.records[index].endTime = new Date();
					plugin.saveTimesheet();
					plugin.refreshViews();
				}
			} else {
				const now = new Date();
				const startTime = lastRecord?.endTime || now;
				const newRecord: TimeRecord = {
					id: CSVHandler.getNextId(plugin.timesheetData.records),
					projectId: record.projectId,
					startTime: startTime,
					endTime: now,
					title: record.title,
				};
				plugin.timesheetData.records.push(newRecord);
				plugin.saveTimesheet();
				plugin.refreshViews();
			}
			onRefresh();
		} else {
			if (project) {
				plugin.startTimer(project.id);
				setTimeout(() => {
					const runningRecord = plugin.timesheetData.records.find(
						(r) => r.projectId === project.id && r.endTime === null,
					);
					if (runningRecord) {
						runningRecord.title = record.title;
						plugin.saveTimesheet();
					}
					onRefresh();
				}, 100);
			} else {
				plugin.startTimerWithoutProject(record.title);
				onRefresh();
			}
		}
	}

	function handleEdit(record: TimeRecord): void {
		new EditRecordModal(plugin.app, plugin, record, onRefresh).open();
	}
</script>

{#if recentRecords.length > 0}
	<div class="pt-4 pb-3">
		<MiniTitle>
			{recentRecords.length == 1 ? "Last Record" : "Last Records"}
		</MiniTitle>
		<div class="flex flex-col gap-1 mt-1">
			{#each recentRecords as record (record.id)}
				{@const project = plugin.getProjectById(record.projectId)}
				<div class="flex items-center gap-2 rounded">
					<!-- project name and title -->
					<div
						class="flex-1 min-w-0 flex items-center gap-1"
						aria-label={(project
							? `${project.name}`
							: `No project`) +
							(record.title
								? ` - ${record.title}`
								: " - untitled")}
					>
						{#if project}
							<div
								class="rounded flex items-center justify-center pr-2"
								style="background-color: {project.color};"
							>
								<span
									class="text-xs font-medium shrink-0 size-7 flex items-center justify-center"
									>{project.icon}</span
								>

								<span class="text-xs font-medium shrink-0"
									>{project.name}</span
								>
							</div>
							{#if record.title}
								<span
									class="text-xs text-(--text-muted) truncate"
									>{record.title}</span
								>
							{/if}
						{:else}
							<span
								class="text-xs text-(--text-faint) italic shrink-0"
								>No project</span
							>
							{#if record.title}
								<span
									class="text-xs text-(--text-normal) truncate"
									>{record.title}</span
								>
							{/if}
						{/if}
					</div>

					<div class="text-xs text-(--text-muted) tabular-nums">
						{formatNaturalDuration(getRecordDuration(record))}
					</div>
					<!-- buttons -->
					<button
						class="size-10 rounded p-0"
						aria-label="Repeat"
						onclick={() => handleRepeat(record)}
						{@attach icon("repeat")}
					>
					</button>
					<button
						class="size-10 rounded p-0"
						aria-label="Edit"
						onclick={() => handleEdit(record)}
						{@attach icon("pencil")}
					>
					</button>
				</div>
			{/each}
		</div>
	</div>
{/if}
