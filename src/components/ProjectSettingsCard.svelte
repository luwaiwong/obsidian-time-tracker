<script lang="ts">
	import type { Project } from "../types";

	interface Props {
		project: Project;
		categoryName?: string;
		onEdit: (project: Project) => void;
	}

	let { project, categoryName = "Uncategorized", onEdit }: Props = $props();
</script>

<button
	type="button"
	class="w-full rounded-lg overflow-hidden shadow-sm flex items-center transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer border-0 p-0 text-left bg-[--background-secondary]"
	class:opacity-60={project.archived}
	onclick={() => onEdit(project)}
>
	<div
		class="w-14 h-16 flex items-center justify-center shrink-0"
		style="background-color: {project.color};"
	>
		<span class="text-xl text-white drop-shadow-sm">{project.icon}</span>
	</div>

	<div class="flex-1 px-3 py-2 min-w-0">
		<div class="text-sm font-medium text-[--text-normal] truncate">
			{project.name}
		</div>
		<div class="text-[11px] text-[--text-muted] truncate">
			{categoryName}{#if project.archived}
				· Archived{/if}
		</div>
	</div>
</button>
