import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const data = path.join(root, "firmware", "data");

if (!existsSync(path.join(dist, "index.html"))) {
  throw new Error("dist/index.html is missing. Run the Vite production build first.");
}

mkdirSync(data, { recursive: true });
for (const entry of readdirSync(data)) {
  if (entry !== ".gitattributes") {
    rmSync(path.join(data, entry), { recursive: true, force: true });
  }
}
cpSync(dist, data, { recursive: true });

let totalBytes = 0;
function measure(directory) {
  for (const entry of readdirSync(directory)) {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) measure(entryPath);
    else totalBytes += stats.size;
  }
}
measure(data);

console.log(`Prepared LittleFS upload folder: ${path.relative(root, data)}`);
console.log(`Website files: ${totalBytes.toLocaleString()} bytes`);
console.log("In Arduino IDE, select the AirWatch sketch, then run Tools > ESP32 LittleFS Data Upload.");
console.log("Keep the sketch and selected board/partition settings the same, then upload the firmware sketch too.");
