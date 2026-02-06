const fs = require("fs");
const path = require("path");

const BUMP_TYPE = process.argv[2];
if (!["patch", "minor", "major"].includes(BUMP_TYPE)) {
  console.error("Usage: node scripts/version.js <patch|minor|major>");
  process.exit(1);
}

const pkgPath = path.join(__dirname, "..", "package.json");
const manifestPath = path.join(__dirname, "..", "public", "manifest.json");

const pkgText = fs.readFileSync(pkgPath, "utf-8");
const oldVersion = JSON.parse(pkgText).version;

const parts = oldVersion.split(".").map(Number);
if (BUMP_TYPE === "major") {
  parts[0]++;
  parts[1] = 0;
  parts[2] = 0;
} else if (BUMP_TYPE === "minor") {
  parts[1]++;
  parts[2] = 0;
} else {
  parts[2]++;
}

const newVersion = parts.join(".");

/** Replace the "version" field in-place to preserve file formatting. */
function replaceVersion(filePath) {
  const text = fs.readFileSync(filePath, "utf-8");
  const updated = text.replace(
    /"version":\s*"[^"]+"/,
    `"version": "${newVersion}"`
  );
  fs.writeFileSync(filePath, updated);
}

replaceVersion(pkgPath);
replaceVersion(manifestPath);

console.log(`Bumped version: ${oldVersion} → ${newVersion}`);
console.log(`\nNext steps:`);
console.log(`  npm run build:release   # build & zip`);
console.log(`  git add -A && git commit -m "v${newVersion}"`);
