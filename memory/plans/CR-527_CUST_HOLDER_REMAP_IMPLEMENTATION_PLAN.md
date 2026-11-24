# CR-527a — IMPLEMENTATION PLAN (Gate 3) — TAB holder → `cust_*` (Option B)

**ID:** CR-527 (slice "a")  **Role:** PLANNING (Gate 3 — plan only, NO code)  **Date:** 2026-11-24
**Risk:** HIGH  **Client:** ALL  **Assignee:** Abhishek
**IA:** `impact/CR-527_CUST_HOLDER_REMAP_IMPACT_ANALYSIS.md`
**Owner decisions locked:** OD-527a-1 = **YES** (cust_* = holder on TAB/credit) · OD-527a-2 = **ship FE workaround only** · OD-527a-3 = **holder-not-CRM-linked → `cust_membership_id` BLANK, never diner id**

## Source & deviation note
Base = branch `notification-fix` (`8c80bfe`, single squashed commit). Cherry-pick is **per-hunk** (not `git cherry-pick <sha>`).
**DEVIATION from `nf` (required by OD-527a-3):** `nf` sets `cust_membership_id: isTab ? (tabContact?.crmId || customer?.id || '') : …` — it **falls back to the diner's id**. The plan **drops `|| customer?.id`** in the `isTab` branch so it goes **blank**. `cust_name`/`cust_mobile`/`cust_country_code` keep the holder-first-then-customer fallback (a valid TAB always carries holder name/phone; this only guards a degenerate empty-holder case).

## Scope lock
- **WILL change:** `frontend/src/api/transforms/orderTransform.js` (2 spots), `frontend/src/api/transforms/__tests__/orderTransform.cr527.test.js`.
- **WILL NOT touch:** unpaid `place-order` (L1112) + update-place-order (L1248), cash/card/upi/paylater `cust_*`, `name`/`mobile`/`crm_customer_id` TAB block (already holder), `diner_*` block, CollectPaymentPanel, sockets, print, reports.

---

## Edit 1 — `placeOrderWithPayment` (prepaid place + Credit), main L1414–1421
**Current:**
```js
      // BUG-672 Phase 2: fallback to tabContact when customer not linked (prepaid TAB)
      cust_name:                  customer?.name || (isTab ? tabContact?.name : '') || '',
      cust_mobile:                customer?.phone || (isTab ? tabContact?.phone : '') || '',
      cust_country_code:          customer?.countryCode || (isTab ? tabContact?.countryCode : '') || '+91', // CR-479
      cust_email:                 customer?.email || '',
      cust_dob:                   customer?.dob || '',
      cust_anniversary:           customer?.anniversary || '',
      cust_membership_id:         customer?.id || (isTab ? tabContact?.crmId : '') || '',
```
**New:**
```js
      // CR-527a (OD-527a-1): TAB → cust_* = tab holder (Daily Report CUSTOMER + CRM); diner stays in diner_*. Supersedes BUG-672 customer-first fallback.
      cust_name:                  isTab ? (tabContact?.name || customer?.name || '') : (customer?.name || ''),
      cust_mobile:                isTab ? (tabContact?.phone || customer?.phone || '') : (customer?.phone || ''),
      cust_country_code:          isTab ? (tabContact?.countryCode || customer?.countryCode || '+91') : (customer?.countryCode || '+91'), // CR-479
      cust_email:                 customer?.email || '',
      cust_dob:                   customer?.dob || '',
      cust_anniversary:           customer?.anniversary || '',
      // CR-527a (OD-527a-3): holder not CRM-linked → BLANK; never fall back to diner id.
      cust_membership_id:         isTab ? (tabContact?.crmId || '') : (customer?.id || ''),
```

