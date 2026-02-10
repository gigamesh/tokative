const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Environment file not found: ${filePath}`);
  }
  const envContent = fs.readFileSync(filePath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const k = key.trim();
        if (!(k in process.env)) {
          process.env[k] = valueParts.join("=").trim();
        }
      }
    }
  }
}

const envFileMap = {
  production: ".env.production",
  staging: ".env.staging",
};
const envFile = envFileMap[process.env.BUILD_ENV] || ".env";
const envPath = path.join(__dirname, "..", envFile);

console.log(`Loading environment from ${envFile}`);
loadEnvFile(envPath);

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\nCreate apps/extension/.env with this variable.`,
    );
  }
  return value;
}

function getEnvWithDefault(name, defaultValue) {
  return process.env[name] || defaultValue;
}

module.exports = {
  CONVEX_SITE_URL: getRequiredEnv("CONVEX_SITE_URL"),
  TOKATIVE_ENDPOINT: getEnvWithDefault(
    "TOKATIVE_ENDPOINT",
    "http://localhost:3000",
  ),
};
