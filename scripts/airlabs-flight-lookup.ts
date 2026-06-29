import "dotenv/config";
import { AirLabsIntegrationError, lookupAirLabsFlight } from "../server/integrations/airlabs";

const query = process.argv.slice(2).join(" ").trim();

if (!query) {
  console.error("Usage: pnpm flight:lookup DL123");
  console.error("   or: pnpm flight:lookup MSP-JFK");
  process.exit(1);
}

try {
  const result = await lookupAirLabsFlight(query);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (error instanceof AirLabsIntegrationError) {
    console.error(JSON.stringify({
      error: {
        status: error.status,
        code: error.code,
        message: error.message,
      },
    }, null, 2));
    process.exit(error.status === 429 ? 75 : 1);
  }

  console.error(error);
  process.exit(1);
}

