<script lang="ts">
	import type TimeTrackerPlugin from "../../main";
	import type { Project, TimeRecord } from "../types";
	import { formatNaturalDuration } from "../utils/timeUtils";
	import { icon, yieldToMain } from "../utils/styleUtils";
	import { Calendar } from "@fullcalendar/core";
	import timeGridPlugin from "@fullcalendar/timegrid";
	import interactionPlugin from "@fullcalendar/interaction";
	import { onMount, onDestroy } from "svelte";
	import ICAL from "ical.js";
	import { IcsEventModal } from "../modals/IcsEventModal";
	import { Notice } from "obsidian";
	import { fetchIcsCalendars } from "../utils/icsHandler";

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

	let icsEvents = $state<any[]>([]);
	let icsLoading = $state(false);
	let zoomLevel = $state(plugin.settings.scheduleZoom);

	const ZOOM_LEVELS = [15, 30, 60, 120];

	$effect(() => {
		icsEvents = plugin.icsCache.events;
		icsLoading = !plugin.icsCache.fetched && plugin.icsCache.loading;
	});

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

	function zoomIn() {
		const idx = ZOOM_LEVELS.indexOf(zoomLevel);
		if (idx > 0) {
			zoomLevel = ZOOM_LEVELS[idx - 1];
			applyZoom();
		}
	}

	function zoomOut() {
		const idx = ZOOM_LEVELS.indexOf(zoomLevel);
		if (idx < ZOOM_LEVELS.length - 1) {
			zoomLevel = ZOOM_LEVELS[idx + 1];
			applyZoom();
		}
	}

	function applyZoom() {
		if (calendar) {
			const duration = `${String(Math.floor(zoomLevel / 60)).padStart(2, "0")}:${String(zoomLevel % 60).padStart(2, "0")}:00`;
			calendar.setOption("slotDuration", duration);
			calendar.setOption("slotLabelInterval", duration);
		}
		plugin.settings.scheduleZoom = zoomLevel;
		plugin.saveSettings();
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


	async function fetchIcsEvents(force = false) {
		if (plugin.icsCache.fetched && !force) {
			return;
		}
		icsLoading = true;
		
		await fetchIcsCalendars(plugin);

		icsEvents = plugin.icsCache.events;
		icsLoading = false;
	}

	function reloadIcsCalendars() {
		fetchIcsEvents(true);
	}

	async function updateCalendarEvents() {
		if (!calendar) return;
		const trackerEvents = buildCalendarEvents();
		const allEvents = [...trackerEvents, ...icsEvents];
		const currentEvents = calendar.getEvents();

		// more efficient lookups
		const allEventsMap = new Map(allEvents.map((e) => [e.id, e]));
		const currentEventsMap = new Map(currentEvents.map((e) => [e.id, e]));

		// collect events to add
		const eventsToAdd: any[] = [];
		for (const newEvent of allEvents) {
			const existing = currentEventsMap.get(newEvent.id);
			if (existing) {
				if (newEvent.extendedProps?.isRunning) {
					existing.setEnd(newEvent.end);
				}
			} else {
				eventsToAdd.push(newEvent);
			}
		}

		// add events in chunks to avoid blocking UI
		// calendars can get large with >1000 events, adding causes lag
		const CHUNK_SIZE = 10;
		for (let i = 0; i < eventsToAdd.length; i += CHUNK_SIZE) {
			const chunk = eventsToAdd.slice(i, i + CHUNK_SIZE);
			for (const event of chunk) {
				calendar.addEvent(event);
			}
			if (i + CHUNK_SIZE < eventsToAdd.length) {
				await yieldToMain();
			}
		}

		// remove events that no longer exist
		for (const existing of currentEvents) {
			if (!allEventsMap.has(existing.id)) {
				existing.remove();
			}
		}
	}

	let resizeObserver: ResizeObserver | null = null;

	function getCurrentScrollTime(): string {
		const now = new Date();
		const hours = now.getHours();
		// scroll to current time, clamped to 23:00
		const scrollHour = Math.max(0, hours - 4);
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
			slotDuration: `${String(Math.floor(zoomLevel / 60)).padStart(2, "0")}:${String(zoomLevel % 60).padStart(2, "0")}:00`,
			slotLabelInterval: `${String(Math.floor(zoomLevel / 60)).padStart(2, "0")}:${String(zoomLevel % 60).padStart(2, "0")}:00`,
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
			dayHeaderFormat: {
				weekday: "long",
				month: "long",
				day: "numeric",
				year: "numeric",
			},
			eventMinHeight: 0,
			eventShortHeight: 100000,
			events: [...buildCalendarEvents(), ...icsEvents],
			dateClick(arg) {
				console.log("Date clicked:", arg.date);
			},
			eventClick: (info) => {
				const props = info.event.extendedProps;
				if (props?.isIcs) {
					new IcsEventModal(plugin.app, {
						title: info.event.title,
						start: info.event.start,
						end: info.event.end,
						description: props.description,
						location: props.location,
						url: props.url,
						color: props.color,
					}).open();
				} else if (props?.project && props?.record) {
					onEditRecord(props.record, props.project);
				}
			},
			eventContent: (arg) => {
				const props = arg.event.extendedProps;
				let duration = props?.duration || null;

				// calculate duration if not provided
				if (duration == null) {
					const start = arg.event.start;
					const end = arg.event.end;
					if (start && end) {
						duration = end.getTime() - start.getTime();
					} else {
						duration = 0;
					}
				}

				// ics events
				if (props?.isIcs) {
					if (duration != 0 && duration < 60 * 60 * 1000) {
						return {
							html: `
								<div class="flex flex-row gap-1 justify-start items-center p-0 pl-1 w-full h-full overflow-hidden whitespace-nowrap"
								style="flex-direction: row;">
									<div class="font-bold text-sm shrink-0">${arg.event.title}:</div>
									<div class="text-sm opacity-95 truncate">${arg.timeText}</div>
								</div>
							`,
						};
					}

					return {
						html: `
							<div class="flex flex-column gap-0.5 justify-start items-start p-0 pl-1 w-full h-full"
							style="flex-direction: column;">
								<div class="font-bold text-sm">${arg.event.title} </div>
								<div class="text-sm opacity-95">${arg.timeText}</div>
							</div>
						`,
					};
				} else; {
					// time tracker events under 30 minutes
					if (duration < 30 * 60 * 1000) {
						return {
							html: `<div class="flex flex-col gap-0.5"></div>`,
						};
					}

					// time tracker events under 1.5 hours
					if (duration < 90 * 60 * 1000) {
						return {
							html: `
								<div class="flex flex-row gap-1 justify-start items-center p-0 w-full"
								style="padding: 0;">
									<div class="font-bold text-sm">${arg.event.title}: </div>
									<div class="text-sm opacity-95">${formatNaturalDuration(duration)}</div>
								</div>
							`,
						};
					}
					// time tracker events over 1.5 hours
					return {
						html: `
							<div class="flex flex-column justify-start items-center p-0 w-full"
							style="flex-direction: column; align-items: flex-start;">
								<div class="font-bold text-sm">${arg.event.title} </div>
								<div class="text-sm opacity-95">${formatNaturalDuration(duration)}</div>
								<div class="text-sm opacity-95">${arg.timeText}</div>
							</div>
						`,
					};
				}

			},
		});
		calendar.render();

		// restore scroll position if available
		if (plugin.scheduleState.scrollTop > 0) {
			const scroller = calendarEl.querySelector(".fc-scroller-liquid-absolute");
			if (scroller) {
				scroller.scrollTop = plugin.scheduleState.scrollTop;
			}
		}

		// fetch ICS if not already cached (events already included in initial render if cached)
		if (!plugin.icsCache.fetched) {
			fetchIcsEvents();
		}

		// watch for container resize to update calendar dimensions
		resizeObserver = new ResizeObserver(() => {
			if (calendar) {
				calendar.updateSize();
			}
		});
		resizeObserver.observe(calendarEl);
	});

	onDestroy(() => {
		// save scroll position before destroy
		const scroller = calendarEl?.querySelector(".fc-scroller-liquid-absolute");
		if (scroller) {
			plugin.scheduleState.scrollTop = scroller.scrollTop;
		}

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
		// track dependencies
		projects;
		records;
		selectedDate;
		icsEvents;
		updateCalendarEvents();
	});
