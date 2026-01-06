<script lang="ts">
	import type TimeTrackerPlugin from "../../main";
	import type { TimeRecord } from "../types";
	import {
		formatDuration,
		formatNaturalDuration,
		getRecordDuration,
	} from "../utils/timeUtils";
	import { icon } from "../utils/styleUtils";
	import { CreateRecordModal } from "../modals/CreateRecordModal";
	import { EditRecordModal } from "../modals/EditRecordModal";
	import { CSVHandler } from "../utils/csvHandler";
	import "../../styles.css";

	interface Props {
		plugin: TimeTrackerPlugin;
		runningTimers: TimeRecord[];
		onOpenAnalytics: () => void;
		onOpenSettings: () => void;
		onRefresh: () => void;
	}

	let {
		plugin,
		runningTimers,
		onOpenAnalytics,
		onOpenSettings,
		onRefresh,
	}: Props = $props();

	let currentTime = $state(Date.now());
	let interval: number | undefined;
	let isPlayButtonHovering = $state(false);

	// Derived state
	let isTracking = $derived(runningTimers.length > 0);
	let currentTimer = $derived(
		runningTimers.length > 0 ? runningTimers[0] : null,
	);
	let currentProject = $derived(
		currentTimer ? plugin.getProjectById(currentTimer.projectId) : null,
	);
	let currentRecord = $derived(
		currentTimer
			? plugin.timesheetData.records.find((r) => r.id === currentTimer.id)
			: null,
	);

	let recentRecords = $derived(
		plugin.timesheetData.records
			.filter((r) => r.endTime !== null)
			.sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime())
			.slice(0, plugin.settings.embeddedRecentRecordsCount || 3),
	);

	let timerDisplay = $derived(getTimerDisplay());

	// display text for the main button
	let buttonDisplayText = $derived(getButtonDisplayText());

	// timer update effect
	$effect(() => {
		if (interval) clearInterval(interval);
		interval = window.setInterval(() => {
			currentTime = Date.now();
		}, 1000);

		return () => {
			if (interval) clearInterval(interval);
		};
	});

	function getButtonDisplayText(): string {
		if (isTracking && currentRecord) {
			const projectName = currentProject?.name || "No project";
			const title = currentRecord.title;
			if (title) {
				return `${projectName} · ${title}`;
			}
			return projectName;
		}
		if (plugin.settings.retroactiveTrackingEnabled) {
			return "Retroactively Track";
		}
		return "Start tracking...";
	}

	function getTimerDisplay(): string {
		if (isTracking && currentTimer) {
			const elapsed = currentTime - currentTimer.startTime.getTime();
			return formatNaturalDuration(elapsed);
		}

		const lastRecord = plugin.getLastStoppedRecord();
		if (lastRecord?.endTime) {
			const elapsed = currentTime - lastRecord.endTime.getTime();
			return formatNaturalDuration(elapsed);
		}

		return "00m 00s";
	}

	// starts record without project
	function handlePlay(): void {
		plugin.startTimerWithoutProject();
	}

	function handleStop(): void {
		if (currentTimer) {
			plugin.stopTimer(currentTimer.projectId);
		}
	}

	function handleMainButtonClick(): void {
		if (isTracking && currentRecord) {
			new EditRecordModal(
				plugin.app,
				plugin,
				currentRecord,
				onRefresh,
			).open();
		} else {
			new CreateRecordModal(
				plugin.app,
				plugin,
				onRefresh,
				false,
				"",
				null,
			).open();
		}
	}

	function handleRepeat(record: TimeRecord): void {
		const project = plugin.getProjectById(record.projectId);

		if (plugin.settings.retroactiveTrackingEnabled) {
			// Retroactive behavior
			const lastRecord = plugin.getLastStoppedRecord();
			if (
				lastRecord &&
				lastRecord.projectId === record.projectId &&
				lastRecord.title === record.title
			) {
				// Extend last record
				const index = plugin.timesheetData.records.findIndex(
					(r) => r.id === lastRecord.id,
				);
				if (index !== -1) {
					plugin.timesheetData.records[index].endTime = new Date();
					plugin.saveTimesheet();
					plugin.refreshViews();
				}
			} else {
				// Create completed record filling the gap
				const now = new Date();
				const startTime = lastRecord?.endTime || now;
				const newRecord: TimeRecord = {
					id: CSVHandler.getNextId(plugin.timesheetData.records),
					projectId: record.projectId,
					startTime: startTime,
					endTime: now,
					title: record.title,
				};
				plugin.timesheetData.records.push(newRecord);
				plugin.saveTimesheet();
				plugin.refreshViews();
			}
		} else {
			// Normal mode - start new timer
			if (project) {
				plugin.startTimer(project.id);
				// Set the title after timer starts
				setTimeout(() => {
					const runningRecord = plugin.timesheetData.records.find(
						(r) => r.projectId === project.id && r.endTime === null,
					);
					if (runningRecord) {
						runningRecord.title = record.title;
						plugin.saveTimesheet();
						onRefresh();
					}
				}, 100);
			} else {
				// No project - start without project
				plugin.startTimerWithoutProject(record.title);
			}
		}
	}

	function handleEdit(record: TimeRecord): void {
		new EditRecordModal(plugin.app, plugin, record, onRefresh).open();
	}

	function handleDelete(record: TimeRecord): void {
		const index = plugin.timesheetData.records.findIndex(
			(r) => r.id === record.id,
		);
		if (index !== -1) {
			plugin.timesheetData.records.splice(index, 1);
			plugin.saveTimesheet();
			plugin.refreshViews();
		}
	}
