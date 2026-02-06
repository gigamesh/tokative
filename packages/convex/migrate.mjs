#!/usr/bin/env node
import { execSync } from 'child_process';

const MIGRATION = process.argv[2] || "replySent";
const BATCH_SIZE = 100;

function parseJsonFromOutput(output) {
  const lines = output.trim().split('\n');
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
}

function migrateReplySent() {
  console.log('Migration: replySent → repliedTo');

  let cursor = undefined;
  let totalMigrated = 0;
  let totalProcessed = 0;
  let batchNum = 0;

  while (true) {
    batchNum++;
    const args = { batchSize: BATCH_SIZE };
    if (cursor) args.cursor = cursor;

    const argsJson = JSON.stringify(args);
    const cmd = `npx convex run comments:migrateReplySentToRepliedTo '${argsJson}'`;

    try {
      const output = execSync(cmd, { encoding: 'utf-8' });
      const result = parseJsonFromOutput(output);

      if (!result) {
        console.error('Migration failed at batch', batchNum);
        break;
      }

      totalMigrated += result.migrated;
      totalProcessed += result.processed;

      console.log(`Batch ${batchNum}: migrated ${result.migrated}/${result.processed}, total: ${totalMigrated}/${totalProcessed}`);

      if (result.isDone) {
        console.log(`\nMigration complete! Total migrated: ${totalMigrated}`);
        break;
      }

      cursor = result.continueCursor;
    } catch (err) {
      console.error('Error running batch:', err.message);
      if (err.stdout) console.error('stdout:', err.stdout);
      if (err.stderr) console.error('stderr:', err.stderr);
      break;
    }
  }
}

function migrateBackfillCommenters() {
  const clerkId = process.argv[3] || "user_38xvKBfA5Xs8W9rQm3gxZCk7L8F";
  console.log(`Migration: backfill commenters for user: ${clerkId}`);

  let skip = 0;
  let totalUpdated = 0;
  let totalProcessed = 0;
  let batchNum = 0;

  while (true) {
    batchNum++;
    const argsJson = JSON.stringify({ clerkId, batchSize: 5, skip });
    const cmd = `npx convex run commenters:backfillBatch '${argsJson}'`;

    try {
      const output = execSync(cmd, { encoding: 'utf-8' });
      const result = parseJsonFromOutput(output);

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
    } catch (err) {
      console.error('Error running batch:', err.message);
      if (err.stdout) console.error('stdout:', err.stdout);
      if (err.stderr) console.error('stderr:', err.stderr);
      break;
    }
  }
}

switch (MIGRATION) {
  case "replySent":
    migrateReplySent();
    break;
  case "backfillCommenters":
    migrateBackfillCommenters();
    break;
  default:
    console.error(`Unknown migration: ${MIGRATION}`);
    console.error('Available migrations: replySent, backfillCommenters');
    process.exit(1);
}
