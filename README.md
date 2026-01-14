# Time Tracker for Obsidian

A **fully-featured**, time tracking plugin built into Obsidian. Track your work, analyze your productivity, and block out your time, all built in.

Big thanks to the Simple Time Tracker Android App, this plugin was greatly inspired by it.

![Obsidian](https://img.shields.io/badge/Obsidian-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte_5-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

---

## Features

### Time Tracking
- Create projects with custom icons and colors
- Organize projects in categories
- One-click start/stop from sidebar

### Analytics
- Pie charts by project or category
- Timeline graphs over time
- Filter by day, week, month, year, or custom range

### Schedule View
- Daily calendar view of tracked time, using [Full Calendar](https://github.com/fullcalendar/fullcalendar)
- ICS calendar integration (Google Calendar, etc.)
- Timeblocking, right in your sidebar

### Tracking Modes
- **Standard** - Click to start, click to stop
- **Retroactive** - Fills time gaps when switching projects

### Data

All data are stored as CSV files *in your vault*
- Auto-backup every 3 hours
- Conflict resolution for sync issues
- Import from Simple Time Tracker
- Mobile support

### Commands
| Command | Description |
|---------|-------------|
| Open Time Tracker | Open sidebar |
| Open Analytics | Open analytics |
| Toggle Last Used Timer | Start/stop last project |
| View Backups | Browse backups |
| Resolve Conflicts | Fix sync conflicts |
| Import from Simple Time Tracker | Import STT data |

---

## Installation

### BRAT
1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Add beta plugin: `https://github.com/luwaiwong/obsidian-time-tracker`
3. Enable in settings

### Manual
1. Download from [Releases](https://github.com/luwaiwong/obsidian-time-tracker/releases)
2. Extract to `{vault}/.obsidian/plugins/time-tracker/`
3. Enable in settings

---

## Development

```bash
git clone git@github.com:luwaiwong/obsidian-time-tracker.git
cd obsidian-time-tracker
npm install
```

Set `DEV_DIRECTORY` in `vite.config.ts` to your test vault.

```bash
npm run dev      # watch mode
npm run build    # production build
npm run check    # type check
npm run lint     # lint
npm run format   # format
```

---

## Support

[![Ko-fi](https://img.shields.io/badge/Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/luwai)

---

## License

GPL-3.0 © [Lu-Wai Wong](https://github.com/luwaiwong)
