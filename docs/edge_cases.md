# Edge-Case Documentation

Each case below was tested with a real or fabricated receipt image and a natural-language description.
The table at the top gives the verdict; the body explains what was tricky, what the tool did, and what the correct output should be.

---

## EC-1 — Rounding Absorption Bug (Spice Garden, Bill #0391)

**Receipt:** Butter Chicken + Garlic Naan + Lassi, shared equally by Raj, Simran, Pooja.  
**Complexity:** Multi-level arithmetic inconsistency — extracted items sum ≠ printed subtotal ≠ grand total.

| Field | Value |
|---|---|
| Extracted item sum | ₹490 |
| Printed subtotal | ₹510 (₹20 unexplained) |
| Printed grand total | ₹580 (₹35 above item+charges) |
| Service (5%) | ₹25 |
| Tax (5%) | ₹30 |

**What the tool did (before fix):** Reconciled against the printed ₹580. Found ₹37 gap between per-person totals and grand total. Absorbed the entire ₹37 onto Raj (first person, also largest-share). Output showed "Zero Variance Reconciled" while simultaneously flagging the discrepancy. Raj's total was ₹218 vs the correct ₹181.

**Correct behaviour:**
- Per-person totals must be computed from **extracted item math** (₹490 + charges), not from the printed grand total.
- Rounding absorption is capped at ₹2. The ₹37 gap must be flagged and left unabsorbed.
- `matches_bill: false` with two flags:
  - Printed subtotal ₹510 ≠ extracted items ₹490 — ₹20 unexplained.
  - Grand total ₹580 ≠ extracted items + charges ₹545 — ₹35 unexplained.
- All three participants correctly owe ≈₹181 each (with minor rounding across the three).

**Fix location:** `calculator.py` — Step 5 (rounding correction). Baseline changed from `grand_total` to `extracted_total = round(item_sum + charges)`. `_MAX_ABSORPTION_RUPEES = 2` constant added.

---

## EC-2 — No Service Charge + Round-Off Drop (Udupi Sagar, Bill #1188)

**Receipt:** Masala Dosa + Filter Coffee (Ananya) and Idli Sambar (Vikram). No service charge. CGST + SGST = ₹13.50 total. Round-off printed as +₹0.50.

**What the tool did (before fix):** Correctly applied 0% service charge. Item attribution correct. Settle-up correct. But:
1. Tax column showed Ananya ₹9 + Vikram ₹4 = ₹13, missing the ₹0.50 round-off entirely.
2. No assumption entry logged for the absent service charge — looked like a data gap.

**Correct behaviour:**
- `round_off` must be distributed proportionally per person and folded into each person's total, not silently dropped.
- When `service_charge == 0`, assumption log must read: `"No service charge line found on bill — applied 0%"`.

**Fix location:** `calculator.py` — Step 4 now computes `round_off_share = round(weight * round_off)` per person. Step 0b logs the zero-service assumption.

---

## EC-3 — Tip / Handwritten Addition Silently Dropped (EC-7, Rohan/Sneha Bill)

**Receipt:** Standard printed bill total ₹970. Handwritten tip of ₹88 added at the bottom. Rohan paid ₹1,058 total.

**What the tool did (before fix):** Gemini OCR had no `extra_charges` field in the schema, so the tip had nowhere to go. It was silently dropped. Output: grand total ₹970, "Zero Variance Reconciled," 0 audit flags. Sneha was told she owed ₹452 (her share of ₹970). Rohan was short ₹88 with no indication why.

**Correct behaviour:**
- Tip is extracted into `extra_charges: [{name: "Tip", amount: 88, is_handwritten: true}]`.
- Each extra charge generates an audit flag: `"'Tip' of ₹88 found on bill (appears handwritten) — not covered by fairness rules. Excluded from split. Verify with participants."`
- Split is computed on ₹970 (printed bill before tip). `matches_bill: false` because ₹970 ≠ ₹1,058.
- Users decide manually whether to split the tip; the tool does not pick silently.

**Fix location:** `extractor.py` — `extra_charges` field added to OCR schema with Rule 11. `calculator.py` — Step 0a flags every entry in `extra_charges`.

---

## EC-4 — Shared Platter False-Positive Flag (Curry House, Bill #0774)

**Receipt:** Veg Platter (serves 2) ₹450, Roti x3 ₹90, Kheer ₹110.  
**Description:** "Meera and Kabir shared the platter. All three shared the roti. Jaya had the kheer."

**What the tool did (before fix):** Correctly split all items. But fired two flags:
1. `'Veg Platter' billed qty 1 but description implies 2 consumed`
2. `'Veg Platter (serves 2)' billed qty 1 but description implies 2 consumed` (duplicate via fuzzy match)

Both flags were wrong in reasoning: 2 people sharing 1 platter is normal sharing, not a quantity mismatch.

