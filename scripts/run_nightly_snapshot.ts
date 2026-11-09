import { snapshotRequestSchema } from "../src/snapshot_contract";

const serviceUrl = process.env.SNAPSHOT_SERVICE_URL ?? "http://localhost:3000";
const date = new Date().toISOString().slice(0, 10);
const capturedAt = new Date(`${date}T02:00:00.000Z`).toISOString();

const snapshot = snapshotRequestSchema.parse({
  snapshotId: date,
  creatorId: "creator_42",
  capturedAt,
  digitalAssetDeliveries: [
    { orderId: "order_810", assetId: "asset_course_pdf", deliveredAt: capturedAt },
  ],
  subscriberUpdates: [
    { subscriberId: "subscriber_23", action: "tier_changed", occurredAt: capturedAt },
  ],
  contentProcessing: [
    { contentId: "video_17", status: "ready", processedAt: capturedAt },
  ],
});

const response = await fetch(`${serviceUrl}/snapshots/nightly`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(snapshot),
});
const result = await response.json();
if (!response.ok) throw new Error(`Snapshot request failed: ${JSON.stringify(result)}`);
console.log(JSON.stringify(result, null, 2));
