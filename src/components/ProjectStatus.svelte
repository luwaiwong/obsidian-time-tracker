<script lang="ts">
import { onDestroy } from "svelte";
import type TimeTrackerPlugin from "../../main";
import type { Project, TimeRecord } from "../types";
import { formatDuration } from "../utils";

interface Props {
	plugin: TimeTrackerPlugin;
}

let { plugin }: Props = $props();

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

// Get the currently running timer (first one if multitasking)
let activeTimer = $derived(
	plugin.runningTimers.length > 0 ? plugin.runningTimers[0] : null,
);

// Get the project for the active timer
let activeProject = $derived(
	activeTimer
		? plugin.timesheetData.projects.find((p) => p.id === activeTimer.projectId)
		: null,
);

// Get the last recorded time entry
let lastRecord = $derived.by(() => {
	if (plugin.timesheetData.records.length === 0) return null;
	return plugin.timesheetData.records
		.slice()
		.sort((a, b) => b.endTime - a.endTime)[0];
});

// Get the project for the last record
let lastRecordProject = $derived(
	lastRecord
		? plugin.timesheetData.projects.find((p) => p.id === lastRecord.projectId)
		: null,
);

// Calculate current duration for running timer
let runningDuration = $derived(
	activeTimer ? currentTime - activeTimer.startTime : 0,
);

// Calculate time since last record ended
let timeSinceLastRecord = $derived(
	lastRecord ? currentTime - lastRecord.endTime : 0,
);

// Last record duration
let lastRecordDuration = $derived(
	lastRecord ? lastRecord.endTime - lastRecord.startTime : 0,
);

// Check if we're currently recording
let isRecording = $derived(plugin.runningTimers.length > 0);
</script>

<div class="project-status">
    <div class="status-bar">
        <div class="status-content">
            {#if isRecording && activeProject}
                <!-- Currently recording -->
                <div class="recording-info">
                    <div class="recording-indicator">
                        <span class="pulse-dot"></span>
                    </div>
                    <div
                        class="project-icon"
                        style="background-color: {activeProject.color};"
                    >
                        {activeProject.icon}
                    </div>
                    <span class="project-name">{activeProject.name}</span>
                    <span class="timer recording-timer">
                        {formatDuration(runningDuration, true)}
                    </span>
                </div>
            {:else if lastRecord}
                <!-- Not recording, show time since last -->
                <div class="idle-info">
                    <span class="idle-label">Idle for</span>
                    <span class="timer idle-timer">
                        {formatDuration(timeSinceLastRecord, true)}
                    </span>
                </div>
            {:else}
                <!-- No records at all -->
                <div class="idle-info">
                    <span class="idle-label">No activity recorded</span>
                </div>
            {/if}
        </div>

        <!-- Last recorded pill - overlapping the border -->
        {#if lastRecordProject && lastRecord}
            <div class="last-recorded-pill">
                <div
                    class="pill-icon"
                    style="background-color: {lastRecordProject.color};"
                >
                    {lastRecordProject.icon}
                </div>
                <span class="pill-name">{lastRecordProject.name}</span>
                <span class="pill-duration">
                    {formatDuration(lastRecordDuration, true)}
                </span>
            </div>
        {/if}
    </div>
</div>

<style>
    .project-status {
        padding: 8px 16px;
        position: relative;
    }

    .status-bar {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border: 2px solid var(--background-modifier-border);
        border-radius: 12px;
        background-color: var(--background-primary);
        min-height: 48px;
    }

    .status-content {
        flex: 1;
        display: flex;
        align-items: center;
    }

    /* Recording state */
    .recording-info {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .recording-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .pulse-dot {
        width: 10px;
        height: 10px;
        background-color: var(--text-error);
        border-radius: 50%;
        animation: pulse-recording 1.5s ease-in-out infinite;
    }

    @keyframes pulse-recording {
        0%,
        100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.5;
            transform: scale(1.2);
        }
    }

    .project-icon {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: white;
        flex-shrink: 0;
    }

    .project-name {
        font-weight: 600;
        color: var(--text-normal);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
    }

    .timer {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        font-family: var(--font-monospace);
    }

    .recording-timer {
        color: var(--text-accent);
        font-size: 1.1em;
        animation: pulse-text 2s ease-in-out infinite;
    }

    @keyframes pulse-text {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.7;
        }
    }

    /* Idle state */
    .idle-info {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .idle-label {
        color: var(--text-muted);
        font-size: 0.9em;
    }

    .idle-timer {
        color: var(--text-muted);
        font-size: 1em;
    }

    /* Last recorded pill */
    .last-recorded-pill {
        position: absolute;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px 6px 6px;
        background-color: var(--background-secondary);
        border: 2px solid var(--background-modifier-border);
        border-radius: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        z-index: 1;
    }

    .pill-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: white;
        flex-shrink: 0;
    }

    .pill-name {
        font-weight: 500;
        font-size: 0.85em;
        color: var(--text-normal);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 80px;
    }

    .pill-duration {
        font-weight: 600;
        font-size: 0.8em;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    /* Responsive adjustments */
    @media (max-width: 400px) {
        .project-name {
            max-width: 80px;
        }

        .pill-name {
            display: none;
        }

        .last-recorded-pill {
            padding: 4px 8px 4px 4px;
        }
    }
</style>
