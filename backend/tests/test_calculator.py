"""
Unit tests for calculator.py.
Verified manually against the four sample receipts (R1–R4) provided in the assignment.

Run with:
    cd backend
    pytest tests/test_calculator.py -v
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from calculator import calculate_split


# ─────────────────────────────────────────────────────────────────────────────
# R1 — Brew & Bite Café, Koramangala
# Subtotal 1040 · Service 52 · GST 54.60 · Round-off +0.40 · Grand Total 1147
# Ravi: cappuccino + sandwich | Neha: pasta + lime soda | Sameer: brownie
# Sameer paid.
# ─────────────────────────────────────────────────────────────────────────────
def test_r1_totals_reconcile():
    line_items = [
        {"name": "Cappuccino", "qty": 1, "amount": 180},
        {"name": "Grilled Chicken Sandwich", "qty": 1, "amount": 260},
        {"name": "Penne Arrabiata", "qty": 1, "amount": 320},
        {"name": "Fresh Lime Soda", "qty": 1, "amount": 120},
        {"name": "Brownie", "qty": 1, "amount": 160},
    ]
    assignments = [
        {"item": "Cappuccino", "assigned_to": ["Ravi"]},
        {"item": "Grilled Chicken Sandwich", "assigned_to": ["Ravi"]},
        {"item": "Penne Arrabiata", "assigned_to": ["Neha"]},
        {"item": "Fresh Lime Soda", "assigned_to": ["Neha"]},
        {"item": "Brownie", "assigned_to": ["Sameer"]},
    ]
    result = calculate_split(
        line_items=line_items,
        subtotal=1040,
        service_charge=52,
        discount=0,
        tax=54.60,
        round_off=0.40,
        grand_total=1147,
        assignments=assignments,
        people=["Ravi", "Neha", "Sameer"],
        payer="Sameer",
        assumptions=[],
        flags=[],
    )

    assert result["grand_total"] == 1147
    assert result["reconciliation"]["matches_bill"] is True
    assert result["paid_by"] == "Sameer"
    assert result["reconciliation"]["sum_of_person_totals"] == 1147
    assert len(result["flags"]) == 0  # clean bill, no flags expected

    by_name = {p["name"]: p for p in result["per_person"]}
    assert by_name["Ravi"]["subtotal"] == 440   # 180+260
    assert by_name["Neha"]["subtotal"] == 440   # 320+120
    assert by_name["Sameer"]["subtotal"] == 160

    # Settle-up: Ravi + Neha owe Sameer their totals
    settle = {s["from"]: s["amount"] for s in result["settle_up"]}
    assert "Ravi" in settle
    assert "Neha" in settle
    assert "Sameer" not in settle  # payer doesn't pay themselves
    assert settle["Ravi"] + settle["Neha"] + by_name["Sameer"]["total"] == 1147


def test_r1_no_discount():
    """Discount is 0 — all discount_share values must be 0."""
    line_items = [
        {"name": "Cappuccino", "qty": 1, "amount": 180},
        {"name": "Grilled Chicken Sandwich", "qty": 1, "amount": 260},
        {"name": "Penne Arrabiata", "qty": 1, "amount": 320},
        {"name": "Fresh Lime Soda", "qty": 1, "amount": 120},
        {"name": "Brownie", "qty": 1, "amount": 160},
    ]
    assignments = [
        {"item": "Cappuccino", "assigned_to": ["Ravi"]},
        {"item": "Grilled Chicken Sandwich", "assigned_to": ["Ravi"]},
        {"item": "Penne Arrabiata", "assigned_to": ["Neha"]},
        {"item": "Fresh Lime Soda", "assigned_to": ["Neha"]},
        {"item": "Brownie", "assigned_to": ["Sameer"]},
    ]
    result = calculate_split(
        line_items=line_items,
        subtotal=1040,
        service_charge=52,
        discount=0,
        tax=54.60,
        round_off=0.40,
        grand_total=1147,
        assignments=assignments,
        people=["Ravi", "Neha", "Sameer"],
        payer="Sameer",
        assumptions=[],
        flags=[],
    )
    for p in result["per_person"]:
        assert p["discount_share"] == 0, f"{p['name']} should have 0 discount"


# ─────────────────────────────────────────────────────────────────────────────
# R2 — Tamarind Kitchen, HSR Layout
# Subtotal 1220 · Service 61 · GST 64.05 · Round-off −0.05 · Grand Total 1345
# Gulab Jamun shared by Priya+Karan only; everything else common to all four.
# Priya paid.
# ─────────────────────────────────────────────────────────────────────────────
def test_r2_partial_shared_item():
    """Gulab Jamun is split between only 2 of 4 people."""
    line_items = [
        {"name": "Paneer Butter Masala", "qty": 1, "amount": 320},
        {"name": "Dal Makhani", "qty": 1, "amount": 260},
        {"name": "Butter Naan", "qty": 4, "amount": 240},
        {"name": "Jeera Rice", "qty": 1, "amount": 180},
        {"name": "Gulab Jamun", "qty": 2, "amount": 120},
        {"name": "Masala Papad", "qty": 2, "amount": 100},
    ]
    all_four = ["Aman", "Priya", "Karan", "Sara"]
    assignments = [
        {"item": "Paneer Butter Masala", "assigned_to": all_four},
        {"item": "Dal Makhani", "assigned_to": all_four},
        {"item": "Butter Naan", "assigned_to": all_four},
        {"item": "Jeera Rice", "assigned_to": all_four},
        {"item": "Gulab Jamun", "assigned_to": ["Priya", "Karan"]},
        {"item": "Masala Papad", "assigned_to": all_four},
    ]
    result = calculate_split(
        line_items=line_items,
        subtotal=1220,
        service_charge=61,
        discount=0,
        tax=64.05,
        round_off=-0.05,
        grand_total=1345,
        assignments=assignments,
        people=all_four,
        payer="Priya",
        assumptions=[],
        flags=[],
    )

    assert result["grand_total"] == 1345
    assert result["reconciliation"]["matches_bill"] is True

    by_name = {p["name"]: p for p in result["per_person"]}

    # Aman and Sara each get equal share of common items only
    # Common item total = 320+260+240+180+100 = 1100, split 4 ways = 275 each
    assert by_name["Aman"]["subtotal"] == 275
    assert by_name["Sara"]["subtotal"] == 275

    # Priya and Karan each get 275 + 60 (half of Gulab Jamun 120)
    assert by_name["Priya"]["subtotal"] == 335
    assert by_name["Karan"]["subtotal"] == 335

    # Priya is payer — doesn't appear in settle_up
    settle_from = {s["from"] for s in result["settle_up"]}
    assert "Priya" not in settle_from
    assert "Aman" in settle_from
    assert "Karan" in settle_from
    assert "Sara" in settle_from


def test_r2_settle_up_sums_correctly():
    """Everyone's totals must sum to grand total."""
    line_items = [
        {"name": "Paneer Butter Masala", "qty": 1, "amount": 320},
        {"name": "Dal Makhani", "qty": 1, "amount": 260},
        {"name": "Butter Naan", "qty": 4, "amount": 240},
        {"name": "Jeera Rice", "qty": 1, "amount": 180},
        {"name": "Gulab Jamun", "qty": 2, "amount": 120},
        {"name": "Masala Papad", "qty": 2, "amount": 100},
    ]
    all_four = ["Aman", "Priya", "Karan", "Sara"]
    assignments = [
        {"item": "Paneer Butter Masala", "assigned_to": all_four},
        {"item": "Dal Makhani", "assigned_to": all_four},
        {"item": "Butter Naan", "assigned_to": all_four},
        {"item": "Jeera Rice", "assigned_to": all_four},
        {"item": "Gulab Jamun", "assigned_to": ["Priya", "Karan"]},
        {"item": "Masala Papad", "assigned_to": all_four},
    ]
    result = calculate_split(
        line_items=line_items,
        subtotal=1220,
        service_charge=61,
        discount=0,
        tax=64.05,
        round_off=-0.05,
        grand_total=1345,
        assignments=assignments,
        people=all_four,
        payer="Priya",
        assumptions=[],
        flags=[],
    )
    total_via_settle = (
        sum(s["amount"] for s in result["settle_up"])
        + next(p["total"] for p in result["per_person"] if p["name"] == "Priya")
    )
    assert total_via_settle == 1345


