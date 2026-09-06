import {
  capabilityLedger,
  capabilityStatuses,
} from "../lib/capability-ledger.mjs";

export const prerender = true;

export function GET() {
  return new Response(
    JSON.stringify(
      {
        ...capabilityLedger,
        statusDefinitions: capabilityStatuses,
      },
      null,
      2,
    ),
    {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=86400",
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
