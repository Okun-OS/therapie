"""
CP-SAT constraint solver for shift scheduling.

Hard constraints:
  - At most one shift per employee per day
  - Minimum staffing per (day, shift)
  - Vacation / absence / wunschfrei blocks
  - Employee shift-type eligibility
  - Max weekly hours (per wochenstundenSoll)
  - Minimum 11h rest between consecutive-day shifts
  - Max consecutive working days

Soft objective (maximized):
  - +10 per fulfilled shift wish
  - -3 * belastungsHistorie load per shift-type assignment (fairness)
  - +1 per shift assigned (encourages full coverage)
"""

from datetime import datetime, timedelta


SHIFT_TYPE_LOAD: dict[str, str] = {
    "nacht": "nachtSchichten",
    "spaet": "spaetDienste",
}


def _hhmm_mins(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _shift_duration_mins(s: dict) -> int:
    start = _hhmm_mins(s["von"])
    end = _hhmm_mins(s["bis"])
    return end - start if end > start else end - start + 1440


def _rest_between_mins(s1: dict, s2: dict) -> int:
    """Minutes of rest from end of s1 to start of s2 (s2 is next calendar day)."""
    end1 = _hhmm_mins(s1["bis"])
    if s1.get("uebernacht", False):
        end1 += 1440
    start2 = _hhmm_mins(s2["von"]) + 1440
    return start2 - end1


def _iso_week_key(date_str: str) -> str:
    d = datetime.fromisoformat(date_str)
    mon = d - timedelta(days=d.weekday())
    return mon.strftime("%Y-%m-%d")


def solve(rule_model: dict) -> dict:
    from ortools.sat.python import cp_model  # lazy import: keeps startup fast for /health

    days: list[str] = rule_model["zeitraum"]["arbeitstage"]
    employees: list[dict] = rule_model["mitarbeiter"]
    shifts: list[dict] = rule_model["schichten"]
    hard_rules: list[dict] = rule_model.get("harteRegeln", [])
    fairness: dict = rule_model.get("fairness", {})

    def _first_rule_wert(typ: str, default: float) -> float:
        return next((r.get("wert", default) for r in hard_rules if r.get("typ") == typ), default)

    max_weekly_hours = _first_rule_wert("max_wochenstunden", 40)
    min_rest_hours = _first_rule_wert("min_ruhezeit", 11)
    max_consec_days = int(_first_rule_wert("max_folgetage", 5))
    min_rest_mins = int(min_rest_hours * 60)

    n_emp = len(employees)
    n_days = len(days)
    n_shifts = len(shifts)

    if n_emp == 0 or n_days == 0 or n_shifts == 0:
        return _empty_result("Leere Eingabe")

    day_idx: dict[str, int] = {d: i for i, d in enumerate(days)}
    shift_idx: dict[str, int] = {s["id"]: i for i, s in enumerate(shifts)}

    model = cp_model.CpModel()

    # ── Decision variables ────────────────────────────────────────────────────
    X: dict[tuple[int, int, int], cp_model.BoolVarT] = {}
    for e in range(n_emp):
        for d in range(n_days):
            for s in range(n_shifts):
                X[e, d, s] = model.new_bool_var(f"x_{e}_{d}_{s}")

    # ── Hard constraints ──────────────────────────────────────────────────────

    # 1. At most one shift per employee per day
    for e in range(n_emp):
        for d in range(n_days):
            model.add(sum(X[e, d, s] for s in range(n_shifts)) <= 1)

    # 2. Minimum staffing per (day, shift)
    for d in range(n_days):
        for si, shift in enumerate(shifts):
            min_staff = max(1, shift.get("minBesetzungGesamt", 1))
            model.add(sum(X[e, d, si] for e in range(n_emp)) >= min_staff)

    # 3. Unavailability: vacation / absence / wunschfrei / shift-type ineligibility
    for ei, emp in enumerate(employees):
        blocked: set[str] = (
            set(emp.get("urlaubAn", []))
            | set(emp.get("nichtVerfuegbarAn", []))
            | {w["datum"] for w in emp.get("wuensche", []) if w.get("typ") == "wunschfrei"}
        )
        available_types: set[str] = set(emp.get("verfuegbareSchichtTypen", []))

        for di, day in enumerate(days):
            if day in blocked:
                for s in range(n_shifts):
                    model.add(X[ei, di, s] == 0)
                continue
            if available_types:
                for si, shift in enumerate(shifts):
                    if shift.get("typ") not in available_types:
                        model.add(X[ei, di, si] == 0)

    # 4. Max weekly hours
    weeks: dict[str, list[int]] = {}
    for di, day in enumerate(days):
        weeks.setdefault(_iso_week_key(day), []).append(di)

    for ei, emp in enumerate(employees):
        soll = emp.get("wochenstundenSoll", max_weekly_hours)
        max_mins = int(soll * 60) + 30  # 30-min grace
        for d_indices in weeks.values():
            model.add(
                sum(
                    X[ei, di, si] * _shift_duration_mins(shifts[si])
                    for di in d_indices
                    for si in range(n_shifts)
                )
                <= max_mins
            )

    # 5. Minimum rest between shifts on consecutive days
    for e in range(n_emp):
        for di in range(n_days - 1):
            for si1, s1 in enumerate(shifts):
                for si2, s2 in enumerate(shifts):
                    if _rest_between_mins(s1, s2) < min_rest_mins:
                        model.add(X[e, di, si1] + X[e, di + 1, si2] <= 1)

    # 6. Max consecutive working days
    if max_consec_days > 0 and n_days > max_consec_days:
        for e in range(n_emp):
            for start in range(n_days - max_consec_days):
                model.add(
                    sum(
                        X[e, d, s]
                        for d in range(start, start + max_consec_days + 1)
                        for s in range(n_shifts)
                    )
                    <= max_consec_days
                )

    # 7. Max working days per week from arbeitstageProWoche
    for ei, emp in enumerate(employees):
        max_days = emp.get("arbeitstageProWoche", 0)
        if max_days and max_days > 0:
            for d_indices in weeks.values():
                model.add(
                    sum(X[ei, di, s] for di in d_indices for s in range(n_shifts))
                    <= int(max_days)
                )

    # ── Soft objective ────────────────────────────────────────────────────────
    obj_terms: list = []

    # a) Shift wishes (+10 per fulfilled wunsch)
    for ei, emp in enumerate(employees):
        for w in emp.get("wuensche", []):
            if w.get("typ") != "wunsch":
                continue
            di = day_idx.get(w.get("datum", ""))
            si = shift_idx.get(w.get("schichtId", ""))
            if di is not None and si is not None:
                obj_terms.append(10 * X[ei, di, si])

    # b) Belastungshistorie fairness (-3 per load unit for high-load employee+shift-type)
    for ei, emp in enumerate(employees):
        hist: dict = emp.get("belastungsHistorie") or {}
        for si, shift in enumerate(shifts):
            load_key = SHIFT_TYPE_LOAD.get(shift.get("typ", ""))
            load = int(hist.get(load_key, 0)) if load_key else 0
            if load > 0:
                penalty = 3 * load
                for di in range(n_days):
                    obj_terms.append(-penalty * X[ei, di, si])

    # c) Coverage incentive (+1 per shift assigned)
    for e in range(n_emp):
        for d in range(n_days):
            for s in range(n_shifts):
                obj_terms.append(X[e, d, s])

    if obj_terms:
        model.maximize(sum(obj_terms))

    # ── Solve ─────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 25.0
    solver.parameters.num_workers = 4
    status = solver.solve(model)

    # ── Extract solution ──────────────────────────────────────────────────────
    eintraege: list[dict] = []
    decisions: list[dict] = []
    status_name = solver.status_name(status)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for ei, emp in enumerate(employees):
            units: list[str] = emp.get("einheiten", [])
            unit_id = units[0] if units else None
            for di, day in enumerate(days):
                for si, shift in enumerate(shifts):
                    if solver.boolean_value(X[ei, di, si]):
                        eintraege.append(
                            {
                                "mitarbeiterId": emp["id"],
                                "datum": day,
                                "schichtId": shift["id"],
                                "einheitId": unit_id,
                                "istVertretung": False,
                            }
                        )

        for di, day in enumerate(days):
            for si, shift in enumerate(shifts):
                filled = sum(solver.boolean_value(X[e, di, si]) for e in range(n_emp))
                min_staff = max(1, shift.get("minBesetzungGesamt", 1))
                if filled < min_staff:
                    decisions.append(
                        {
                            "typ": "unterbesetzung",
                            "beschreibung": (
                                f'Schicht „{shift["name"]}“ am {day}: '
                                f"nur {filled} von {min_staff} Stellen besetzt"
                            ),
                            "betroffenesDatum": day,
                        }
                    )
    else:
        decisions.append(
            {
                "typ": "solver_fehler",
                "beschreibung": f"Solver-Status: {status_name}. Kein zulässiger Plan gefunden.",
            }
        )

    solver_tag = "ortools-cpsat-v1"
    if status == cp_model.OPTIMAL:
        solver_tag += " (optimal)"
    elif status == cp_model.FEASIBLE:
        solver_tag += " (feasible)"

    return {
        "eintraege": eintraege,
        "decisions": decisions,
        "metadaten": {
            "erstelltAm": datetime.utcnow().isoformat() + "Z",
            "solver": solver_tag,
            "regelmodellVersion": "1.0",
        },
    }


def _empty_result(reason: str) -> dict:
    return {
        "eintraege": [],
        "decisions": [{"typ": "fehler", "beschreibung": reason}],
        "metadaten": {
            "erstelltAm": datetime.utcnow().isoformat() + "Z",
            "solver": "ortools-cpsat-v1",
            "regelmodellVersion": "1.0",
        },
    }