# ─────────────────────────────────────────────────────────────────────────────
# R3 — The Daily Grind, Powai
# Subtotal 1560 · Service 78 · GST 81.90 · Round-off +0.10 · Grand Total 1720
# Pizza/pasta/garlic-bread shared equally by all three.
# Two beers: Ishaan + Rohit. Mojito: Meera. Rohit paid.
# ─────────────────────────────────────────────────────────────────────────────
def test_r3_three_way_and_two_way_split():
    line_items = [
        {"name": "Margherita Pizza", "qty": 1, "amount": 380},
        {"name": "Arrabiata Pasta", "qty": 1, "amount": 340},
        {"name": "Garlic Bread", "qty": 1, "amount": 160},
        {"name": "Craft Beer", "qty": 2, "amount": 500},
        {"name": "Virgin Mojito", "qty": 1, "amount": 180},
    ]
    all_three = ["Ishaan", "Meera", "Rohit"]
    assignments = [
        {"item": "Margherita Pizza", "assigned_to": all_three},
        {"item": "Arrabiata Pasta", "assigned_to": all_three},
        {"item": "Garlic Bread", "assigned_to": all_three},
        {"item": "Craft Beer", "assigned_to": ["Ishaan", "Rohit"]},
        {"item": "Virgin Mojito", "assigned_to": ["Meera"]},
    ]
    result = calculate_split(
        line_items=line_items,
        subtotal=1560,
        service_charge=78,
        discount=0,
        tax=81.90,
        round_off=0.10,
        grand_total=1720,
        assignments=assignments,
        people=all_three,
        payer="Rohit",
        assumptions=[],
        flags=[],
    )

    assert result["grand_total"] == 1720
    assert result["reconciliation"]["matches_bill"] is True
    assert len(result["flags"]) == 0

    by_name = {p["name"]: p for p in result["per_person"]}

    # Common food items each person's share: (380+340+160)/3 = 293.33
    # Ishaan/Rohit extra beer: 500/2 = 250 each
    # Meera extra mojito: 180
    # So Ishaan ≈ Rohit subtotal > Meera subtotal
    assert by_name["Ishaan"]["subtotal"] > by_name["Meera"]["subtotal"]
    assert by_name["Rohit"]["subtotal"] > by_name["Meera"]["subtotal"]

    # Check item label format for shared items
    meera_items = by_name["Meera"]["items"]
    assert any("(1/3)" in item for item in meera_items), "Three-way split should show (1/3)"


