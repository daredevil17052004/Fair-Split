# Prompt Engineering Log

## Architecture Decision: Does the AI Do the Arithmetic?

**No. The model never does arithmetic. The model only extracts and assigns.**

The pipeline is split into three strictly separate stages:

| Stage | Who does it | What it does |
|---|---|---|
| Stage 1 — Gemini Vision | AI | OCR: reads the receipt image, outputs structured JSON of line items, subtotal, tax, service charge, discount, round-off, grand total, and extra charges. Numbers copied verbatim from the bill — **not computed**. |
| Stage 2 — Gemini Text | AI | Intent parsing: reads the plain-English description, outputs structured JSON assigning each item to its consumers with per-person quantities. **No math performed.** |
| Stage 3 — `calculator.py` | Pure Python | All arithmetic: proportional splits, tax/service/discount allocation, rounding correction, reconciliation, settle-up. Deterministic and fully unit-testable without any API call. |

**Why this split?**

LLMs hallucinate arithmetic. Asking the model to output "Raj owes ₹218" is a direct path to silent, confidently-wrong totals with no way to audit the working. Asking the model to output "Raj consumed 1/3 of the Butter Chicken" is a semantic judgment it handles reliably. The arithmetic then becomes Python `round()` calls — verifiable, reproducible, testable with `pytest`.

The rule of thumb used throughout this project: **AI extracts intent, Python computes money.**

---

## Prompt Iteration Log

### Stage 1 — Receipt OCR Prompt (`RECEIPT_EXTRACTION_PROMPT` in `extractor.py`)

#### v1 — Initial
**Schema:** Basic fields — `line_items`, `subtotal`, `tax`, `grand_total`.  
**Problem that drove change:** No explicit sign rules for `discount` and `round_off`. The model sometimes stored the discount as `-69` (correct sign), sometimes as `69`. Downstream arithmetic was silently wrong when the sign was flipped because `calculator.py` was subtracting an already-negative number, doubling the discount.

#### v2 — Sign rules for discount and round-off
**Change:** Added Rule 1: `"discount" MUST be a POSITIVE number (e.g., if bill shows −228 or (228), store 228)`. Added Rule 2: `"round_off" can be negative (e.g., −0.40) or positive (+0.40) — copy sign exactly`. Added `abs()` sanitisation in `extract_receipt()` as a defensive backstop.  
**Problem that drove change:** Indian restaurant bills almost always show CGST and SGST as two separate lines (e.g., CGST 2.5% = ₹16.30, SGST 2.5% = ₹16.30). The schema had a single `tax` field. The model was only capturing one of the two lines — the other was silently dropped — understating tax by exactly half.

#### v3 — CGST/SGST summation
**Change:** Added Rule 3: `"If CGST and SGST are shown separately, SUM them into the single tax field"`. Added Rule 4 for single-line GST as a special case.  
**Problem that drove change:** Bills with no service charge were indistinguishable from bills where the OCR missed the service charge line. The assumption log showed no entry, making it look like a data gap rather than a deliberate zero. EC-2 (Uduji Sagar) specifically printed "** No Service Charge **" but the tool logged no assumption for this.

#### v4 — Zero service charge assumption
**Change:** Added Rule 5: `"If service charge is absent from the bill, set service_charge to 0"`. Added corresponding assumption log entry in `calculator.py` when `service_charge == 0`: `"No service charge line found on bill — applied 0%"`.  
**Problem that drove change:** When a handwritten ₹88 tip appeared on a receipt (EC-7, Rohan/Sneha bill), the model had no schema field for it. The model silently dropped it — output showed "Zero Variance, 0 Audit Flags." The user trusted the output, Rohan ended up short ₹88 with no indication anything was wrong. A silent miss with zero flags is the worst possible outcome per the assignment brief.

#### v5 — Extra charges (current)
**Change:** Added `extra_charges: [{name, amount, is_handwritten}]` field to the schema. Added Rule 11 listing every charge category to capture: tips, gratuity, delivery fees, packaging fees, cover charges, handwritten additions. `is_handwritten: bool` distinguishes printed vs. handwritten charges. Zero-amount entries are stripped during sanitisation. In `calculator.py`, each `extra_charge` is immediately converted to an audit flag and excluded from split arithmetic.

---

### Stage 2 — Description Parsing Prompt (`DESCRIPTION_PARSING_PROMPT_TEMPLATE` in `extractor.py`)

#### v1 — Initial
**Schema:** `assignments: [{item, assigned_to: [names]}]`.  
**Problem that drove change:** `assigned_to` is a flat name list — it carries no quantity information. When the description said "Tarun had two cappuccinos," the parser could only encode `assigned_to: ["Tarun"]`. The calculator saw one consumer and gave Tarun 1/3 of the total (same as Arjun and Nisha). Tarun was undercharged by exactly one cappuccino's worth. The tool detected the semantic problem (flagged the mismatch) but then resolved it incorrectly (still split 1:1:1 instead of 1:1:2).

#### v2 — Per-person quantity schema
**Change:** Schema changed from `assigned_to: [names]` to `consumers: [{person, qty}]`. Rule 4 updated ("each had" → give each person explicit `qty:1`, calculator splits proportionally by qty). Rule 13 added: sum consumer qtys vs billed qty, add flag if they differ.  
**Problem that drove change:** The quantity mismatch flag was firing for every shared item. "2 people sharing 1 platter" generated the flag: "2 consumed, 1 billed." This is normal sharing — 2 diners splitting a single dish — not a bill discrepancy. The condition `sum(consumer_qtys) != billed_qty` is correct for individual multi-unit consumption (Tarun:2 + Arjun:1 on a qty-2 item) but wrong for equal sharing (2 people splitting 1 platter each given implicit qty:1). EC-4 (Curry House, Veg Platter) showed this as a false positive.

#### v3 — Quantity mismatch guard (current)
**Change:** Added `has_explicit_individual_qty` guard in `calculator.py`: the mismatch flag only fires when at least one consumer has `qty > 1` (someone explicitly consumed multiple units). Pure equal sharing (`1:1:1`) never fires the flag. Three distinct outcomes now: over-consumption → flag, under-consumption → flag, exact explicit match → assumption log (not a flag). Flags deduplicated via `dict.fromkeys()` to prevent the same item triggering two identical messages when the fuzzy-matcher found both the original and annotated item name (e.g., "Veg Platter" and "Veg Platter (serves 2)"). Backward compatibility maintained: calculator accepts both old `assigned_to` list format and new `consumers` dict format.
