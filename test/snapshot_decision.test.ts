import assert from "node:assert/strict";
import test from "node:test";
import { storeNightlySnapshot } from "../src/nightly_snapshot";
import type { SnapshotRequest } from "../src/snapshot_contract";

const input: SnapshotRequest = {
  snapshotId: "2026-09-18",
  creatorId: "creator_42",
  capturedAt: "2026-09-18T02:00:00.000Z",
  digitalAssetDeliveries: [
    { orderId: "order_810", assetId: "asset_pdf", deliveredAt: "2026-09-18T01:40:00.000Z" },
  ],
  subscriberUpdates: [
    { subscriberId: "subscriber_23", action: "subscribed", occurredAt: "2026-09-18T01:45:00.000Z" },
  ],
  contentProcessing: [
    { contentId: "video_17", status: "ready", processedAt: "2026-09-18T01:55:00.000Z" },
  ],
};

test("an existing nightly snapshot is reported without a second write", async () => {
  let writes = 0;
  const result = await storeNightlySnapshot(input, {
    head: async () => ({ found: true }),
    put: async () => { writes += 1; },
  });

  assert.equal(result.outcome, "already_stored");
  assert.equal(result.recordCount, 3);
  assert.equal(writes, 0);
});

test("a new nightly snapshot is written with a stable idempotency key", async () => {
  let key = "";
  const result = await storeNightlySnapshot(input, {
    head: async () => ({ found: false }),
    put: async (_bucket, _objectKey, body) => { key = body.idempotency_key; },
  });

  assert.equal(result.outcome, "stored");
  assert.equal(key, "creator-snapshot:creator_42:2026-09-18");
});
