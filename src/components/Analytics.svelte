<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import type TimeTrackerPlugin from "../../main";
	import {
		formatDuration,
		formatNaturalDuration,
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
	let showByCategory = $state(false);
	let filterProjectIds: number[] = $state([]);
	let filterCategoryIds: number[] = $state([]);
	let showCategoryDropdown = $state(false);
	let showProjectDropdown = $state(false);

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

	let allProjects = $derived(
		showArchived
			? plugin.timesheetData.projects
			: plugin.timesheetData.projects.filter((p) => !p.archived),
	);

	let allCategories = $derived(
		showArchived
			? plugin.timesheetData.categories
			: plugin.timesheetData.categories.filter((c) => !c.archived),
	);

	let filteredProjects = $derived.by(() => {
		let projects = allProjects;
		if (filterProjectIds.length > 0) {
			projects = projects.filter((p) => filterProjectIds.includes(p.id));
		}
		if (filterCategoryIds.length > 0) {
			projects = projects.filter((p) => p.categoryId !== undefined && filterCategoryIds.includes(p.categoryId));
		}
		return projects;
	});

	let filteredCategories = $derived.by(() => {
		if (filterCategoryIds.length > 0) {
			return allCategories.filter((c) => filterCategoryIds.includes(c.id));
		}
		return allCategories;
	});

	function toggleCategoryFilter(id: number) {
		if (filterCategoryIds.includes(id)) {
			filterCategoryIds = filterCategoryIds.filter((i) => i !== id);
		} else {
			filterCategoryIds = [...filterCategoryIds, id];
		}
	}

	function toggleProjectFilter(id: number) {
		if (filterProjectIds.includes(id)) {
			filterProjectIds = filterProjectIds.filter((i) => i !== id);
		} else {
			filterProjectIds = [...filterProjectIds, id];
		}
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest(".relative")) {
			showCategoryDropdown = false;
			showProjectDropdown = false;
		}
	}

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
		if (showByCategory) {
			// aggregate by category
			const categoryTotals = new Map<number, number>();
			for (const project of filteredProjects) {
				const duration = getProjectDuration(
					project.id,
					plugin.timesheetData.records,
					dateRange.start,
					dateRange.end,
				);
				if (duration > 0) {
					const catId = project.categoryId ?? -1;
					categoryTotals.set(catId, (categoryTotals.get(catId) ?? 0) + duration);
				}
			}

			const result: { label: string; value: number; color: string }[] = [];
			for (const category of filteredCategories) {
				const value = categoryTotals.get(category.id) ?? 0;
				if (value > 0) {
					result.push({ label: category.name, value, color: category.color });
				}
			}
			// add uncategorized
			const uncategorized = categoryTotals.get(-1) ?? 0;
			if (uncategorized > 0) {
				result.push({ label: "Uncategorized", value: uncategorized, color: "#888888" });
			}
			return result;
		}

		// show by project
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
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: "bottom",
						labels: {
							color: style.getPropertyValue("--text-normal"),
							font: { size: 11 },
							boxWidth: 12,
							padding: 8,
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
				maintainAspectRatio: false,
				interaction: { mode: "index", intersect: false },
				plugins: {
					legend: {
						position: "bottom",
						labels: {
							color: style.getPropertyValue("--text-normal"),
							font: { size: 11 },
							boxWidth: 12,
							padding: 8,
						},
					},
					tooltip: {
						itemSort: (a, b) => (b.parsed.y ?? 0) - (a.parsed.y ?? 0),
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

<svelte:window onclick={handleClickOutside} />

<div class="p-4 h-full overflow-y-auto">
	<!-- <h3 class="m-0 mb-4 text-xl font-semibold">Analytics</h3> -->

	<!-- controls -->
	<div class="flex flex-col gap-2 mb-4 w-full">
		<div class="flex justify-between items-center gap-2 flex-wrap text-sm w-full">
			<select
				bind:value={timeRange}
			>
				<option value="day">By Day</option>
				<option value="week">By Week</option>
				<option value="month">By Month</option>
				<option value="year">By Year</option>
				<option value="custom">Custom</option>
			</select>

			{#if timeRange !== "custom"}
				<div class="flex gap-1 items-center">
					<button
						onclick={() => shiftPeriod(-1)}
					>
						←
					</button>
					<button
						onclick={() => (currentDate = new Date())}
						title="Click to reset to today"
					>
						{dateRangeLabel}
					</button>
					<button
						onclick={() => shiftPeriod(1)}
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
					/>
					<span class="text-(--text-muted)">to</span>
					<input
						type="date"
						value={formatDateForInput(customEndDate)}
						onchange={(e) =>
							(customEndDate = new Date(e.currentTarget.value))}
					/>
				</div>
			{/if}

			<div class="px-2 py-1 bg-(--background-secondary) rounded">
				<strong>Total:</strong> {formatDuration(totalTime, false)}
			</div>
		</div>

		<!-- line -->
		 <hr style="margin: 0; padding: 0; margin-bottom: 8px; margin-top: 8px">

		<!-- filters row -->
		<div class="flex justify-start gap-2 items-center flex-wrap text-sm">
			<!-- category multi-select -->
			<div class="relative">
				<button
					onclick={() => { showCategoryDropdown = !showCategoryDropdown; showProjectDropdown = false; }}
					class="px-2 py-1 border border-(--background-modifier-border) rounded bg-(--background-primary) text-(--text-normal) cursor-pointer hover:bg-(--background-modifier-hover) min-w-[120px] text-left"
				>
					{filterCategoryIds.length === 0 ? "All categories" : `${filterCategoryIds.length} selected`}
				</button>
				{#if showCategoryDropdown}
					<div class="absolute top-full left-0 mt-1 bg-(--background-primary) border border-(--background-modifier-border) rounded shadow-lg z-10 min-w-[160px] max-h-[400px] overflow-y-auto">
						<button
							onclick={() => { filterCategoryIds = []; }}
							class="w-full px-3 py-1.5 text-left hover:bg-(--background-modifier-hover) text-(--text-muted)"
						>
							Clear all
						</button>
						{#each allCategories as category}
							<label class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-(--background-modifier-hover)">
								<input
									type="checkbox"
									checked={filterCategoryIds.includes(category.id)}
									onchange={() => toggleCategoryFilter(category.id)}
								/>
								<span class="w-2 h-2 rounded-full" style="background-color: {category.color}"></span>
								{category.name}
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<!-- project multi-select -->
			<div class="relative">
				<button
					onclick={() => { showProjectDropdown = !showProjectDropdown; showCategoryDropdown = false; }}
					class="px-2 py-1 border border-(--background-modifier-border) rounded  text-(--text-normal) cursor-pointer hover:bg-(--background-modifier-hover) min-w-[120px] text-left"
				>
					{filterProjectIds.length === 0 ? "All projects" : `${filterProjectIds.length} selected`}
				</button>
				{#if showProjectDropdown}
					<div class="absolute top-full left-0 mt-1 bg-(--background-primary) border border-(--background-modifier-border) rounded shadow-lg z-10 min-w-[160px] max-h-[400px] overflow-y-auto">
						<button
							onclick={() => { filterProjectIds = []; }}
							class="w-full px-3 py-1.5 text-left hover:bg-(--background-modifier-hover) text-(--text-muted)"
						>
							Clear all
						</button>
						{#each allProjects as project}
							<label class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-(--background-modifier-hover)">
								<input
									type="checkbox"
									checked={filterProjectIds.includes(project.id)}
									onchange={() => toggleProjectFilter(project.id)}
								/>
								<span class="w-2 h-2 rounded-full" style="background-color: {project.color}"></span>
								{project.name}
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<label class="flex items-center gap-2 px-2 py-1 bg-(--background-secondary) rounded-sm hover:bg-(--background-modifier-hover)">
				<input type="checkbox" bind:checked={showArchived} />
				Show archived
			</label>
		</div>
	</div>

	<!-- charts -->
	<div class="grid gap-4 w-full" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));">
		<div class="bg-(--background-secondary) p-4 pt-0 rounded-lg overflow-hidden">
			<div class="flex justify-between items-center mb-2">
				<h4 class="m-0 font-medium">Distribution</h4>
				<label class="flex items-center gap-2 cursor-pointer text-sm">
					<input type="checkbox" bind:checked={showByCategory} />
					By category
				</label>
			</div>
			<div class="h-[300px] w-full">
				<canvas bind:this={pieChartCanvas}></canvas>
			</div>
			<!-- list of projects sorted by duration -->
			<div class="flex justify-start flex-col items-start gap-2 pt-4">
				{#each 
					filteredProjects.sort(
						(a, b) => getProjectDuration(b.id, plugin.timesheetData.records, dateRange.start, dateRange.end) - getProjectDuration(a.id, plugin.timesheetData.records, dateRange.start, dateRange.end)) as project}
					{#if getProjectDuration(project.id, plugin.timesheetData.records, dateRange.start, dateRange.end) > 0}
						<div class="flex items-center w-full p-2 rounded-lg gap-2" style="background-color: {project.color}">
							<p class="text-md font-bold">
								{project.name}:
							</p>
							<p class="text-md">
								{formatNaturalDuration(getProjectDuration(project.id, plugin.timesheetData.records, dateRange.start, dateRange.end))}
							</p>
						</div>
					{/if}
				{/each}
			</div>

		</div>

		<div class="bg-(--background-secondary) p-4 pt-0 rounded-lg overflow-hidden">
			<h4 class="m-0 mb-2 font-medium">Timeline</h4>
			<div class="min-h-[250px] w-full">
				<canvas bind:this={lineChartCanvas}></canvas>
			</div>
		</div>
	</div>
</div>
