import sharp from "sharp";
import * as fs from "fs/promises";
import * as path from "path";

export interface ConvertOptions {
  width?: number;
  height?: number;
  background?: { r: number; g: number; b: number; alpha: number };
}

export async function svgToPng(
  inputPath: string,
  outputPath: string,
  options: ConvertOptions = {}
): Promise<void> {
  const svgBuffer = await fs.readFile(inputPath);

  let pipeline = sharp(svgBuffer, { density: 300 });

  if (options.width || options.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      fit: "contain",
      background: options.background || { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  await pipeline.png().toFile(outputPath);
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
