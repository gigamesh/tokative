#!/usr/bin/env node
import { execSync } from 'child_process';

const CLERK_ID = process.argv[2] || "user_38xvKBfA5Xs8W9rQm3gxZCk7L8F";
const BATCH_SIZE = 5;

function runBatch(skip = 0) {
  const argsJson = JSON.stringify({ clerkId: CLERK_ID, batchSize: BATCH_SIZE, skip });
  const cmd = `npx convex run commenters:backfillBatch '${argsJson}'`;

  try {
    const output = execSync(cmd, { encoding: 'utf-8' });
    const lines = output.trim().split('\n');

    // Find the JSON object - it spans multiple lines
    let jsonStr = '';
    let inJson = false;
    let braceCount = 0;

    for (const line of lines) {
      if (line.startsWith('{')) {
        inJson = true;
      }
      if (inJson) {
        jsonStr += line;
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;
        if (braceCount === 0) break;
      }
    }

    if (!jsonStr) {
      console.error('No JSON found in output:', output);
      return null;
    }
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Error running batch:', err.message);
    if (err.stdout) console.error('stdout:', err.stdout);
    if (err.stderr) console.error('stderr:', err.stderr);
    return null;
  }
}

function main() {
  console.log(`Starting migration for user: ${CLERK_ID}`);

  let skip = 0;
  let totalUpdated = 0;
  let totalProcessed = 0;
  let batchNum = 0;

  while (true) {
    batchNum++;
    const result = runBatch(skip);

    if (!result) {
      console.error('Migration failed at batch', batchNum);
      break;
    }

    totalUpdated += result.updated;
    totalProcessed += result.processed;

    console.log(`Batch ${batchNum}: updated ${result.updated}, total processed: ${totalProcessed}, total updated: ${totalUpdated}`);

    if (result.done) {
      console.log(`\nMigration complete! Total updated: ${totalUpdated}`);
      break;
    }

    skip = result.nextSkip;
  }
}

main();