**Correct behaviour:**
- No flag for shared items where all consumers have `qty = 1`. "2 people sharing 1 dish" is never a mismatch.
- The mismatch flag only fires when at least one consumer explicitly has `qty > 1` (e.g., "Tarun had two cappuccinos").
- Duplicate flags (same string from fuzzy-matched item name and annotated item name) must be deduplicated before output.

**Fix location:** `calculator.py` — `has_explicit_individual_qty` guard added. `dict.fromkeys(flags)` deduplication added at return.

---

## EC-5 — Multi-Unit Individual Consumption (Café, Cappuccino x3)

**Receipt:** Cappuccino x3 = ₹540, Croissant x2 = ₹220, Club Sandwich = ₹260.  
**Description:** "Arjun and Nisha each had a cappuccino. Tarun had two. Arjun and Nisha split the croissants. Tarun had the sandwich."

**Expected split:**
| Person | Cappuccino | Croissant | Sandwich | Subtotal |
|---|---|---|---|---|
| Arjun | ₹180 (1/4 described) | ₹110 | — | ₹290 |
| Nisha | ₹180 (1/4 described) | ₹110 | — | ₹290 |
| Tarun | ₹360 (2/4 described) | — | ₹260 | ₹620 |

**What the tool did (before fix):** Flagged the discrepancy (described qty 4 > billed qty 3) correctly. But split the ₹540 as 1:1:1 (₹180 each) instead of 1:1:2 (₹135:₹135:₹270). Tarun was undercharged ₹180.

**Correct behaviour (after fix):**
- Schema changed to `consumers: [{person, qty}]` to carry explicit quantities.
- Calculator splits proportionally: `share = (person_qty / total_described_qty) * item_amount`.
- For Cappuccino: `total_described_qty = 1+1+2 = 4`. Tarun's share = `(2/4) * 540 = ₹270`.
- Quantity mismatch flag fires (described total 4 > billed qty 3) — user is notified.

**Fix location:** `extractor.py` — Stage 2 schema changed. `calculator.py` — Step 1 & 2 rewritten to use `{person: qty}` map and proportional split.

---

## EC-6 — Partial Subset Sharing (Tamarind Kitchen, Bill #R2)

**Receipt:** 6 items, 4 participants. Gulab Jamun shared only between Priya and Karan (not all four).  
**Description:** "...only Priya and Karan shared the Gulab Jamun. Everything else common to all four."

**Expected:** Aman and Sara each get 1/4 of common items. Priya and Karan each get 1/4 of common items + 1/2 of Gulab Jamun.

**Result:** Tool handled this correctly in all versions. Confirms subset-sharing via `assigned_to` / `consumers` list with only two names works without special cases. Included here to document that sub-group sharing is a tested path.

---

## EC-7 — Discount Applied Before Service & Tax (Punjab Da Dhaba, Bill #2274)

**Receipt:** Subtotal ₹690. Coupon FLAT10 applies 10% discount = -₹69. Service charge 2.5% = ₹31.05 (applied to post-discount subtotal per bill footer: "Discount applied before service & tax"). CGST + SGST 5% = ₹32.60. Round-off -₹0.05. Grand total ₹684.

**Complexity:** Discount applied before service and tax changes the arithmetic order. Most receipts apply discount to subtotal; here it affects the base for service and tax too.

**Result:** Tool extracted all fields correctly. Service and tax allocation (proportional to each person's post-discount subtotal) matched the bill. `matches_bill: true`. All four equal-share participants correctly showed `discount_share: -₹17`.

**UI bug found:** Discount column in `ResultCard.tsx` rendered `--₹17` (double negative) because the UI prepended a `-` sign before calling `fmt()`, which already emits `-` for negative numbers.  
**Fix location:** `ResultCard.tsx` line 466 — removed hardcoded `-` prefix.

---

## EC-8 — No Payer Identified

**Description omits who paid.**

**Expected:** `settle_up: []`, flag: `"No payer identified — settle-up cannot be computed"`.  
**Result:** Correct. Per-person breakdown still computed; only settle-up is empty. Covered by `test_no_payer_adds_flag` unit test.

---

## EC-9 — Unassigned Receipt Item

**Receipt has an item the description doesn't mention at all.**

**Expected per Rule 8:** Assign to ALL people (qty 1 each) and note in assumptions.  
**Result:** Handled correctly by Stage 2 parser. Unit test `test_unassigned_item_raises_flag` validates the flag path for items not in any assignment.

---

## EC-10 — Offline Fallback Parser

**Scenario:** Gemini API rate limit hit during description parsing.

**Expected:** Fallback parser `_mock_fallback_description()` runs, identifies people from capitalized words in the description, infers payer from "X paid" pattern, assigns all items to all identified people equally, and adds flag: `"Generated via offline fallback parser due to AI rate limits."`

**Result:** Verified on Punjab Da Dhaba test run (EC-7 above). All arithmetic correct. Flag correctly surfaced. Limitation: fallback cannot handle subset assignments — everything is assigned equally when fallback is active.
