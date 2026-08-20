"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GATE_CANDLES = "https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=BTC_USDT";
const DAY = 86400;

async function jfetch(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
  return r.json();
}

function candles(interval, from, to, limit) {
  let u = GATE_CANDLES + "&interval=" + interval;
  if (from) u += "&from=" + from;
  if (to) u += "&to=" + to;
  if (limit) u += "&limit=" + limit;
  return jfetch(u);
}

async function candlesChunked(interval, from, to) {
  const MAX_POINTS = 1000;
  const step = { "1m": 60, "1h": 3600, "1d": 86400 }[interval] * MAX_POINTS;
  const out = [];
  for (let s = from; s < to; s += step) {
    const e = Math.min(s + step - 1, to);
    const part = await candles(interval, s, e, null);
    out.push(...(part || []));
  }
  return out;
}

const now = Math.floor(Date.now() / 1000);
const dayStart = Math.floor(now / DAY) * DAY;
const prevStart = dayStart - DAY;

const [m1, h48, d22] = await Promise.all([
  candlesChunked("1m", dayStart, now),
  candles("1h", prevStart, now, 60),
  candles("1d", null, null, 22)
]);

const m1s = (m1 || []).map(c => ({ ts: +c[0], c: +c[2], h: +c[3], l: +c[4], o: +c[5], v: +c[6] }))
  .filter(c => c.ts >= dayStart).sort((a, b) => a.ts - b.ts);
const h1s = (h48 || []).map(c => ({ ts: +c[0], c: +c[2], h: +c[3], l: +c[4], o: +c[5], v: +c[6] }))
  .sort((a, b) => a.ts - b.ts);
const d1s = (d22 || []).map(c => ({ ts: +c[0], c: +c[2], h: +c[3], l: +c[4], o: +c[5], v: +c[6] }))
  .sort((a, b) => a.ts - b.ts);

const out = { ts: now, dayStart, source: "gate.io", session: null, prior: null, avgVol20: null, atrDaily: null, atr1h: null, last1hClose: null, spark: [] };

if (m1s.length) {
  let pv = 0, tv = 0;
  for (const c of m1s) { pv += ((c.h + c.l + c.c) / 3) * c.v; tv += c.v; }
  out.session = {
    open: m1s[0].o,
    high: Math.max(...m1s.map(c => c.h)),
    low: Math.min(...m1s.map(c => c.l)),
    vwap: tv > 0 ? pv / tv : null,
    vol: m1s.reduce((a, c) => a + c.v, 0)
  };
  out.spark = m1s.slice(-180).map(c => [c.ts, c.c]);
}

const yestH = h1s.filter(c => c.ts >= prevStart && c.ts < dayStart);
if (yestH.length) {
  let pv = 0, tv = 0;
  for (const c of yestH) { pv += ((c.h + c.l + c.c) / 3) * c.v; tv += c.v; }
  out.prior = { vwap: tv > 0 ? pv / tv : null, close: d1s.filter(c => c.ts < dayStart).slice(-1)[0]?.c ?? null };
}
const closedH = h1s.filter(c => c.ts < now - 3600);
if (closedH.length) out.last1hClose = closedH[closedH.length - 1].c;

const prevDays = d1s.filter(c => c.ts < dayStart);
const last20 = prevDays.slice(-20);
if (last20.length === 20) out.avgVol20 = last20.reduce((a, c) => a + c.v, 0) / 20;

function atr14(list) {
  if (list.length < 15) return null;
  const last15 = list.slice(-15);
  let trs = [];
  for (let i = 0; i < last15.length; i++) {
    const pc = i === 0 ? last15[0].o : last15[i - 1].c;
    trs.push(Math.max(last15[i].h - last15[i].l, Math.abs(last15[i].h - pc), Math.abs(last15[i].l - pc)));
  }
  return trs.reduce((a, b) => a + b, 0) / 14;
}
out.atrDaily = atr14(d1s);
out.atr1h = atr14(h1s);

const target = path.join(__dirname, "..", "data", "state.json");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out));
console.log("state.json written:", JSON.stringify(out).length, "bytes");