</script>

<div class="flex flex-col gap-3 h-full w-full p-3 box-border overflow-hidden">
	<div class="flex justify-between items-center gap-1 w-full">
		<div class="flex justify-start items-center gap-2">	
			<button
				class="shrink-0"
				style="
					background-color: transparent;
					border: none;
					padding: 0;
					margin: 0;
					cursor: pointer;

				"
				aria-label="Zoom out"
				onclick={zoomOut}
				disabled={ZOOM_LEVELS.indexOf(zoomLevel) === ZOOM_LEVELS.length - 1}
				{@attach icon("zoom-out")}
			></button>
			<button
				class="bg-transparent shrink-0"
				aria-label="Zoom in"
				style="
					background-color: transparent;
					border: none;
					padding: 0;
					margin: 0;
					cursor: pointer;

				"
				onclick={zoomIn}
				disabled={ZOOM_LEVELS.indexOf(zoomLevel) === 0}
				{@attach icon("zoom-in")}
			></button>
		</div>
		<div class=" flex justify-center items-center gap-2">
			<button
				class="border border-(--background-modifier-border) rounded-md px-2 py-1 bg-transparent text-(--text-normal) cursor-pointer font-semibold hover:brightness-105"
				onclick={() => moveDay(-1)}
			>
				‹
			</button>
			<button
				class="bg-transparent shrink-0"
				onclick={setToday}
				aria-label="Go to today"
				{@attach icon("calendar-check")}
			></button>
			<button
				class="border border-(--background-modifier-border) rounded-md px-2 py-1 bg-transparent text-(--text-normal) cursor-pointer font-semibold hover:brightness-105"
				onclick={() => moveDay(1)}
			>
				›
			</button>
		</div>
		<div class="flex justify-end items-center gap-2">	
			<button
				class="bg-transparent shrink-0"
				style="
					background-color: transparent;
					border: none;
					padding: 0;
					margin: 0;
					cursor: pointer;

				"
				aria-label="Open Analytics"
				onclick={onOpenAnalytics}
				{@attach icon("bar-chart-2")}
			></button>
		<button
			class="bg-transparent shrink-0"
			style="
				background-color: transparent;
				border: none;
				padding: 0;
				margin: 0;
				cursor: pointer;

			"
			aria-label="Open Settings"
			onclick={onOpenSettings}
			{@attach icon("settings")}
		></button>
		</div>
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
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	/* ics calendar events */
	:global(.fc .fc-event.ics-event) {
		opacity: 0.9;
		box-shadow: none;
		padding: 0 !important;
		overflow: hidden;
	}

	:global(.fc .fc-event.ics-event:hover) {
		opacity: 1;
	}

	:global(.ics-event-content) {
		display: flex;
		height: 100%;
		overflow: hidden;
	}

	:global(.ics-color-bar) {
		width: 4px;
		flex-shrink: 0;
	}

	:global(.ics-event-info) {
		display: flex;
		flex-direction: column;
		padding: 4px 8px;
		overflow: hidden;
		min-width: 0;
	}

	/* hide details only when FC marks it as short */
	:global(.fc .fc-timegrid-event.fc-timegrid-event-short .fc-my-event__meta) {
		display: none;
	}
</style>
