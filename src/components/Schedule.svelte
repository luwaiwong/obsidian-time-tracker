<script lang="ts">
	import type TimeTrackerPlugin from "../../main";
	import type { Project, TimeRecord } from "../types";
	import { formatDuration } from "../utils/timeUtils";
	import { icon } from "../utils/styleUtils";
	import { Calendar } from "@fullcalendar/core";
	import timeGridPlugin from "@fullcalendar/timegrid";
	import interactionPlugin from "@fullcalendar/interaction";
	import { onMount, onDestroy } from "svelte";

	interface Props {
		plugin: TimeTrackerPlugin;
		onOpenAnalytics: () => void;
		onOpenSettings: () => void;
		onEditRecord: (record: TimeRecord, project: Project) => void;
	}

	let { plugin, onOpenAnalytics, onOpenSettings, onEditRecord }: Props =
		$props();

	let calendarEl: HTMLDivElement;
	let calendar: Calendar | null = null;
	let selectedDate = $state(new Date());
	let now = $state(Date.now());
	let interval: number | undefined;
	let projects = $derived(plugin.timesheetData?.projects ?? []);
	let records = $derived(plugin.timesheetData?.records ?? []);

	$effect(() => {
		if (interval) clearInterval(interval);
		interval = window.setInterval(() => {
			now = Date.now();
			updateCalendarEvents();
		}, 1000 * 30);

		return () => {
			if (interval) clearInterval(interval);
		};
	});

	function moveDay(delta: number) {
		const next = new Date(selectedDate);
		next.setDate(next.getDate() + delta);
		selectedDate = next;
		if (calendar) {
			calendar.gotoDate(next);
		}
	}

	function setToday() {
		selectedDate = new Date();
		if (calendar) {
			calendar.gotoDate(selectedDate);
		}
	}

	function getDayRange(date: Date) {
		const start = new Date(date);
		start.setHours(0, 0, 0, 0);
		const end = new Date(date);
		end.setHours(23, 59, 59, 999);
		return { start: start.getTime(), end: end.getTime() };
	}

	function buildCalendarEvents() {
		const events: any[] = [];
		const { start, end } = getDayRange(selectedDate);

		// Process completed records
		for (const record of records) {
			if (record.endTime === null) continue;
			const recordStart = record.startTime.getTime();
			const recordEnd = record.endTime.getTime();
			if (recordEnd < start || recordStart > end) continue;

			const project = plugin.getProjectById(record.projectId);
			if (!project) continue;

			const clampedStart = Math.max(recordStart, start);
			const clampedEnd = Math.min(recordEnd, end);

			events.push({
				id: `${record.id}`,
				title: `${project.icon} ${project.name}`,
				start: new Date(clampedStart),
				end: new Date(clampedEnd),
				backgroundColor: project.color,
				borderColor: "grey",
				extendedProps: {
					project,
					duration: clampedEnd - clampedStart,
					isRunning: false,
					record: record,
				},
			});
		}

		// Process running timers
		for (const timer of plugin.runningTimers || []) {
			const timerStart = timer.startTime.getTime();
			if (timerStart > end) continue;

			const project = plugin.getProjectById(timer.projectId);
			if (!project) continue;

			const clampedStart = Math.max(timerStart, start);
			const clampedEnd = Math.min(now, end);

			events.push({
				id: `running-${timer.projectId}`,
				title: `${project.icon} ${project.name} (Running)`,
				start: new Date(clampedStart),
				end: new Date(clampedEnd),
				backgroundColor: project.color,
				borderColor: project.color,
				extendedProps: {
					project,
					duration: clampedEnd - clampedStart,
					isRunning: true,
					record: timer,
				},
			});
		}

		return events;
	}

	function updateCalendarEvents() {
		if (!calendar) return;
		const newEvents = buildCalendarEvents();
		const currentEvents = calendar.getEvents();

		for (const newEvent of newEvents) {
			const existing = currentEvents.find((e) => e.id === newEvent.id);
			if (existing) {
				// update end time for running timers
				if (newEvent.extendedProps?.isRunning) {
					existing.setEnd(newEvent.end);
				}
			} else {
				calendar.addEvent(newEvent);
			}
		}

		// remove events that no longer exist
		for (const existing of currentEvents) {
			if (!newEvents.find((e) => e.id === existing.id)) {
				existing.remove();
			}
		}
	}

	let totalDayDuration = $derived.by(() => {
		const events = buildCalendarEvents();
		return events.reduce(
			(total, event) => total + (event.extendedProps?.duration || 0),
			0,
		);
	});

	let blockCount = $derived(buildCalendarEvents().length);

	let selectedDateLabel = $derived(
		selectedDate.toLocaleDateString(undefined, {
			weekday: "long",
			month: "short",
			day: "numeric",
		}),
	);

	let resizeObserver: ResizeObserver | null = null;

	function getCurrentScrollTime(): string {
		const now = new Date();
		const hours = now.getHours();
		// scroll to 3 hours after current time, clamped to 23:00
		const scrollHour = Math.min(23, hours + 3);
		return `${String(scrollHour).padStart(2, "0")}:00:00`;
	}

	onMount(() => {
		calendar = new Calendar(calendarEl, {
			plugins: [timeGridPlugin, interactionPlugin],
			initialView: "timeGridDay",
			initialDate: selectedDate,
			headerToolbar: false,
			height: "100%",
			slotMinTime: "00:00:00",
			slotMaxTime: "24:00:00",
			slotDuration: "01:00:00",
			slotLabelInterval: "01:00:00",
			allDaySlot: false,
			nowIndicator: true,
			scrollTime: getCurrentScrollTime(),
			slotLabelFormat: {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			},
			eventTimeFormat: {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			},
			eventMinHeight: 0,
			eventShortHeight: 100000,
			events: buildCalendarEvents(),
			eventClick: (info) => {
				if (
					info.event.extendedProps?.project &&
					info.event.extendedProps?.record
				) {
					onEditRecord(
						info.event.extendedProps.record,
						info.event.extendedProps.project,
					);
				}
			},
			eventContent: (arg) => {
				const duration = arg.event.extendedProps?.duration || 0;
				const isRunning = arg.event.extendedProps?.isRunning || false;

				// if duration under 30 min, just show color
				if (duration < 30 * 60 * 1000) {
					return {
						html: `
							<div class="fc-event-main-container flex flex-col gap-0.5">
							</div>
						`,
					};
				} else {
					return {
						html: `
							<div class="fc-event-main-container flex flex-col gap-0.5 justify-center">
								<div class="font-bold text-sm">${arg.event.title}</div>
								<div class="text-xs opacity-95">
									${arg.timeText}
								</div>
							</div>
						`,
					};
				}
			},
		});

		calendar.render();

		// Watch for container resize to update calendar dimensions
		resizeObserver = new ResizeObserver(() => {
			if (calendar) {
				calendar.updateSize();
			}
		});
		resizeObserver.observe(calendarEl);
	});

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
		if (calendar) {
			calendar.destroy();
		}
		if (interval) {
			clearInterval(interval);
		}
	});

	// Update events when data changes
	$effect(() => {
		// Watch for changes in projects, records, or selectedDate
		projects;
		records;
		selectedDate;
		updateCalendarEvents();
	});
