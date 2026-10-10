/** Windows directory junctions do not require Developer Mode; cloud builds use normal symlinks. */
import fs from "node:fs";
const file = "node_modules/@sveltejs/adapter-vercel/index.js";
if (!fs.existsSync(file)) process.exit(0);
let source = fs.readFileSync(file, "utf8");
if (source.includes("function showtimeSymlink(")) process.exit(0);
source = source.replaceAll("fs.symlinkSync(", "showtimeSymlink(");
source += `\nfunction showtimeSymlink(target,dest,type){if(process.platform==='win32'&&type!=='file'){fs.symlinkSync(path.resolve(path.dirname(dest),target),dest,'junction');}else{fs.symlinkSync(target,dest,type);}}\n`;
fs.writeFileSync(file, source);
