import { App, Modal } from "obsidian";

interface IcsEventData {
	title: string;
	start: Date | null;
	end: Date | null;
	description: string;
	location: string;
	url: string;
	color: string;
	sourceName?: string;
}

export class IcsEventModal extends Modal {
	private data: IcsEventData;

	constructor(app: App, data: IcsEventData) {
		super(app);
		this.data = data;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("ics-event-modal");
		modalEl.setCssProps({ maxWidth: "400px" });

		// color bar at top
		const colorBar = contentEl.createDiv();
		colorBar.setCssProps({
			height: "6px",
			backgroundColor: this.data.color || "#6b7280",
			marginBottom: "16px",
			borderRadius: "3px",
		});

		// source name
		if (this.data.sourceName) {
			const sourceEl = contentEl.createDiv();
			sourceEl.setCssProps({
				fontSize: "0.75em",
				color: "var(--text-muted)",
				marginBottom: "4px",
				textTransform: "uppercase",
				letterSpacing: "0.05em",
			});
			sourceEl.setText(this.data.sourceName);
		}

		// title
		const titleEl = contentEl.createEl("h2", { text: this.data.title });
		titleEl.setCssProps({ marginTop: "0", marginBottom: "12px" });

		// time
		if (this.data.start) {
			const timeEl = contentEl.createDiv();
			timeEl.setCssProps({ marginBottom: "8px", color: "var(--text-muted)" });
			const startStr = this.data.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			const endStr = this.data.end?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			const dateStr = this.data.start.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
			timeEl.setText(`📅 ${dateStr} · ${startStr}${endStr ? ` - ${endStr}` : ""}`);
		}

		// location
		if (this.data.location) {
			const locEl = contentEl.createDiv();
			locEl.setCssProps({ marginBottom: "8px", color: "var(--text-muted)" });
			locEl.setText(`📍 ${this.data.location}`);
		}

		// description
		if (this.data.description) {
			const descEl = contentEl.createDiv();
			descEl.setCssProps({
				marginTop: "12px",
				padding: "12px",
				backgroundColor: "var(--background-secondary)",
				borderRadius: "6px",
				whiteSpace: "pre-wrap",
			});
			descEl.setText(this.data.description);
		}

		// link
		if (this.data.url) {
			const linkContainer = contentEl.createDiv();
			linkContainer.setCssProps({ marginTop: "16px" });
			const linkEl = linkContainer.createEl("a", {
				text: "🔗 Open link",
				href: this.data.url,
			});
			linkEl.setCssProps({ color: "var(--interactive-accent)" });
			linkEl.setAttr("target", "_blank");
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
