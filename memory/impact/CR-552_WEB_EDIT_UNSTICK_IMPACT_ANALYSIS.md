# CR-552 UNSTICK — Impact Analysis (Gate 2)

**ID:** CR-552 (slice "unstick") · **Stage:** Gate 2 — Impact Analysis · **Date:** 2026-11-24
**Role:** PLANNING (IA only) · **Risk:** HIGH · **Priority:** P1 · **Client:** ALL · **Assignee:** Abhishek
**Intake:** `change_requests/CR-552_WEB_EDIT_UNSTICK_REINTAKE_INTAKE.md` · **Source:** `notification-fix` (`8c80bfe`), per-hunk.

---

## Header — Code Reality & Conflict Pre-Check
- **Code Reality:** **NONE on `main`** for the unstick slice (auto-confirm absent in `OrderEntry.jsx`). The CR-552 **body** (item flags, label, ScanOrderPopOut Mode A/B, DashboardPage reject) is already on main. **FULL on `notification-fix`** (port source).
- **Conflict Pre-Check (`OrderEntry.jsx`, hotspot, many owners):** existing edits are BUG-746 (L3088), BUG-662 (L1679/2464), CR-482 kbd, BUG-538/CR-412/413/409 (CPP props ~L1935), BUG-567 (L55) — **all IMPLEMENTED and line-disjoint** from the Scenario-1 Update-Order region (~L1340-1388). **No open conflict.**
- **⚠ Merge caveat:** `git diff origin/notification-fix -- OrderEntry.jsx` = **+2/−39** → `nf` lags `main` on this file. **Per-hunk port only** (import + block) onto main's current file; never copy nf's file.

## 1. Problem (confirmed in code)
`OrderEntry.jsx` **Scenario 1 — Update Order** (L1340-1388): fires HTTP, `await waitForOrderEngaged(placedOrderId)` (L1370/1385), `if (apiFailed) return` (L1386), logs "Socket engaged — redirecting" (L1387), then redirects. **No `confirmOrder` call** → appended `food_status=7` lines stay Not-Confirm, so `ScanOrderPopOut` keeps the order flagged until a manual **Accept**.

## 2. Data-flow trace
```
Update Order (L1340) → updateOrder HTTP → waitForOrderEngaged(placedOrderId) → await engage (L1385)
  → [BREAK: nothing confirms the fos=7 lines] → redirect to dashboard (L1388)
ScanOrderPopOut: hasUnconfirmedWebEditItems(order) stays true → banner stuck until manual Accept → handleConfirmOrder
```
**Fix (mirror `DashboardPage.handleConfirmOrder` L1364-1390):** right after the engage+redirect log (insert after L1387), read snapshot `getOrderById(placedOrderId)`, and **only if** web order still has Not-Confirm lines, auto-confirm them.

## 3. Owner direction — resolved ODs
- **KOT scope (owner):** KOT must print **only the newly-added `food_status=7` items**, not the whole order. ⇒ `confirmItems = items.filter(it => it.isNotConfirmed && it.status !== 'cancelled')`; KOT stations from `cartStationsToSet(confirmItems)` only (exactly DashboardPage OD-2 / nf).
- **OD-552-unstick-3 — RESOLVED (owner):** if **no `food_status=7` lines remain**, do **nothing** — no `confirmOrder`, no scan/auto-KOT. ⇒ guard the whole block on `hasNotConfirm`; auto-KOT additionally gated by `settings.autoKot && settings.scanOrderAutoPrint`.
- **OD-552-unstick-1:** classified **P1 / HIGH** (manual Accept is an unreliable workaround — unconfirmed items can miss the kitchen). Owner to confirm at Gate 4.

## 4. Files & edit sites (scope lock)
**WILL change — 1 file:** `frontend/src/components/order-entry/OrderEntry.jsx`