def test_r3_reconciled():
    line_items = [
        {"name": "Margherita Pizza", "qty": 1, "amount": 380},
        {"name": "Arrabiata Pasta", "qty": 1, "amount": 340},
        {"name": "Garlic Bread", "qty": 1, "amount": 160},
        {"name": "Craft Beer", "qty": 2, "amount": 500},
        {"name": "Virgin Mojito", "qty": 1, "amount": 180},
    ]
    all_three = ["Ishaan", "Meera", "Rohit"]
    assignments = [
        {"item": "Margherita Pizza", "assigned_to": all_three},
        {"item": "Arrabiata Pasta", "assigned_to": all_three},
        {"item": "Garlic Bread", "assigned_to": all_three},
        {"item": "Craft Beer", "assigned_to": ["Ishaan", "Rohit"]},
        {"item": "Virgin Mojito", "assigned_to": ["Meera"]},
    ]
    result = calculate_split(
        line_items=line_items, subtotal=1560, service_charge=78, discount=0,
        tax=81.90, round_off=0.10, grand_total=1720, assignments=assignments,
        people=all_three, payer="Rohit", assumptions=[], flags=[],
    )
    totals = [p["total"] for p in result["per_person"]]
    assert sum(totals) == 1720


# ─────────────────────────────────────────────────────────────────────────────
# R4 — Spice Route, Jubilee Hills (has a 15% discount)
# Subtotal 1520 · Discount WELCOME15 -15% -228 · Service 76 · GST 68.40
# Round-off -0.40 · Grand Total 1436
# Dev + Nikhil: chicken biryani (each). Anjali: veg biryani. Farah: rogan josh.
# Raita + soft drinks: common to all. Anjali paid.
# ─────────────────────────────────────────────────────────────────────────────
def test_r4_discount_allocation():
    """Discount must be allocated proportional to subtotal (negative discount_share)."""
    line_items = [
        {"name": "Chicken Biryani", "qty": 2, "amount": 560},
        {"name": "Veg Biryani", "qty": 1, "amount": 240},
        {"name": "Mutton Rogan Josh", "qty": 1, "amount": 420},
        {"name": "Raita", "qty": 2, "amount": 120},
        {"name": "Soft Drinks", "qty": 3, "amount": 180},
    ]
    all_four = ["Dev", "Nikhil", "Anjali", "Farah"]
    assignments = [
        {"item": "Chicken Biryani", "assigned_to": ["Dev", "Nikhil"]},
        {"item": "Veg Biryani", "assigned_to": ["Anjali"]},
        {"item": "Mutton Rogan Josh", "assigned_to": ["Farah"]},
        {"item": "Raita", "assigned_to": all_four},
        {"item": "Soft Drinks", "assigned_to": all_four},
    ]
    result = calculate_split(
        line_items=line_items,
        subtotal=1520,
        service_charge=76,
        discount=228,
        tax=68.40,
        round_off=-0.40,
        grand_total=1436,
        assignments=assignments,
        people=all_four,
        payer="Anjali",
        assumptions=[],
        flags=[],
    )

    assert result["grand_total"] == 1436
    assert result["reconciliation"]["matches_bill"] is True

    by_name = {p["name"]: p for p in result["per_person"]}

    # Subtotals
    assert by_name["Dev"]["subtotal"] == 355    # 280 biryani + 30 raita + 45 drinks
    assert by_name["Nikhil"]["subtotal"] == 355
    assert by_name["Anjali"]["subtotal"] == 315  # 240 + 30 + 45
    assert by_name["Farah"]["subtotal"] == 495   # 420 + 30 + 45

    # All discount_shares must be negative
    for p in result["per_person"]:
        assert p["discount_share"] <= 0, f"{p['name']} discount_share must be ≤ 0"

    # Anjali is payer — not in settle_up as "from"
    settle_from = {s["from"] for s in result["settle_up"]}
    assert "Anjali" not in settle_from
    assert settle_from == {"Dev", "Nikhil", "Farah"}