</script>

<div class="flex flex-col gap-3 h-full p-3 box-border overflow-hidden">
	<div class="flex items-center gap-2 shrink-0 w-full">
		<button
			class="border border-(--background-modifier-border) rounded-md px-2.5 py-1.5 bg-transparent text-(--text-normal) cursor-pointer font-semibold hover:brightness-105"
			onclick={() => moveDay(-1)}
		>
			‹
		</button>
		<button
			class="flex-1 border border-(--interactive-accent) rounded-md px-2.5 py-1.5 bg-(--interactive-accent) text-(--text-on-accent) cursor-pointer font-semibold hover:brightness-105"
			onclick={setToday}
		>
			{selectedDateLabel}
		</button>
		<button
			class="p-2 rounded transition-colors shrink-0"
			aria-label="Open Analytics"
			onclick={onOpenAnalytics}
			{@attach icon("bar-chart-2")}
		></button>
		<button
			class="p-2 rounded transition-colors shrink-0"
			aria-label="Open Settings"
			onclick={onOpenSettings}
			{@attach icon("settings")}
		></button>
		<button
			class="border border-(--background-modifier-border) rounded-md px-2.5 py-1.5 bg-transparent text-(--text-normal) cursor-pointer font-semibold hover:brightness-105"
			onclick={() => moveDay(1)}
		>
			›
		</button>
	</div>

	<div class="flex-1 min-h-0 overflow-auto" bind:this={calendarEl}></div>
</div>

<style>
	/* FullCalendar customization */
	:global(.fc) {
		height: 100%;
		font-family: var(--font-interface);
	}

	:global(.fc .fc-timegrid-slot) {
		height: 48px;
	}

	:global(.fc .fc-timegrid-slot-label) {
		color: var(--text-muted);
		font-size: 0.85em;
	}

	:global(.fc .fc-timegrid-divider) {
		display: none;
	}

	:global(.fc .fc-scrollgrid) {
		border-color: var(--background-modifier-border);
	}

	:global(.fc .fc-scrollgrid td) {
		border-color: var(--background-modifier-border);
	}

	:global(.fc .fc-timegrid-axis) {
		background: var(--background-primary);
	}

	:global(.fc .fc-timegrid-slot-lane) {
		background: var(--background-secondary);
	}

	:global(.fc .fc-col-header-cell) {
		background: var(--background-primary);
		color: var(--text-normal);
		font-weight: 600;
	}

	:global(.fc .fc-event) {
		border-radius: 6px;
		padding: 4px 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	/* hide details only when FC marks it as short */
	:global(.fc .fc-timegrid-event.fc-timegrid-event-short .fc-my-event__meta) {
		display: none;
	}
</style>
