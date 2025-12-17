<script lang="ts">
	import type { Project } from "../types";
	import type TimeTrackerPlugin from "../../main";

	interface Props {
		plugin: TimeTrackerPlugin;
		selectedProjectId: number | null;
		onSelect: (project: Project) => void;
		gridColumns?: number;
	}

	let { plugin, selectedProjectId, onSelect, gridColumns = 3 }: Props = $props();

	function getVisibleProjects(): Project[] {
		return plugin.timesheetData.projects
			.filter((p) => !p.archived)
			.sort((a, b) => a.order - b.order);
	}

	let visibleProjects = $derived(getVisibleProjects());
	let gridStyle = $derived(
		`grid-template-columns: repeat(${gridColumns}, 1fr);`,
	);
</script>

<div class="project-selector-grid" style={gridStyle}>
	{#each visibleProjects as project (project.id)}
		<button
			class="project-selector-card"
			class:selected={selectedProjectId === project.id}
			style="background-color: {project.color}"
			onclick={() => onSelect(project)}
		>
			<span class="project-selector-card-icon">{project.icon}</span>
			<span class="project-selector-card-name">{project.name}</span>
		</button>
	{/each}
</div>

{#if visibleProjects.length === 0}
	<div class="empty-state">
		<p>No projects yet!</p>
	</div>
{/if}

<style>
	.project-selector-grid {
		display: grid;
		gap: 12px;
		width: 100%;
		max-height: 300px;
		overflow-y: auto;
		padding: 4px;
	}

	.project-selector-card {
		aspect-ratio: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 12px;
		border-radius: 8px;
		border: 2px solid transparent;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
		color: white;
	}

	.project-selector-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.project-selector-card.selected {
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px var(--interactive-accent);
	}

	.project-selector-card-icon {
		font-size: 1.5rem;
	}

	.project-selector-card-name {
		font-size: 0.75rem;
		text-align: center;
		word-break: break-word;
		font-weight: 500;
	}

	.empty-state {
		padding: 24px;
		text-align: center;
		color: var(--text-muted);
	}
</style>