</script>

<div class="border-b border-(--background-modifier-border) px-3 pt-3">
	<!-- CONTROL AREA -->
	<div
		class="grid gap-2"
		style="grid-template-columns: 48px 1fr auto; align-items: stretch;"
	>
		<!-- play button -->
		{#if isTracking}
			<button
				class="flex items-center justify-center transition-all"
				style="width: 100%; height: 100%; border-radius: var(--radius-m);"
				onclick={handleStop}
				onmouseenter={() => (isPlayButtonHovering = true)}
				onmouseleave={() => (isPlayButtonHovering = false)}
				aria-label="Stop timer"
				{@attach icon("square")}
			>
			</button>
		{:else}
			<button
				class="flex items-center justify-center bg-(--background-modifier-hover) hover:bg-(--background-modifier-hover) transition-colors border-2 border-(--background-modifier-hover)"
				style="width: 100%; height: 100%; border-radius: var(--radius-m);"
				onclick={handlePlay}
				aria-label="Start tracking"
				{@attach icon("play")}
			></button>
		{/if}

		<!-- project area -->
		<div
			class="px-4 py-3 rounded-lg text-left transition-colors hover:bg-(--background-modifier-hover) cursor-pointer"
			style="border-color: {isTracking && currentProject
				? currentProject.color + '; border: 3px solid; padding: 0.8rem;'
				: 'var(--background-modifier-hover); border: 2px solid var(--background-modifier-hover)'}"
			onclick={handleMainButtonClick}
			onkeydown={(e) => e.key === "Enter" && handleMainButtonClick()}
			role="button"
			tabindex="0"
			aria-label={isTracking ? "Edit current record" : "Start tracking"}
		>
			<div class="flex items-center gap-2 min-w-0">
				{#if isTracking && currentProject}
					<span class="text-lg shrink-0">{currentProject.icon}</span>
				{/if}
				<span
					class="truncate text-base {isTracking
						? 'text-(--text-normal)'
						: 'text-(--text-muted)'}"
				>
					{buttonDisplayText}
				</span>
			</div>
		</div>

		<!-- timer -->
		<button
			class="tabular-nums flex items-center justify-center px-1 {isTracking
				? 'text-(--text-normal) bg-(--background-modifier-hover)'
				: 'text-(--text-faint) border-2 border-(--background-modifier-hover) bg-transparent'}"
			style="width: 5rem; height: 100%; border-radius: var(--radius-m); font-size: 1rem;"
			aria-label={timerDisplay +
				(isTracking ? " active" : " since last record")}
		>
			{timerDisplay}
		</button>
	</div>

	<!-- LAST RECORDS SECTION -->
	{#if recentRecords.length > 0}
		<div class="pt-4 pb-3">
			<div
				class="text-[10px] text-(--text-faint) uppercase tracking-wider mb-1.5"
			>
				Last Records
			</div>
			<div class="flex flex-col gap-1">
				{#each recentRecords as record (record.id)}
					{@const project = plugin.getProjectById(record.projectId)}
					<div class="flex items-center gap-2 rounded">
						<!-- project name and title -->
						<div
							class="flex-1 min-w-0 flex items-center gap-1"
							aria-label={(project
								? `${project.name}`
								: `No project`) +
								(record.title
									? ` - ${record.title}`
									: " - untitled")}
						>
							{#if project}
								<div
									class="rounded flex items-center justify-center pr-2"
									style="background-color: {project.color};"
								>
									<span
										class="text-xs font-medium shrink-0 size-7 flex items-center justify-center"
										>{project.icon}</span
									>

									<span class="text-xs font-medium shrink-0"
										>{project.name}</span
									>
								</div>
								{#if record.title}
									<span
										class="text-xs text-(--text-muted) truncate"
										>{record.title}</span
									>
								{/if}
							{:else}
								<span
									class="text-xs text-(--text-faint) italic shrink-0"
									>No project</span
								>
								{#if record.title}
									<span
										class="text-xs text-(--text-normal) truncate"
										>{record.title}</span
									>
								{/if}
							{/if}
						</div>

						<div class="text-xs text-(--text-muted) tabular-nums">
							{formatNaturalDuration(getRecordDuration(record))}
						</div>
						<!-- buttons -->
						<button
							class="size-10 rounded p-0"
							aria-label="Repeat"
							onclick={() => handleRepeat(record)}
							{@attach icon("repeat")}
						>
						</button>
						<button
							class="size-10 rounded p-0"
							aria-label="Edit"
							onclick={() => handleEdit(record)}
							{@attach icon("pencil")}
						>
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
