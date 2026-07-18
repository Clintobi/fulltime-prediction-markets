# Fulltime keeper — permissionless auto-settlement

A watcher that settles Fulltime markets the moment TxLINE publishes a finalized
(full-time, period-100) proof for the fixture. Because settlement is **trustless**
(the outcome is derived on-chain from TxLINE's `validate_stat` verdict, and there
is no `admin_settle`), the keeper needs **no privileged key** — anyone can run it,
and a bettor can always self-settle if no keeper is online. Funds are never stuck
behind an operator.

## What it does each pass

1. Enumerates open markets — `getProgramAccounts` on the Fulltime program with a
   memcmp on the state byte (offset 85 == 0/Open), or a `--watch` fixture list.
2. For each, asks TxLINE for a finalized period-100 proof for that fixture.
3. If one exists, settles the market permissionlessly by building and sending the
   real settle-from-proof transaction (a tampered/invalid proof simply reverts —
   logged and skipped, never fatal).

Idempotent (skips `Settled`), resilient (per-market errors don't kill the loop),
exponential backoff on RPC errors, structured JSON logs, and a per-pass +
lifetime metrics summary (scanned / open / settleable / settled / avg
goal→settle latency).

## Run

```bash
npm install
# continuous:
CREDS=~/fulltime-keys/txline-creds.json KEEPER_KEYPAIR=~/fulltime-keys/deployer.json node keeper.mjs
# single pass (CI/demo):
CREDS=~/fulltime-keys/txline-creds.json node keeper.mjs --once
# see what it WOULD settle, send nothing:
CREDS=~/fulltime-keys/txline-creds.json node keeper.mjs --once --dry-run
```

Env: `RPC_URL` (default devnet), `CREDS` (TxLINE token json), `KEEPER_KEYPAIR`
(fee payer; any funded devnet key), `INTERVAL_MS`, `WATCH` (comma-sep fixture ids).
