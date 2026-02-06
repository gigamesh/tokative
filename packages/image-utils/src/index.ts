import sharp from "sharp";
import * as fs from "fs/promises";
import * as path from "path";

export interface ConvertOptions {
  width?: number;
  height?: number;
  background?: { r: number; g: number; b: number; alpha: number };
}

/** Converts an SVG file to PNG, rasterizing at the exact target density to avoid resize blur. */
export async function svgToPng(
  inputPath: string,
  outputPath: string,
  options: ConvertOptions = {}
): Promise<void> {
  const svgBuffer = await fs.readFile(inputPath);

  const metadata = await sharp(svgBuffer).metadata();
  const svgWidth = metadata.width || 128;

  const targetWidth = options.width || svgWidth;
  const density = Math.round((targetWidth / svgWidth) * 72);

  await sharp(svgBuffer, { density })
    .png()
    .toFile(outputPath);
}

export async function convertDirectory(
  inputDir: string,
  outputDir: string,
  options: ConvertOptions = {}
): Promise<string[]> {
  const files = await fs.readdir(inputDir);
  const svgFiles = files.filter((f) => f.endsWith(".svg"));
  const converted: string[] = [];

  await fs.mkdir(outputDir, { recursive: true });

  for (const file of svgFiles) {
    const inputPath = path.join(inputDir, file);
    const outputFile = file.replace(".svg", ".png");
    const outputPath = path.join(outputDir, outputFile);

    await svgToPng(inputPath, outputPath, options);
    converted.push(outputPath);
  }

  return converted;
}

export async function svgToPngInPlace(
  inputPath: string,
  options: ConvertOptions = {}
): Promise<string> {
  const outputPath = inputPath.replace(".svg", ".png");
  await svgToPng(inputPath, outputPath, options);
  return outputPath;
}