def test_r4_totals_sum():
    line_items = [
        {"name": "Chicken Biryani", "qty": 2, "amount": 560},
        {"name": "Veg Biryani", "qty": 1, "amount": 240},
        {"name": "Mutton Rogan Josh", "qty": 1, "amount": 420},
        {"name": "Raita", "qty": 2, "amount": 120},
        {"name": "Soft Drinks", "qty": 3, "amount": 180},
    ]
    all_four = ["Dev", "Nikhil", "Anjali", "Farah"]
    assignments = [
        {"item": "Chicken Biryani", "assigned_to": ["Dev", "Nikhil"]},
        {"item": "Veg Biryani", "assigned_to": ["Anjali"]},
        {"item": "Mutton Rogan Josh", "assigned_to": ["Farah"]},
        {"item": "Raita", "assigned_to": all_four},
        {"item": "Soft Drinks", "assigned_to": all_four},
    ]
    result = calculate_split(
        line_items=line_items, subtotal=1520, service_charge=76, discount=228,
        tax=68.40, round_off=-0.40, grand_total=1436, assignments=assignments,
        people=all_four, payer="Anjali", assumptions=[], flags=[],
    )
    assert sum(p["total"] for p in result["per_person"]) == 1436


# ─────────────────────────────────────────────────────────────────────────────
# Edge case tests
# ─────────────────────────────────────────────────────────────────────────────

