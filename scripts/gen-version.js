// Reads APP_VERSION from src/constants.js and writes public/version.json.
// Runs automatically before every build via the "prebuild" npm script.
import { readFileSync, writeFileSync } from "fs";

const constants = readFileSync("./src/constants.js", "utf8");
const match = constants.match(/APP_VERSION\s*=\s*"([^"]+)"/);
if (!match) { console.error("gen-version: APP_VERSION not found in constants.js"); process.exit(1); }

const version = match[1];
writeFileSync("./public/version.json", JSON.stringify({ v: version }) + "\n");
console.log(`gen-version: version.json → ${version}`);
