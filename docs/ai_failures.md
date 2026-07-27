# Where the AI Was Wrong — 3 Concrete Failure Examples

These are real failures observed during testing where the model's first output was wrong.
Each entry documents what happened, how the error was caught, and what the fix was.

---

## Failure 1 — Silent Rounding Absorption (Spice Garden, Bill #0391)

### What the model output (wrong)

```
Participant  Subtotal  Service  Tax  Discount  Net Total
Raj          ₹163      ₹8       ₹10  —         ₹218   ← wrong
Simran       ₹163      ₹8       ₹10  —         ₹181
Pooja        ₹163      ₹8       ₹10  —         ₹181
```

```
Settle-up:
  Raj → Simran  ₹218   ← wrong
  Pooja → Simran ₹181
```

```
Reconciliation: "Zero Variance Reconciled" ✓
Audit Flags: 3 (including "₹37 discrepancy... absorbed by Raj")
```

### What is actually correct

All three shares are identical — equal third of everything. Correct net total for each: **₹181**.

### How I caught it

The flags section said `"₹37 discrepancy... absorbed by Raj"` while the header said `"Zero Variance Reconciled"`. These two statements directly contradict each other — you cannot have zero variance and a ₹37 absorbed discrepancy simultaneously. The ₹37 difference also exactly matched one cappuccino's worth of unexplained bill inflation, pointing to the absorption logic as the source.

### What was wrong in the code

`calculator.py` Step 5 was computing `diff = grand_total_int - sum_of_totals` (comparing to the **printed** grand total) and then applying the full diff regardless of size:

```python
# WRONG — was:
diff = grand_total_int - sum_of_totals  # could be ₹37
correction_person["total"] += diff      # silently applied to one person
```

The printed grand total was itself wrong (₹580 vs extracted ₹545). Trusting it as the reconciliation target caused the ₹37 to flow directly into Raj's total.

### The fix

Two changes:
1. Reconcile against `extracted_total = round(item_sum + charges)`, not the printed `grand_total`.
2. Cap absorption at `_MAX_ABSORPTION_RUPEES = 2`. Gaps > ₹2 are flagged and left unabsorbed. The separate Step 5b checks `|grand_total - final_sum|` and flags when > ₹2 with `matches_bill: false`.

---

## Failure 2 — Handwritten Tip Silently Dropped, Zero Flags Returned (EC-7)

### What the model output (wrong)

```
Bill: ₹970 (printed), Tip: ₹88 (handwritten), Rohan paid: ₹1,058

Output:
  Rohan: ₹518
  Sneha: ₹452
  Grand Total: ₹970
  Reconciliation: "Zero Variance Reconciled"
  Audit Flags: 0
```

### What is actually correct

The ₹88 tip must appear as an audit flag. The split of ₹970 may be arithmetically correct, but the output is semantically wrong — Sneha is being undercharged and Rohan is absorbing a cost that wasn't disclosed to either party.

### How I caught it

When I manually checked the receipt image, the handwritten "Tip ₹88" line was clearly visible at the bottom. The output showed ₹970 as the grand total but the receipt showed ₹1,058 written as the final amount. The `flags: []` response was the clearest signal — a system that claims 0 audit flags on a bill with an ambiguous handwritten addition is lying by silence.

### What was wrong in the code

The Stage 1 OCR prompt schema had no field for tip or any non-standard charge. When Gemini saw the handwritten tip, it had no JSON key to put it in. It silently discarded it. The extractor's `defaults` dict also had no `extra_charges` key, so even if the model tried to include it, the sanitisation step would have dropped it.

### The fix

Three-layer fix:
1. **Prompt (extractor.py):** Added `extra_charges: [{name, amount, is_handwritten}]` to the OCR schema. Added Rule 11 explicitly listing tips, gratuity, delivery, packaging, cover charges, and handwritten additions as capture targets.
2. **Sanitisation (extractor.py):** `extract_receipt()` now sanitises and validates each `extra_charge` entry, filtering zero-amount entries.
3. **Calculator (calculator.py):** Step 0a iterates `extra_charges` and appends a flag for each one. The charge is excluded from all split math but explicitly visible to users.

---

## Failure 3 — Multi-Unit Consumption Split as Equal Share (Cappuccino, EC-5)

### What the model output (wrong)

```
Receipt: Cappuccino x3 = ₹540
Description: "Arjun and Nisha each had one, Tarun had two."

Stage 2 parser output:
  assignments: [{item: "Cappuccino", assigned_to: ["Arjun", "Nisha", "Tarun"]}]

Calculator split: ₹540 / 3 = ₹180 each

Tarun's Cappuccino share: ₹180   ← wrong, should be ₹360
```

The tool correctly flagged the quantity mismatch (described qty 4 > billed qty 3) but then resolved it wrong — it detected the problem, logged it as a warning, and proceeded with the incorrect equal split anyway.

### What is actually correct

```
Described consumption: Arjun 1, Nisha 1, Tarun 2 → total 4
Proportional split of ₹540:
  Arjun: (1/4) × ₹540 = ₹135
  Nisha: (1/4) × ₹540 = ₹135
  Tarun: (2/4) × ₹540 = ₹270
```

Tarun's correct subtotal: ₹290 (₹135 Croissant share) + ₹270 (Cappuccino) + ₹260 (Sandwich) ... no, wait. Tarun had no Croissant. Tarun's correct subtotal: ₹270 + ₹260 = ₹530.

### How I caught it

Cross-checked the per-person subtotal column against manual arithmetic. Tarun's subtotal showed ₹440 (₹180 cappuccino + ₹260 sandwich). With two cappuccinos, his subtotal should be ₹360 + ₹260 = ₹620. The ₹180 discrepancy was exactly one cappuccino's unit price — confirming the split was 1:1:1 instead of 1:1:2.

### What was wrong in the code

The Stage 2 schema used `assigned_to: [names]` — a flat list with no quantity dimension. The parser encoded all three consumers but had no way to say "Tarun gets 2." The calculator then saw 3 names and did `amount / len(assigned)` which is always equal regardless of actual consumption.

### The fix

Two-layer fix:
1. **Prompt schema (extractor.py):** Changed `assigned_to: [names]` to `consumers: [{person, qty}]`. The model now encodes `[{person: "Arjun", qty: 1}, {person: "Nisha", qty: 1}, {person: "Tarun", qty: 2}]`.
2. **Calculator (calculator.py):** Step 1 reads `consumers` format and builds a `{person: qty}` dict. Step 2 splits each item amount as `(person_qty / total_described_qty) * item_amount` — proportional, not equal. Backward-compatible with old `assigned_to` format via the `qty_aware_keys` set that gates the mismatch flag.
