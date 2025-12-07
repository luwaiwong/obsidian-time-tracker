<script lang="ts">
import type TimeTrackerPlugin from "../../main";
import type { Project, Category } from "../types";
import { CSVHandler } from "../csvHandler";

interface Props {
	plugin: TimeTrackerPlugin;
	onClose: () => void;
}

let { plugin, onClose }: Props = $props();

let projects = $state(plugin.timesheetData.projects);
let categories = $state(plugin.timesheetData.categories);
let editingProject: Project | null = $state(null);
let showNewProjectForm = $state(false);

// New project form fields
let newProjectName = $state("");
let newProjectIcon = $state("");
let newProjectIconType: "emoji" | "text" = $state("emoji");
let newProjectColor = $state("#4ECDC4");
let newProjectCategoryId = $state(-1);

function startNewProject() {
	showNewProjectForm = true;
	resetForm();
}

function resetForm() {
	newProjectName = "";
	newProjectIcon = "";
	newProjectIconType = "emoji";
	newProjectColor = "#4ECDC4";
	newProjectCategoryId = -1;
}

async function saveNewProject() {
	if (!newProjectName.trim() || !newProjectIcon.trim()) {
		alert("Please enter both name and icon");
		return;
	}

	const newId = CSVHandler.getNextId(plugin.timesheetData.projects);
	const newProject: Project = {
		id: newId,
		name: newProjectName.trim(),
		icon: newProjectIcon.trim(),
		iconType: newProjectIconType,
		color: newProjectColor,
		categoryId: newProjectCategoryId,
		archived: false,
		order: plugin.timesheetData.projects.length,
	};

	plugin.timesheetData.projects.push(newProject);

	if (newProjectCategoryId !== -1) {
		plugin.timesheetData.projectCategories.set(newId, newProjectCategoryId);
	}

	await plugin.saveTimesheet();
	projects = [...plugin.timesheetData.projects];
	showNewProjectForm = false;
	resetForm();
	plugin.refreshViews();
}

function startEdit(project: Project) {
	editingProject = { ...project };
}

async function saveEdit() {
	if (!editingProject) return;

	const index = plugin.timesheetData.projects.findIndex(
		(p) => p.id === editingProject!.id,
	);
	if (index !== -1) {
		plugin.timesheetData.projects[index] = editingProject;

		// Update category mapping
		if (editingProject.categoryId !== -1) {
			plugin.timesheetData.projectCategories.set(
				editingProject.id,
				editingProject.categoryId,
			);
		} else {
			plugin.timesheetData.projectCategories.delete(editingProject.id);
		}

		await plugin.saveTimesheet();
		projects = [...plugin.timesheetData.projects];
		editingProject = null;
		plugin.refreshViews();
	}
}

function cancelEdit() {
	editingProject = null;
}

async function toggleArchive(project: Project) {
	project.archived = !project.archived;
	await plugin.saveTimesheet();
	projects = [...plugin.timesheetData.projects];
	plugin.refreshViews();
}

async function deleteProject(project: Project) {
	if (
		!confirm(`Delete project "${project.name}"? All time records will be kept.`)
	) {
		return;
	}

	plugin.timesheetData.projects = plugin.timesheetData.projects.filter(
		(p) => p.id !== project.id,
	);
	plugin.timesheetData.projectCategories.delete(project.id);

	await plugin.saveTimesheet();
	projects = [...plugin.timesheetData.projects];
	plugin.refreshViews();
}

function getCategoryName(categoryId: number): string {
	const category = categories.find((c) => c.id === categoryId);
	return category ? category.name : "Uncategorized";
}
</script>