def test_three_way_equal_split_rounding():
    """100 split 3 ways → rounding correction applied to largest person."""
    result = calculate_split(
        line_items=[{"name": "Shared Item", "qty": 1, "amount": 100}],
        subtotal=100,
        service_charge=0,
        discount=0,
        tax=0,
        round_off=0,
        grand_total=100,
        assignments=[{"item": "Shared Item", "assigned_to": ["A", "B", "C"]}],
        people=["A", "B", "C"],
        payer="A",
        assumptions=[],
        flags=[],
    )
    # 100/3 = 33.33 each → 33+33+33 = 99, correction +1 → one person pays 34
    assert result["grand_total"] == 100
    assert result["reconciliation"]["matches_bill"] is True
    assert sum(p["total"] for p in result["per_person"]) == 100
    totals = sorted([p["total"] for p in result["per_person"]])
    assert totals == [33, 33, 34]


def test_no_payer_adds_flag():
    """No payer in description → flag raised, settle_up empty."""
    result = calculate_split(
        line_items=[{"name": "Item", "qty": 1, "amount": 100}],
        subtotal=100, service_charge=0, discount=0, tax=0, round_off=0,
        grand_total=100,
        assignments=[{"item": "Item", "assigned_to": ["A", "B"]}],
        people=["A", "B"],
        payer=None,
        assumptions=[],
        flags=[],
    )
    assert result["paid_by"] is None
    assert result["settle_up"] == []
    assert any("No payer" in f for f in result["flags"])


def test_unassigned_item_raises_flag():
    """An item present on the bill but absent from assignments → flagged."""
    result = calculate_split(
        line_items=[
            {"name": "Item A", "qty": 1, "amount": 100},
            {"name": "Mystery Item", "qty": 1, "amount": 50},
        ],
        subtotal=150, service_charge=0, discount=0, tax=0, round_off=0,
        grand_total=150,
        assignments=[{"item": "Item A", "assigned_to": ["Alice"]}],
        people=["Alice"],
        payer="Alice",
        assumptions=[],
        flags=[],
    )
    assert any("Mystery Item" in f for f in result["flags"])


def test_single_person():
    """One person — they pay everything."""
    result = calculate_split(
        line_items=[{"name": "Steak", "qty": 1, "amount": 800}],
        subtotal=800, service_charge=40, discount=0, tax=42, round_off=0,
        grand_total=882,
        assignments=[{"item": "Steak", "assigned_to": ["Solo"]}],
        people=["Solo"],
        payer="Solo",
        assumptions=[],
        flags=[],
    )
    assert result["grand_total"] == 882
    assert result["reconciliation"]["matches_bill"] is True
    assert result["settle_up"] == []  # paying themselves — nothing to settle
    assert result["per_person"][0]["name"] == "Solo"
    assert result["per_person"][0]["total"] == 882


def test_person_with_zero_subtotal():
    """Person assigned nothing → 0 subtotal, 0 tax, 0 total, not in settle_up amounts."""
    result = calculate_split(
        line_items=[{"name": "Dinner", "qty": 1, "amount": 500}],
        subtotal=500, service_charge=0, discount=0, tax=0, round_off=0,
        grand_total=500,
        assignments=[{"item": "Dinner", "assigned_to": ["Alice"]}],
        people=["Alice", "Bob"],
        payer="Alice",
        assumptions=[],
        flags=[],
    )
    by_name = {p["name"]: p for p in result["per_person"]}
    assert by_name["Bob"]["subtotal"] == 0
    assert by_name["Bob"]["total"] == 0
    # Bob owes 0 — should be absent from settle_up (or present with 0)
    bob_settle = [s for s in result["settle_up"] if s["from"] == "Bob"]
    assert all(s["amount"] == 0 for s in bob_settle)
