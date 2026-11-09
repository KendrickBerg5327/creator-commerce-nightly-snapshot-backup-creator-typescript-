import { InfraiError, infrai } from "./infrai_storage";
import type { SnapshotRequest, SnapshotResult } from "./snapshot_contract";

const BUCKET = process.env.INFRAI_SNAPSHOT_BUCKET ?? "creator-commerce-snapshots";

type SnapshotStorage = {
  head(bucket: string, key: string): Promise<{ found: boolean }>;
  put(bucket: string, key: string, body: {
    data_base64: string;
    content_type: string;
    idempotency_key: string;
  }): Promise<unknown>;
};

const snapshotStorage: SnapshotStorage = {
  head: (bucket, key) => infrai.storage.object.head(bucket, key),
  put: (bucket, key, body) => infrai.storage.object.put(bucket, key, body),
};

export async function ensureSnapshotBucket(): Promise<void> {
  try {
    await infrai.storage.bucket.get(BUCKET);
  } catch (error) {
    if (!(error instanceof InfraiError) || error.status !== 404) throw error;
    await infrai.storage.bucket.create({ name: BUCKET });
  }
}

export async function storeNightlySnapshot(
  input: SnapshotRequest,
  storage: SnapshotStorage = snapshotStorage,
): Promise<SnapshotResult> {
  const objectKey = `creators/${input.creatorId}/nightly/${input.snapshotId}.json`;
  const existing = await storage.head(BUCKET, objectKey);
  const recordCount = input.digitalAssetDeliveries.length
    + input.subscriberUpdates.length
    + input.contentProcessing.length;

  if (existing.found) {
    return { snapshotId: input.snapshotId, objectKey, outcome: "already_stored", recordCount };
  }

  const document = JSON.stringify({ schemaVersion: 1, ...input });
  await storage.put(BUCKET, objectKey, {
    data_base64: Buffer.from(document).toString("base64"),
    content_type: "application/json",
    idempotency_key: `creator-snapshot:${input.creatorId}:${input.snapshotId}`,
  });

  return { snapshotId: input.snapshotId, objectKey, outcome: "stored", recordCount };
}
