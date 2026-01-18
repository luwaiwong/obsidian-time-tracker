
import ICAL from "ical.js";
import TimeTrackerPlugin from "main";
import { Notice } from "obsidian";
import type { IcsCalendarEvent } from "../types";
import { yieldToMain } from "../utils/styleUtils";

export async function fetchIcsCalendars(plugin: TimeTrackerPlugin) {
	if (plugin.icsCache.loading) {
		return;
	}

	plugin.icsCache.loading = true;
	const events: IcsCalendarEvent[] = [];

	try {
		for (const url of plugin.settings.icsCalendars) {
			if (!url) continue;
			try {
				const text = await plugin.fetchUrl(url);

				// yield before heavy parsing
				await yieldToMain();

				const jcalData = ICAL.parse(text) as string;
				const comp = new ICAL.Component(jcalData );
				const calName = comp.getFirstPropertyValue("x-wr-calname") as string;
				let sourceName = "ICS";
				if (calName) {
					sourceName = calName;
				} else {
					// fallback to domain or filename
					try {
						const urlObj = new URL(url);
						if (urlObj.protocol === "file:") {
							const parts = urlObj.pathname.split("/");
							sourceName = parts[parts.length - 1].replace(".ics", "") || "Local ICS";
						} else {
							sourceName = urlObj.hostname.replace("www.", "");
						}
					} catch (e) {
						new Notice("Error fetching ICS calendars: " + e);
						sourceName = "ICS Calendar";
					}
				}

				const vevents = comp.getAllSubcomponents("vevent");

				// process in chunks to avoid blocking UI
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
								url: String(vevent.getFirstPropertyValue("url") || ""),
								color: icsColor,
								sourceName: sourceName,
							},
						});
					}
					// yield between chunks
					if (i + CHUNK_SIZE < vevents.length) {
						await yieldToMain();
					}
				}
			} catch (err) {
				new Notice("Error fetching ICS calendars: " + err);
			}
		}

		new Notice(`Fetched ${events.length} ICS events`);
		plugin.icsCache.events = events;
		plugin.icsCache.fetched = true;
	} finally {
		plugin.icsCache.loading = false;
	}
}