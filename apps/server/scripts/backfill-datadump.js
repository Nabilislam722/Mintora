// Builds and freezes every finished month from [YYYY-MM] (default: the first active month); months without price samples use today's price
import "dotenv/config";
import mongoose from "mongoose";
import { crawlerCaughtUp, finalizeMonths, pendingMonths } from "../lib/dataDump.js";
import { isMonth } from "../lib/months.js";

const from = process.argv[2];
if (from && !isMonth(from)) {
  console.error("Usage: node scripts/backfill-datadump.js [YYYY-MM]");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/nft_marketplace");
try {
  const months = await pendingMonths(from);
  if (!months.length) {
    console.log("Nothing to build: every finished month is already frozen.");
  } else if (!(await crawlerCaughtUp())) {
    console.error(`The crawler hasn't read up to the chain head yet, so ${months.join(", ")} could be incomplete. Run this again once it has.`);
    process.exitCode = 1;
  } else {
    const done = await finalizeMonths({ from });
    console.log(`Built and froze ${done.length} month(s): ${done.join(", ") || "none"}`);
  }
} catch (err) {
  console.error("Backfill failed:", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
