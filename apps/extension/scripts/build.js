const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");
const env = require("./env");

const isWatch = process.argv.includes("--watch");

const entryPoints = [
  { in: "src/background/index.ts", out: "background" },
  { in: "src/content/dashboard-bridge.ts", out: "content/dashboard-bridge" },
  { in: "src/content/tiktok/index.ts", out: "content/tiktok" },
  {
    in: "src/content/tiktok/extract-react-props.ts",
    out: "content/extract-react-props",
  },
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
    CONVEX_SITE_URL_PLACEHOLDER: JSON.stringify(env.CONVEX_SITE_URL),
    TOKATIVE_ENDPOINT_PLACEHOLDER: JSON.stringify(env.TOKATIVE_ENDPOINT),
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
    if (file === "manifest.json") {
      // Process manifest.json to inject dashboard URL
      const manifest = JSON.parse(
        fs.readFileSync(path.join(publicDir, file), "utf8"),
      );
      const dashboardPattern = env.TOKATIVE_ENDPOINT + "/*";

      // Update host_permissions
      manifest.host_permissions = manifest.host_permissions.map((perm) =>
        perm === "http://localhost:3000/*" ? dashboardPattern : perm,
      );

      // Inject Convex host permission
      const convexPattern = env.CONVEX_SITE_URL + "/*";
      if (!manifest.host_permissions.includes(convexPattern)) {
        manifest.host_permissions.push(convexPattern);
      }

      // Update content_scripts matches
      manifest.content_scripts = manifest.content_scripts.map((script) => ({
        ...script,
        matches: script.matches.map((match) =>
          match === "http://localhost:3000/*" ? dashboardPattern : match,
        ),
      }));

      fs.writeFileSync(
        path.join(distDir, file),
        JSON.stringify(manifest, null, 2),
      );
    } else {
      fs.copyFileSync(path.join(publicDir, file), path.join(distDir, file));
    }
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
