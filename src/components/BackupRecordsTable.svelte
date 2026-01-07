<script lang="ts">
	import type { TimeRecord, Project } from "../types";
	import type TimeTrackerPlugin from "../../main";
	import { formatDateTime, formatDuration, getRecordDuration } from "../utils/timeUtils";

	interface Props {
		records: TimeRecord[];
		projects: Project[];
		plugin: TimeTrackerPlugin;
	}

	let { records, projects, plugin }: Props = $props();

	const completedRecords = $derived(
		records
			.filter((r) => r.endTime !== null)
			.sort((a, b) => {
				const aTime = a.endTime?.getTime() || 0;
				const bTime = b.endTime?.getTime() || 0;
				return bTime - aTime;
			})
			.slice(0, 10),
	);
</script>

{#if completedRecords.length === 0}
	<p class="text-(--text-muted) italic">
		No completed records found in this backup
	</p>
{:else}
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-b-2 border-(--background-modifier-border)">
				<th class="p-2 text-left font-medium">Project</th>
				<th class="p-2 text-left font-medium">Title</th>
				<th class="p-2 text-left font-medium">Start</th>
				<th class="p-2 text-left font-medium">End</th>
				<th class="p-2 text-left font-medium">Duration</th>
			</tr>
		</thead>
		<tbody>
			{#each completedRecords as record}
				{@const project = projects.find((p) => p.id === record.projectId)}
				{@const projectName = project?.name || "Unknown"}
				{@const projectColor = project?.color || "#888"}
				{@const duration = getRecordDuration(record)}
				<tr class="border-b border-(--background-modifier-border)">
					<td class="p-2">
						<span class="inline-flex items-center gap-1.5">
							<span
								class="w-2 h-2 rounded-full inline-block"
								style="background-color: {projectColor}"
							></span>
							{projectName}
						</span>
					</td>
					<td class="p-4">{record.title || "-"}</td>
					<td class="p-2">{formatDateTime(record.startTime)}</td>
					<td class="p-2">
						{record.endTime ? formatDateTime(record.endTime) : "Running"}
					</td>
					<td class="p-2">
						{formatDuration(duration, plugin.settings.showSeconds)}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

