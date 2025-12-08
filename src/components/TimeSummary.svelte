<script lang="ts">
import { onMount, onDestroy } from "svelte";
import type TimeTrackerPlugin from "../../main";
import type { Project } from "../types";
import { formatDuration, getProjectDuration } from "../utils";
import { Chart, registerables } from "chart.js";

interface Props {
	plugin: TimeTrackerPlugin;
}

let { plugin }: Props = $props();

Chart.register(...registerables);

let currentTime = $state(Date.now());
let interval: number | undefined;
let pieChartCanvas: HTMLCanvasElement | undefined = $state();
let pieChart: Chart | null = null;

function getRecentRecordsCount(): number {
	return plugin.settings.embeddedRecentLogsCount || 3;
}

let recentRecordsCount = $derived(getRecentRecordsCount());

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
	updatePieChart();
});

onDestroy(() => {
	if (pieChart) pieChart.destroy();
});

$effect(() => {
	if (pieChartCanvas) {
		updatePieChart();
	}
});

function updatePieChart() {
	if (!pieChartCanvas) return;

	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date();
	endOfDay.setHours(23, 59, 59, 999);

	const data = plugin.timesheetData.projects
		.map((project) => ({
			label: project.name,
			value: getProjectDuration(
				project.id,
				plugin.timesheetData.records,
				startOfDay.getTime(),
				endOfDay.getTime(),
			),
			color: project.color,
		}))
		.filter((d) => d.value > 0);

	if (pieChart) {
		pieChart.destroy();
	}

	const ctx = pieChartCanvas.getContext("2d");
	if (!ctx) return;

	pieChart = new Chart(ctx, {
		type: "doughnut",
		data: {
			labels: data.map((d) => d.label),
			datasets: [
				{
					data: data.map((d) => d.value / 1000 / 60),
					backgroundColor: data.map((d) => d.color),
					borderWidth: 2,
					borderColor: getComputedStyle(document.body).getPropertyValue(
						"--background-primary",
					),
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						label: (context) => {
							const label = context.label || "";
							const value = context.parsed;
							return `${label}: ${formatDuration(value * 60 * 1000, false)}`;
						},
					},
				},
			},
		},
	});
}

function getProject(projectId: number): Project | undefined {
	return plugin.timesheetData.projects.find((p) => p.id === projectId);
}

function getRunningDuration(projectId: number): number {
	const timer = plugin.runningTimers.find((t) => t.projectId === projectId);
	if (!timer) return 0;
	return currentTime - timer.startTime;
}

function getLastStoppedTime(): number | null {
	const lastRecord = plugin.getLastStoppedRecord();
	return lastRecord ? lastRecord.endTime : null;
}

function getTimeSinceLastRecord(): number {
	const lastTime = getLastStoppedTime();
	if (!lastTime) return 0;
	return currentTime - lastTime;
}

function formatRecordTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

let recentRecords = $derived(
	plugin.timesheetData.records
		.slice()
		.sort((a, b) => b.endTime - a.endTime)
		.slice(0, recentRecordsCount),
);

let totalToday = $derived.by(() => {
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date();
	endOfDay.setHours(23, 59, 59, 999);

	return plugin.timesheetData.projects.reduce((total, project) => {
		return (
			total +
			getProjectDuration(
				project.id,
				plugin.timesheetData.records,
				startOfDay.getTime(),
				endOfDay.getTime(),
			)
		);
	}, 0);
});
</script>

