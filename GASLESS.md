# Gasless bets (optional) — Solana-native fee-payer sponsorship

Solana lets any account be the transaction **fee payer**, separate from the
instruction signers — so a sponsor can cover network fees while the user only signs
the intent. Fulltime already uses this for the **faucet** (app-signed; users mint
test-USDC with zero SOL). This makes the same primitive available to **bets/offers**
via a relayer, so a bettor never needs SOL.

- `app/src/app/api/relay/route.ts` — the relayer. It only co-signs a transaction if
  (a) the fee payer is the relayer and (b) **every instruction targets a whitelisted
  program** (this app + token/ATA/system/compute), so it can't be tricked into
  sponsoring a drain.
- `app/src/lib/gasless.ts` — `trySponsored()`; the `/exchange` page tries it first
  and **silently falls back to wallet-pays** if the relayer isn't configured or
  declines. Gasless can never block a bet.

## Activate (one Vercel env var)

A relayer key is already generated and funded on devnet
(`EqKEAXahemooXQtnGkD87Z6qtgjGmQGgNg8rtdw1WGDB`, 0.5 SOL, in `~/fulltime-keys/relayer.json`).
Set its base64 as `RELAYER_SECRET` in Vercel (Project → Settings → Environment
Variables), then redeploy:

```bash
# print the value to paste (do NOT commit it):
node -e 'console.log(Buffer.from(JSON.parse(require("fs").readFileSync(process.env.HOME+"/fulltime-keys/relayer.json"))).toString("base64"))'
```

If `RELAYER_SECRET` is unset, `/api/relay` reports `{enabled:false}` and the app
behaves exactly as before (wallet pays the fee). The relayer key is **not** committed.
