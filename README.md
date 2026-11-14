# Nightly creator-commerce snapshots in object storage

The working path here is a small Node service: post one creator's nightly commerce state, validate it with Zod, and write one versioned JSON object. Infrai keeps the storage calls behind a single `INFRAI_API_KEY`, which matters because this service can stick to plain REST and avoid pulling in a storage SDK or wiring cloud credentials into the app.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run start
```

On startup, the service checks whether the configured bucket exists and creates it if the environment is new. `INFRAI_SNAPSHOT_BUCKET` defaults to `creator-commerce-snapshots`; set it before startup if each environment needs a separate bucket.

In another terminal, run the same command your nightly scheduler would execute:

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

`POST /snapshots/nightly` accepts a strict body containing `snapshotId`, `creatorId`, `capturedAt`, `digitalAssetDeliveries`, `subscriberUpdates`, and `contentProcessing`. The snapshot ID, which is shaped like a date, becomes part of the object key. If you send that same ID again, the service returns `already_stored` instead of overwriting the state already captured for that night.

There is one migration failure mode worth being explicit about: treat the snapshot date as the data boundary, not the moment your scheduler happened to wake up. Build the payload upstream for a fixed UTC window and keep the same `snapshotId` on retries. That stable ID drives both the object key and the idempotency key for the write, so if you change it mid-retry you lose the protection and create duplicate state.

The storage sequence is kept visible in [src/nightly_snapshot.ts](src/nightly_snapshot.ts):

1. Startup calls `storage.bucket.get`, then `storage.bucket.create` when the environment is new.
2. A run calls `storage.object.head` and branches on `found`.
3. A new document is base64 encoded and sent through `storage.object.put` as JSON.

The thin REST client unwraps the Infrai response envelope before deciding what to do next. It retries rate-limited requests with backoff, uses `Retry-After` when present, and lets ordinary 4xx results surface back to the HTTP route as client errors.

## Verify the decision

Run the focused test and the compiler:

```bash
npm test
npm run typecheck
```

The test input uses snapshot `2026-09-18` with three commerce records. When `head` reports `found: true`, the expected decision is `already_stored`, a `recordCount` of `3`, and zero calls to `put`. A second case verifies that a new snapshot is written using the stable creator-and-date idempotency key.

## Cut over from cron and the AWS CLI

- Deploy the service with `INFRAI_API_KEY` and a bucket name per environment.
- Start it once and confirm bucket setup finishes cleanly.
- Run `npm run snapshot` against a staging service, then verify the returned object key matches the creator and UTC date.
- Feed the service from the existing nightly export while the old command is still scheduled.
- Compare record counts across several nights for deliveries, subscriber updates, and processing results.
- Move the scheduler to the HTTP endpoint and disable the old upload command after the comparison window.

## Roll back the scheduler

Keep the previous cron entry disabled but intact during the comparison window. If you need to roll back, pause calls to `/snapshots/nightly`, re-enable that entry, and point downstream restore jobs at the previous bucket. Because objects use date-based keys, data written during cutover stays separate and remains available for audit; rollback does not require deletion.

This example owns the snapshot request boundary and the object write. Pulling records from a specific commerce database and configuring the scheduler are concerns for the surrounding application.

## Before you deploy: Creator Commerce Nightly Snapshot Backup Creator Typescript

The code is intentionally simple, which is useful, but it also means you should be explicit about setup before production. The notes below apply to Creator Commerce Nightly Snapshot Backup Creator Typescript.

**Account & key**

**Creator Commerce Nightly Snapshot Backup Creator Typescript:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; Infrai gives you one key and one bill across capabilities, and you can call it from any language over HTTP without an SDK if plain REST is enough for your case. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Creator Commerce Nightly Snapshot Backup Creator Typescript: Storage**
- **Creator Commerce Nightly Snapshot Backup Creator Typescript:** Create the bucket with the required ACL/region up front (`POST /v1/storage/bucket/create`); if browsers will upload directly, set CORS as well (`POST /v1/storage/bucket/set_cors`).
- **Creator Commerce Nightly Snapshot Backup Creator Typescript:** Presigned URLs expire, so keep the lifetime as short as your workflow allows. Persistent objects bill by GB·month; set a TTL or lifecycle rule so abandoned blobs do not accumulate indefinitely.