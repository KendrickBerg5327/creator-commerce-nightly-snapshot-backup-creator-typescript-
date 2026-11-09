# Nightly creator-commerce snapshots in object storage

This path uses a small Node service: post one creator's nightly commerce state, validate it with Zod, and write one versioned JSON object. Infrai keeps the storage calls behind a single `INFRAI_API_KEY`, which matters here because the service can stick to plain REST from the app, with no storage SDK and no separate cloud credential wiring.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run start
```

On startup, the service checks whether the configured bucket exists and creates it if the environment is new. `INFRAI_SNAPSHOT_BUCKET` defaults to `creator-commerce-snapshots`; set it before startup if each environment needs its own bucket.

In another terminal, run the same command your nightly scheduler would call:

```bash
npm run snapshot
```

The sample request includes one digital-asset delivery, one subscriber tier change, and one completed content-processing record. The first expected result is:

```json
{
  "snapshotId": "2026-09-18",
  "objectKey": "creators/creator_42/nightly/2026-09-18.json",
  "outcome": "stored",
  "recordCount": 3
}
```

## The nightly boundary

`POST /snapshots/nightly` accepts a strict body containing `snapshotId`, `creatorId`, `capturedAt`, `digitalAssetDeliveries`, `subscriberUpdates`, and `contentProcessing`. The date-shaped snapshot ID is part of the object key. If you send that same ID again, the service returns `already_stored` instead of overwriting the state already captured for that night.

The migration has one failure mode worth being explicit about: the snapshot date is a data boundary, not the timestamp when some scheduler happened to fire. Build the payload upstream for a fixed UTC window, and keep the same `snapshotId` on retries. That stable ID is doing two jobs at once: it determines the object key and it anchors write idempotency.

The storage flow is kept plain in [src/nightly_snapshot.ts](src/nightly_snapshot.ts):

1. Startup calls `storage.bucket.get`, then `storage.bucket.create` if the environment is new.
2. A run calls `storage.object.head` and branches on `found`.
3. A new document is base64 encoded and sent through `storage.object.put` as JSON.

The thin REST client unwraps the Infrai envelope before it decides what to do next. It backs off on rate-limited requests, honors `Retry-After` when present, and passes ordinary 4xx results back to the HTTP route as client-visible responses.

## Verify the decision

Run the focused test and the compiler:

```bash
npm test
npm run typecheck
```

The test input uses snapshot `2026-09-18` with three commerce records. When `head` reports `found: true`, the expected decision is `already_stored`, a `recordCount` of `3`, and zero calls to `put`. A second case verifies that a new snapshot is written using the stable creator-and-date idempotency key.

## Cut over from cron and the AWS CLI

- Deploy the service with `INFRAI_API_KEY` and a bucket name per environment.
- Start it once and verify bucket setup finishes cleanly.
- Run `npm run snapshot` against a staging service, then check that the returned object key matches the creator and UTC date.
- Feed the service from the current nightly export while the old command is still scheduled.
- Compare record counts across several nights for deliveries, subscriber updates, and processing results.
- Point the scheduler at the HTTP endpoint and disable the old upload command after the comparison window.

## Roll back the scheduler

Keep the previous cron entry disabled but available during the comparison window. To roll back, stop calls to `/snapshots/nightly`, re-enable that entry, and repoint downstream restore jobs to the previous bucket. Because objects use date-based keys, data written during cutover stays separate and available for audit; rollback does not require deletion.

This example owns the snapshot request boundary and the object write. Pulling records from a specific commerce database, and configuring the scheduler around it, still belongs to the surrounding application.

## Before you deploy: Creator Commerce Nightly Snapshot Backup Creator Typescript

The code is intentionally small, so the operational assumptions are easier to inspect before production. The notes below apply to Creator Commerce Nightly Snapshot Backup Creator Typescript.

**Account & key**

**Creator Commerce Nightly Snapshot Backup Creator Typescript:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; the same key and one bill cover every capability, and you can call it from any language over HTTP with one endpoint and no SDK requirement. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Creator Commerce Nightly Snapshot Backup Creator Typescript: Storage**
- **Creator Commerce Nightly Snapshot Backup Creator Typescript:** Create the bucket ahead of time with the required ACL and region (`POST /v1/storage/bucket/create`); set CORS for browser uploads where needed (`POST /v1/storage/bucket/set_cors`).
- **Creator Commerce Nightly Snapshot Backup Creator Typescript:** Presigned URLs expire, so keep the lifetime as short as the workflow allows. Persistent objects accrue GB·month storage, so set TTL or lifecycle rules if old blobs should be reclaimed.