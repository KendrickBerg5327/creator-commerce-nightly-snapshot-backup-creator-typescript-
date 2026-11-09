import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_storage";
import { ensureSnapshotBucket, storeNightlySnapshot } from "./nightly_snapshot";
import { snapshotRequestSchema } from "./snapshot_contract";

const port = Number(process.env.PORT ?? 3000);

async function readJson(request: AsyncIterable<Buffer | string>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

await ensureSnapshotBucket();

createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.method !== "POST" || request.url !== "/snapshots/nightly") {
    response.writeHead(404).end(JSON.stringify({ error: "Route not found" }));
    return;
  }

  try {
    const input = snapshotRequestSchema.parse(await readJson(request));
    const result = await storeNightlySnapshot(input);
    response.writeHead(result.outcome === "stored" ? 201 : 200).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid snapshot", issues: error.issues }));
      return;
    }
    if (error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "Request body must be JSON" }));
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      response.writeHead(error.status).end(JSON.stringify({ error: error.message }));
      return;
    }
    console.error(error);
    response.writeHead(500).end(JSON.stringify({ error: "Snapshot could not be stored" }));
  }
}).listen(port, () => {
  console.log(`Snapshot service listening on http://localhost:${port}`);
});
