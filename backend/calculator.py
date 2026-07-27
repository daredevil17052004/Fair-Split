"""
Pure Python arithmetic engine for bill splitting.

No AI/LLM calls here — all math is deterministic and verifiable.

Fairness rules (per assignment spec):
  1. Each person pays for items they consumed.
  2. Shared items split equally among the people who shared that specific item.
  3. Tax + service charge allocated proportional to each person's pre-tax subtotal.
  4. A bill-level discount allocated proportional to subtotal.
  5. Round-off line (if present) distributed proportionally; absorbed by largest-share
     person only when the residual is ≤ ₹2 (pure paise-level rounding artefact).
  6. If extracted totals diverge from the printed grand total by more than ₹2,
     the discrepancy is FLAGGED and NOT absorbed — matches_bill is set to false.
"""

from __future__ import annotations

from typing import Dict, List, Optional

# Maximum rupee gap that may be silently absorbed as a rounding artefact.
# Anything larger must be flagged and left unabsorbed.
_MAX_ABSORPTION_RUPEES = 2


def calculate_split(
    line_items: List[Dict],
    subtotal: float,
    service_charge: float,
    discount: float,
    tax: float,
    round_off: float,
    grand_total: float,
    assignments: List[Dict],
    people: List[str],
    payer: Optional[str],
    assumptions: List[str],
    flags: List[str],
    extra_charges: Optional[List[Dict]] = None,
) -> Dict:
    """
    Compute a fair, fully-reconciled per-person bill split.

    Args:
        line_items:     [{name, qty, amount}] — from receipt extractor
        subtotal:       printed subtotal on bill (₹)
        service_charge: printed service charge (₹, positive)
        discount:       printed discount as POSITIVE number (₹)
        tax:            printed tax/GST (₹)
        round_off:      printed round-off (₹, may be negative)
        grand_total:    printed grand total (₹)
        assignments:    [{item: str, assigned_to: [names]}] — from parser
        people:         all people in the party
        payer:          name of person who paid, or None
        assumptions:    mutable list — appended to during calculation
        flags:          mutable list — appended to during calculation
        extra_charges:  [{name, amount, is_handwritten}] — tips, delivery fees, etc.

    Returns:
        Dict matching the exact API response contract.
    """

    # ── 0. Validate printed bill arithmetic ──────────────────────────────────
    computed = subtotal + service_charge - discount + tax + round_off
    if abs(computed - grand_total) > 1.0:
        flags.append(
            f"Bill arithmetic check: "
            f"{subtotal} + {service_charge}(svc) − {discount}(disc) + {tax}(tax) + {round_off}(rnd) "
            f"= {computed:.2f} but printed grand total = {grand_total}"
        )

    # ── 0a. Flag extra charges (tips, delivery fees, etc.) ──────────────────
    # These are EXCLUDED from the split — fairness rules don’t cover them.
    # Surface every one as a flag so participants can decide consciously.
    for ec in (extra_charges or []):
        handwritten_note = "(appears handwritten) " if ec.get("is_handwritten") else ""
        flags.append(
            f"'{ec['name']}' of ₹{ec['amount']:.0f} found on bill {handwritten_note}"
            f"— not covered by fairness rules. Excluded from split. Verify with participants."
        )

    # ── 0b. Log zero service charge assumption ──────────────────────────────
    if service_charge == 0:
        assumptions.append(
            "No service charge line found on bill \u2014 applied 0%"
        )

    # ── 1. Build item → {person: qty} map (lowercase keys for fuzzy match) ──
    #
    # Accepts BOTH formats from the LLM:
    #   New: consumers: [{person, qty}, ...]  — quantities are meaningful
    #   Old: assigned_to: [name, ...]          — each person gets equal share
    assignment_map: Dict[str, Dict[str, float]] = {}
    qty_aware_keys: set = set()   # items that used the new consumers format
    for a in assignments:
        key = a["item"].strip().lower()
        if "consumers" in a:
            # New format: [{person, qty}, ...]
            person_qty: Dict[str, float] = {}
            for c in a["consumers"]:
                p = str(c.get("person", "")).strip()
                q = float(c.get("qty", 1) or 1)
                if p:
                    person_qty[p] = person_qty.get(p, 0) + q
            assignment_map[key] = person_qty
            qty_aware_keys.add(key)
        else:
            # Old format: assigned_to: [name, ...]  (all qty implicitly 1)
            assignment_map[key] = {
                p.strip(): 1.0 for p in a.get("assigned_to", [])
            }

    # ── 2. Per-person item subtotals ────────────────────────────────────────
    person_raw_sub: Dict[str, float] = {p: 0.0 for p in people}
    person_item_list: Dict[str, List[str]] = {p: [] for p in people}

    item_sum = 0.0
    for item in line_items:
        name: str = item["name"]
        amount = float(item["amount"])
        billed_qty = float(item.get("qty", 1) or 1)
        item_sum += amount

        # Try exact key first, then partial match
        key = name.strip().lower()
        consumer_map = assignment_map.get(key)

        if consumer_map is None:
            # Attempt partial/fuzzy match
            for map_key, val in assignment_map.items():
                if map_key in key or key in map_key:
                    consumer_map = val
                    break

        if consumer_map is None:
            flags.append(
                f"Item '{name}' was not assigned to anyone — excluded from split"
            )
            continue

        # Filter to people actually in the party
        valid_consumers: Dict[str, float] = {}
        for person, qty in consumer_map.items():
            if person in person_raw_sub:
                valid_consumers[person] = qty
            else:
                flags.append(
                    f"Person '{person}' in assignment not found in party — skipped"
                )

        if not valid_consumers:
            continue

        total_described_qty = sum(valid_consumers.values())

        # Flag qty mismatch ONLY for qty-aware (consumers) format assignments,
        # AND only when the described individual totals genuinely exceed or fall
        # short of what's on the bill.
        #
        # Key distinction:
        #   2 people sharing 1 platter  → total_described_qty = 2×1 = 2, billed = 1
        #     → this is NORMAL sharing — do NOT flag
        #   Tarun:2 + Arjun:1 for qty-3 item → total = 3, billed = 3 → no flag (match)
        #   Tarun:2 + Arjun:1 for qty-2 item → total = 3, billed = 2 → FLAG (over)
        #
        # Rule: only fire when the sum of EXPLICITLY STATED individual quantities
        # (i.e. any consumer with qty > 1, meaning someone deliberately said "had two")
        # differs from the billed qty. Pure 1:1:1 sharing never triggers this.
        resolved_key = key
        matched_key = resolved_key if resolved_key in qty_aware_keys else None
        if matched_key is None:
            for mk in qty_aware_keys:
                if mk in key or key in mk:
                    matched_key = mk
                    break

        if matched_key is not None:
            # Only meaningful when at least one consumer has qty > 1 (explicit
            # individual consumption, not just "shared among N people equally")
            has_explicit_individual_qty = any(q > 1.0 for q in valid_consumers.values())
            if has_explicit_individual_qty:
                if total_described_qty > billed_qty + 0.01:
                    flags.append(
                        f"Quantity mismatch: '{name}' billed as {billed_qty:.0f} "
                        f"but description implies {total_described_qty:.0f} consumed — "
                        f"splitting billed amount proportionally to described quantities."
                    )
                elif total_described_qty < billed_qty - 0.01:
                    flags.append(
                        f"Quantity mismatch: '{name}' billed as {billed_qty:.0f} "
                        f"but description only accounts for {total_described_qty:.0f} — "
                        f"{billed_qty - total_described_qty:.0f} unit(s) unassigned."
                    )
                else:
                    # Exact match with explicit quantities — log as assumption
                    assumptions.append(
                        f"'{name}': {billed_qty:.0f} billed, "
                        f"{total_described_qty:.0f} described — quantities match."
                    )

        # Split amount proportionally to each person's described qty share
        for person, qty in valid_consumers.items():
            share = (qty / total_described_qty) * amount
            person_raw_sub[person] += share
            n = len(valid_consumers)
            if n == 1:
                label_suffix = ""
            elif abs(qty - 1.0) < 0.01:
                label_suffix = f" (1/{n})"
            else:
                label_suffix = f" ({qty:.0f}/{total_described_qty:.0f})"
            person_item_list[person].append(f"{name}{label_suffix}")


    # Check item sum vs printed subtotal
    if abs(item_sum - subtotal) > 0.5:
        flags.append(
            f"Extracted line items sum to ₹{item_sum:.2f} but printed subtotal "
            f"is ₹{subtotal:.2f} — ₹{abs(item_sum - subtotal):.2f} unexplained"
        )

    # ── 3. Proportional weight ──────────────────────────────────────────────
    total_raw = sum(person_raw_sub.values())

    if total_raw == 0:
        # Degenerate: nobody assigned anything → split equally and flag
        n_people = len(people) or 1
        for p in people:
            person_raw_sub[p] = 1.0 / n_people
        total_raw = 1.0
        flags.append("No items assigned to anyone — all charges split equally")

    # ── 4. Compute per-person components (rounded individually) ────────────
    per_person_data: List[Dict] = []

    for person in people:
        raw = person_raw_sub[person]
        weight = raw / total_raw

        sub_display = round(raw)
        service_share = round(weight * service_charge)
        discount_share = -round(weight * discount)   # always ≤ 0
        tax_share = round(weight * tax)
        # Distribute the printed round-off proportionally (can be +ve or -ve)
        round_off_share = round(weight * round_off)
        total = sub_display + service_share + discount_share + tax_share + round_off_share

        per_person_data.append(
            {
                "name": person,
                "items": person_item_list[person],
                "_raw": raw,          # internal — removed before output
                "subtotal": sub_display,
                "tax_share": tax_share,
                "service_share": service_share,
                "discount_share": discount_share,
                "total": total,
            }
        )

    # ── 5. Paise-level rounding correction ─────────────────────────────────
    #
    # Reconcile against OUR extracted total (item_sum + charges), NOT against
    # the printed grand_total — the printed total may itself have errors.
    # Only absorb if the gap is within _MAX_ABSORPTION_RUPEES (≤ ₹2).
    # Larger gaps are flagged and left unabsorbed.
    extracted_total = round(item_sum + service_charge - discount + tax + round_off)
    sum_of_totals = sum(p["total"] for p in per_person_data)
    diff = extracted_total - sum_of_totals

    if diff != 0:
        if abs(diff) <= _MAX_ABSORPTION_RUPEES:
            correction_person = max(per_person_data, key=lambda p: p["_raw"])
            correction_person["total"] += diff
            sign = "+" if diff > 0 else ""
            assumptions.append(
                f"₹{sign}{diff} rounding correction absorbed by "
                f"{correction_person['name']} (largest food share)"
            )
        else:
            # Large gap — do NOT absorb; flag it so the user sees honest totals
            flags.append(
                f"₹{diff} discrepancy between per-person totals and extracted "
                f"item total — NOT absorbed. Check for unassigned items or "
                f"charges not reflected in line items."
            )

    # ── 5b. Check per-person totals vs printed grand total ─────────────────
    grand_total_int = round(grand_total)
    final_sum = sum(p["total"] for p in per_person_data)
    printed_diff = grand_total_int - final_sum
    if abs(printed_diff) > _MAX_ABSORPTION_RUPEES:
        flags.append(
            f"Grand total ₹{grand_total} \u2260 extracted items + charges "
            f"₹{final_sum} \u2014 ₹{abs(printed_diff)} unexplained. "
            f"Split calculated on extracted line items. User should verify the bill."
        )

    # Strip internal key
    for p in per_person_data:
        p.pop("_raw", None)

    # ── 6. Reconciliation ───────────────────────────────────────────────────
    reconciliation = {
        "sum_of_person_totals": final_sum,
        "matches_bill": final_sum == grand_total_int,
    }

    # ── 7. Settle-up ────────────────────────────────────────────────────────
    settle_up: List[Dict] = []
    if payer:
        for p in per_person_data:
            if p["name"] != payer and p["total"] > 0:
                settle_up.append(
                    {"from": p["name"], "to": payer, "amount": p["total"]}
                )
    else:
        flags.append("No payer identified — settle-up cannot be computed")

    return {
        "per_person": per_person_data,
        "grand_total": grand_total_int,
        "reconciliation": reconciliation,
        "paid_by": payer,
        "settle_up": settle_up,
        "assumptions": assumptions,
        # Deduplicate flags while preserving order (dict.fromkeys trick)
        "flags": list(dict.fromkeys(flags)),
    }
