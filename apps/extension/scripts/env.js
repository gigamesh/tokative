const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    }
  }
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}\nCreate apps/extension/.env with this variable.`);
  }
  return value;
}

function getEnvWithDefault(name, defaultValue) {
  return process.env[name] || defaultValue;
}

module.exports = {
  CONVEX_SITE_URL: getRequiredEnv("CONVEX_SITE_URL"),
  DASHBOARD_URL: getEnvWithDefault("DASHBOARD_URL", "http://localhost:3000"),
};
