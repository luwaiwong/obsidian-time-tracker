
import ICAL from "ical.js";
import TimeTrackerPlugin from "main";
import { Notice } from "obsidian";
import { yieldToMain } from "./styleUtils";

	export async function fetchIcsCalendars(plugin: TimeTrackerPlugin) {
		if (plugin.icsCache.loading) {
			return;
		}

		plugin.icsCache.loading = true;
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
							backgroundColor: "var(--background-primary-alt)",
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
		// notice
		new Notice(`Fetched ${events.length} ICS events`);

		plugin.icsCache.events = events;
		plugin.icsCache.fetched = true;
		plugin.icsCache.loading = false;
	}