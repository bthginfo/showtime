import fs from "node:fs";
import path from "node:path";
const functions = path.resolve(".vercel/output/functions");
const consumerDirectory = path.join(functions, "api/events/consume.func");
const original = fs.realpathSync(consumerDirectory);
if (!original.startsWith(functions + path.sep))
  throw new Error("Consumer bundle must stay inside build output");
// Queues invoke the physical function pathname. The adapter's alias otherwise
// delivers /![-]/1 to SvelteKit, which has no such route. Give the consumer its
// own physical path and point the generated routes at that private function.
if (fs.lstatSync(consumerDirectory).isSymbolicLink()) {
  const originalConfig = path.join(original, ".vc-config.json");
  const originalMetadata = JSON.parse(fs.readFileSync(originalConfig, "utf8"));
  delete originalMetadata.experimentalTriggers;
  fs.writeFileSync(originalConfig, JSON.stringify(originalMetadata, null, 2));
  if (process.platform === "win32") fs.rmdirSync(consumerDirectory);
  else fs.unlinkSync(consumerDirectory);
  fs.cpSync(original, consumerDirectory, { recursive: true, dereference: true });
  const routingFile = ".vercel/output/config.json",
    routing = JSON.parse(fs.readFileSync(routingFile, "utf8"));
  const originalDestination =
    "/" +
    path
      .relative(functions, original)
      .replaceAll(path.sep, "/")
      .replace(/\.func$/, "");
  for (const entry of routing.routes)
    if (entry.dest === originalDestination) entry.dest = "/api/events/consume";
  fs.writeFileSync(routingFile, JSON.stringify(routing, null, 2));
}
const consumer = path.join(consumerDirectory, ".vc-config.json");
if (!fs.existsSync(consumer))
  throw new Error("Queue consumer function missing; split route must be enabled");
const config = JSON.parse(fs.readFileSync(consumer, "utf8"));
config.experimentalTriggers = [
  {
    type: "queue/v2beta",
    topic: "showtime-domain-events",
    consumer: "showtime-business-v1",
    retryAfterSeconds: 30,
  },
];
fs.writeFileSync(consumer, JSON.stringify(config, null, 2));
console.log("Queue trigger configured for the separate SvelteKit consumer function.");
// Fonts and the local portrait model use runtime filesystem access and must be shipped.
const roots = new Set();
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.name.endsWith(".func")) roots.add(fs.realpathSync(file));
    else if (entry.isDirectory()) visit(file);
  }
}
visit(".vercel/output/functions");
let fontBundles = 0;
for (const root of roots) {
  // NFT may retain a common-ancestor prefix such as vercel/path0. Find the
  // actual package location instead of assuming node_modules is at the root.
  const projects = new Set([root]);
  function findProjects(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(directory, entry.name);
      if (entry.name === "node_modules") projects.add(directory);
      else if (![".svelte-kit", "src"].includes(entry.name)) findProjects(child);
    }
  }
  findProjects(root);
  for (const project of projects) {
    for (const directory of ["src/modules/exports/assets", "src/modules/files/assets"])
      fs.cpSync(directory, path.join(project, directory), { recursive: true });
    // PDFKit selects built-in fonts through computed require() paths, which
    // file tracing cannot infer. Include the modules and their shared chunks.
    const pdfkit = path.join(project, "node_modules/pdfkit");
    if (fs.existsSync(pdfkit)) {
      fs.cpSync("node_modules/pdfkit/js/standard-fonts", path.join(pdfkit, "js/standard-fonts"), {
        recursive: true,
      });
      fontBundles++;
    }
  }
}
if (!fontBundles) throw new Error("No traced PDFKit package found in function bundles");
console.log(
  `Runtime assets included; dynamic PDFKit fonts copied into ${fontBundles} function bundles.`,
);
