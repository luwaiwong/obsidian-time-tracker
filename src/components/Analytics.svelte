<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import type TimeTrackerPlugin from "../../main";
	import {
		formatDuration,
		getProjectDuration,
		getTimeRange,
	} from "../utils/timeUtils";
	import { Chart, registerables } from "chart.js";
	import "../../styles.css";

	interface Props {
		plugin: TimeTrackerPlugin;
	}

	let { plugin }: Props = $props();

	Chart.register(...registerables);

	let timeRange: "day" | "week" | "month" | "year" | "custom" = $state("week");
	let currentDate = $state(new Date());
	let customStartDate = $state(new Date());
	let customEndDate = $state(new Date());
	let showArchived = $state(false);

	let pieChartCanvas: HTMLCanvasElement | undefined = $state();
	let lineChartCanvas: HTMLCanvasElement | undefined = $state();
	let pieChart: Chart | null = null;
	let lineChart: Chart | null = null;

	onMount(() => {
		timeRange = plugin.settings.defaultTimeRange;
		customStartDate = new Date(plugin.settings.customStartDate);
		customEndDate = new Date(plugin.settings.customEndDate);
	});

	onDestroy(() => {
		pieChart?.destroy();
		lineChart?.destroy();
	});

	let dateRange = $derived.by(() => {
		if (timeRange === "custom") {
			return {
				start: customStartDate.getTime(),
				end: customEndDate.getTime(),
			};
		}
		return getTimeRange(timeRange, currentDate);
	});

	let filteredProjects = $derived(
		showArchived
			? plugin.timesheetData.projects
			: plugin.timesheetData.projects.filter((p) => !p.archived),
	);

	let filteredCategories = $derived(
		showArchived
			? plugin.timesheetData.categories
			: plugin.timesheetData.categories.filter((c) => !c.archived),
	);

	let totalTime = $derived(
		filteredProjects.reduce(
			(total, project) =>
				total +
				getProjectDuration(
					project.id,
					plugin.timesheetData.records,
					dateRange.start,
					dateRange.end,
				),
			0,
		),
	);

	let pieChartData = $derived.by(() => {
		const projectData = filteredProjects
			.map((project) => ({
				label: project.name,
				value: getProjectDuration(
					project.id,
					plugin.timesheetData.records,
					dateRange.start,
					dateRange.end,
				),
				color: project.color,
				categoryId: project.categoryId ?? -1,
			}))
			.filter((d) => d.value > 0);

		// sort by category to group slices together
		const categoryOrder = new Map(filteredCategories.map((c, i) => [c.id, i]));
		projectData.sort((a, b) => {
			const orderA = categoryOrder.get(a.categoryId) ?? 999;
			const orderB = categoryOrder.get(b.categoryId) ?? 999;
			return orderA - orderB;
		});

		return projectData;
	});

	let lineChartData = $derived.by(() => {
		const { start, end } = dateRange;
		const buckets: Record<string, Record<number, number>> = {};

		// max duration per bucket: 1 hour for day view, 24 hours for others
		const maxMs = timeRange === "day" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

		// for day view, use hourly buckets; otherwise daily
		if (timeRange === "day") {
			for (let h = 0; h < 24; h++) {
				const key = `${h.toString().padStart(2, "0")}:00`;
				buckets[key] = {};
				for (const c of filteredCategories) {
					buckets[key][c.id] = 0;
				}
				buckets[key][-1] = 0;
			}
		} else {
			const startDate = new Date(start);
			const endDate = new Date(end);
			const dayCount = Math.ceil(
				(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
			);
			for (let i = 0; i <= dayCount; i++) {
				const d = new Date(startDate);
				d.setDate(startDate.getDate() + i);
				const key = d.toLocaleDateString();
				buckets[key] = {};
				for (const c of filteredCategories) {
					buckets[key][c.id] = 0;
				}
				buckets[key][-1] = 0;
			}
		}

		// aggregate records by category, splitting across buckets
		for (const record of plugin.timesheetData.records) {
			if (!record.endTime) continue;
			const recordEnd = record.endTime.getTime();
			const recordStart = record.startTime.getTime();
			if (recordEnd < start || recordStart > end) continue;

			const project = filteredProjects.find((p) => p.id === record.projectId);
			if (!project) continue;

			const categoryId = project.categoryId ?? -1;

			if (timeRange === "day") {
				// split record across hours it spans
				const startHour = new Date(Math.max(recordStart, start));
				const endHour = new Date(Math.min(recordEnd, end));

				for (let h = startHour.getHours(); h <= endHour.getHours(); h++) {
					const bucketStart = new Date(startHour);
					bucketStart.setHours(h, 0, 0, 0);
					const bucketEnd = new Date(startHour);
					bucketEnd.setHours(h + 1, 0, 0, 0);

					const overlapStart = Math.max(recordStart, bucketStart.getTime());
					const overlapEnd = Math.min(recordEnd, bucketEnd.getTime());
					const overlap = Math.max(0, overlapEnd - overlapStart);

					const key = `${h.toString().padStart(2, "0")}:00`;
					if (buckets[key]) {
						buckets[key][categoryId] = (buckets[key][categoryId] || 0) + overlap;
					}
				}
			} else {
				// split record across days it spans
				const startDay = new Date(Math.max(recordStart, start));
				startDay.setHours(0, 0, 0, 0);
				const endDay = new Date(Math.min(recordEnd, end));

				for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
					const bucketStart = new Date(d);
					bucketStart.setHours(0, 0, 0, 0);
					const bucketEnd = new Date(d);
					bucketEnd.setHours(23, 59, 59, 999);

					const overlapStart = Math.max(recordStart, bucketStart.getTime());
					const overlapEnd = Math.min(recordEnd, bucketEnd.getTime());
					const overlap = Math.max(0, overlapEnd - overlapStart);

					const key = d.toLocaleDateString();
					if (buckets[key]) {
						buckets[key][categoryId] = (buckets[key][categoryId] || 0) + overlap;
					}
				}
			}
		}

		const labels = Object.keys(buckets);

		// convert to percentages
		const datasets = filteredCategories.map((category) => ({
			label: category.name,
			data: labels.map(
				(label) => (buckets[label][category.id] / maxMs) * 100,
			),
			backgroundColor: category.color + "40",
			borderColor: category.color,
			tension: 0.3,
			fill: true,
		}));

		// add uncategorized if there's data
		const hasUncategorized = labels.some((l) => buckets[l][-1] > 0);
		if (hasUncategorized) {
			datasets.push({
				label: "Uncategorized",
				data: labels.map((label) => (buckets[label][-1] / maxMs) * 100),
				backgroundColor: "#88888840",
				borderColor: "#888888",
				tension: 0.3,
				fill: true,
			});
		}

		return { labels, datasets };
	});

	// update charts when data changes
	$effect(() => {
		if (!pieChartCanvas) return;
		const ctx = pieChartCanvas.getContext("2d");
		if (!ctx) return;

		pieChart?.destroy();
		const style = getComputedStyle(document.body);

		pieChart = new Chart(ctx, {
			type: "pie",
			data: {
				labels: pieChartData.map((d) => d.label),
				datasets: [
					{
						data: pieChartData.map((d) => d.value / 1000 / 60),
						backgroundColor: pieChartData.map((d) => d.color),
						borderWidth: 2,
						borderColor: "#fff",
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					legend: {
						position: "right",
						labels: {
							color: style.getPropertyValue("--text-normal"),
							font: { size: 12 },
						},
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const value = context.parsed;
								const total = context.dataset.data.reduce(
									(a: number, b: number) => a + b,
									0,
								);
								const pct = ((value / total) * 100).toFixed(1);
								return `${context.label}: ${formatDuration(value * 60 * 1000, true)} (${pct}%)`;
							},
						},
					},
				},
			},
		});
	});

	$effect(() => {
		if (!lineChartCanvas) return;
		const ctx = lineChartCanvas.getContext("2d");
		if (!ctx) return;

		lineChart?.destroy();
		const style = getComputedStyle(document.body);

		lineChart = new Chart(ctx, {
			type: "line",
			data: lineChartData,
			options: {
				responsive: true,
				maintainAspectRatio: true,
				interaction: { mode: "index", intersect: false },
				plugins: {
					legend: {
						position: "top",
						labels: {
							color: style.getPropertyValue("--text-normal"),
							font: { size: 12 },
						},
					},
					tooltip: {
						callbacks: {
							label: (context) =>
								`${context.dataset.label}: ${context.parsed.y?.toFixed(1) ?? "0"}%`,
						},
					},
				},
				scales: {
					y: {
						beginAtZero: true,
						max: 100,
						ticks: {
							color: style.getPropertyValue("--text-muted"),
							callback: (value) => `${value}%`,
						},
						grid: { color: style.getPropertyValue("--background-modifier-border") },
					},
					x: {
						ticks: { color: style.getPropertyValue("--text-muted") },
						grid: { color: style.getPropertyValue("--background-modifier-border") },
					},
				},
			},
		});
	});

	function shiftPeriod(direction: 1 | -1) {
		const d = new Date(currentDate);
		switch (timeRange) {
			case "day":
				d.setDate(d.getDate() + direction);
				break;
			case "week":
				d.setDate(d.getDate() + 7 * direction);
				break;
			case "month":
				d.setMonth(d.getMonth() + direction);
				break;
			case "year":
				d.setFullYear(d.getFullYear() + direction);
				break;
		}
		currentDate = d;
	}

	function formatDateForInput(date: Date): string {
		return date.toISOString().split("T")[0];
	}

	let dateRangeLabel = $derived.by(() => {
		const start = new Date(dateRange.start);
		const end = new Date(dateRange.end);
		const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
		if (start.getFullYear() !== end.getFullYear()) {
			return `${start.toLocaleDateString(undefined, { ...opts, year: "numeric" })} – ${end.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
		}
		if (start.getTime() === end.getTime() || timeRange === "day") {
			return start.toLocaleDateString(undefined, { ...opts, year: "numeric" });
		}
		return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
	});
</script>

<div class="p-6 h-full overflow-y-auto">
	<h3 class="m-0 mb-6 text-xl font-semibold">Time Analytics</h3>

	<!-- controls -->
	<div class="flex justify-between items-center mb-6 gap-4 flex-wrap">
		<div class="flex gap-3 items-center flex-wrap">
			<select
				bind:value={timeRange}
				class="px-3 py-2 border border-(--background-modifier-border) rounded bg-(--background-primary) text-(--text-normal)"
			>
				<option value="day">Day</option>
				<option value="week">Week</option>
				<option value="month">Month</option>
				<option value="year">Year</option>
				<option value="custom">Custom</option>
			</select>

			{#if timeRange !== "custom"}
				<div class="flex gap-1 items-center">
					<button
						onclick={() => shiftPeriod(-1)}
						class="px-2 py-1 border border-(--background-modifier-border) rounded bg-(--background-primary) text-(--text-normal) cursor-pointer hover:bg-(--background-modifier-hover)"
					>
						←
					</button>
					<button
						onclick={() => (currentDate = new Date())}
						class="px-3 py-1 border border-(--background-modifier-border) rounded bg-(--background-primary) text-(--text-normal) cursor-pointer hover:bg-(--background-modifier-hover) min-w-[140px]"
						title="Click to reset to today"
					>
						{dateRangeLabel}
					</button>
					<button
						onclick={() => shiftPeriod(1)}
						class="px-2 py-1 border border-(--background-modifier-border) rounded bg-(--background-primary) text-(--text-normal) cursor-pointer hover:bg-(--background-modifier-hover)"
					>
						→
					</button>
				</div>
			{:else}
				<div class="flex gap-2 items-center">
					<input
						type="date"
						value={formatDateForInput(customStartDate)}
						onchange={(e) =>
							(customStartDate = new Date(e.currentTarget.value))}
						class="px-2 py-2 border border-(--background-modifier-border) rounded bg-(--background-primary) text-(--text-normal)"
					/>
					<span class="text-(--text-muted)">to</span>
					<input
						type="date"
						value={formatDateForInput(customEndDate)}
						onchange={(e) =>
							(customEndDate = new Date(e.currentTarget.value))}
						class="px-2 py-2 border border-(--background-modifier-border) rounded bg-(--background-primary) text-(--text-normal)"
					/>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-4">
			<label class="flex items-center gap-2 cursor-pointer text-sm">
				<input type="checkbox" bind:checked={showArchived} />
				Show archived
			</label>
			<div class="px-4 py-2 bg-(--background-secondary) rounded">
				<strong>Total:</strong>
				{formatDuration(totalTime, false)}
			</div>
		</div>
	</div>

	<!-- charts -->
	<div class="grid gap-6" style="grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));">
		<div class="bg-(--background-secondary) p-5 rounded-lg">
			<h4 class="m-0 mb-4 font-medium">Time Distribution</h4>
			<canvas bind:this={pieChartCanvas} class="max-h-[400px]"></canvas>
		</div>

		<div class="bg-(--background-secondary) p-5 rounded-lg">
			<h4 class="m-0 mb-4 font-medium">Timeline</h4>
			<canvas bind:this={lineChartCanvas} class="max-h-[400px]"></canvas>
		</div>
	</div>
</div>
