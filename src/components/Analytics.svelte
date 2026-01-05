<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import type TimeTrackerPlugin from "../../main";
	import type { Project } from "../types";
	import {
		formatDuration,
		getProjectDuration,
		getTimeRange,
		formatDate,
	} from "../utils/timeUtils";
	import { Chart, registerables } from "chart.js";

	interface Props {
		plugin: TimeTrackerPlugin;
	}

	let { plugin }: Props = $props();

	Chart.register(...registerables);

	let timeRange: "day" | "week" | "month" | "year" | "custom" =
		$state("week");
	let currentDate = $state(new Date());
	let customStartDate = $state(new Date());
	let customEndDate = $state(new Date());
	let selectedProjects: number[] = $state([]);
	let selectedCategories: number[] = $state([]);

	let pieChartCanvas: HTMLCanvasElement | undefined = $state();
	let lineChartCanvas: HTMLCanvasElement | undefined = $state();
	let pieChart: Chart | null = null;
	let lineChart: Chart | null = null;

	onMount(() => {
		timeRange = plugin.settings.defaultTimeRange;
		customStartDate = new Date(plugin.settings.customStartDate);
		customEndDate = new Date(plugin.settings.customEndDate);
		updateCharts();
	});

	$effect(() => {
		if (pieChartCanvas && lineChartCanvas) {
			updateCharts();
		}
	});

	onDestroy(() => {
		if (pieChart) pieChart.destroy();
		if (lineChart) lineChart.destroy();
	});

	function updateCharts() {
		const { start, end } = getDateRange();
		const filteredProjects = getFilteredProjects();

		updatePieChart(filteredProjects, start, end);
		updateLineChart(filteredProjects, start, end);
	}

	function getDateRange(): { start: number; end: number } {
		if (timeRange === "custom") {
			return {
				start: customStartDate.getTime(),
				end: customEndDate.getTime(),
			};
		}
		return getTimeRange(timeRange, currentDate);
	}

	function getFilteredProjects(): Project[] {
		let projects = plugin.timesheetData.projects;

		if (selectedProjects.length > 0) {
			projects = projects.filter((p) => selectedProjects.includes(p.id));
		}

		if (selectedCategories.length > 0) {
			projects = projects.filter((p) =>
				selectedCategories.includes(p.categoryId),
			);
		}

		return projects;
	}

	function updatePieChart(projects: Project[], start: number, end: number) {
		const data = projects
			.map((project) => ({
				label: project.name,
				value: getProjectDuration(
					project.id,
					plugin.timesheetData.records,
					start,
					end,
				),
				color: project.color,
			}))
			.filter((d) => d.value > 0);

		if (pieChart) {
			pieChart.destroy();
		}

		if (!pieChartCanvas) return;
		const ctx = pieChartCanvas.getContext("2d");
		if (!ctx) return;

		pieChart = new Chart(ctx, {
			type: "pie",
			data: {
				labels: data.map((d) => d.label),
				datasets: [
					{
						data: data.map((d) => d.value / 1000 / 60),
						backgroundColor: data.map((d) => d.color),
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
							color: getComputedStyle(
								document.body,
							).getPropertyValue("--text-normal"),
							font: { size: 12 },
						},
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const label = context.label || "";
								const value = context.parsed;
								const total = context.dataset.data.reduce(
									(a: number, b: number) => a + b,
									0,
								);
								const percentage = (
									(value / total) *
									100
								).toFixed(1);
								return `${label}: ${formatDuration(value * 60 * 1000, true)} (${percentage}%)`;
							},
						},
					},
				},
			},
		});
	}

	function updateLineChart(projects: Project[], start: number, end: number) {
		const days: { [key: string]: { [projectId: number]: number } } = {};

		const startDate = new Date(start);
		const endDate = new Date(end);

		for (
			let d = new Date(startDate);
			d <= endDate;
			d.setDate(d.getDate() + 1)
		) {
			const key = formatDate(d.getTime());
			days[key] = {};
			projects.forEach((p) => {
				days[key][p.id] = 0;
			});
		}

		plugin.timesheetData.records.forEach((record) => {
			if (record.endTime === null) return;
			const recordEnd = record.endTime.getTime();
			const recordStart = record.startTime.getTime();
			if (recordEnd < start || recordStart > end) return;

			const project = plugin.getProjectById(record.projectId);
			if (!project || !projects.some((p) => p.id === project.id)) return;

			const recordDate = new Date(recordStart);
			const key = formatDate(recordDate.getTime());

			if (days[key]) {
				const duration = recordEnd - recordStart;
				days[key][project.id] = (days[key][project.id] || 0) + duration;
			}
		});

		const labels = Object.keys(days);
		const datasets = projects.map((project) => ({
			label: project.name,
			data: labels.map(
				(label) => days[label][project.id] / 1000 / 60 / 60,
			),
			borderColor: project.color,
			backgroundColor: project.color + "40",
			tension: 0.3,
			fill: true,
		}));

		if (lineChart) {
			lineChart.destroy();
		}

		if (!lineChartCanvas) return;
		const ctx = lineChartCanvas.getContext("2d");
		if (!ctx) return;

		lineChart = new Chart(ctx, {
			type: "line",
			data: { labels, datasets },
			options: {
				responsive: true,
				maintainAspectRatio: true,
				interaction: { mode: "index", intersect: false },
				plugins: {
					legend: {
						position: "top",
						labels: {
							color: getComputedStyle(
								document.body,
							).getPropertyValue("--text-normal"),
							font: { size: 12 },
						},
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const label = context.dataset.label || "";
								const value = context.parsed.y;
								return `${label}: ${value?.toFixed(2) ?? "0.00"}h`;
							},
						},
					},
				},
				scales: {
					y: {
						beginAtZero: true,
						stacked: false,
						ticks: {
							color: getComputedStyle(
								document.body,
							).getPropertyValue("--text-muted"),
						},
						grid: {
							color: getComputedStyle(
								document.body,
							).getPropertyValue("--background-modifier-border"),
						},
					},
					x: {
						ticks: {
							color: getComputedStyle(
								document.body,
							).getPropertyValue("--text-muted"),
						},
						grid: {
							color: getComputedStyle(
								document.body,
							).getPropertyValue("--background-modifier-border"),
						},
					},
				},
			},
		});
	}

	function previousPeriod() {
		switch (timeRange) {
			case "day":
				currentDate.setDate(currentDate.getDate() - 1);
				break;
			case "week":
				currentDate.setDate(currentDate.getDate() - 7);
				break;
			case "month":
				currentDate.setMonth(currentDate.getMonth() - 1);
				break;
			case "year":
				currentDate.setFullYear(currentDate.getFullYear() - 1);
				break;
		}
		currentDate = new Date(currentDate);
		updateCharts();
	}

	function nextPeriod() {
		switch (timeRange) {
			case "day":
				currentDate.setDate(currentDate.getDate() + 1);
				break;
			case "week":
				currentDate.setDate(currentDate.getDate() + 7);
				break;
			case "month":
				currentDate.setMonth(currentDate.getMonth() + 1);
				break;
			case "year":
				currentDate.setFullYear(currentDate.getFullYear() + 1);
				break;
		}
		currentDate = new Date(currentDate);
		updateCharts();
	}

	function today() {
		currentDate = new Date();
		updateCharts();
	}

	function toggleProject(projectId: number) {
		const index = selectedProjects.indexOf(projectId);
		if (index > -1) {
			selectedProjects.splice(index, 1);
		} else {
			selectedProjects.push(projectId);
		}
		selectedProjects = [...selectedProjects];
		updateCharts();
	}

	function toggleCategory(categoryId: number) {
		const index = selectedCategories.indexOf(categoryId);
		if (index > -1) {
			selectedCategories.splice(index, 1);
		} else {
			selectedCategories.push(categoryId);
		}
		selectedCategories = [...selectedCategories];
		updateCharts();
	}

	let totalTime = $derived.by(() => {
		const { start, end } = getDateRange();
		const projects = getFilteredProjects();
		return projects.reduce((total, project) => {
			return (
				total +
				getProjectDuration(
					project.name,
					plugin.timesheetData.records,
					start,
					end,
				)
			);
		}, 0);
	});

	function handleTimeRangeChange() {
		updateCharts();
	}

	function handleCustomStartChange(e: Event) {
		const target = e.target as HTMLInputElement;
		customStartDate = new Date(target.value);
		updateCharts();
	}

	function handleCustomEndChange(e: Event) {
		const target = e.target as HTMLInputElement;
		customEndDate = new Date(target.value);
		updateCharts();
	}

	function formatDateForInput(date: Date): string {
		return date.toISOString().split("T")[0];
	}
