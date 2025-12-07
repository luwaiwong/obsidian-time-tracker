import { pathToFileURL } from "url";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import * as builtins from "builtin-modules";
import { PluginOption, defineConfig } from "vite";

const DEV_DIRECTORY = "../../.md/";

const setOutDir = (mode: string) => {
	switch (mode) {
		case "development":
			return `${DEV_DIRECTORY}.obsidian/plugins/obsidian-time-tracker`;
		case "production":
			return "build";
	}
};

export default defineConfig(({ mode }) => {
	return {
		plugins: [
			svelte({ preprocess: vitePreprocess() }) as PluginOption,
		],
		build: {
			lib: {
				entry: "main.ts",
				formats: ["cjs"],
			},
			rollupOptions: {
				output: {
					entryFileNames: "main.js",
					assetFileNames: "styles.css",
					sourcemapBaseUrl: pathToFileURL(
						`${__dirname}`,
					).toString(),
				},
				external: [
					"obsidian",
					"electron",
					"@codemirror/autocomplete",
					"@codemirror/collab",
					"@codemirror/commands",
					"@codemirror/language",
					"@codemirror/lint",
					"@codemirror/search",
					"@codemirror/state",
					"@codemirror/view",
					"@lezer/common",
					"@lezer/highlight",
					"@lezer/lr",
					...builtins,
				],
			},
			outDir: setOutDir(mode),
			emptyOutDir: false,
			sourcemap: true,
			// sourcemap: "inline",
		},
	};
});