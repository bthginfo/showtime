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
    ],
    server: {
      watch: {
        ignored: ["**/.local/**", "**/test-results/**", "**/playwright-report/**", "**/.vercel/**"],
      },
      fs: { allow: [resolve(".")] },
    },
  };
});
