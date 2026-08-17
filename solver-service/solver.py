"""
CP-SAT constraint solver for shift scheduling.

Hard constraints:
  - At most one shift per employee per day
  - Vacation / absence / wunschfrei blocks
  - Employee shift-type eligibility
  - Max weekly hours (capped at legal max, not individual soll)
  - Minimum rest between shifts on consecutive CALENDAR days
  - Max consecutive CALENDAR working days (seeded from letzteSchichten)
  - Max working days per week (arbeitstageProWoche)
  - Weekend shift cap (fairness.wochenendLimitProMonat)

Soft objective (minimized cost):
  - 10 000 per understaffed slot (heavy penalty, not a hard cut-off)
  - 500 per unfulfilled shift-wish
  -  20 per minute below weekly target (hours fairness)
  -   5 per minute above weekly target (soft overtime penalty)
  - 300 * range of weekend shifts across employees
  - 150 * range of night/late shifts across employees
  -   3 * belastungsHistorie load per shift-type assignment
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

log = logging.getLogger("solver")

SHIFT_TYPE_LOAD: dict[str, str] = {
    "nacht": "nachtSchichten",
    "spaet": "spaetDienste",
}


# ─── Time helpers ──────────────────────────────────────────────────────────────

def _mins(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _shift_dur(s: dict) -> int:
    start = _mins(s["von"])
    end = _mins(s["bis"])
    return end - start if end > start else end - start + 1440


def _rest_between_mins(s1: dict, s2: dict) -> int:
    """
    Rest minutes from end-of-s1 (on day D) to start-of-s2 (on day D+1).
    Accounts for overnight shifts.
    """
    end1 = _mins(s1["bis"])
    if s1.get("uebernacht", False):
        # s1 ends on day D+1 at end1; s2 starts on day D+1 at start2
        return _mins(s2["von"]) - end1
    # s1 ends on day D; s2 starts on day D+1 → add 1440 for the overnight gap
    return _mins(s2["von"]) + 1440 - end1


def _iso_week_key(date_str: str) -> str:
    d = datetime.fromisoformat(date_str)
    mon = d - timedelta(days=d.weekday())
    return mon.strftime("%Y-%m-%d")


def _is_weekend(date_str: str) -> bool:
    return date.fromisoformat(date_str).weekday() >= 5  # Sat=5, Sun=6


def _calendar_day_after(d1: str, d2: str) -> bool:
    """True iff d2 is exactly one calendar day after d1."""
    return (date.fromisoformat(d2) - date.fromisoformat(d1)).days == 1


# ─── History streak helper ─────────────────────────────────────────────────────

def _streak_before_period(emp: dict, first_plan_day: str) -> int:
    """Count consecutive working days immediately before first_plan_day."""
    recent: set[str] = {ls["datum"] for ls in (emp.get("letzteSchichten") or [])}
    if not recent:
        return 0
    check = date.fromisoformat(first_plan_day) - timedelta(days=1)
    streak = 0
    while streak < 35:
        if check.isoformat() not in recent:
            break
        streak += 1
        check -= timedelta(days=1)
    return streak


# ─── §70 Custom constraint executor ──────────────────────────────────────────

# §97: Fähigkeiten dieses Rechendienstes. Die App vergleicht sie mit dem, was
# sie erwartet — läuft eine veraltete Version, fällt das sofort auf, statt dass
# Regeln stillschweigend wirkungslos bleiben.
#
# SOLVER_VERSION bei jeder Änderung erhöhen, die den Regel-Code betrifft.
# SANDBOX_VARS listet die Variablen, die generierter Regel-Code verwenden darf.
SOLVER_VERSION = 98

# §98: Standardfunktionen, die Regel-Code verwenden darf.
# Zu eng gefasst war die Sandbox selbst der Fehler: fehlte etwa str(), scheiterte
# völlig korrekter Regel-Code mit "NameError: name 'str' is not defined".
# Bewusst NICHT enthalten sind alle Wege nach draußen — kein open, eval, exec,
# __import__, getattr/setattr, input, compile, globals/locals.
SAFE_BUILTINS = {
    # Zahlen & Text
    "int": int, "float": float, "str": str, "bool": bool, "round": round, "abs": abs,
    # Sammlungen
    "list": list, "dict": dict, "set": set, "tuple": tuple, "frozenset": frozenset,
    # Iteration
    "range": range, "enumerate": enumerate, "zip": zip, "sorted": sorted,
    "reversed": reversed, "filter": filter, "map": map,
    # Aggregation & Prüfung
    "sum": sum, "min": min, "max": max, "any": any, "all": all, "len": len,
    "isinstance": isinstance, "divmod": divmod,
}
SANDBOX_VARS = [
    "model", "X", "employees", "shifts", "days", "weekdays", "weeks",
    "day_idx", "shift_idx", "n_emp", "n_days", "n_shifts",
    "G", "gruppen", "n_groups",
]
SOLVER_FEATURES = [
    "weeks",            # §94 Kalenderwochen für "pro Woche höchstens N"
    "gruppen",          # §71 Gruppen-/Etagenebene
    "regel-report",     # §96 gescheiterte Regeln werden gemeldet
    "feste-zeiten",     # §96 keine gekürzten Dienstfenster mehr
    "stundenbilanz",    # §96 Soll/Ist der Wochenstunden
]


def capabilities() -> dict:
    return {
        "solverVersion": SOLVER_VERSION,
        "sandboxVars": SANDBOX_VARS,
        "features": SOLVER_FEATURES,
        "safeBuiltins": sorted(SAFE_BUILTINS.keys()),
    }


def validate_constraint_code(code: str) -> dict:
    """
    §98: Regel-Code an einem kleinen Beispielplan WIRKLICH ausführen.

    Vorher konnte eine Regel gespeichert und aktiviert werden, ohne je gelaufen
    zu sein. Erst beim fertigen Dienstplan zeigte sich, dass sie mit SyntaxError
    oder NameError abbrach — die Regel stand auf "aktiv" und tat nichts.

    Geprüft wird gegen ein Miniatur-Modell mit denselben Variablennamen wie im
    Echtbetrieb: 3 Mitarbeiter, 14 Tage (zwei Kalenderwochen), Früh/Tag/Spät,
    zwei Gruppen auf zwei Etagen. Das deckt die üblichen Fehler ab, ohne den
    echten Plan zu berühren.
    """
    from ortools.sat.python import cp_model

    if not code or not code.strip():
        return {"ok": False, "fehler": "Kein Code vorhanden.", "art": "leer"}

    # 1) Syntax — fängt abgeschnittenen Code ab ("'(' was never closed")
    try:
        compile(code, "<regel>", "exec")
    except SyntaxError as exc:
        return {
            "ok": False,
            "art": "syntax",
            "fehler": f"SyntaxError: {exc.msg} (Zeile {exc.lineno})",
            "hinweis": "Der Code ist unvollständig oder fehlerhaft — vermutlich abgeschnitten.",
        }

    # 2) Ausführung gegen ein Beispielmodell — fängt NameError, TypeError, KeyError
    model = cp_model.CpModel()
    demo_shifts = [
        {"id": "frueh", "name": "Frühdienst", "typ": "frueh", "von": "06:00", "bis": "14:30",
         "uebernacht": False, "minBesetzungGesamt": 1, "erforderlicheQualifikationen": []},
        {"id": "tag", "name": "Tagdienst", "typ": "mittel", "von": "07:00", "bis": "15:30",
         "uebernacht": False, "minBesetzungGesamt": 1, "erforderlicheQualifikationen": []},
        {"id": "spaet", "name": "Spätdienst", "typ": "spaet", "von": "08:30", "bis": "17:00",
         "uebernacht": False, "minBesetzungGesamt": 1, "erforderlicheQualifikationen": []},
    ]
    demo_gruppen = [
        {"id": "g1", "name": "Gruppe A", "typ": "gruppe", "mindestbesetzung": 2, "etageId": "e1"},
        {"id": "g2", "name": "Gruppe B", "typ": "gruppe", "mindestbesetzung": 2, "etageId": "e2"},
    ]
    demo_emps = [
        {"id": "m1", "name": "Beispiel Person", "einheiten": ["g1"], "stammEinheitId": "g1",
         "wochenstundenSoll": 40, "arbeitstageProWoche": 5, "qualifikationen": [],
         "verfuegbareSchichtTypen": ["frueh", "spaet", "mittel"], "nichtVerfuegbarAn": [],
         "urlaubAn": [], "wuensche": [], "letzteSchichten": []},
        {"id": "m2", "name": "Zweite Person", "einheiten": ["g2"], "stammEinheitId": "g2",
         "wochenstundenSoll": 30, "arbeitstageProWoche": 4, "qualifikationen": [],
         "verfuegbareSchichtTypen": ["frueh", "spaet", "mittel"], "nichtVerfuegbarAn": [],
         "urlaubAn": [], "wuensche": [], "letzteSchichten": []},
        {"id": "m3", "name": "Dritte Person", "einheiten": [], "stammEinheitId": None,
         "wochenstundenSoll": 20, "arbeitstageProWoche": 3, "qualifikationen": [],
         "verfuegbareSchichtTypen": ["frueh", "spaet", "mittel"], "nichtVerfuegbarAn": [],
         "urlaubAn": [], "wuensche": [], "letzteSchichten": []},
    ]
    demo_days = [f"2026-01-{d:02d}" for d in range(5, 19)]  # zwei volle Kalenderwochen

    n_e, n_d, n_s, n_g = len(demo_emps), len(demo_days), len(demo_shifts), len(demo_gruppen)
    X = {(e, d, s): model.new_bool_var(f"x_{e}_{d}_{s}")
         for e in range(n_e) for d in range(n_d) for s in range(n_s)}
    G = {(e, d, g): model.new_bool_var(f"g_{e}_{d}_{g}")
         for e in range(n_e) for d in range(n_d) for g in range(n_g)}

    weeks_demo: dict[str, list[int]] = {}
    for di, day in enumerate(demo_days):
        weeks_demo.setdefault(_iso_week_key(day), []).append(di)

    report = _execute_custom_constraints(
        [{"id": "probe", "name": "Prüflauf", "code": code}],
        model, X, demo_emps, demo_shifts, demo_days,
        {d: i for i, d in enumerate(demo_days)},
        {s["id"]: i for i, s in enumerate(demo_shifts)},
        n_e, n_d, n_s,
        G=G, gruppen=demo_gruppen, n_groups=n_g,
        weeks=list(weeks_demo.values()),
    )
    eintrag = report[0] if report else {"angewendet": False, "fehler": "Kein Ergebnis"}
    if not eintrag.get("angewendet"):
        fehler = eintrag.get("fehler", "unbekannter Fehler")
        hinweis = "Die Regel bricht beim Ausführen ab."
        if "is not defined" in fehler:
            hinweis = ("Der Code verwendet einen Namen, den die Regel-Umgebung nicht kennt. "
                       f"Erlaubt sind: {', '.join(SANDBOX_VARS)} sowie "
                       f"{', '.join(sorted(SAFE_BUILTINS.keys()))}.")
        return {"ok": False, "art": "laufzeit", "fehler": fehler, "hinweis": hinweis}

    # 3) Wirkt die Regel überhaupt? Eine Regel ohne einzige Beschränkung ist
    #    fast immer ein Denkfehler (z.B. Name trifft niemanden).
    if len(model.proto.constraints) == 0:
        return {
            "ok": True,
            "art": "wirkungslos",
            "warnung": ("Die Regel läuft fehlerfrei, erzeugt am Beispielplan aber keine einzige "
                        "Einschränkung. Häufigste Ursache: ein Personen- oder Dienstname, den es "
                        "so nicht gibt. Bitte Schreibweise prüfen."),
        }

    return {"ok": True, "art": "geprueft", "constraints": len(model.proto.constraints)}


def _execute_custom_constraints(
    constraints: list[dict],
    model,
    X: dict,
    employees: list[dict],
    shifts: list[dict],
    days: list[str],
    day_idx: dict,
    shift_idx: dict,
    n_emp: int,
    n_days: int,
    n_shifts: int,
    G: dict | None = None,
    gruppen: list[dict] | None = None,
    n_groups: int = 0,
    weeks: list[list[int]] | None = None,
) -> list[dict]:
    """
    Execute admin-authored custom constraints in a restricted namespace.
    Each constraint is a Python snippet that may call model.add(...) using the
    pre-bound variables. Errors are caught per-constraint so one bad snippet
    does not break the whole solve.

    §96: returns a report per constraint (applied / failed). A rule that fails
    silently is worse than no rule at all — the planner believes it is in force.
    The caller surfaces failures with the plan.
    """
    if not constraints:
        return []

    safe_builtins = SAFE_BUILTINS

    # Weekday per plan day (0=Mo … 6=So) — generated code cannot import datetime,
    # so recurring day-of-week rules need this precomputed list.
    weekdays = [date.fromisoformat(d).weekday() for d in days]

    ns = {
        "__builtins__": safe_builtins,
        "model": model,
        "X": X,
        "employees": employees,
        "shifts": shifts,
        "days": days,
        "weekdays": weekdays,
        "day_idx": day_idx,
        "shift_idx": shift_idx,
        "n_emp": n_emp,
        "n_days": n_days,
        "n_shifts": n_shifts,
        "G": G or {},
        "gruppen": gruppen or [],
        "n_groups": n_groups,
        # §94: Tage nach Kalenderwochen gruppiert — Voraussetzung für Regeln wie
        # "höchstens ein Frühdienst pro Woche". Ohne das müsste der generierte
        # Code Datumsangaben parsen, was in der Sandbox nicht möglich ist.
        "weeks": weeks or [],
    }

    report: list[dict] = []
    for c in constraints:
        name = c.get("name") or c.get("id") or "Regel"
        try:
            exec(c["code"], ns)  # noqa: S102
            report.append({"id": c.get("id"), "name": name, "angewendet": True})
        except Exception as exc:
            log.warning("[solver] custom constraint %r skipped: %s", name, exc)
            report.append({
                "id": c.get("id"),
                "name": name,
                "angewendet": False,
                "fehler": f"{type(exc).__name__}: {exc}"[:300],
            })
    return report


# ─── Main solver ───────────────────────────────────────────────────────────────

def solve(rule_model: dict) -> dict:
    from ortools.sat.python import cp_model  # lazy import: keeps /health fast

    days: list[str]   = rule_model["zeitraum"]["arbeitstage"]
    employees: list[dict] = rule_model["mitarbeiter"]
    shifts: list[dict]    = rule_model["schichten"]
    hard_rules: list[dict] = rule_model.get("harteRegeln", [])
    fairness: dict         = rule_model.get("fairness", {})

    # Plan variant cost-weight modifiers
    plan_variante = rule_model.get("planVariante", "ausgewogen")
    if plan_variante == "mitarbeiterfreundlich":
        wish_weight = 1000   # doubled: prioritise employee wishes
        fairness_mult = 0.5  # halved: relax fairness pressure
    elif plan_variante == "maximal_fair":
        wish_weight = 250    # halved: individual wishes matter less
        fairness_mult = 2.0  # doubled: enforce tight fairness
    else:  # "ausgewogen" (default)
        wish_weight = 500
        fairness_mult = 1.0

    def _rule(typ: str, default: float) -> float:
        return next(
            (r.get("wert", default) for r in hard_rules if r.get("typ") == typ),
            default,
        )

    max_weekly_hours = _rule("max_wochenstunden", 40.0)
    min_rest_hours   = _rule("min_ruhezeit", 11.0)
    max_consec_days  = int(_rule("max_folgetage", 5))
    min_rest_mins    = int(min_rest_hours * 60)
    max_weekly_mins  = int(max_weekly_hours * 60)

    n_emp    = len(employees)
    n_days   = len(days)
    n_shifts = len(shifts)

    if n_emp == 0 or n_days == 0 or n_shifts == 0:
        return _empty_result("Leere Eingabe (keine Mitarbeiter, Tage oder Schichten)")

    # ── §72/§96 Break rules → NET working minutes ────────────────────────────
    # Presence above the threshold contains an unpaid break; all hour math
    # (legal max, weekly targets) uses NET minutes.
    #
    # §96: A shift has FIXED times. Earlier versions shortened a shift to hit a
    # part-timer's daily target exactly, which produced times no company has
    # ("06:00–10:48", "08:36–15:30"). Part-time is expressed by working fewer
    # DAYS or by shifts the company actually defined — never by inventing a
    # window. eff_min therefore depends on the shift alone.
    pausen = rule_model.get("pausenRegeln") or {}
    br_threshold = int(pausen.get("thresholdMinutes", 360))
    br_deduct = int(pausen.get("deductionMinutes", 30))

    def _net_of_gross(gross: int) -> int:
        return gross - br_deduct if gross >= br_threshold else gross

    eff_min: dict[tuple[int, int], int] = {}  # net working minutes per (emp, shift)
    for _ei in range(len(employees)):
        for _si, _s in enumerate(shifts):
            eff_min[_ei, _si] = _net_of_gross(_shift_dur(_s))

    day_idx:   dict[str, int] = {d: i for i, d in enumerate(days)}
    shift_idx: dict[str, int] = {s["id"]: i for i, s in enumerate(shifts)}
    day_set:   set[str]       = set(days)

    # ── Weeks ────────────────────────────────────────────────────────────────
    weeks: dict[str, list[int]] = {}
    for di, day in enumerate(days):
        weeks.setdefault(_iso_week_key(day), []).append(di)

    # ── Pre-compute rest-violating shift pairs ────────────────────────────────
    rest_violations: set[tuple[int, int]] = set()
    for si1, s1 in enumerate(shifts):
        for si2, s2 in enumerate(shifts):
            if _rest_between_mins(s1, s2) < min_rest_mins:
                rest_violations.add((si1, si2))

    # ── Weekend shift cap ─────────────────────────────────────────────────────
    weekend_cap = (
        fairness.get("wochenendLimitProMonat")
        if fairness.get("wochenendArbeit") and fairness.get("wochenendLimitProMonat")
        else None
    )
    weekend_indices = [di for di, day in enumerate(days) if _is_weekend(day)]

    # ── History streaks ───────────────────────────────────────────────────────
    emp_streaks: list[int] = []
    for emp in employees:
        emp_streaks.append(_streak_before_period(emp, days[0]) if days else 0)

    # ── Existing schedule (for change minimization + freeze) ─────────────────
    # existing_schedule: list of {mitarbeiterId, datum, schichtId}
    # frozen_dates: set of "YYYY-MM-DD" strings whose assignments are locked
    existing_entries: list[dict] = rule_model.get("existingSchedule") or []
    frozen_dates: set[str] = set(rule_model.get("frozenDates") or [])
    # Build lookup: (empId, date) → shiftId
    existing_lookup: dict[tuple[str, str], str] = {
        (e["mitarbeiterId"], e["datum"]): e["schichtId"]
        for e in existing_entries
        if e.get("mitarbeiterId") and e.get("datum") and e.get("schichtId")
    }

    # ── CP-SAT model ─────────────────────────────────────────────────────────
    model = cp_model.CpModel()

    X: dict[tuple[int, int, int], cp_model.BoolVarT] = {
        (e, d, s): model.new_bool_var(f"x_{e}_{d}_{s}")
        for e in range(n_emp)
        for d in range(n_days)
        for s in range(n_shifts)
    }

    # ── §71 Group assignment layer (Kita/Etagen/Gruppen) ─────────────────────
    # Active only when the model defines units of typ "gruppe". Adds a second
    # decision: which group an employee staffs on each working day.
    gruppen: list[dict] = [
        u for u in (rule_model.get("einheiten") or []) if u.get("typ") == "gruppe"
    ]
    group_active = len(gruppen) > 0
    n_groups = len(gruppen)
    G: dict[tuple[int, int, int], cp_model.BoolVarT] = {}
    group_gap_cost: list = []  # §96: Kosten für Arbeit ohne Gruppenzuordnung
    if group_active:
        G = {
            (e, d, g): model.new_bool_var(f"g_{e}_{d}_{g}")
            for e in range(n_emp)
            for d in range(n_days)
            for g in range(n_groups)
        }
        # §96: Wer arbeitet, steht in HÖCHSTENS einer Gruppe — früher war es
        # "in genau einer". Damit war jede Kraft ohne Gruppe unplanbar: Leitung,
        # Verwaltung oder Hauswirtschaft gehören zum Haus, aber nicht in die
        # Gruppenbesetzung. Eine Regel wie "die Leitung wird keiner Gruppe
        # zugeteilt" hätte sie sonst vom Dienst ganz ausgeschlossen.
        # Ohne Gruppe zu arbeiten kostet etwas (soft), damit die Gruppenzuteilung
        # der Normalfall bleibt und nur bewusst gesetzte Regeln davon abweichen.
        for e in range(n_emp):
            for d in range(n_days):
                arbeitet = sum(X[e, d, s] for s in range(n_shifts))
                in_gruppe = sum(G[e, d, g] for g in range(n_groups))
                model.add(in_gruppe <= arbeitet)
                ohne_gruppe = model.new_bool_var(f"nogrp_{e}_{d}")
                model.add(ohne_gruppe >= arbeitet - in_gruppe)
                group_gap_cost.append(500 * ohne_gruppe)

    # ── HARD CONSTRAINTS ─────────────────────────────────────────────────────

    # H1: At most one shift per employee per day
    for e in range(n_emp):
        for d in range(n_days):
            model.add(sum(X[e, d, s] for s in range(n_shifts)) <= 1)

    # H2: Unavailability, vacation, wunschfrei, shift-type eligibility
    for ei, emp in enumerate(employees):
        blocked: set[str] = (
            set(emp.get("urlaubAn", []))
            | set(emp.get("nichtVerfuegbarAn", []))
            | {w["datum"] for w in emp.get("wuensche", []) if w.get("typ") == "wunschfrei"}
        )
        avail_types: set[str] = set(emp.get("verfuegbareSchichtTypen", []))
        for di, day in enumerate(days):
            if day in blocked:
                for s in range(n_shifts):
                    model.add(X[ei, di, s] == 0)
                continue
            if avail_types:
                for si, shift in enumerate(shifts):
                    if shift.get("typ") not in avail_types:
                        model.add(X[ei, di, si] == 0)

    # H8: Qualification requirements — employee must possess all required qualifications
    for si, shift in enumerate(shifts):
        required_quals: list[str] = shift.get("erforderlicheQualifikationen") or []
        if not required_quals:
            continue
        for ei, emp in enumerate(employees):
            emp_quals: set[str] = set(emp.get("qualifikationen") or [])
            if not all(q in emp_quals for q in required_quals):
                # Employee lacks at least one required qualification → block all days
                for di in range(n_days):
                    model.add(X[ei, di, si] == 0)

    # H9: Frozen dates — lock existing assignments on frozen days
    for ei, emp in enumerate(employees):
        for di, day in enumerate(days):
            if day not in frozen_dates:
                continue
            existing_shift_id = existing_lookup.get((emp["id"], day))
            if existing_shift_id and existing_shift_id in shift_idx:
                # Force this exact assignment
                si = shift_idx[existing_shift_id]
                model.add(X[ei, di, si] == 1)
            else:
                # Employee had no assignment on this frozen day → keep them free
                model.add(sum(X[ei, di, s] for s in range(n_shifts)) == 0)

    # §70: Custom constraints generated via natural-language → code pipeline
    constraint_report = _execute_custom_constraints(
        rule_model.get("customConstraints") or [],
        model, X, employees, shifts, days, day_idx, shift_idx,
        n_emp, n_days, n_shifts,
        G=G, gruppen=gruppen, n_groups=n_groups,
        weeks=list(weeks.values()),
    )

    # H3: Legal max weekly hours (NET working minutes, §72)
    for ei in range(n_emp):
        for d_indices in weeks.values():
            model.add(
                sum(
                    X[ei, di, si] * eff_min[ei, si]
                    for di in d_indices
                    for si in range(n_shifts)
                )
                <= max_weekly_mins
            )

    # H4: Minimum rest — only between CALENDAR-consecutive plan days
    for e in range(n_emp):
        for di in range(n_days - 1):
            if not _calendar_day_after(days[di], days[di + 1]):
                continue  # gap of >1 day → enough rest guaranteed
            for si1, si2 in rest_violations:
                model.add(X[e, di, si1] + X[e, di + 1, si2] <= 1)

    # H5: Max consecutive CALENDAR days (window constraint)
    for e in range(n_emp):
        for start_di in range(n_days):
            start_date = date.fromisoformat(days[start_di])
            window: list[int] = []
            for offset in range(max_consec_days + 1):
                check = (start_date + timedelta(days=offset)).isoformat()
                if check in day_idx:
                    window.append(day_idx[check])
            # Only constrain when ALL window slots are plan days
            if len(window) == max_consec_days + 1:
                model.add(
                    sum(X[e, d, s] for d in window for s in range(n_shifts))
                    <= max_consec_days
                )

    # H5b: History-seeded streak limits at start of period
    for ei, emp in enumerate(employees):
        streak = emp_streaks[ei]
        if streak <= 0 or not days:
            continue
        can_work = max(0, max_consec_days - streak)
        first_date = date.fromisoformat(days[0])
        window: list[int] = []
        for offset in range(can_work + 1):
            check = (first_date + timedelta(days=offset)).isoformat()
            if check in day_idx:
                window.append(day_idx[check])
        if window:
            model.add(
                sum(X[ei, d, s] for d in window for s in range(n_shifts))
                <= can_work
            )

    # H6: Max working days per week
    for ei, emp in enumerate(employees):
        max_days = emp.get("arbeitstageProWoche", 0)
        if max_days and max_days > 0:
            for d_indices in weeks.values():
                model.add(
                    sum(X[ei, di, s] for di in d_indices for s in range(n_shifts))
                    <= int(max_days)
                )

    # H7: Weekend shift cap (per planning period)
    if weekend_cap is not None and weekend_indices:
        for e in range(n_emp):
            model.add(
                sum(X[e, d, s] for d in weekend_indices for s in range(n_shifts))
                <= weekend_cap
            )

    # ── SOFT OBJECTIVE (minimize total cost) ──────────────────────────────────
    cost: list = []
    cost.extend(group_gap_cost)  # §96: Arbeit ohne Gruppenzuordnung

    # C1: Understaffing — heavy penalty (soft, not hard → always find a plan)
    for di in range(n_days):
        for si, shift in enumerate(shifts):
            min_staff = max(1, shift.get("minBesetzungGesamt", 1))
            shortage = model.new_int_var(0, n_emp, f"short_{di}_{si}")
            model.add(sum(X[e, di, si] for e in range(n_emp)) + shortage >= min_staff)
            cost.append(10_000 * shortage)

    # C2: Unfulfilled shift wishes (§20/§21: prioritaet → cost weight)
    # prioritaet 1 (critical) → 4× base; 2 (high) → 2× base; 3 (normal) → 1× base
    # §73: among equal-priority wishes for the SAME slot the earlier submission
    # gets a small bonus (first come, first served) — always below one priority
    # step, so priority still dominates.
    PRIO_MULT = {1: 4, 2: 2, 3: 1}
    wish_tuples: list[dict] = []
    for ei, emp in enumerate(employees):
        blocked = (
            set(emp.get("urlaubAn", []))
            | set(emp.get("nichtVerfuegbarAn", []))
        )
        for w in emp.get("wuensche", []):
            if w.get("typ") != "wunsch":
                continue
            day = w.get("datum", "")
            if day in blocked:
                continue
            di = day_idx.get(day)
            si = shift_idx.get(w.get("schichtId", ""))
            if di is not None and si is not None:
                wish_tuples.append({
                    "ei": ei, "di": di, "si": si,
                    "prio": int(w.get("prioritaet", 3)),
                    "ts": w.get("eingereichtAm") or "9999-12-31T23:59:59Z",
                })

    # Rank wishes per slot by submission time: rank 0 → +90, 1 → +60, 2 → +30
    slot_groups: dict[tuple[int, int], list[dict]] = {}
    for wt in wish_tuples:
        slot_groups.setdefault((wt["di"], wt["si"]), []).append(wt)
    for group in slot_groups.values():
        group.sort(key=lambda w: w["ts"])
        for rank, wt in enumerate(group):
            wt["bonus"] = max(0, 90 - 30 * rank) if len(group) > 1 else 0

    for wt in wish_tuples:
        mult = PRIO_MULT.get(wt["prio"], 1)
        effective_weight = wish_weight * mult + wt.get("bonus", 0)
        not_assigned = model.new_bool_var(f"nowish_{wt['ei']}_{wt['di']}_{wt['si']}")
        model.add(not_assigned == 1 - X[wt["ei"], wt["di"], wt["si"]])
        cost.append(effective_weight * not_assigned)

    # C3: Hours below weekly target (per employee per week, NET minutes §72)
    for ei, emp in enumerate(employees):
        target_min = int(emp.get("wochenstundenSoll", 40) * 60)
        for d_indices in weeks.values():
            actual = sum(
                X[ei, di, si] * eff_min[ei, si]
                for di in d_indices
                for si in range(n_shifts)
            )
            below = model.new_int_var(0, target_min, f"below_{ei}")
            model.add(below >= target_min - actual)
            cost.append(20 * below)

    # C4: Hours above weekly target (NET minutes §72)
    # §96: weighted ABOVE the shortfall penalty. With fixed shift lengths a
    # contract like 35 h rarely divides evenly; overshooting the contract is
    # the worse of the two errors, so the solver now prefers to stay under.
    for ei, emp in enumerate(employees):
        target_min = int(emp.get("wochenstundenSoll", 40) * 60)
        for d_indices in weeks.values():
            actual = sum(
                X[ei, di, si] * eff_min[ei, si]
                for di in d_indices
                for si in range(n_shifts)
            )
            above = model.new_int_var(0, max_weekly_mins, f"above_{ei}")
            model.add(above >= actual - target_min)
            cost.append(30 * above)

    # C5: Weekend distribution fairness
    if len(weekend_indices) >= 2 and n_emp >= 2:
        max_we = model.new_int_var(0, len(weekend_indices), "max_we")
        min_we = model.new_int_var(0, len(weekend_indices), "min_we")
        for e in range(n_emp):
            we = sum(X[e, d, s] for d in weekend_indices for s in range(n_shifts))
            model.add(max_we >= we)
            model.add(min_we <= we)
        we_range = model.new_int_var(0, len(weekend_indices), "we_range")
        model.add(we_range == max_we - min_we)
        cost.append(int(300 * fairness_mult) * we_range)

    # C6: Night / late shift fairness
    for typ_name in ("nacht", "spaet"):
        type_shift_indices = [si for si, s in enumerate(shifts) if s.get("typ") == typ_name]
        if not type_shift_indices or n_emp < 2:
            continue
        max_t = model.new_int_var(0, n_days, f"max_{typ_name}")
        min_t = model.new_int_var(0, n_days, f"min_{typ_name}")
        for e in range(n_emp):
            cnt = sum(X[e, d, si] for d in range(n_days) for si in type_shift_indices)
            model.add(max_t >= cnt)
            model.add(min_t <= cnt)
        t_range = model.new_int_var(0, n_days, f"range_{typ_name}")
        model.add(t_range == max_t - min_t)
        cost.append(int(150 * fairness_mult) * t_range)

    # C7: Belastungshistorie — reduce burden on already-loaded employees
    for ei, emp in enumerate(employees):
        hist: dict = emp.get("belastungsHistorie") or {}
        for si, shift in enumerate(shifts):
            load_key = SHIFT_TYPE_LOAD.get(shift.get("typ", ""))
            load = int(hist.get(load_key, 0)) if load_key else 0
            if load > 0:
                penalty = 3 * load
                for di in range(n_days):
                    cost.append(penalty * X[ei, di, si])

    # C9 (§71/§72): coverage on two levels, matching Kita reality:
    # a) every GRUPPE needs minStaff people standing in it per DAY (core-time
    #    coverage — members may be spread across Früh/Tag/Spät shifts)
    # b) every ETAGE needs minStaff people per Früh- and Spät-shift (someone
    #    opens and closes each floor), drawn from its child groups.
    # Both soft with the heavy understaffing penalty (always solvable).
    if group_active:
        for d in range(n_days):
            for gi, grp in enumerate(gruppen):
                min_staff_g = int(grp.get("mindestbesetzung", 1) or 0)
                if min_staff_g <= 0:
                    continue
                short_g = model.new_int_var(0, min_staff_g, f"gshort_{d}_{gi}")
                model.add(sum(G[e, d, gi] for e in range(n_emp)) + short_g >= min_staff_g)
                cost.append(10_000 * short_g)

        # Coverage per SHIFT TYPE (frueh/spaet), not per individual shift: a
        # location may define several Früh variants — any of them opens the
        # floor. Per-shift demands would both over-constrain and blow up the
        # model (memory!) on locations with many shift variants.
        etagen_units = [u for u in (rule_model.get("einheiten") or []) if u.get("typ") == "etage"]
        for et in etagen_units:
            et_min = int(et.get("mindestbesetzung", 0) or 0)
            if et_min <= 0:
                continue
            child_gis = [gi for gi, g in enumerate(gruppen) if g.get("etageId") == et.get("id")]
            if not child_gis:
                continue
            for typ_name in ("frueh", "spaet"):
                type_sis = [si for si, s in enumerate(shifts) if s.get("typ") == typ_name]
                if not type_sis:
                    continue
                for d in range(n_days):
                    covered = []
                    for e in range(n_emp):
                        works_type = sum(X[e, d, si] for si in type_sis)  # 0/1 (H1)
                        for gi in child_gis:
                            z = model.new_bool_var(f"ez_{e}_{d}_{typ_name}_{gi}")
                            model.add(z <= works_type)
                            model.add(z <= G[e, d, gi])
                            model.add(z >= works_type + G[e, d, gi] - 1)
                            covered.append(z)
                    short_e = model.new_int_var(0, et_min, f"eshort_{d}_{typ_name}_{et['id']}")
                    model.add(sum(covered) + short_e >= et_min)
                    cost.append(10_000 * short_e)

    # C10 (§71): Stammgruppen-Treue — leaving the home group costs 300/day,
    # crossing to another Etage costs 800/day. Employees without a home group
    # (Springer) float freely at no cost.
    if group_active:
        etage_of: dict[str, str | None] = {g["id"]: g.get("etageId") for g in gruppen}
        for ei, emp in enumerate(employees):
            stamm = emp.get("stammEinheitId")
            if not stamm or stamm not in etage_of:
                continue
            stamm_etage = etage_of.get(stamm)
            for gi, grp in enumerate(gruppen):
                if grp["id"] == stamm:
                    continue
                w = 300
                if stamm_etage and grp.get("etageId") and grp.get("etageId") != stamm_etage:
                    w = 800
                for d in range(n_days):
                    cost.append(w * G[ei, d, gi])

    # C8: Change minimization — penalise deviations from the existing schedule
    # Only applies on non-frozen days (frozen days are already hard-locked by H9).
    if existing_lookup:
        emp_id_idx: dict[str, int] = {emp["id"]: ei for ei, emp in enumerate(employees)}
        for (emp_id, day), old_shift_id in existing_lookup.items():
            if day not in day_idx or day in frozen_dates:
                continue
            ei = emp_id_idx.get(emp_id)
            si = shift_idx.get(old_shift_id)
            if ei is None or si is None:
                continue
            di = day_idx[day]
            changed = model.new_bool_var(f"chg_{ei}_{di}")
            model.add(changed == 1 - X[ei, di, si])
            cost.append(200 * changed)  # 200 per changed assignment

    if cost:
        model.minimize(sum(cost))

    # ── Solve ─────────────────────────────────────────────────────────────────
    import random as _random
    solver_seed = rule_model.get("solverSeed")  # §44: explicit seed for replay
    if solver_seed is None:
        solver_seed = _random.randint(0, 2**31 - 1)

    solver_inst = cp_model.CpSolver()
    # §89 Zeitbudget: Läuft die Anfrage über die ÖFFENTLICHE Railway-Adresse,
    # kappt der Edge-Proxy lange Verbindungen — der Dienst rechnet weiter, der
    # Aufrufer sieht HTTP 502. Deshalb ein knappes Budget (per SOLVER_MAX_SECONDS
    # anpassbar). CP-SAT liefert die beste bis dahin gefundene Lösung zurück.
    import os as _os
    try:
        _budget = float(_os.environ.get("SOLVER_MAX_SECONDS", "15"))
    except ValueError:
        _budget = 15.0
    solver_inst.parameters.max_time_in_seconds = max(5.0, _budget)
    # §88 Speicher-Schutz: Jeder Worker hält eine eigene Kopie des Modells. In
    # kleinen Containern führte das bei großen Modellen zum OOM-Kill — der
    # Dienst war danach weg und das Gateway meldete dauerhaft HTTP 502.
    # Modellgröße berücksichtigt auch die Gruppen-Ebene (G-Variablen).
    model_size = n_emp * n_days * (n_shifts + (n_groups if group_active else 0))
    if model_size > 12000:
        solver_inst.parameters.num_workers = 1
        solver_inst.parameters.max_time_in_seconds = min(solver_inst.parameters.max_time_in_seconds, 12.0)
    elif model_size > 4000:
        solver_inst.parameters.num_workers = 2
    else:
        solver_inst.parameters.num_workers = 4
    solver_inst.parameters.log_search_progress = False
    solver_inst.parameters.random_seed = solver_seed

    log.info(
        "[solver] %d employees × %d shifts × %d days",
        n_emp, n_shifts, n_days,
    )
    status = solver_inst.solve(model)
    status_name = solver_inst.status_name(status)
    log.info(
        "[solver] %s  wall=%.1fs  obj=%s",
        status_name,
        solver_inst.wall_time,
        f"{solver_inst.objective_value:.0f}" if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else "—",
    )

    # ── Extract solution ───────────────────────────────────────────────────────
    eintraege: list[dict] = []
    decisions: list[dict] = []
    why_not_assigned: list[dict] = []  # §68

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # Build wish lookup for per-assignment explanations (§68)
        wish_lookup: dict[tuple[int, str], str] = {}  # (ei, day) → schichtId
        for ei, emp in enumerate(employees):
            for w in emp.get("wuensche", []):
                if w.get("typ") == "wunsch":
                    wish_lookup[(ei, w["datum"])] = w.get("schichtId", "")

        for ei, emp in enumerate(employees):
            unit_id_default = (emp.get("einheiten") or [None])[0]
            stamm_id = emp.get("stammEinheitId")
            blocked: set[str] = (
                set(emp.get("urlaubAn", []))
                | set(emp.get("nichtVerfuegbarAn", []))
                | {w["datum"] for w in emp.get("wuensche", []) if w.get("typ") == "wunschfrei"}
            )
            for di, day in enumerate(days):
                assigned_si = None
                for si in range(n_shifts):
                    if solver_inst.boolean_value(X[ei, di, si]):
                        assigned_si = si
                        break

                if assigned_si is not None:
                    shift = shifts[assigned_si]
                    # §71: resolve assigned group for this day
                    unit_id = unit_id_default
                    role = None
                    springer_note = None
                    if group_active:
                        for gi in range(n_groups):
                            if solver_inst.boolean_value(G[ei, di, gi]):
                                unit_id = gruppen[gi]["id"]
                                if stamm_id and unit_id != stamm_id:
                                    role = "Springer"
                                    springer_note = f'Springer in „{gruppen[gi]["name"]}"'
                                break

                    # §68: generate whyAssigned explanation
                    why_parts: list[str] = []
                    if springer_note:
                        why_parts.append(springer_note)
                    wished_shift_id = wish_lookup.get((ei, day))
                    if wished_shift_id == shift["id"]:
                        why_parts.append("Wunschdienst erfüllt")
                    target_mins = int(emp.get("wochenstundenSoll", 40) * 60)
                    if target_mins > 0:
                        why_parts.append("Stundenziel")
                    existing_shift = existing_lookup.get((emp["id"], day))
                    if existing_shift == shift["id"]:
                        why_parts.append("unveränderter Bestandsplan")
                    elif existing_shift:
                        why_parts.append("geänderter Bestandsplan")
                    if not why_parts:
                        why_parts.append("Mindestbesetzung")
                    why_assigned = "; ".join(why_parts)

                    entry = {
                        "mitarbeiterId": emp["id"],
                        "datum": day,
                        "schichtId": shift["id"],
                        "einheitId": unit_id,
                        "istVertretung": False,
                        "source": "solver",
                        "whyAssigned": why_assigned,
                    }
                    if role:
                        entry["role"] = role

                    # §96: keine erfundenen Zeiten — der Eintrag übernimmt die
                    # definierten Zeiten des Dienstes unverändert.
                    eintraege.append(entry)
                elif day not in blocked:
                    # §68: explain why not assigned on a work day
                    why_not_assigned.append({
                        "mitarbeiterId": emp["id"],
                        "datum": day,
                        "grund": "Kein Dienst zugewiesen (Stundenziel erreicht oder keine passende Schicht verfügbar)",
                    })

        for di, day in enumerate(days):
            for si, shift in enumerate(shifts):
                filled = sum(solver_inst.boolean_value(X[e, di, si]) for e in range(n_emp))
                min_staff = max(1, shift.get("minBesetzungGesamt", 1))
                if filled < min_staff:
                    decisions.append(
                        {
                            "typ": "unterbesetzung",
                            "beschreibung": (
                                f'Schicht „{shift["name"]}" am {day}: '
                                f"nur {filled} von {min_staff} Stellen besetzt"
                            ),
                            "betroffenesDatum": day,
                        }
                    )
    else:
        diagnosis = _diagnose_infeasibility(
            employees, shifts, days, max_consec_days, min_rest_hours, max_weekly_hours,
        )
        decisions.append(
            {
                "typ": "infeasible",
                "beschreibung": diagnosis,
            }
        )

    # ── §96 Regeln, die nicht angewendet werden konnten ──────────────────────
    # Eine aktive Regel, die im Solver scheitert, muss auffallen: sonst hält der
    # Planer sie für wirksam, während der Plan sie ignoriert.
    for rep in constraint_report:
        if not rep.get("angewendet"):
            decisions.append({
                "typ": "regel_fehlgeschlagen",
                "beschreibung": (
                    f'Die aktive Regel „{rep["name"]}" konnte NICHT angewendet werden '
                    f'({rep.get("fehler", "unbekannter Fehler")}). '
                    "Der Plan wurde ohne diese Regel erstellt — bitte die Regel prüfen "
                    "und neu erzeugen lassen."
                ),
            })

    # ── §96 Stundenbilanz: Soll gegen Ist, offen ausgewiesen ─────────────────
    # Feste Dienstzeiten bedeuten, dass sich nicht jedes Vertragsmodell exakt
    # treffen lässt (35 Std. bei 8-Std.-Diensten = 4 Tage à 32 Std.). Statt die
    # Zeiten passend zu rechnen, wird die Abweichung benannt.
    stundenbilanz: list[dict] = []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for ei, emp in enumerate(employees):
            target_min = int(float(emp.get("wochenstundenSoll", 40) or 0) * 60)
            if target_min <= 0:
                continue
            for wk, d_indices in weeks.items():
                ist = sum(
                    eff_min[ei, si]
                    for di in d_indices
                    for si in range(n_shifts)
                    if solver_inst.boolean_value(X[ei, di, si])
                )
                diff = ist - target_min
                stundenbilanz.append({
                    "mitarbeiterId": emp["id"],
                    "woche": wk,
                    "sollStunden": round(target_min / 60, 2),
                    "istStunden": round(ist / 60, 2),
                    "abweichungStunden": round(diff / 60, 2),
                })
                # Nur echte Abweichungen melden (> 30 Minuten)
                if abs(diff) > 30:
                    richtung = "über" if diff > 0 else "unter"
                    decisions.append({
                        "typ": "stundenabweichung",
                        "beschreibung": (
                            f'{emp.get("name", emp["id"])}: {round(ist / 60, 1)} statt '
                            f'{round(target_min / 60, 1)} Std. in Woche {wk} '
                            f"({abs(round(diff / 60, 1))} Std. {richtung} Vertrag). "
                            "Dienstzeiten bleiben unverändert — für einen genauen Treffer "
                            "einen passenden Teilzeit-Dienst anlegen oder die Arbeitstage anpassen."
                        ),
                    })

    obj_str = (
        f"{solver_inst.objective_value:.0f}"
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
        else "—"
    )
    solver_tag = f"ortools-cpsat-v2 ({status_name}, cost={obj_str}, {solver_inst.wall_time:.1f}s)"

    return {
        "eintraege": eintraege,
        "decisions": decisions,
        "whyNotAssigned": why_not_assigned,  # §68
        "stundenbilanz": stundenbilanz,      # §96
        "regelReport": constraint_report,    # §96: welche Regeln wirklich griffen
        "metadaten": {
            "erstelltAm": datetime.utcnow().isoformat() + "Z",
            "solver": solver_tag,
            "regelmodellVersion": "1.0",
            "solverSeed": solver_seed,  # §44
        },
    }


def _diagnose_infeasibility(
    employees: list[dict],
    shifts: list[dict],
    days: list[str],
    max_consec_days: int,
    min_rest_hours: float,
    max_weekly_hours: float,
) -> str:
    """
    Heuristic diagnosis of why CP-SAT could not find a feasible plan.
    Checks the most common root causes in order of likelihood.
    """
    total_required_per_day = sum(max(1, s.get("minBesetzungGesamt", 1)) for s in shifts)
    n_emp = len(employees)

    issues: list[str] = []

    # Check per-day availability vs. required staffing
    critical_days: list[str] = []
    for day in days:
        available = 0
        for emp in employees:
            blocked: set[str] = (
                set(emp.get("urlaubAn", []))
                | set(emp.get("nichtVerfuegbarAn", []))
                | {w["datum"] for w in emp.get("wuensche", []) if w.get("typ") == "wunschfrei"}
            )
            if day not in blocked:
                available += 1
        if available < total_required_per_day:
            critical_days.append(f"{day} ({available}/{total_required_per_day} verfügbar)")

    if critical_days:
        sample = critical_days[:3]
        rest = len(critical_days) - len(sample)
        suffix = f" und {rest} weitere" if rest > 0 else ""
        issues.append(
            f"Zu wenige Mitarbeiter verfügbar an: {', '.join(sample)}{suffix}."
        )

    # Check if weekly hours budget is sufficient to cover all required shifts
    if not issues:
        total_shift_mins_per_week = sum(_shift_dur(s) * max(1, s.get("minBesetzungGesamt", 1)) for s in shifts)
        # Estimate: 5 plan-days per week
        plan_days_count = len(days)
        weeks_estimate = max(1, plan_days_count / 5)
        total_emp_mins = sum(int(emp.get("wochenstundenSoll", max_weekly_hours) * 60) * weeks_estimate for emp in employees)
        if total_emp_mins < total_shift_mins_per_week * weeks_estimate * 0.9:
            issues.append(
                f"Gesamtstundenkapazität der Mitarbeiter reicht möglicherweise nicht für alle Schichten aus "
                f"({int(total_emp_mins / 60)}h verfügbar, ~{int(total_shift_mins_per_week * weeks_estimate / 60)}h benötigt)."
            )

    # Check if consecutive-day rule is too restrictive given staffing needs
    if not issues and n_emp > 0:
        min_needed_per_emp = total_required_per_day / n_emp
        if min_needed_per_emp > max_consec_days:
            issues.append(
                f"Maximale Folgetage ({max_consec_days}) könnte zu restriktiv sein: "
                f"bei {n_emp} Mitarbeitern und {total_required_per_day} benötigten Stellen je Tag "
                f"müsste im Schnitt jeder {min_needed_per_emp:.1f} Tage am Stück arbeiten."
            )

    if not issues:
        issues.append(
            f"Kein zulässiger Plan gefunden (CP-SAT INFEASIBLE). "
            f"Mögliche Ursachen: zu viele Überschneidungen zwischen Urlauben/Abwesenheiten, "
            f"Ruhezeitanforderungen ({min_rest_hours}h) oder Wochenstundenlimit ({max_weekly_hours}h). "
            f"Bitte Zeitraum, Verfügbarkeiten oder Mindestbesetzungen anpassen."
        )

    return " ".join(issues)


def _empty_result(reason: str) -> dict:
    return {
        "eintraege": [],
        "decisions": [{"typ": "fehler", "beschreibung": reason}],
        "metadaten": {
            "erstelltAm": datetime.utcnow().isoformat() + "Z",
            "solver": "ortools-cpsat-v2",
            "regelmodellVersion": "1.0",
        },
    }
