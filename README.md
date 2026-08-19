# BTC-USD Trade Setup Monitor

Live Bitcoin dashboard mirroring the [VELVET-USD Trade Setup Monitor](https://github.com/posu303-tech/velvet-dashboard) architecture, parameterized with the BTC-USD pre-market brief of **2026-08-19 15:48 UTC**.

**Live site:** https://posu303-tech.github.io/btc-setup-monitor/

## Data pipeline

- **Live price:** Gate.io WebSocket `spot.tickers` (`BTC_USDT`), with CoinGecko REST fallback, then `data/state.json` price.
- **Session context:** `scripts/update-data.mjs` (GitHub Actions, every 5 min) fetches Gate.io 1m/1h/1d candles and writes `data/state.json`:
  - session open/high/low, session VWAP (typical-price weighted, 1m), session volume
  - prior-day VWAP + prior-day close, 20d avg volume, ATR14 (daily & 1h), last closed 1h close, 1m spark series

## Parameters (from the 2026-08-19 brief)

- Prior close (Aug 18): **64,483**
- Session VWAP (brief, 15:48 UTC): **64,500**
- Key levels: pivots (P 63,901 / R1 65,097 / R2 65,712 / R3 66,908 / S1 63,286 / S2 62,090 / S3 61,475), SMA200 69,023, SMA50 63,764, VAH/POC/VAL 20-session profile (64,926 / 64,177 / 62,928), fibs on swing 82,018 → 58,566 (61.8% = 67,525, 50% = 70,292)

### Setups

| # | Setup | Direction | Trigger zone | Stop | T1 | T2 |
|---|-------|-----------|--------------|------|----|----|
| A | Breakout-retest long | LONG | 65,888–66,000 | 65,712 | 67,525 | 69,023 |
| B | Momentum continuation | LONG | 1h close > 68,445 | 67,525 | 69,023 | 70,292 |
| C | Spike fade at SMA200 | SHORT | rejection 69,023–69,200 | 69,500 | 66,908 | 65,712 |
| D | Deep mean-reversion long | LONG | 63,585–64,000 | 63,200 | 64,483 | 65,712 |

## Structure

```
index.html                front page (panels: price/spark, setups, levels, log)
app.js                    WS + REST feeds, setup evaluation, trigger alerts
styles.css                terminal dark theme
data/state.json           session context, refreshed by CI every 5 min
scripts/update-data.mjs   Gate.io candle → state.json converter (CI)
.github/workflows/update-data.yml  cron refresh every 5 min
```

## Deploy

GitHub Pages from `main` root — push updates to `main` and Pages redeploys automatically. Data refresh is fully automated via Actions.

Not financial advice.