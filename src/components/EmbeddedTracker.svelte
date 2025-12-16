<script lang="ts">
	import type TimeTrackerPlugin from "../../main";
	import type { EmbeddedTrackerConfig } from "../codeBlockProcessor";
	import type { Project, TimeLog } from "../types";
	import { formatDuration, formatDateTime } from "../utils";

	interface Props {
		plugin: TimeTrackerPlugin;
		config: EmbeddedTrackerConfig;
	}

	let { plugin, config }: Props = $props();

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

	let projects = $derived(getRelevantProjects());
	let recentLogs = $derived(getRecentLogs());
	let runningTimers = $derived(
		plugin.runningTimers.filter((t) =>
			projects.some((p) => p.id === t.projectId),
		),
	);

	function getRelevantProjects(): Project[] {
		if (config.type === "project" && config.projectId !== null) {
			const project = plugin.timesheetData.projects.find(
				(p) => p.id === config.projectId,
			);
			return project ? [project] : [];
		} else if (config.type === "category" && config.categoryId !== null) {
			return plugin.timesheetData.projects.filter(
				(p) => p.categoryId === config.categoryId,
			);
		} else {
			return plugin.timesheetData.projects;
		}
	}

	function getRecentLogs(): TimeLog[] {
		const projectNames = projects.map((p) => p.name);
		const filtered = plugin.timesheetData.logs
			.filter(
				(l) =>
					projectNames.includes(l.projectName) && l.endTime !== null,
			)
			.sort((a, b) => {
				const aEnd = a.endTime?.getTime() ?? 0;
				const bEnd = b.endTime?.getTime() ?? 0;
				return bEnd - aEnd;
			})
			.slice(0, config.recentLogs);

		return filtered;
	}

	function getProject(projectId: number): Project | undefined {
		return plugin.timesheetData.projects.find((p) => p.id === projectId);
	}

	function getProjectByName(name: string): Project | undefined {
		return plugin.timesheetData.projects.find((p) => p.name === name);
	}

	function getCategoryName(): string {
		const category = plugin.timesheetData.categories.find(
			(c) => c.id === config.categoryId,
		);
		return category?.name || "Unknown";
	}

	function handleProjectClick(project: Project) {
		const isRunning = plugin.isProjectRunning(project.id);

		if (isRunning) {
			plugin.stopTimer(project.id);
		} else {
			plugin.startTimer(
				project.id,
				plugin.settings.retroactiveTrackingEnabled,
			);
		}
	}

	function getRunningDuration(projectId: number): number {
		const timer = plugin.runningTimers.find(
			(t) => t.projectId === projectId,
		);
		if (!timer) return 0;
		return currentTime - timer.startTime.getTime();
	}

	function isProjectRunning(projectId: number): boolean {
		return plugin.isProjectRunning(projectId);
	}

	let sizeClass = $derived(
		config.size === "small"
			? "small"
			: config.size === "large"
				? "large"
				: "normal",
	);
</script>

