const archiver = require("archiver");
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const outputDir = path.join(__dirname, "..", "..", "web", "public", "downloads");
const outputPath = path.join(outputDir, "tokative-extension.zip");

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
);
const releasesDir = path.join(__dirname, "..", "releases");
const versionedPath = path.join(releasesDir, `tokative-v${pkg.version}.zip`);

if (!fs.existsSync(distDir)) {
  console.error("Error: dist/ folder not found. Run 'npm run build' first.");
  process.exit(1);
}

for (const dir of [outputDir, releasesDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let completed = 0;
const targets = [outputPath, versionedPath];

function createZip(dest) {
  const output = fs.createWriteStream(dest);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    const sizeKB = (archive.pointer() / 1024).toFixed(2);
    console.log(`Created ${dest} (${sizeKB} KB)`);
    completed++;
    if (completed === targets.length) {
      console.log(`\nv${pkg.version} zipped successfully.`);
    }
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(output);
  archive.directory(distDir, false);
  archive.finalize();
}

targets.forEach(createZip);