</script>

<div class="analytics-container">
	<div class="analytics-header">
		<h3>Time Analytics</h3>
	</div>

	<div class="analytics-controls">
		<div class="time-range-selector">
			<select bind:value={timeRange} onchange={handleTimeRangeChange}>
				<option value="day">Day</option>
				<option value="week">Week</option>
				<option value="month">Month</option>
				<option value="year">Year</option>
				<option value="custom">Custom</option>
			</select>

			{#if timeRange !== "custom"}
				<div class="time-navigation">
					<button onclick={previousPeriod}>←</button>
					<button onclick={today}>Today</button>
					<button onclick={nextPeriod}>→</button>
				</div>
			{:else}
				<div class="custom-range">
					<input
						type="date"
						value={formatDateForInput(customStartDate)}
						onchange={handleCustomStartChange}
					/>
					<span>to</span>
					<input
						type="date"
						value={formatDateForInput(customEndDate)}
						onchange={handleCustomEndChange}
					/>
				</div>
			{/if}
		</div>

		<div class="total-time">
			<strong>Total:</strong>
			{formatDuration(totalTime, false)}
		</div>
	</div>

	<div class="filters">
		<details>
			<summary>Filter by Projects</summary>
			<div class="filter-list">
				{#each plugin.timesheetData.projects as project (project.id)}
					<label>
						<input
							type="checkbox"
							checked={selectedProjects.includes(project.id)}
							onchange={() => toggleProject(project.id)}
						/>
						{project.icon}
						{project.name}
					</label>
				{/each}
			</div>
		</details>

		<details>
			<summary>Filter by Categories</summary>
			<div class="filter-list">
				{#each plugin.timesheetData.categories as category (category.id)}
					<label>
						<input
							type="checkbox"
							checked={selectedCategories.includes(category.id)}
							onchange={() => toggleCategory(category.id)}
						/>
						{category.name}
					</label>
				{/each}
			</div>
		</details>
	</div>

	<div class="charts">
		<div class="chart-container">
			<h4>Time Distribution</h4>
			<canvas bind:this={pieChartCanvas}></canvas>
		</div>

		<div class="chart-container">
			<h4>Timeline</h4>
			<canvas bind:this={lineChartCanvas}></canvas>
		</div>
	</div>
</div>

<style>
	.analytics-container {
		padding: 24px;
		height: 100%;
		overflow-y: auto;
	}

	.analytics-header h3 {
		margin: 0 0 24px 0;
	}

	.analytics-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
		gap: 16px;
		flex-wrap: wrap;
	}

	.time-range-selector {
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
	}

	.time-range-selector select {
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background-color: var(--background-primary);
		color: var(--text-normal);
	}

	.time-navigation {
		display: flex;
		gap: 8px;
	}

	.time-navigation button {
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background-color: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
	}

	.time-navigation button:hover {
		background-color: var(--background-modifier-hover);
	}

	.custom-range {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.custom-range input {
		padding: 8px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background-color: var(--background-primary);
		color: var(--text-normal);
	}

	.total-time {
		padding: 8px 16px;
		background-color: var(--background-secondary);
		border-radius: 4px;
	}

	.filters {
		margin-bottom: 24px;
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
	}

	.filters details {
		background-color: var(--background-secondary);
		padding: 12px;
		border-radius: 4px;
		min-width: 200px;
	}

	.filters summary {
		cursor: pointer;
		font-weight: 600;
		margin-bottom: 8px;
	}

	.filter-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 12px;
	}

	.filter-list label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.charts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
		gap: 24px;
	}

	.chart-container {
		background-color: var(--background-secondary);
		padding: 20px;
		border-radius: 8px;
	}

	.chart-container h4 {
		margin: 0 0 16px 0;
	}

	canvas {
		max-height: 400px;
	}
</style>
