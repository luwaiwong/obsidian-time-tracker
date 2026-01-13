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
		modalEl.style.maxWidth = "400px";

		// color bar at top
		const colorBar = contentEl.createDiv();
		colorBar.style.height = "6px";
		colorBar.style.backgroundColor = this.data.color || "#6b7280";
		colorBar.style.marginBottom = "16px";
		colorBar.style.borderRadius = "3px";

		// source name
		if (this.data.sourceName) {
			const sourceEl = contentEl.createDiv();
			sourceEl.style.fontSize = "0.75em";
			sourceEl.style.color = "var(--text-muted)";
			sourceEl.style.marginBottom = "4px";
			sourceEl.style.textTransform = "uppercase";
			sourceEl.style.letterSpacing = "0.05em";
			sourceEl.setText(this.data.sourceName);
		}

		// title
		const titleEl = contentEl.createEl("h2", { text: this.data.title });
		titleEl.style.marginTop = "0";
		titleEl.style.marginBottom = "12px";

		// time
		if (this.data.start) {
			const timeEl = contentEl.createDiv();
			timeEl.style.marginBottom = "8px";
			timeEl.style.color = "var(--text-muted)";
			const startStr = this.data.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			const endStr = this.data.end?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			const dateStr = this.data.start.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
			timeEl.setText(`📅 ${dateStr} · ${startStr}${endStr ? ` - ${endStr}` : ""}`);
		}

		// location
		if (this.data.location) {
			const locEl = contentEl.createDiv();
			locEl.style.marginBottom = "8px";
			locEl.style.color = "var(--text-muted)";
			locEl.setText(`📍 ${this.data.location}`);
		}

		// description
		if (this.data.description) {
			const descEl = contentEl.createDiv();
			descEl.style.marginTop = "12px";
			descEl.style.padding = "12px";
			descEl.style.backgroundColor = "var(--background-secondary)";
			descEl.style.borderRadius = "6px";
			descEl.style.whiteSpace = "pre-wrap";
			descEl.setText(this.data.description);
		}

		// link
		if (this.data.url) {
			const linkContainer = contentEl.createDiv();
			linkContainer.style.marginTop = "16px";
			const linkEl = linkContainer.createEl("a", {
				text: "🔗 Open link",
				href: this.data.url,
			});
			linkEl.style.color = "var(--interactive-accent)";
			linkEl.setAttr("target", "_blank");
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
