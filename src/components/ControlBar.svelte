<script lang="ts">
	import type TimeTrackerPlugin from "../../main";
	import type { TimeRecord } from "../types";
	import { formatNaturalDuration } from "../utils/timeUtils";
	import { icon } from "../utils/styleUtils";
	import { CreateRecordModal } from "../modals/CreateRecordModal";
	import { EditRecordModal } from "../modals/EditRecordModal";
	import RecentRecords from "./RecentRecords.svelte";
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
			? plugin.timesheetData.records.find((r) => r.id === currentTimer!.id)
			: null,
	);

	let timerDisplay = $derived(getTimerDisplay());
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
				return `${title}`;
			}
			return projectName;
		}
		if (plugin.settings.retroactiveTrackingEnabled) {
			return "Track Retroactively";
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

	function handlePlay(): void {
		if (plugin.settings.retroactiveTrackingEnabled) {
			new CreateRecordModal(
				plugin.app,
				plugin,
				onRefresh,
				false,
				"",
				null,
			).open();
		} else {
			plugin.startTimerWithoutProject();
		}
	}

	function handleStop(): void {
	if (currentTimer) {
			plugin.stopTimer(currentTimer.id);
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
			class="px-4 py-3 rounded-lg text-left transition-colors hover:bg-(--background-modifier-hover) cursor-pointer overflow-hidden"
			style="border: {isTracking && currentProject
				? `3px solid ${currentProject.color}`
				: '2px solid var(--background-modifier-hover)'};"
			onclick={handleMainButtonClick}
			onkeydown={(e) => e.key === "Enter" && handleMainButtonClick()}
			role="button"
			tabindex="0"
			aria-label={isTracking ? "Edit current record" : "Start tracking"}
		>
			<div class="flex items-center gap-2 min-w-0 w-full">
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
			class="tabular-nums flex flex-1 items-center justify-center px-1 {isTracking
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
	<RecentRecords {plugin} {onRefresh} />
</div>