<div class="embedded-tracker {sizeClass}">
	{#if config.showRunningTimer && runningTimers.length > 0}
		<div class="running-timers">
			<h4>Running Timers</h4>
			{#each runningTimers as timer (timer.projectId)}
				{#if getProject(timer.projectId)}
					<div
						class="running-timer"
						style="border-color: {getProject(timer.projectId)
							?.color};"
						onclick={() =>
							handleProjectClick(getProject(timer.projectId)!)}
						onkeydown={(e) =>
							e.key === "Enter" &&
							handleProjectClick(getProject(timer.projectId)!)}
						role="button"
						tabindex="0"
					>
						<div class="timer-icon">
							{getProject(timer.projectId)?.icon}
						</div>
						<div class="timer-info">
							<div class="timer-name">
								{getProject(timer.projectId)?.name}
							</div>
							<div class="timer-duration">
								{formatDuration(
									getRunningDuration(timer.projectId),
								)}
							</div>
						</div>
						<div class="timer-indicator">●</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<div class="tracker-projects">
		{#if projects.length === 1}
			<h4>Quick Track: {projects[0].name}</h4>
		{:else if config.type === "category"}
			<h4>Category: {getCategoryName()}</h4>
		{:else}
			<h4>Projects</h4>
		{/if}

		<div class="project-buttons">
			{#each projects as project (project.id)}
				<button
					class="project-button"
					class:running={isProjectRunning(project.id)}
					style="background-color: {project.color};"
					onclick={() => handleProjectClick(project)}
				>
					<span class="button-icon">{project.icon}</span>
					<span class="button-name">{project.name}</span>
					{#if isProjectRunning(project.id)}
						<span class="button-timer">
							{formatDuration(
								getRunningDuration(project.id),
								true,
							)}
						</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	{#if recentLogs.length > 0}
		<div class="recent-logs">
			<h4>Recent Logs ({config.recentLogs})</h4>
			<div class="logs-list">
				{#each recentLogs as log (log.id)}
					{#if getProjectByName(log.projectName)}
						<div class="log-item">
							<div
								class="log-color"
								style="background-color: {getProjectByName(
									log.projectName,
								)?.color};"
							></div>
							<div class="log-info">
								<div class="log-project">
									{getProjectByName(log.projectName)?.icon}
									{log.projectName}
								</div>
								<div class="log-time">
									{formatDateTime(log.startTime)}
								</div>
							</div>
							<div class="log-duration">
								{#if log.endTime}
									{formatDuration(
										log.endTime.getTime() -
											log.startTime.getTime(),
										true,
									)}
								{/if}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.embedded-tracker {
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 16px;
		background-color: var(--background-primary);
		font-family: var(--font-interface);
	}

	.embedded-tracker.small {
		padding: 12px;
		font-size: 0.9em;
	}

	.embedded-tracker.large {
		padding: 24px;
		font-size: 1.1em;
	}

	h4 {
		margin: 0 0 12px 0;
		font-size: 1em;
		font-weight: 600;
		color: var(--text-normal);
	}

	.running-timers {
		margin-bottom: 16px;
	}

	.running-timer {
		display: flex;
		align-items: center;
		padding: 12px;
		background-color: var(--background-secondary);
		border-left: 4px solid;
		border-radius: 4px;
		margin-bottom: 8px;
		cursor: pointer;
		gap: 12px;
	}

	.running-timer:hover {
		background-color: var(--background-modifier-hover);
	}

	.timer-icon {
		font-size: 1.5em;
	}

	.timer-info {
		flex: 1;
	}

	.timer-name {
		font-weight: 600;
		margin-bottom: 4px;
	}

	.timer-duration {
		color: var(--text-muted);
		font-size: 0.9em;
	}

	.timer-indicator {
		color: var(--interactive-accent);
		font-size: 1.2em;
		animation: blink 1.5s ease-in-out infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.tracker-projects {
		margin-bottom: 16px;
	}

	.project-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.project-button {
		padding: 10px 16px;
		border: none;
		border-radius: 6px;
		color: white;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: all 0.2s ease;
	}

	.project-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	.project-button.running {
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
		}
		50% {
			box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.3);
		}
	}

	.button-icon {
		font-size: 1.2em;
	}

	.button-name {
		flex: 1;
	}

	.button-timer {
		font-size: 0.85em;
		opacity: 0.9;
	}

	.logs-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.log-item {
		display: flex;
		align-items: center;
		padding: 8px;
		background-color: var(--background-secondary);
		border-radius: 4px;
		gap: 12px;
	}

	.log-color {
		width: 4px;
		height: 32px;
		border-radius: 2px;
	}

	.log-info {
		flex: 1;
	}

	.log-project {
		font-weight: 600;
		margin-bottom: 2px;
	}

	.log-time {
		color: var(--text-muted);
		font-size: 0.85em;
	}

	.log-duration {
		font-weight: 600;
		color: var(--text-muted);
	}
</style>
