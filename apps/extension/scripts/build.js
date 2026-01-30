const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");
const env = require("./env");

const isWatch = process.argv.includes("--watch");

const entryPoints = [
  { in: "src/background/index.ts", out: "background" },
  { in: "src/content/dashboard-bridge.ts", out: "content/dashboard-bridge" },
  { in: "src/content/tiktok/index.ts", out: "content/tiktok" },
  { in: "src/content/tiktok/extract-react-props.ts", out: "content/extract-react-props" },
  { in: "src/popup/index.ts", out: "popup" },
  { in: "src/page-script.ts", out: "page-script" },
];

const buildOptions = {
  entryPoints: entryPoints.map((e) => ({
    in: path.join(__dirname, "..", e.in),
    out: e.out,
  })),
  bundle: true,
  outdir: path.join(__dirname, "..", "dist"),
  platform: "browser",
  target: "chrome110",
  format: "iife",
  sourcemap: isWatch ? "inline" : false,
  minify: !isWatch,
  define: {
    "CONVEX_SITE_URL_PLACEHOLDER": JSON.stringify(env.CONVEX_SITE_URL),
  },
};

async function copyPublicFiles() {
  const publicDir = path.join(__dirname, "..", "public");
  const distDir = path.join(__dirname, "..", "dist");

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const files = fs.readdirSync(publicDir);
  for (const file of files) {
    fs.copyFileSync(path.join(publicDir, file), path.join(distDir, file));
  }
}

async function build() {
  try {
    copyPublicFiles();

    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log("Watching for changes...");
    } else {
      await esbuild.build(buildOptions);
      console.log("Build complete!");
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
