<script lang="ts">
	import ProjectCard from "./ProjectCard.svelte";
	import type { Project, TimeRecord } from "../types";
	import type TimeTrackerPlugin from "../../main";
	import { on } from "svelte/events";

	interface Props {
		plugin: TimeTrackerPlugin;
		projects?: Project[];
		runningTimers?: TimeRecord[];
		gridColumns?: number;
		onProjectClick?: (project: Project) => void;
		selectedProjectId?: number | null;
		selectionMode?: boolean;
	}
	let {
		plugin,
		gridColumns = plugin.settings.gridColumns,
		onProjectClick,
		selectedProjectId = null,
		selectionMode = false,
	}: Props = $props();

	let currentTime = $state(Date.now());
	let interval: number | undefined;
	let projects = plugin.timesheetData.projects;
	let runningTimers = plugin.runningTimers;

	$effect(() => {
		if (interval) clearInterval(interval);
		interval = window.setInterval(() => {
			currentTime = Date.now();
		}, 1000);

		return () => {
			if (interval) clearInterval(interval);
		};
	});

	function handleProjectClick(project: Project) {
		if (onProjectClick) {
			onProjectClick(project);
			return;
		}

		const isRunning = isProjectRunning(project.id);

		if (isRunning) {
			plugin.stopTimer(project.id);
		} else {
			plugin.startTimer(project.id);
		}
	}

	function isProjectRunning(projectId: number): boolean {
		return runningTimers.some((t) => t.projectId === projectId);
	}

	function getRunningDuration(projectId: number): number {
		const timer = runningTimers.find((t) => t.projectId === projectId);
		if (!timer) return 0;
		return currentTime - timer.startTime.getTime();
	}

	function sortProjects(projectList: Project[]): Project[] {
		const sorted = [...projectList];

		switch (plugin.settings.sortMode) {
			case "name":
				return sorted.sort((a, b) => a.name.localeCompare(b.name));

			case "category":
				return sorted.sort((a, b) => {
					if (a.categoryId === b.categoryId) {
						return a.order - b.order;
					}
					return a.categoryId - b.categoryId;
				});

			case "recent": {
				const lastUsed = new Map<number, number>();
				for (const record of plugin.timesheetData.records) {
					if (record.endTime === null) continue;
					const current = lastUsed.get(record.projectId) || 0;
					if (record.endTime.getTime() > current) {
						lastUsed.set(
							record.projectId,
							record.endTime.getTime(),
						);
					}
				}
				return sorted.sort((a, b) => {
					const aTime = lastUsed.get(a.id) || 0;
					const bTime = lastUsed.get(b.id) || 0;
					return bTime - aTime;
				});
			}

			case "manual":
			default:
				return sorted.sort((a, b) => a.order - b.order);
		}
	}

	function getVisibleProjects(): Project[] {
		const filtered = projects.filter(
			(p) => plugin.settings.showArchivedProjects || !p.archived,
		);
		return sortProjects(filtered);
	}

	let visibleProjects = $derived(getVisibleProjects());
	let gridStyle = $derived(
		`grid-template-columns: repeat(${gridColumns}, 1fr);`,
	);
</script>

<div class="p-4">
	<div class="grid w-full gap-4" style={gridStyle}>
		{#each visibleProjects as project (project.id)}
			<ProjectCard
				{project}
				isRunning={selectionMode ? false : isProjectRunning(project.id)}
				isSelected={selectionMode && selectedProjectId === project.id}
				currentDuration={selectionMode
					? 0
					: getRunningDuration(project.id)}
				onClick={() => handleProjectClick(project)}
				{gridColumns}
			/>
		{/each}
	</div>

	{#if visibleProjects.length === 0}
		<div class="px-4 py-12 text-center text-[var(--text-muted)]">
			<p class="my-2">No projects yet!</p>
			<p class="my-2 text-sm opacity-80">
				Create a project to start tracking time.
			</p>
		</div>
	{/if}
</div>
