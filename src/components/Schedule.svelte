<script lang="ts">
import type TimeTrackerPlugin from "../../main";
import type { Project } from "../types";
import { formatDuration } from "../utils";

interface Props {
	plugin: TimeTrackerPlugin;
}

type ScheduleBlock = {
	key: string;
	project: Project;
	start: number;
	end: number;
	duration: number;
	top: number;
	height: number;
	isRunning: boolean;
};

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0:00 through 24:00 guide lines
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_BLOCK_HEIGHT_PERCENT = 1;

let { plugin }: Props = $props();
let selectedDate = $state(new Date());
let now = $state(Date.now());
let interval: number | undefined;
let projects = $derived(plugin.timesheetData?.projects ?? []);
let records = $derived(plugin.timesheetData?.records ?? []);

$effect(() => {
	if (interval) clearInterval(interval);
	interval = window.setInterval(() => {
		now = Date.now();
	}, 1000 * 30);

	return () => {
		if (interval) clearInterval(interval);
	};
});

function moveDay(delta: number) {
	const next = new Date(selectedDate);
	next.setDate(next.getDate() + delta);
	selectedDate = next;
}

function setToday() {
	selectedDate = new Date();
}

function getDayRange(date: Date) {
	const start = new Date(date);
	start.setHours(0, 0, 0, 0);
	const end = new Date(date);
	end.setHours(23, 59, 59, 999);
	return { start: start.getTime(), end: end.getTime() };
}

