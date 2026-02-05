#!/usr/bin/env npx tsx
import { svgToPng, svgToPngInPlace } from "./index";
import * as path from "path";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: pnpm --filter @tokative/image-utils convert <svg-files...>");
    console.log("       pnpm --filter @tokative/image-utils convert --all");
    console.log("");
    console.log("Options:");
    console.log("  --all    Convert all brand SVGs to PNGs");
    console.log("  --width  Specify output width");
    console.log("  --height Specify output height");
    process.exit(1);
  }

  const rootDir = path.resolve(__dirname, "../../..");

  if (args.includes("--all")) {
    console.log("Converting all brand SVGs to PNGs...\n");

    const conversions = [
      // Extension icons
      {
        input: path.join(rootDir, "apps/extension/public/icon16.svg"),
        output: path.join(rootDir, "apps/extension/public/icon16.png"),
        width: 16,
        height: 16,
      },
      {
        input: path.join(rootDir, "apps/extension/public/icon48.svg"),
        output: path.join(rootDir, "apps/extension/public/icon48.png"),
        width: 48,
        height: 48,
      },
      {
        input: path.join(rootDir, "apps/extension/public/icon128.svg"),
        output: path.join(rootDir, "apps/extension/public/icon128.png"),
        width: 128,
        height: 128,
      },
      // Web app icons
      {
        input: path.join(rootDir, "apps/web/public/icon128.svg"),
        output: path.join(rootDir, "apps/web/public/icon128.png"),
        width: 128,
        height: 128,
      },
      // OG image
      {
        input: path.join(rootDir, "apps/web/public/og-image.svg"),
        output: path.join(rootDir, "apps/web/public/og-image.png"),
        width: 1200,
        height: 630,
      },
    ];

    for (const { input, output, width, height } of conversions) {
      try {
        await svgToPng(input, output, { width, height });
        console.log(`✓ ${path.relative(rootDir, output)}`);
      } catch (error) {
        console.error(`✗ ${path.relative(rootDir, input)}: ${error}`);
      }
    }

    console.log("\nDone!");
    return;
  }

  let width: number | undefined;
  let height: number | undefined;
  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--width" && args[i + 1]) {
      width = parseInt(args[++i], 10);
    } else if (args[i] === "--height" && args[i + 1]) {
      height = parseInt(args[++i], 10);
    } else if (!args[i].startsWith("--")) {
      files.push(args[i]);
    }
  }

  for (const file of files) {
    try {
      const outputPath = await svgToPngInPlace(file, { width, height });
      console.log(`✓ ${outputPath}`);
    } catch (error) {
      console.error(`✗ ${file}: ${error}`);
    }
  }
}

main().catch(console.error);
