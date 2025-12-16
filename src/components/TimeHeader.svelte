<script lang="ts">
	import { setIcon } from "obsidian";
	import { onMount } from "svelte";
	import type TimeTrackerPlugin from "../../main";
	import type { RunningTimer } from "../types";
	import "../../styles.css";

	interface Props {
		plugin: TimeTrackerPlugin;
		runningTimers: RunningTimer[];
		onAddProject: () => void;
		onOpenAnalytics: () => void;
		onOpenSettings: () => void;
		onStopAll?: () => void;
	}

	let {
		plugin,
		runningTimers,
		onAddProject,
		onOpenAnalytics,
		onOpenSettings,
		onStopAll,
	}: Props = $props();

	let currentTime = $state(Date.now());
	let interval: number | undefined;

	let addBtnRef: HTMLButtonElement | undefined = $state();
	let analyticsBtnRef: HTMLButtonElement | undefined = $state();
	let settingsBtnRef: HTMLButtonElement | undefined = $state();
	let stopAllBtnRef: HTMLButtonElement | undefined = $state();

	$effect(() => {
		if (interval) clearInterval(interval);
		interval = window.setInterval(() => {
			currentTime = Date.now();
		}, 1000);

		return () => {
			if (interval) clearInterval(interval);
		};
	});

	onMount(() => {
		if (addBtnRef) setIcon(addBtnRef, "plus");
		if (analyticsBtnRef) setIcon(analyticsBtnRef, "bar-chart-2");
		if (settingsBtnRef) setIcon(settingsBtnRef, "settings");
		if (stopAllBtnRef) setIcon(stopAllBtnRef, "square");
	});

	function formatDuration(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
		}
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	}

	function getTimerDisplay(): string {
		if (runningTimers.length > 0) {
			const earliestTimer = runningTimers.reduce((earliest, timer) =>
				timer.startTime.getTime() < earliest.startTime.getTime()
					? timer
					: earliest,
			);
			const elapsed = currentTime - earliestTimer.startTime.getTime();
			return formatDuration(elapsed);
		}

		const completedLogs = plugin.timesheetData.logs.filter(
			(l) => l.endTime !== null,
		);
		if (completedLogs.length > 0) {
			const lastLog = completedLogs.reduce((latest, log) => {
				if (!latest.endTime) return log;
				if (!log.endTime) return latest;
				return log.endTime.getTime() > latest.endTime.getTime()
					? log
					: latest;
			});
			if (lastLog.endTime) {
				const elapsed = currentTime - lastLog.endTime.getTime();
				return formatDuration(elapsed);
			}
		}

		return "0:00";
	}

	let timerLabel = $derived(
		runningTimers.length > 0 ? "Current Track" : "Since Last Track",
	);
	let timerDisplay = $derived(getTimerDisplay());
	let hasRunningTimers = $derived(runningTimers.length > 0);
</script>

<div
	class="flex items-center justify-between px-4 py-3 border-b border-[var(--background-modifier-border)]"
>
	<div class="flex flex-col items-start">
		<div class="text-xs text-[--text-muted] tracking-wide">
			{timerLabel}
		</div>
		<div class="text-2xl tabular-nums text-[--text-normal]">
			{timerDisplay}
		</div>
	</div>
	<div class="flex items-center gap-2">
		<button
			bind:this={addBtnRef}
			class="p-2 rounded hover:bg-[var(--background-modifier-hover)] transition-colors"
			aria-label="Add Project"
			onclick={onAddProject}
		></button>

		<button
			bind:this={analyticsBtnRef}
			class="p-2 rounded hover:bg-[var(--background-modifier-hover)] transition-colors"
			aria-label="Open Analytics"
			onclick={onOpenAnalytics}
		></button>

		<button
			bind:this={settingsBtnRef}
			class="p-2 rounded hover:bg-[var(--background-modifier-hover)] transition-colors"
			aria-label="Open Settings"
			onclick={onOpenSettings}
		></button>

		{#if hasRunningTimers && onStopAll}
			<button
				bind:this={stopAllBtnRef}
				class="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--interactive-accent)] text-[var(--text-on-accent)] hover:bg-[var(--interactive-accent-hover)] transition-colors"
				aria-label="Stop All Timers"
				onclick={onStopAll}
			>
				<span>Stop All</span>
			</button>
		{/if}
	</div>
</div>