function formatTimeOfDay(timestamp: number) {
	return new Date(timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function buildBlock(
	key: string,
	project: Project,
	start: number,
	end: number,
	isRunning: boolean,
	dayStart: number,
	dayLength: number,
): ScheduleBlock {
	const duration = Math.max(end - start, 0);
	const top = ((start - dayStart) / dayLength) * 100;
	const height = Math.max((duration / dayLength) * 100, MIN_BLOCK_HEIGHT_PERCENT);

	return {
		key,
		project,
		start,
		end,
		duration,
		top,
		height,
		isRunning,
	};
}

let dayRange = $derived(getDayRange(selectedDate));
let dayLength = $derived(dayRange.end - dayRange.start);

let blocks: ScheduleBlock[] = $derived.by(() => {
	const { start, end } = dayRange;
	const items: ScheduleBlock[] = [];
	if (dayLength <= 0 || projects.length === 0) return items;

	for (const record of records) {
		if (record.endTime < start || record.startTime > end) continue;
		const project = projects.find((p) => p.id === record.projectId);
		if (!project) continue;

		const clampedStart = Math.max(record.startTime, start);
		const clampedEnd = Math.min(record.endTime, end);

		items.push(
			buildBlock(
				`record-${record.id}`,
				project,
				clampedStart,
				clampedEnd,
				false,
				start,
				dayLength,
			),
		);
	}

	for (const timer of plugin.runningTimers || []) {
		if (timer.startTime > end) continue;
		const project = projects.find((p) => p.id === timer.projectId);
		if (!project) continue;
		const clampedStart = Math.max(timer.startTime, start);
		const clampedEnd = Math.min(now, end);

		items.push(
			buildBlock(
				`running-${timer.projectId}`,
				project,
				clampedStart,
				clampedEnd,
				true,
				start,
				dayLength,
			),
		);
	}

	return items
		.filter((block) => block.height > 0)
		.sort((a, b) => a.start - b.start);
});

let totalDayDuration = $derived(
	blocks.reduce((total, block) => total + block.duration, 0),
);

function getNowMarkerPosition() {
	if (!isSameDay(selectedDate, now)) return null;
	const { start } = dayRange;
	const position = ((now - start) / DAY_MS) * 100;
	if (position < 0 || position > 100) return null;
	return position;
}

function isSameDay(date: Date, timestamp: number) {
	const check = new Date(timestamp);
	return (
		date.getFullYear() === check.getFullYear() &&
		date.getMonth() === check.getMonth() &&
		date.getDate() === check.getDate()
	);
}

let nowPosition = $derived(getNowMarkerPosition());

let selectedDateLabel = $derived(
	selectedDate.toLocaleDateString(undefined, {
		weekday: "long",
		month: "short",
		day: "numeric",
	}),
);
</script>

<div class="schedule">
    <div class="schedule-header">
        <div class="date-controls">
            <button class="ghost" onclick={() => moveDay(-1)}>‹</button>
            <button class="solid" onclick={setToday}>Today</button>
            <button class="ghost" onclick={() => moveDay(1)}>›</button>
            <div class="date-label">{selectedDateLabel}</div>
        </div>
        <div class="day-summary">
            <span>Total {formatDuration(totalDayDuration, true)}</span>
            <span class="divider">•</span>
            <span>{blocks.length} {blocks.length === 1 ? "block" : "blocks"}</span>
        </div>
    </div>

    <div class="schedule-body">
        <div class="time-axis">
            {#each HOURS as hour (hour)}
                <div class="axis-row">
                    <span class="axis-label">{String(hour).padStart(2, "0")}:00</span>
                </div>
            {/each}
        </div>

        <div class="schedule-canvas">
            {#each HOURS as hour (hour)}
                <div
                    class="hour-line"
                    style={`top: ${(hour / 24) * 100}%;`}
                ></div>
            {/each}

            {#if nowPosition !== null}
                <div class="now-line" style={`top: ${nowPosition}%;`}>
                    <span>Now</span>
                </div>
            {/if}

            {#each blocks as block (block.key)}
                <div
                    class="time-block"
                    style={`top: ${block.top}%; height: ${block.height}%; background-color: ${block.project.color};`}
                >
                    <div class="block-content">
                        <div class="block-title">
                            <span class="block-icon">{block.project.icon}</span>
                            <span class="block-name">{block.project.name}</span>
                        </div>
                        <div class="block-times">
                            {formatTimeOfDay(block.start)} - {formatTimeOfDay(block.end)}
                        </div>
                        <div class="block-duration">
                            {block.isRunning ? "Running • " : ""}{formatDuration(block.duration, true)}
                        </div>
                    </div>
                </div>
            {/each}

            {#if blocks.length === 0}
                <div class="empty-state">
                    <p>No entries for this day.</p>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .schedule {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
        padding: 12px;
        box-sizing: border-box;
    }

    .schedule-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .date-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .date-label {
        font-weight: 700;
        font-size: 1em;
        color: var(--text-normal);
        margin-left: 8px;
    }

    .day-summary {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-muted);
        font-weight: 600;
    }

    .day-summary .divider {
        opacity: 0.6;
    }

    .schedule-body {
        display: flex;
        gap: 12px;
        align-items: stretch;
    }

    .time-axis {
        width: 70px;
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .axis-row {
        height: 48px;
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
        padding-right: 8px;
        box-sizing: border-box;
        color: var(--text-muted);
        font-size: 0.85em;
    }

    .schedule-canvas {
        position: relative;
        flex: 1;
        min-height: 1152px;
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 10px;
        overflow: hidden;
    }

    .hour-line {
        position: absolute;
        left: 0;
        right: 0;
        height: 1px;
        background: var(--background-modifier-border);
        pointer-events: none;
    }

    .now-line {
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--text-accent);
        display: flex;
        align-items: center;
        color: var(--text-accent);
        font-size: 0.75em;
        font-weight: 700;
        pointer-events: none;
    }

    .now-line span {
        background: var(--background-secondary);
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 6px;
    }

    .time-block {
        position: absolute;
        left: 10px;
        right: 10px;
        border-radius: 8px;
        color: white;
        padding: 10px;
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.15);
        box-sizing: border-box;
        overflow: hidden;
        display: flex;
        align-items: center;
    }

    .time-block::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
            135deg,
            rgba(0, 0, 0, 0.1),
            rgba(255, 255, 255, 0.1)
        );
        pointer-events: none;
    }

    .block-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
    }

    .block-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
    }

    .block-icon {
        font-size: 1.2em;
    }

    .block-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .block-times {
        font-size: 0.9em;
        opacity: 0.95;
    }

    .block-duration {
        font-size: 0.85em;
        opacity: 0.9;
        font-weight: 600;
    }

    button {
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        padding: 6px 10px;
        background: var(--background-secondary);
        color: var(--text-normal);
        cursor: pointer;
        font-weight: 600;
    }

    button.solid {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border-color: var(--interactive-accent);
    }

    button.ghost {
        background: transparent;
    }

    button:hover {
        filter: brightness(1.05);
    }

    @media (max-width: 700px) {
        .schedule-body {
            flex-direction: column;
        }

        .time-axis {
            flex-direction: row;
            overflow-x: auto;
            width: 100%;
        }

        .axis-row {
            height: auto;
            padding: 4px;
        }

        .schedule-canvas {
            min-height: 900px;
        }

        .empty-state {
            left: 12px;
            right: 12px;
        }
    }

    .empty-state {
        position: absolute;
        top: 40%;
        left: 0;
        right: 0;
        text-align: center;
        color: var(--text-muted);
        font-style: italic;
        pointer-events: none;
    }
</style>

