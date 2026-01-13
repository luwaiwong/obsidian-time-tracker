<script lang="ts">
	import type TimeTrackerPlugin from "../../main";
	import type { TimeRecord } from "../types";
	import { icon } from "../utils/styleUtils";
	import { EditRecordModal } from "../modals/EditRecordModal";
	
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
			.slice(0, maxRecords ?? 3),
	);

	function handleRepeat(record: TimeRecord): void {
		plugin.repeatRecord(record.id, new Date());
	}

	function handleEdit(record: TimeRecord): void {
		new EditRecordModal(plugin.app, plugin, record, onRefresh).open();
	}
</script>	

{#if recentRecords.length > 0}
	<div class="pt-1 pb-3">
		<!-- <MiniTitle>
			{recentRecords.length == 1 ? "Last Record" : "Last Records"}
		</MiniTitle> -->
		<div class="flex flex-col gap-2 mt-1">
			{#each recentRecords as record (record.id)}
				{@const project = plugin.getProjectById(record.projectId)}
				<div
					class="flex justify-between items-center gap-0 rounded-lg p-0 m-0 "
				>
					<!-- project name and title -->
					<div
						class="flex-1 min-w-0 flex items-center gap-2 cursor-pointer  "
						onclick={() => handleEdit(record)}
						onkeydown={(e) => e.key === "Enter" && handleEdit(record)}
						role="button"
						tabindex="0"
						aria-label={(project
							? `${project.name}`
							: `No project`) +
							(record.title
								? ` - ${record.title}`
								: " - untitled")}
					>
						{#if project}
							<div
								class="rounded flex items-center justify-center pr-1 min-w-0 overflow-hidden"
							>
								<button
									class="flex items-center justify-center rounded-lg mr-2 shrink-0"
									style="background-color: {project.color}; cursor: pointer; font-size: 1rem; height: 2rem; width: 3rem;"
									aria-label="Edit project"
									>{project.icon}</button
								>

								<p class="text-xs font-medium min-w-0"
									style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
									>{project.name}</p
								>
							</div>
						{:else}
							<span
								class="text-xs text-(--text-faint) italic shrink-0"
								>No project</span
							>
						{/if}

						{#if record.title}
							<span
								class="text-xs text-(--text-muted) truncate mr-1"
								>{record.title}</span
							>
						{/if}
					</div>

					<div class="text-xs text-(--text-normal) tabular-nums cursor-pointer pl-1  pr-2"
						onclick={() => handleEdit(record)}
						onkeydown={(e) => e.key === "Enter" && handleEdit(record)}
						role="button"
						tabindex="0"
					>
						<!-- {formatNaturalDuration(getRecordDuration(record))} -->
						 {record.startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?(am|pm)/i, "")}
						 -
						 {record.endTime?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?(am|pm)/i, "")}
					</div>
					<!-- buttons -->
					<button
						class="rounded p-0"
						style="width: 3rem; height: 2rem; font-size: 1rem; cursor: pointer;"
						aria-label="Repeat"
						onclick={() => handleRepeat(record)}
						{@attach icon("repeat")}
					>
					</button>
					<!-- <button
						class="size-10 rounded p-0"
						aria-label="Edit"
						onclick={() => handleEdit(record)}
						{@attach icon("pencil")}
					>
					</button> -->
				</div>
			{/each}
		</div>
	</div>
{/if}
