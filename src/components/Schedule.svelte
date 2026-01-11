<script lang="ts">
	import type TimeTrackerPlugin from "../../main";
	import type { Project, TimeRecord } from "../types";
	import { formatNaturalDuration } from "../utils/timeUtils";
	import { icon } from "../utils/styleUtils";
	import { Calendar } from "@fullcalendar/core";
	import timeGridPlugin from "@fullcalendar/timegrid";
	import interactionPlugin from "@fullcalendar/interaction";
	import { onMount, onDestroy } from "svelte";
	import ICAL from "ical.js";
	import { IcsEventModal } from "../modals/IcsEventModal";

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

	// yield to main thread to prevent UI blocking
	function yieldToMain(): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, 0));
	}

	async function fetchIcsCalendars(force = false) {
		if (plugin.icsCache.fetched && !force) {
			return;
		}
		if (plugin.icsCache.loading) {
			return;
		}

		plugin.icsCache.loading = true;
		icsLoading = true;
		const events: any[] = [];

		for (const url of plugin.settings.icsCalendars) {
			if (!url) continue;
			try {
				const text = await plugin.fetchUrl(url);

				// yield before heavy parsing
				await yieldToMain();

				const jcalData = ICAL.parse(text);
				const comp = new ICAL.Component(jcalData);
				const vevents = comp.getAllSubcomponents("vevent");

				// process in chunks to avoid blocking UI
				// calendars can get large with >1000 events, processing all at once can cause lag
				const CHUNK_SIZE = 10;
				for (let i = 0; i < vevents.length; i += CHUNK_SIZE) {
					const chunk = vevents.slice(i, i + CHUNK_SIZE);
					for (const vevent of chunk) {
						const event = new ICAL.Event(vevent);
						const start = event.startDate?.toJSDate();
						const end = event.endDate?.toJSDate();
						if (!start) continue;

						const icsColor = event.color || "ffffff";

						events.push({
							id: `ics-${event.uid}`,
							title: event.summary || "Untitled",
							start,
							end: end || start,
							backgroundColor: "var(--background-secondary)",
							borderColor: icsColor,
							borderWidth: "3px",
							classNames: ["ics-event"],
							extendedProps: {
								isIcs: true,
								description: event.description || "",
								location: event.location || "",
								url: vevent.getFirstPropertyValue("url") || "",
								color: icsColor,
							},
						});
					}
					// yield between chunks
					if (i + CHUNK_SIZE < vevents.length) {
						await yieldToMain();
					}
				}
			} catch (err) {
				console.error("Failed to fetch ICS:", url, err);
			}
		}

		plugin.icsCache.events = events;
		plugin.icsCache.fetched = true;
		plugin.icsCache.loading = false;
		// update local state
		icsEvents = events;
		icsLoading = false;
	}

	function reloadIcsCalendars() {
		fetchIcsCalendars(true);
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
			events: [...buildCalendarEvents(), ...icsEvents],
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
			fetchIcsCalendars();
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
		<!-- <button
			class="p-2 rounded transition-colors shrink-0"
			aria-label="Reload calendars"
			onclick={reloadIcsCalendars}
			disabled={icsLoading}
			{@attach icon("refresh-cw")}
		></button> -->
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
