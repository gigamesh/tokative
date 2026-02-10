const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const { WebSocketServer } = require("ws");
const env = require("./env");

const wss = new WebSocketServer({ port: 8080 });
console.log("Hot reload server started on ws://localhost:8080");

const clients = new Set();
wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

function notifyReload() {
  clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send("reload");
    }
  });
  console.log("Extension reloaded");
}

function copyPublicFiles() {
  const publicDir = path.join(__dirname, "../public");
  const distDir = path.join(__dirname, "../dist");

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  fs.readdirSync(publicDir).forEach((file) => {
    const srcPath = path.join(publicDir, file);
    const destPath = path.join(distDir, file);

    if (file === "manifest.json") {
      const manifest = JSON.parse(fs.readFileSync(srcPath, "utf8"));

      const tiktokScript = manifest.content_scripts.find(
        (cs) => cs.matches && cs.matches.includes("https://www.tiktok.com/*"),
      );

      if (tiktokScript) {
        tiktokScript.js = ["hot-reload.js", ...(tiktokScript.js || [])];
      }

      const dashboardScript = manifest.content_scripts.find(
        (cs) => cs.matches && cs.matches.includes("http://localhost:3000/*"),
      );

      if (dashboardScript) {
        dashboardScript.js = ["hot-reload.js", ...(dashboardScript.js || [])];
      }

      fs.writeFileSync(destPath, JSON.stringify(manifest, null, 2));
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

function createHotReloadScript() {
  const hotReloadScript = `
(function() {
  if (typeof window === 'undefined') return;

  let retryCount = 0;
  const maxRetries = 5;

  function connectWebSocket() {
    try {
      const ws = new WebSocket('ws://localhost:8080');

      ws.onopen = () => {
        console.log('[Tokative] Hot reload connected');
        retryCount = 0;
      };

      ws.onmessage = (event) => {
        if (event.data === 'reload') {
          console.log('[Tokative] Reloading...');
          chrome.runtime.sendMessage({ type: 'HOT_RELOAD' });
          window.location.reload();
        }
      };

      ws.onerror = () => {
        console.log('[Tokative] Hot reload connection error');
      };

      ws.onclose = () => {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log('[Tokative] Hot reload disconnected, retrying (' + retryCount + '/' + maxRetries + ')...');
          setTimeout(connectWebSocket, Math.min(1000 * retryCount, 5000));
        } else {
          console.log('[Tokative] Hot reload disabled');
        }
      };
    } catch (e) {
      console.log('[Tokative] Hot reload not available');
    }
  }

  if (window.location.hostname === 'www.tiktok.com' || window.location.hostname === 'localhost') {
    connectWebSocket();
  }
})();
`;

  fs.writeFileSync(
    path.join(__dirname, "../dist/hot-reload.js"),
    hotReloadScript,
  );
}

const buildOptions = {
  entryPoints: {
    background: "./src/background/index.ts",
    "content/tiktok": "./src/content/tiktok/index.ts",
    "content/dashboard-bridge": "./src/content/dashboard-bridge.ts",
    popup: "./src/popup/index.ts",
  },
  bundle: true,
  outdir: "./dist",
  platform: "browser",
  target: ["chrome110"],
  format: "iife",
  sourcemap: "inline",
  define: {
    "process.env.NODE_ENV": '"development"',
    CONVEX_SITE_URL_PLACEHOLDER: JSON.stringify(env.CONVEX_SITE_URL),
    TOKATIVE_URL_PLACEHOLDER: JSON.stringify(env.TOKATIVE_URL),
  },
};

async function build() {
  try {
    copyPublicFiles();
    createHotReloadScript();

    await esbuild.build(buildOptions);
    console.log("Build complete");

    notifyReload();
  } catch (error) {
    console.error("Build failed:", error);
  }
}

build();

const watcher = chokidar.watch(["src/**/*", "public/**/*"], {
  ignored: /node_modules/,
  persistent: true,
});

watcher.on("change", (filePath) => {
  console.log(`Changed: ${filePath}`);
  build();
});

console.log("Watching for changes...");
console.log("Load the extension from dist/ folder in Chrome");
