<script lang="ts">
	import ProjectCard from "./ProjectCard.svelte";
	import type { Project, TimeRecord } from "../types";
	import type TimeTrackerPlugin from "../../main";
	import { slide } from "svelte/transition";
	import { compareColors } from "..//utils/colorUtils";
  	import { icon } from "../utils/styleUtils";

	interface Props {
		plugin: TimeTrackerPlugin;
		projects?: Project[];
		runningTimers?: TimeRecord[];
		gridColumns?: number;
		onProjectClick?: (project: Project) => void;
		selectedProjectId?: number | null;
		selectionMode?: boolean;
		dropdownMode?: boolean;
		dropdownOpen?: boolean;
	}
	let {
		plugin,
		gridColumns = plugin.settings.gridColumns,
		onProjectClick,
		selectedProjectId = null,
		selectionMode = false,
		dropdownMode = false,
		dropdownOpen: initialDropdownOpen = false,
	}: Props = $props();

	let dropdownOpen = $state(initialDropdownOpen);
	let currentTime = $state(Date.now());
	let interval: number | undefined;
	let projects = $derived(plugin.timesheetData.projects);
	let runningTimers = $derived(plugin.runningTimers);

	// set gridColumns from plugin settings after mount
	$effect(() => {
		gridColumns = plugin.settings.gridColumns;
	});

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
		} 
		
		if (dropdownMode) {
			dropdownOpen = false;
		}
	}

	function isProjectRunning(projectId: number): boolean {
		return runningTimers.some((t: TimeRecord) => t.projectId === projectId);
	}

	function getRunningDuration(projectId: number): number {
		const timer = runningTimers.find(
			(t: TimeRecord) => t.projectId === projectId,
		);
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

			case "color": {
				return sorted.sort((a, b) => {
					const colorA = a.color || "#000000";
					const colorB = b.color || "#000000";
					return compareColors(colorA, colorB);
				});
			}
			default:
				return sorted.sort((a, b) => a.order - b.order);
		}
	}

	function getVisibleProjects(): Project[] {
		const filtered = projects.filter(
			(p: Project) => plugin.settings.showArchivedProjects || !p.archived,
		);
		return sortProjects(filtered);
	}

	let visibleProjects = $derived(getVisibleProjects());
	let gridStyle = $derived(
		`grid-template-columns: repeat(${gridColumns}, 1fr);`,
	);
	let selectedProject = $derived(
		selectedProjectId
			? projects.find((p: Project) => p.id === selectedProjectId)
			: null,
	);
</script>

{#if dropdownMode}
	<div
		class="relative w-full h-fit bg-(--background-primary-alt) rounded-lg overflow-clip"
	>
		<button
			type="button"
			style="
				flex: 1;
				justify-content: space-between;
				align-items:center;
				{selectedProject ? `background-color: ${selectedProject.color} !important;` : 'background-color: var(--background-primary-alt) !important;'}
				cursor:pointer;
				width: 100%;
				height: 40px;
				border-radius: 0.5rem;
			"
			onclick={() => (dropdownOpen = !dropdownOpen)}
		>
			<span class="flex items-center gap-2 pl-1">
				{#if selectedProject}
					<p class="text-[1rem]">{selectedProject.icon}</p>

					<p class="text-[1rem]">{selectedProject.name}</p>
				{:else}
					No Project Selected
				{/if}
			</span>
			<span
				class="text-[1rem] text-(--text-muted) transition-transform duration-200"
				class:rotate-180={dropdownOpen}
				{@attach icon("chevron-down")}
			></span>
		</button>

		{#if dropdownOpen}
			<div
				class="overflow-hidden rounded bg-transparent p-2"
				transition:slide={{ duration: 150 }}
			>
				<div class="grid w-full gap-2" style={gridStyle}>
					{#each visibleProjects as project (project.id)}
						<ProjectCard
							{project}
							isRunning={false}
							isSelected={selectedProjectId === project.id}
							currentDuration={0}
							onClick={() => handleProjectClick(project)}
							{gridColumns}
						/>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{:else}
	<div class="p-4">
		<div class="grid w-full gap-4" style={gridStyle}>
			{#each visibleProjects as project (project.id)}
				<ProjectCard
					{project}
					isRunning={selectionMode
						? false
						: isProjectRunning(project.id)}
					isSelected={selectionMode &&
						selectedProjectId === project.id}
					currentDuration={selectionMode
						? 0
						: getRunningDuration(project.id)}
					onClick={() => handleProjectClick(project)}
					{gridColumns}
				/>
			{/each}
		</div>

		{#if visibleProjects.length === 0}
			<div class="px-4 py-12 text-center text-(--text-muted)">
				<p class="my-2">No projects yet!</p>
				<p class="my-2 text-sm opacity-80">
					Create a project to start tracking time.
				</p>
			</div>
		{/if}
	</div>
{/if}