<div class="time-tracker-summary">
    <!-- Running Timers Section -->
    {#if plugin.runningTimers.length > 0}
        <div class="summary-section running-timers-section">
            <h5>Currently Tracking</h5>
            {#each plugin.runningTimers as timer (timer.projectId)}
                {#if getProject(timer.projectId)}
                    <div
                        class="running-timer-item"
                        style="border-left: 4px solid {getProject(
                            timer.projectId,
                        )?.color};"
                    >
                        <div class="timer-info">
                            <div class="timer-project">
                                <span class="timer-icon"
                                    >{getProject(timer.projectId)?.icon}</span
                                >
                                <span class="timer-name"
                                    >{getProject(timer.projectId)?.name}</span
                                >
                            </div>
                            <div class="timer-duration pulsing">
                                {formatDuration(
                                    getRunningDuration(timer.projectId),
                                    true,
                                )}
                            </div>
                        </div>
                        <div class="timer-indicator">●</div>
                    </div>
                {/if}
            {/each}
        </div>
    {/if}

    <!-- Retroactive Timer Indicator -->
    {#if plugin.settings.retroactiveTrackingEnabled && plugin.runningTimers.length === 0 && getLastStoppedTime()}
        <div class="summary-section retroactive-section">
            <h5>Time Since Last Record</h5>
            <div class="retroactive-timer">
                <div class="retroactive-duration">
                    {formatDuration(getTimeSinceLastRecord(), true)}
                </div>
                <div class="retroactive-hint">
                    Will be assigned to next project
                </div>
            </div>
        </div>
    {/if}

    <!-- Today's Time Distribution -->
    <div class="summary-section chart-section">
        <h5>Today's Distribution</h5>
        {#if totalToday > 0}
            <div class="chart-container">
                <canvas bind:this={pieChartCanvas}></canvas>
            </div>
            <div class="total-time">
                Total: {formatDuration(totalToday, true)}
            </div>
        {:else}
            <div class="empty-chart">
                <p>No time tracked today</p>
            </div>
        {/if}
    </div>

    <!-- Recent Time Blocks -->
    <div class="summary-section recent-section">
        <h5>Recent Activity</h5>
        {#if recentRecords.length > 0}
            <div class="recent-records">
                {#each recentRecords as record (record.id)}
                    {#if getProject(record.projectId)}
                        <div class="recent-record-item">
                            <div
                                class="record-color"
                                style="background-color: {getProject(
                                    record.projectId,
                                )?.color};"
                            ></div>
                            <div class="record-info">
                                <div class="record-project">
                                    <span
                                        >{getProject(record.projectId)
                                            ?.icon}</span
                                    >
                                    <span
                                        >{getProject(record.projectId)
                                            ?.name}</span
                                    >
                                </div>
                                <div class="record-time">
                                    {formatRecordTime(record.startTime)}
                                </div>
                            </div>
                            <div class="record-duration">
                                {formatDuration(
                                    record.endTime - record.startTime,
                                    true,
                                )}
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>
        {:else}
            <div class="empty-records">
                <p>No recent activity</p>
            </div>
        {/if}
    </div>
</div>

<style>
    .time-tracker-summary {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .summary-section {
        background-color: var(--background-secondary);
        border-radius: 8px;
        padding: 12px;
    }

    .summary-section h5 {
        margin: 0 0 12px 0;
        font-size: 0.9em;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .running-timer-item {
        display: flex;
        align-items: center;
        padding: 12px;
        background-color: var(--background-primary);
        border-radius: 6px;
        margin-bottom: 8px;
        border-left-width: 4px;
        border-left-style: solid;
    }

    .running-timer-item:last-child {
        margin-bottom: 0;
    }

    .timer-info {
        flex: 1;
    }

    .timer-project {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
    }

    .timer-icon {
        font-size: 1.2em;
    }

    .timer-name {
        font-weight: 600;
    }

    .timer-duration {
        font-size: 1.1em;
        font-weight: 700;
        color: var(--text-accent);
        font-variant-numeric: tabular-nums;
    }

    .timer-duration.pulsing {
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

    .timer-indicator {
        color: var(--text-error);
        font-size: 1.5em;
        animation: blink 1.5s ease-in-out infinite;
        margin-left: 8px;
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

    .retroactive-section {
        background-color: var(--background-secondary-alt);
        border: 1px dashed var(--background-modifier-border);
    }

    .retroactive-timer {
        text-align: center;
        padding: 8px;
    }

    .retroactive-duration {
        font-size: 1.3em;
        font-weight: 700;
        color: var(--text-warning);
        margin-bottom: 4px;
        font-variant-numeric: tabular-nums;
    }

    .retroactive-hint {
        font-size: 0.8em;
        color: var(--text-muted);
        font-style: italic;
    }

    .chart-container {
        max-width: 200px;
        margin: 0 auto 12px auto;
    }

    .total-time {
        text-align: center;
        font-size: 1.1em;
        font-weight: 600;
        color: var(--text-normal);
    }

    .empty-chart {
        text-align: center;
        padding: 20px;
        color: var(--text-muted);
        font-style: italic;
    }

    .recent-records {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .recent-record-item {
        display: flex;
        align-items: center;
        padding: 8px;
        background-color: var(--background-primary);
        border-radius: 4px;
        gap: 8px;
    }

    .record-color {
        width: 4px;
        height: 32px;
        border-radius: 2px;
        flex-shrink: 0;
    }

    .record-info {
        flex: 1;
        min-width: 0;
    }

    .record-project {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .record-time {
        font-size: 0.8em;
        color: var(--text-muted);
    }

    .record-duration {
        font-weight: 600;
        color: var(--text-muted);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }

    .empty-records {
        text-align: center;
        padding: 20px;
        color: var(--text-muted);
        font-style: italic;
    }
</style>
