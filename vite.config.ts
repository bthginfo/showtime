import { defineConfig, loadEnv } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-vercel";
import tailwind from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [
      tailwind(),
      sveltekit({
        adapter: adapter({ runtime: "nodejs24.x", regions: ["fra1"], maxDuration: 120 }),
        alias: { "@": resolve("src") },
      }),
      {
        name: "showtime-workspace-chunks",
        apply: "build",
        enforce: "post",
        config(config) {
          if (config.build?.ssr) return;
          return {
            build: {
              rolldownOptions: {
                output: {
                  // Preserve browser module initialization when splitting the workspace.
                  strictExecutionOrder: true,
                  codeSplitting: {
                    groups: [
                      { name: "vendor", test: /[\\/]node_modules[\\/]/, minSize: 20000, maxSize: 400000, priority: 10 },
                      { name: "workspace", test: /[\\/]src[\\/]/, minSize: 20000, maxSize: 400000, priority: 5 },
                    ],
                  },
                },
              },
            },
          };
        },
      },
    ],
    server: {
      watch: {
        ignored: ["**/.local/**", "**/test-results/**", "**/playwright-report/**", "**/.vercel/**"],
      },
      fs: { allow: [resolve(".")] },
    },
  };
});
