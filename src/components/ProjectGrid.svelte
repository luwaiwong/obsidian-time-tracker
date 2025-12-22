<script lang="ts">
	import ProjectCard from "./ProjectCard.svelte";
	import type { Project, RunningTimer } from "../types";
	import type TimeTrackerPlugin from "../../main";

	interface Props {
		plugin: TimeTrackerPlugin;
		projects: Project[];
		runningTimers: RunningTimer[];
		gridColumns?: number;
	}

	let { plugin, projects, runningTimers, gridColumns = 5 }: Props = $props();

	let currentTime = $state(Date.now());
	let interval: number | undefined;

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
		const isRunning = isProjectRunning(project.id);

		if (isRunning) {
			plugin.stopTimer(project.id);
		} else {
			plugin.startTimer(
				project.id,
				plugin.settings.retroactiveTrackingEnabled,
			);
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
					const project = plugin.getProjectByName(record.projectName);
					if (!project) continue;
					const current = lastUsed.get(project.id) || 0;
					if (record.endTime.getTime() > current) {
						lastUsed.set(project.id, record.endTime.getTime());
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

<div class="container">
	<div class="project-grid" style={gridStyle}>
		{#each visibleProjects as project (project.id)}
			<ProjectCard
				{project}
				isRunning={isProjectRunning(project.id)}
				currentDuration={getRunningDuration(project.id)}
				onStart={() => plugin.startTimer(project.id)}
				onStop={() => plugin.stopTimer(project.id)}
				onClick={() => handleProjectClick(project)}
				{gridColumns}
			/>
		{/each}
	</div>

	{#if visibleProjects.length === 0}
		<div class="empty-state">
			<p>No projects yet!</p>
			<p class="empty-state-hint">
				Create a project to start tracking time.
			</p>
		</div>
	{/if}
</div>

<style>
	.container {
		padding: 16px;
	}
	.project-grid {
		display: grid;
		gap: 16px;
		width: 100%;
	}

	.empty-state {
		padding: 48px 16px;
		text-align: center;
		color: var(--text-muted);
	}

	.empty-state p {
		margin: 8px 0;
	}

	.empty-state-hint {
		font-size: 0.9em;
		opacity: 0.8;
	}
</style>
