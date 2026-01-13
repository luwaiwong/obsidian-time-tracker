<script lang="ts">
	import type TimeTrackerPlugin from "../../main";
	import type { Project } from "../types";
	import ProjectSettingsCard from "./ProjectSettingsCard.svelte";
	import { EditProjectModal } from "../modals/EditProjectModal";
	import { onMount } from "svelte";

	interface Props {
		plugin: TimeTrackerPlugin;
		onUpdate: () => void;
	}

	let { plugin, onUpdate }: Props = $props();

	let containerEl: HTMLElement;
	let columns = $state(3);

	function updateColumns() {
		if (!containerEl) return;

		const width = containerEl.offsetWidth;

		if (width < 400) {
			columns = 1;
		} else if (width < 600) {
			columns = 2;
		} else if (width < 900) {
			columns = 3;
		} else {
			columns = 4;
		}
	}

	onMount(() => {
		updateColumns();

		const resizeObserver = new ResizeObserver(() => {
			updateColumns();
		});

		resizeObserver.observe(containerEl);

		return () => {
			resizeObserver.disconnect();
		};
	});

	let projects = $derived(() => {
		const projects = [...plugin.timesheetData.projects];

		// sort projects by category (reverse order), then by archived
		return projects.sort((a, b) => {
			if (a.archived !== b.archived) {
				return a.archived ? 1 : -1;
			}
			return b.categoryId - a.categoryId;
		});
	});

	function getCategoryName(categoryId: number): string {
		if (categoryId === -1) return "Uncategorized";
		const category = plugin.timesheetData.categories.find(
			(c) => c.id === categoryId,
		);
		return category ? category.name : "Uncategorized";
	}

	function handleEdit(project: Project) {
		new EditProjectModal(plugin.app, plugin, project, () => {
			onUpdate();
		}).open();
	}
</script>

<div
	bind:this={containerEl}
	class="grid gap-2 w-full"
	style="grid-template-columns: repeat({columns}, minmax(0, 1fr));"
>
	{#if projects().length === 0}
		<div class="col-span-full text-center py-8 text-[--text-muted]">
			No projects yet. Create one to start tracking time!
		</div>
	{:else}
		{#each projects() as project (project.id)}
			<ProjectSettingsCard
				{project}
				categoryName={getCategoryName(project.categoryId)}
				onEdit={handleEdit}
			/>
		{/each}
	{/if}
</div>
