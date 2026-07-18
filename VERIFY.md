# Verify Fulltime settles from a real TxLINE proof (not admin, not mock)

Everything below is reproducible against **devnet** and the **real** TxLINE oracle
program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`. Our program is
`37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW`.

The one claim that matters on this track: **the outcome is derived on-chain from
TxLINE's `validate_stat` verdict — the settler never supplies it.**

## Genuine proof-settled markets (live on devnet)

| Fixture | Real result | Derived outcome | Settle tx |
|---|---|---|---|
| 18179549 | 1–0 | **YES** (team1 wins) | [`5QZzyp…3Nexy`](https://explorer.solana.com/tx/5QZzypbShX2VJzQuCpRJfUDb5F4oTx7H8v2RxrAh4NJybPnmMkG6PwVk25avgUFbZhneBxfNfE9hdYXmUEZ3Nexy?cluster=devnet) |
| 18193785 | 1–4 | **NO** (team1 loses) | [`4TG9BU…n3LJZ`](https://explorer.solana.com/tx/4TG9BU5XCi3hRAPq7wLKJtydFvN7XhCSo86Lp3SGbku4BqUneKBPWmnz1ZVkgY8u4dzc2jys11asrmaWRJRn3LJZ?cluster=devnet) |

Two different real scorelines → two different **derived** outcomes. The settle
instruction takes **no `outcome` argument**; it reads the verdict TxLINE returns.

## The proof is in the inner CPI (from tx `5QZzyp…3Nexy` logs)

```
Program 37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW invoke [1]
  Program log: Instruction: Settle
  Program 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J invoke [2]
    Program log: Instruction: ValidateStat
    Program log: Find valid on-chain root for interval 43
    Program log: Perform fixture-level validation
    Program log: Pass fixture-level validation
    Program log: Perform two-stat predicate validation
    Program log: Evaluate predicate to: true
    Program log: Return on-chain predicate
  Program return: 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J AQ==   # 0x01 = true
  Program 37Gju…9vTW success
```

`AQ==` is base64 `0x01`. TxLINE's own program folded the Merkle proof against its
anchored `daily_scores_roots` and returned the verdict; our `settle`
(`programs/fulltime/src/lib.rs:182`) reads that return data, checks it came from
TxLINE, and sets `resolution = Yes`. Nothing the caller passes can change it.

## Reproduce it yourself

```bash
# real TxLINE subscription token in ~/fulltime-keys/txline-creds.json
cd app
# find a finished fixture with a finalized (period-100) proof and no settled market:
CREDS=~/fulltime-keys/txline-creds.json node ft-find-fixtures.mjs
# settle it for real (creates the market, CPIs validate_stat, verifies derived==real result):
CREDS=~/fulltime-keys/txline-creds.json DEPLOYER_KEYPAIR=~/fulltime-keys/deployer.json \
  MODE=real FIXTURE=<fresh-id> node ft-real-settle.mjs
```

Expected tail:
```
✅ settle succeeded — on-chain resolution = YES (expected YES from real 1-0)
✅ DERIVED OUTCOME MATCHES THE REAL RESULT — outcome was NOT caller-chosen
```

## The fraud path reverts

Run the same settle with a corrupted goal value — the tampered leaf no longer
hashes to TxLINE's anchored root, so `validate_stat` reverts **inside the CPI**
and the market stays open:

```bash
CREDS=… DEPLOYER_KEYPAIR=… MODE=real TAMPER=1 FIXTURE=<fresh-id> node ft-real-settle.mjs
# -> ✅ EXPECTED: tampered proof reverted (Merkle check failed)
```

You cannot settle to a result TxLINE's data doesn't support. That is the whole point.

## Automated test

`app/ft-e2e-test.mjs` (`cd app && npm run test:e2e`) re-verifies both recorded
settlements against live devnet — asserting each tx CPI'd TxLINE's `validate_stat`
and that the market's on-chain resolution matches the real scoreline (not a
caller-chosen value). With `CREDS` + `DEPLOYER_KEYPAIR` + a fresh `FIXTURE` it also
runs the live settle and the tamper-reverts path as assertions.

> Note: settlement is **trustless-only** — there is no `admin_settle` / owner
> override in the program. The market can reach `Settled` solely through a valid
> TxLINE proof.