<div class="project-manager">
    <div class="manager-header">
        <h3>Manage Projects</h3>
        <button class="close-button" onclick={onClose}>×</button>
    </div>

    <div class="manager-actions">
        <button class="primary-button" onclick={startNewProject}>
            + New Project
        </button>
    </div>

    {#if showNewProjectForm}
        <div class="project-form">
            <h4>New Project</h4>

            <div class="form-group">
                <label>Project Name</label>
                <input
                    type="text"
                    bind:value={newProjectName}
                    placeholder="e.g., Study Math"
                />
            </div>

            <div class="form-group">
                <label>Icon Type</label>
                <select bind:value={newProjectIconType}>
                    <option value="emoji">Emoji</option>
                    <option value="text">Text</option>
                </select>
            </div>

            <div class="form-group">
                <label
                    >Icon ({newProjectIconType === "emoji"
                        ? "Emoji"
                        : "Text, e.g., MAT"})</label
                >
                <input
                    type="text"
                    bind:value={newProjectIcon}
                    placeholder={newProjectIconType === "emoji" ? "📚" : "MAT"}
                />
            </div>

            <div class="form-group">
                <label>Color</label>
                <input type="color" bind:value={newProjectColor} />
            </div>

            <div class="form-group">
                <label>Category</label>
                <select bind:value={newProjectCategoryId}>
                    <option value={-1}>Uncategorized</option>
                    {#each categories.filter((c) => c.id !== -1) as category}
                        <option value={category.id}>{category.name}</option>
                    {/each}
                </select>
            </div>

            <div class="form-actions">
                <button class="primary-button" onclick={saveNewProject}
                    >Save</button
                >
                <button
                    class="secondary-button"
                    onclick={() => {
                        showNewProjectForm = false;
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    {/if}

    <div class="projects-list">
        {#each projects as project (project.id)}
            {#if editingProject && editingProject.id === project.id}
                <div class="project-form">
                    <h4>Edit Project</h4>

                    <div class="form-group">
                        <label>Project Name</label>
                        <input type="text" bind:value={editingProject.name} />
                    </div>

                    <div class="form-group">
                        <label>Icon Type</label>
                        <select bind:value={editingProject.iconType}>
                            <option value="emoji">Emoji</option>
                            <option value="text">Text</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Icon</label>
                        <input type="text" bind:value={editingProject.icon} />
                    </div>

                    <div class="form-group">
                        <label>Color</label>
                        <input type="color" bind:value={editingProject.color} />
                    </div>

                    <div class="form-group">
                        <label>Category</label>
                        <select bind:value={editingProject.categoryId}>
                            <option value={-1}>Uncategorized</option>
                            {#each categories.filter((c) => c.id !== -1) as category}
                                <option value={category.id}
                                    >{category.name}</option
                                >
                            {/each}
                        </select>
                    </div>

                    <div class="form-actions">
                        <button class="primary-button" onclick={saveEdit}
                            >Save</button
                        >
                        <button class="secondary-button" onclick={cancelEdit}
                            >Cancel</button
                        >
                    </div>
                </div>
            {:else}
                <div class="project-item" class:archived={project.archived}>
                    <div
                        class="project-color"
                        style="background-color: {project.color};"
                    />
                    <div class="project-info">
                        <div class="project-title">
                            {project.iconType === "emoji"
                                ? project.icon
                                : `[${project.icon}]`}
                            {project.name}
                        </div>
                        <div class="project-meta">
                            Category: {getCategoryName(project.categoryId)}
                            {#if project.archived}
                                <span class="archived-badge">Archived</span>
                            {/if}
                        </div>
                    </div>
                    <div class="project-actions">
                        <button
                            class="icon-button"
                            onclick={() => startEdit(project)}
                            title="Edit"
                        >
                            ✏️
                        </button>
                        <button
                            class="icon-button"
                            onclick={() => toggleArchive(project)}
                            title={project.archived ? "Unarchive" : "Archive"}
                        >
                            {project.archived ? "📂" : "📁"}
                        </button>
                        <button
                            class="icon-button delete"
                            onclick={() => deleteProject(project)}
                            title="Delete"
                        >
                            🗑️
                        </button>
                    </div>
                </div>
            {/if}
        {/each}
    </div>
</div>

<style>
    .project-manager {
        padding: 16px;
        height: 100%;
        overflow-y: auto;
    }

    .manager-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .manager-header h3 {
        margin: 0;
    }

    .close-button {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 4px 8px;
        color: var(--text-muted);
    }

    .close-button:hover {
        color: var(--text-normal);
    }

    .manager-actions {
        margin-bottom: 16px;
    }

    .primary-button {
        background-color: var(--interactive-accent);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
    }

    .primary-button:hover {
        background-color: var(--interactive-accent-hover);
    }

    .secondary-button {
        background-color: var(--background-modifier-border);
        color: var(--text-normal);
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    }

    .secondary-button:hover {
        background-color: var(--background-modifier-border-hover);
    }

    .project-form {
        background-color: var(--background-secondary);
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 16px;
    }

    .project-form h4 {
        margin: 0 0 16px 0;
    }

    .form-group {
        margin-bottom: 12px;
    }

    .form-group label {
        display: block;
        margin-bottom: 4px;
        font-weight: 600;
        font-size: 0.9em;
    }

    .form-group input,
    .form-group select {
        width: 100%;
        padding: 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background-color: var(--background-primary);
        color: var(--text-normal);
    }

    .form-actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
    }

    .projects-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .project-item {
        display: flex;
        align-items: center;
        padding: 12px;
        background-color: var(--background-secondary);
        border-radius: 8px;
        gap: 12px;
    }

    .project-item.archived {
        opacity: 0.6;
    }

    .project-color {
        width: 4px;
        height: 40px;
        border-radius: 2px;
    }

    .project-info {
        flex: 1;
    }

    .project-title {
        font-weight: 600;
        margin-bottom: 4px;
    }

    .project-meta {
        font-size: 0.85em;
        color: var(--text-muted);
    }

    .archived-badge {
        background-color: var(--background-modifier-border);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.8em;
        margin-left: 8px;
    }

    .project-actions {
        display: flex;
        gap: 4px;
    }

    .icon-button {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        opacity: 0.7;
    }

    .icon-button:hover {
        opacity: 1;
    }

    .icon-button.delete:hover {
        filter: brightness(1.2);
    }
</style>