| # | Site | Change |
|---|---|---|
| E1 | import L18 | add `confirmOrder, updatePrintStatus` to the `orderService` import |
| E2 | new import | `import { selectAgentsForKot, selectAgentsForBill, cartStationsToSet } from "../../api/transforms/printerAgentSelector";` |
| E3 | `useRestaurant()` destructure L67 | add `defaultOrderStatus` (already provided by the hook — see DashboardPage L184) |
| E4 | after L1387 (Scenario 1, before redirect) | auto-confirm block: `snap = getOrderById(Number(placedOrderId)) || orderData`; `hasNotConfirm = !!snap?.isWebOrder && items.some(isNotConfirmed && !cancelled)`; if `hasNotConfirm` → build `printerAgent` only when `settings.autoKot && settings.scanOrderAutoPrint` (KOT stations from `confirmItems` only + BILL), `await confirmOrder(placedOrderId, permissions?.[0]||'Manager', defaultOrderStatus, printerAgent)`, then if `printerAgent.length` `await updatePrintStatus(placedOrderId, {kot_print:'Yes', bill_print:'No'})`; `catch` → non-blocking toast ("use Accept on the banner if it reappears"). |

**In-scope vars on main (verified):** `placedOrderId` (L189) · `getOrderById` (L65 useOrders) · `settings`,`printerAgents` (L67 useRestaurant) · `permissions` (L68 useAuth) · `orderData` (prop) · `toast`. `settings.scanOrderAutoPrint` present (profileTransform L381). `isNotConfirmed`/`isWebOrder` are item/order data flags (CR-552 body on main). **`defaultOrderStatus`** not currently destructured but supplied by `useRestaurant()` → add in E3 (no new hook).

**WILL NOT touch:** `ScanOrderPopOut.jsx` (CR-552 body) · `DashboardPage` reject/confirm · `orderTransform`/`reportTransform` · CPP-prop region (~L1935) · Scenario-2/New-Order path (L1405+) · any backend.

## 5. Downstream / blast radius
- Only `OrderEntry.jsx` Scenario-1 Update path. Redirect/engage behaviour otherwise unchanged. Blast radius **SMALL (1 file)**, **HIGH risk** (confirm + KOT dispatch).

## 6. Risk register + backend probe (Gate-3 blocker)
| Risk | Mitigation |
|---|---|
| Order-level `confirmOrder` on a `fOrderStatus=2` order re-confirms/alters already-confirmed lines, or double-prints KOT | **OD-552-unstick-2 LIVE PROBE (Gate-3 blocker):** on preprod, web-edit an existing confirmed order, Update, observe whether backend flips only the fos=7 lines and whether KOT reprints confirmed items. Shares OD-552-01/OD-558-01. |
| Duplicate KOT vs a later manual Accept | auto-KOT gated by `autoKot && scanOrderAutoPrint`; `updatePrintStatus(kot_print:'Yes')` marks printed so Accept won't reprint — verify in probe |
| Auto-confirm fires when it shouldn't | `hasNotConfirm` guard (OD-552-unstick-3) — no fos=7 ⇒ no-op |
| CRM/confirm throw blocks redirect | wrapped in try/catch, non-blocking toast; redirect already done |

**R11:** touches the `confirm-order` API → a live web-edit probe is required before Gate-5 close (cannot be fully curl'd now without a web-edit order + creds).

## 7. Owner decisions (carry to Gate 3/4)
- OD-552-unstick-1: confirm **P1/HIGH**.
- OD-552-unstick-2: **live confirm-order probe** result (only fos=7 flipped, no double KOT).
- OD-552-unstick-3: **RESOLVED** — skip confirm + auto-KOT entirely when no fos=7 remains.

---

**Gate status:** GATE_2_IA_COMPLETE
**Next:** PLANNING Gate 3 (Implementation Plan + Verification Matrix) — on owner request; Gate-3 close gated by the OD-552-unstick-2 live probe. No code until Gate-4 GO.
