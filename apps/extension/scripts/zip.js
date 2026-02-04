const archiver = require("archiver");
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const outputDir = path.join(__dirname, "..", "..", "web", "public", "downloads");
const outputPath = path.join(outputDir, "tokative-extension.zip");

if (!fs.existsSync(distDir)) {
  console.error("Error: dist/ folder not found. Run 'npm run build' first.");
  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const output = fs.createWriteStream(outputPath);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  const sizeKB = (archive.pointer() / 1024).toFixed(2);
  console.log(`Created ${outputPath} (${sizeKB} KB)`);
});

archive.on("error", (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();