## Edit 2 — `collectBillExisting` (postpaid Collect Bill → Credit), main L1793–1796
**Current:**
```js
      cust_name:          customer?.name  || '',
      cust_mobile:        customer?.phone || '',
      cust_country_code:  customer?.countryCode || '+91', // CR-479
      cust_membership_id: customer?.id    || '',
```
**New:**
```js
      // CR-527a (OD-527a-1): TAB → cust_* = tab holder; diner stays in diner_*.
      cust_name:          isTab ? (tabContact?.name || customer?.name || '') : (customer?.name || ''),
      cust_mobile:        isTab ? (tabContact?.phone || customer?.phone || '') : (customer?.phone || ''),
      cust_country_code:  isTab ? (tabContact?.countryCode || customer?.countryCode || '+91') : (customer?.countryCode || '+91'), // CR-479
      // CR-527a (OD-527a-3): holder not CRM-linked → BLANK; never fall back to diner id.
      cust_membership_id: isTab ? (tabContact?.crmId || '') : (customer?.id || ''),
```

## Edit 3 — `orderTransform.cr527.test.js`
1. Cherry-pick the `nf` +46 lines verbatim (2 new "holder in cust_*" tests for placeOrder + collectBill + crmId on existing tests). These pass under the deviation (they all pass a populated `crmId`).
2. **ADD 2 edge tests (OD-527a-3):** TAB with `tabContact.crmId` absent + `customer.id='crm-diner-1'`:
   - `placeOrderWithPayment`: `expect(cust_membership_id).toBe('')` and `cust_name === tabContact.name`.
   - `collectBillExisting`: same.

---

## Verification Matrix (seeds QA)
| # | File | Change | How to verify | Automated? |
|---|------|--------|---------------|:--:|
| 1 | orderTransform.js L1414-1421 | placeOrder cust_* holder-first; membership blank-not-diner | Unit: cr527 placeOrder holder + edge tests | YES |
| 2 | orderTransform.js L1793-1796 | collectBill cust_* holder-first; membership blank-not-diner | Unit: cr527 collectBill holder + edge tests | YES |
| 3 | cr527.test.js | holder-in-cust_* + crmId-blank edge | `npx craco test --watchAll=false --testPathPattern=cr527` all green | YES |
| 4 | — | non-TAB unchanged | Unit: existing cash "NO diner fields" + cash cust_* = customer | YES |
| 5 | — | BUG-672 prepaid move-to-credit still works | Browser: prepaid order → move to credit, holder captured in cust_* | NO |
| 6 | — | live write-probe holder≠diner | Browser (`pms@macha`, preprod rest 69): place credit order holder≠diner → request cust_*=holder, diner_*=diner; then Report CUSTOMER + Credit Mgmt = holder | NO |
| 7 | — | holder not CRM-linked | Browser: TAB holder without CRM link → cust_membership_id blank, order still books | NO |

## Post-Code Registry Checklist (Implementation agent runs after coding)
- [ ] registry.json: CR-527 status → note CR-527a IMPLEMENTED (GATE_5A), keep capture-phase history
- [ ] CR_REGISTRY.md: CR-527 row → CR-527a IMPLEMENTED
- [ ] FILE_OWNERSHIP.md: `orderTransform.js` += CR-527a cust_* holder-first (L1414-1421 + L1793-1796)
- [ ] Code markers: `// CR-527a` present in both edited blocks
- [ ] webpack compiles 0 new warnings; `cr527` unit suite green

## Risk register & rollback
- HIGH — re-attributes CRM spend/loyalty to holder on credit bills (owner-approved OD-527a-1). Mitigate via Verify #5/#6/#7 before Gate-5 close.
- Shared-line with BUG-672 (placeOrder) → Verify #5 regress.
- **Rollback:** revert the 2 hunks in `orderTransform.js` (self-contained, no dependency on other nf files); test file revert optional.
- **Backend durability (OD-527a-2 = FE only):** backend still sets `user_name` from `cust_name`; no backend change this pass. Recommend logging a backend brief so a future backend "fix" doesn't double-flip — **owner chose FE-only, so backend brief is optional/deferred, not a blocker.**

**Gate status:** GATE_3_PLAN_COMPLETE. No code written (PLANNING role).
**Next:** Owner **Gate-4 GO** → IMPLEMENTATION (cherry-pick Edits 1-2 with OD-527a-3 deviation + Edit 3 tests), then QA Verify #1-#7.
