import { z } from "zod";

export const snapshotRequestSchema = z.object({
  snapshotId: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  creatorId: z.string().min(1),
  capturedAt: z.string().datetime(),
  digitalAssetDeliveries: z.array(z.object({
    orderId: z.string().min(1),
    assetId: z.string().min(1),
    deliveredAt: z.string().datetime(),
  })),
  subscriberUpdates: z.array(z.object({
    subscriberId: z.string().min(1),
    action: z.enum(["subscribed", "unsubscribed", "tier_changed"]),
    occurredAt: z.string().datetime(),
  })),
  contentProcessing: z.array(z.object({
    contentId: z.string().min(1),
    status: z.enum(["ready", "failed", "pending"]),
    processedAt: z.string().datetime().nullable(),
  })),
}).strict();

export type SnapshotRequest = z.infer<typeof snapshotRequestSchema>;

export type SnapshotResult = {
  snapshotId: string;
  objectKey: string;
  outcome: "stored" | "already_stored";
  recordCount: number;
};
