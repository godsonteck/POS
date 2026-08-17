# POS Sync Server

Small durable synchronization endpoint for independent POS installations.

## Required environment

`POS_SYNC_TOKENS` is a JSON object mapping each shop installation ID to a unique bearer token:

```bash
POS_SYNC_TOKENS='{"shop-a":"replace-with-a-long-random-secret","shop-b":"replace-with-another-secret"}'
PORT=8787
DATA_DIR=./data
```

The server stores received event IDs with a primary key, making retries idempotent. A client can safely retry a batch after a timeout without creating duplicate sync events.

## Endpoints

- `GET /health`
- `POST /v1/sync/push`

The server is intentionally independent from the two shops: each shop authenticates with its own token and all received events retain the originating `shop_id`.
