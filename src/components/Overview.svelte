<script lang="ts">
	import { setIcon } from "obsidian";
	import { onMount, tick } from "svelte";
	import type TimeTrackerPlugin from "../../main";
	import type { RunningTimer, TimeRecord } from "../types";
	import { formatDuration } from "../utils/timeUtils";
	import { icon } from "../utils/styleUtils";
	import { ProjectSelectorModal } from "../modals/ProjectSelectorModal";
	import { EditRecordModal } from "../modals/EditRecordModal";
	import { CSVHandler } from "../utils/csvHandler";
	import "../../styles.css";

	interface Props {
		plugin: TimeTrackerPlugin;
		runningTimers: RunningTimer[];
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
	let currentTitle = $state("");
	let pendingTitle = $state(""); // Title before tracking starts
	let saveTimeout: number | undefined;

	// Button refs for icons
	let playBtnRef: HTMLButtonElement | undefined = $state();
	let stopIconRef: HTMLSpanElement | undefined = $state();
	let analyticsBtnRef: HTMLButtonElement | undefined = $state();
	let settingsBtnRef: HTMLButtonElement | undefined = $state();

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
			? plugin.timesheetData.records.find(
					(r) => r.id === currentTimer.recordId,
				)
			: null,
	);

	let recentRecords = $derived(
		plugin.timesheetData.records
			.filter((r) => r.endTime !== null)
			.sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime())
			.slice(0, plugin.settings.embeddedRecentRecordsCount || 3),
	);

	let timerDisplay = $derived(getTimerDisplay());

	// Timer update effect
	$effect(() => {
		if (interval) clearInterval(interval);
		interval = window.setInterval(() => {
			currentTime = Date.now();
		}, 1000);

		return () => {
			if (interval) clearInterval(interval);
		};
	});

	// Sync title from record when tracking starts
	$effect(() => {
		if (currentRecord) {
			currentTitle = currentRecord.title;
		} else {
			currentTitle = "";
		}
	});

	// Set icons on mount and when recentRecords changes
	onMount(() => {
		if (playBtnRef) setIcon(playBtnRef, "play");
		if (analyticsBtnRef) setIcon(analyticsBtnRef, "bar-chart-2");
		if (settingsBtnRef) setIcon(settingsBtnRef, "settings");
	});

	// Svelte action to set icon on element
	function iconAction(node: HTMLElement, iconName: string) {
		setIcon(node, iconName);
		return {
			update(newIconName: string) {
				node.empty();
				setIcon(node, newIconName);
			},
		};
	}

	$effect(() => {
		if (isTracking && stopIconRef) {
			setIcon(stopIconRef, "square");
		}
	});

	function getTimerDisplay(): string {
		if (isTracking && currentTimer) {
			const elapsed = currentTime - currentTimer.startTime.getTime();
			return formatDuration(elapsed);
		}

		const lastRecord = plugin.getLastStoppedRecord();
		if (lastRecord?.endTime) {
			const elapsed = currentTime - lastRecord.endTime.getTime();
			return formatDuration(elapsed);
		}

		return "0:00";
	}

	function handlePlay(): void {
		if (plugin.settings.retroactiveTrackingEnabled) {
			// Retroactive mode - create a completed record
			const lastRecord = plugin.getLastStoppedRecord();
			const now = new Date();
			const startTime = lastRecord?.endTime || now;
			const newRecord: TimeRecord = {
				id: CSVHandler.getNextId(plugin.timesheetData.records),
				projectName: "",
				startTime: startTime,
				endTime: now,
				title: pendingTitle.trim(),
			};
			plugin.timesheetData.records.push(newRecord);
			plugin.saveTimesheet();
			plugin.refreshViews();
			pendingTitle = "";
		} else {
			// Normal mode - start tracking without project
			plugin.startTimerWithoutProject(pendingTitle.trim());
			pendingTitle = "";
		}
	}

	function handleStop(): void {
		if (currentTimer) {
			plugin.stopTimer(currentTimer.projectId);
		}
	}

	function handleTitleKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			handlePlay();
		}
	}

	function openProjectSelector(): void {
		new ProjectSelectorModal(
			plugin.app,
			plugin,
			onRefresh,
			isTracking,
			isTracking ? currentTitle : pendingTitle.trim(),
		).open();
	}

	function debouncedSaveTitle(): void {
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = window.setTimeout(() => {
			saveTitle();
		}, 500);
	}

	function saveTitle(): void {
		if (!currentRecord) return;

		const index = plugin.timesheetData.records.findIndex(
			(r) => r.id === currentRecord.id,
		);
		if (index !== -1) {
			plugin.timesheetData.records[index].title = currentTitle;
			plugin.saveTimesheet();
		}
	}

	function handleRepeat(record: TimeRecord): void {
		const project = plugin.getProjectByName(record.projectName);

		if (plugin.settings.retroactiveTrackingEnabled) {
			// Retroactive behavior
			const lastRecord = plugin.getLastStoppedRecord();
			if (
				lastRecord &&
				lastRecord.projectName === record.projectName &&
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
					projectName: record.projectName,
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
				plugin.startTimer(project.id, false);
				// Set the title after timer starts
				setTimeout(() => {
					const runningRecord = plugin.timesheetData.records.find(
						(r) =>
							r.projectName === project.name &&
							r.endTime === null,
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

	function getRecordDuration(record: TimeRecord): string {
		if (!record.endTime) return "0:00";
		return formatDuration(
			record.endTime.getTime() - record.startTime.getTime(),
		);
	}
</script>

<div
	class="overview-container border-b border-(--background-modifier-border) px-2 pt-2"
>
	<!-- Top row: Project selector + Analytics/Settings -->
	<div class="flex items-center justify-between">
		<!-- Left: Project Badge or Select Project button -->
		{#if isTracking && currentProject}
			<button
				class="flex items-center gap-1.5 px-2 py-1 rounded-full shrink-0 hover:opacity-80 transition-opacity"
				style="background-color: {currentProject.color}"
				onclick={openProjectSelector}
				aria-label="Change project"
			>
				<span class="text-white text-sm">{currentProject.icon}</span>
				<span class="text-white text-xs font-medium"
					>{currentProject.name}</span
				>
			</button>
		{:else}
			<button
				class="flex items-center gap-1.5 px-2 py-1 rounded-full shrink-0 hover:bg-[var(--background-modifier-border)] transition-colors text-[var(--text-muted)]"
				onclick={openProjectSelector}
				aria-label="Select project"
			>
				<span class="text-md">Select Project</span>
			</button>
		{/if}

		<!-- Right: Analytics and Settings buttons -->
		<div class="flex items-center gap-1">
			<button
				bind:this={analyticsBtnRef}
				class="p-1.5 rounded hover:bg-[var(--background-modifier-hover)] transition-colors"
				aria-label="Open Analytics"
				onclick={onOpenAnalytics}
			></button>
			<button
				bind:this={settingsBtnRef}
				class="p-1.5 rounded hover:bg-[var(--background-modifier-hover)] transition-colors"
				aria-label="Open Settings"
				onclick={onOpenSettings}
			></button>
		</div>
	</div>

	<!-- Main row: Play/Stop | Title | Timer -->
	<div class="flex items-center gap-3 pb-2">
		<!-- Play/Stop Button -->
		{#if isTracking}
			<button
				class="w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 bg-(--background-modifier-hover) hover:bg-(--text-error)"
				onclick={handleStop}
				onmouseenter={() => (isPlayButtonHovering = true)}
				onmouseleave={() => (isPlayButtonHovering = false)}
				aria-label="Stop timer"
			>
				<span bind:this={stopIconRef} class="text-[var(--text-muted)]"
				></span>
			</button>
		{:else}
			<button
				bind:this={playBtnRef}
				class="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--interactive-accent)] hover:bg-[var(--interactive-accent-hover)] transition-colors shrink-0"
				onclick={handlePlay}
				aria-label="Start tracking"
			></button>
		{/if}

		<!-- Center: Title Input (always editable) -->
		<div class="flex-1 min-w-0 py-3">
			{#if isTracking}
				<input
					type="text"
					class="w-full bg-transparent border-none outline-none text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-lg"
					placeholder="What are you working on?"
					bind:value={currentTitle}
					oninput={debouncedSaveTitle}
				/>
			{:else}
				<input
					type="text"
					class="w-full bg-transparent border-none outline-none text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-lg"
					placeholder={plugin.settings.retroactiveTrackingEnabled
						? "Track retroactively"
						: "What will you work on?"}
					bind:value={pendingTitle}
					onkeydown={handleTitleKeydown}
				/>
			{/if}
		</div>

		<!-- Right: Timer Display -->
		<div class="shrink-0 text-right min-w-16">
			{#if !isTracking}
				<div class="text-[9px] text-[var(--text-faint)]">
					elapsed time
				</div>
			{/if}
			<div
				class="text-1xl tabular-nums {isTracking
					? 'text-[var(--text-normal)]'
					: 'text-[var(--text-faint)]'}"
			>
				{timerDisplay}
			</div>
		</div>
	</div>

	<!-- Last Records Section -->
	{#if recentRecords.length > 0}
		<div class="pb-3">
			<div
				class="text-[10px] text-(--text-faint) uppercase tracking-wider mb-1.5"
			>
				Last Records
			</div>
			<div class="flex flex-col gap-1">
				{#each recentRecords as record (record.id)}
					{@const project = plugin.getProjectByName(
						record.projectName,
					)}
					<div
						class="flex items-center gap-2 py-1.5rounded hover:bg-[var(--background-modifier-hover)]"
					>
						<!-- Project indicator -->
						{#if project}
							<div
								class="w-6 h-6 rounded flex items-center justify-center text-xs shrink-0"
								style="background-color: {project.color}"
							>
								<span class="text-white">{project.icon}</span>
							</div>
						{:else}
							<div
								class="w-6 h-6 rounded flex items-center justify-center text-xs shrink-0 bg-[var(--background-modifier-border)]"
							>
								<span class="text-[var(--text-muted)]">-</span>
							</div>
						{/if}

						<!-- Project name and title -->
						<div class="flex-1 min-w-0 flex items-center gap-1">
							{#if project}
								<span class="text-sm font-medium shrink-0"
									>{project.name}</span
								>
								{#if record.title}
									<span
										class="text-sm text-[var(--text-muted)]"
										>·</span
									>
									<span
										class="text-sm text-[var(--text-muted)] truncate"
										>{record.title}</span
									>
								{/if}
							{:else}
								<span
									class="text-sm text-[var(--text-faint)] italic shrink-0"
									>No project</span
								>
								{#if record.title}
									<span
										class="text-sm text-[var(--text-muted)]"
										>·</span
									>
									<span
										class="text-sm text-[var(--text-normal)] truncate"
										>{record.title}</span
									>
								{/if}
							{/if}
						</div>

						<div
							class="text-s text-[var(--text-muted)] tabular-nums pr-2"
						>
							{getRecordDuration(record)}
						</div>
						<!-- Action buttons -->
						<button
							class="size-12 rounded p-0"
							aria-label="Repeat"
							onclick={() => handleRepeat(record)}
							{@attach icon("repeat")}
						>
						</button>
						<button
							class="size-12 rounded p-0"
							aria-label="Edit"
							onclick={() => handleEdit(record)}
							{@attach icon("pencil")}
						>
						</button>
						<!-- <button
							class="size-10 rounded p-0"
							aria-label="Edit"
							onclick={() => handleEdit(record)}
							{@attach icon("pencil")}
						></button> -->
						<!-- <button
							class="size-12 rounded hover:bg-[var(--background-modifier-hover)]"
							aria-label="Delete"
							onclick={() => handleDelete(record)}
							use:iconAction={"trash-2"}
						>
						</button> -->

						<!-- Duration -->
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
