"""
§126 Prüfungen für die Regelpakete.

Eine Regel, die ins Leere läuft, ist der teuerste Fehler überhaupt — sie sieht
aus, als würde sie wirken. Deshalb wird hier nicht geprüft, ob ein Baustein
durchläuft, sondern ob der GELÖSTE Plan sich wirklich daran hält.

    python3 -m pytest test_rulepacks.py -q
"""

from __future__ import annotations

import pytest
from ortools.sat.python import cp_model

from rulepacks import apply_pack, verfuegbare_pakete
from rulepacks import bausteine as b
from rulepacks.context import PlanKontext, RegelFehler


# ── Eine kleine, echte Planungsaufgabe ──────────────────────────────────────

def baue_kontext(tage=14, mit_gruppen=True):
    """Zwei Wochen, vier Personen, drei Dienste — klein genug zum Nachrechnen."""
    model = cp_model.CpModel()

    employees = [
        {"id": "e1", "name": "Franka Berg", "rolle": "leitung"},
        {"id": "e2", "name": "Anna Fischer", "rolle": "erzieher"},
        {"id": "e3", "name": "Bea Klein", "rolle": "erzieher"},
        {"id": "e4", "name": "Carl Ohm", "rolle": "hilfskraft"},
    ]
    shifts = [
        {"id": "s1", "name": "Frühdienst", "typ": "frueh"},
        {"id": "s2", "name": "Spätdienst", "typ": "spaet"},
        {"id": "s3", "name": "Wochenenddienst", "typ": "wochenende"},
    ]
    gruppen = [{"id": "g1", "name": "Marienkäfer"}, {"id": "g2", "name": "Bienen"}] \
        if mit_gruppen else []
    etagen = [{"id": "et1", "name": "Erdgeschoss"}]

    # Montag, 7. September 2026 als Start — zwei volle Wochen
    from datetime import date, timedelta
    start = date(2026, 9, 7)
    days = [(start + timedelta(days=i)).isoformat() for i in range(tage)]
    weekdays = [(start + timedelta(days=i)).weekday() for i in range(tage)]

    weeks: list[list[int]] = []
    for di in range(0, tage, 7):
        weeks.append(list(range(di, min(di + 7, tage))))

    X = {
        (ei, di, si): model.new_bool_var(f"x{ei}_{di}_{si}")
        for ei in range(len(employees))
        for di in range(tage)
        for si in range(len(shifts))
    }
    G = {
        (ei, di, gi): model.new_bool_var(f"g{ei}_{di}_{gi}")
        for ei in range(len(employees))
        for di in range(tage)
        for gi in range(len(gruppen))
    }

    # Höchstens ein Dienst je Person und Tag — sonst ist die Aufgabe unsinnig
    for ei in range(len(employees)):
        for di in range(tage):
            model.add(sum(X[ei, di, si] for si in range(len(shifts))) <= 1)

    return PlanKontext(
        model=model, X=X, G=G,
        employees=employees, shifts=shifts, gruppen=gruppen, etagen=etagen,
        days=days, weekdays=weekdays, weeks=weeks,
    )


def loese(ctx):
    """Den Plan wirklich rechnen — erst daran zeigt sich, ob eine Regel wirkt."""
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    status = solver.solve(ctx.model)
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE), "Aufgabe nicht lösbar"
    return solver


def eingeteilt(solver, ctx, ei, di, si) -> bool:
    return solver.value(ctx.X[ei, di, si]) == 1


# ── Die Sucher melden sich laut ─────────────────────────────────────────────

def test_unbekannte_person_wirft_fehler():
    ctx = baue_kontext()
    with pytest.raises(RegelFehler) as fehler:
        ctx.person("Rumpelstilzchen")
    # Die Meldung muss weiterhelfen, nicht nur melden
    assert "Rumpelstilzchen" in str(fehler.value)


def test_mehrdeutiger_name_wirft_fehler():
    ctx = baue_kontext()
    ctx.employees.append({"id": "e5", "name": "Anna Berg", "rolle": "erzieher"})
    with pytest.raises(RegelFehler):
        ctx.person("Anna")   # Anna Fischer und Anna Berg


def test_unbekannter_dienst_wirft_fehler():
    ctx = baue_kontext()
    with pytest.raises(RegelFehler):
        ctx.dienst("Nachtwache")


def test_person_wird_ueber_teilnamen_gefunden():
    ctx = baue_kontext()
    assert ctx.person("Franka") == 0
    assert ctx.person("Fischer") == 1


# ── Bausteine wirken im gelösten Plan ───────────────────────────────────────

def test_leitung_ohne_gruppe():
    ctx = baue_kontext()
    b.leitung_ohne_gruppe(ctx, "Franka")
    solver = loese(ctx)
    for di in range(ctx.n_days):
        for gi in range(ctx.n_groups):
            assert solver.value(ctx.G[0, di, gi]) == 0
    assert any("Gruppe" in z for z in ctx.protokoll)


def test_leitung_ohne_gruppe_ohne_gruppenplanung():
    # Ohne Gruppen darf die Regel nicht scheitern, sondern sagt, dass nichts zu tun ist
    ctx = baue_kontext(mit_gruppen=False)
    b.leitung_ohne_gruppe(ctx, "Franka")
    assert any("keine Gruppenplanung" in z for z in ctx.protokoll)


def test_hoechstens_ein_spaetdienst_pro_woche():
    ctx = baue_kontext()
    # Anreiz setzen, möglichst viele Spätdienste zu vergeben — sonst beweist
    # die Prüfung nichts: der Solver könnte einfach gar nichts einteilen.
    ctx.model.maximize(
        sum(ctx.X[ei, di, 1] for ei in range(ctx.n_emp) for di in range(ctx.n_days))
    )
    b.hoechstens_pro_woche(ctx, "spät", 1)
    solver = loese(ctx)
    for ei in range(ctx.n_emp):
        for woche in ctx.weeks:
            anzahl = sum(1 for di in woche if eingeteilt(solver, ctx, ei, di, 1))
            assert anzahl <= 1, f"Person {ei} hat {anzahl} Spätdienste in einer Woche"


def test_ohne_die_regel_gaebe_es_mehr_spaetdienste():
    """Die Gegenprobe — sonst könnte die Regel wirkungslos sein und der Test grün."""
    ctx = baue_kontext()
    ctx.model.maximize(
        sum(ctx.X[ei, di, 1] for ei in range(ctx.n_emp) for di in range(ctx.n_days))
    )
    solver = loese(ctx)
    hoechstens = max(
        sum(1 for di in woche if eingeteilt(solver, ctx, ei, di, 1))
        for ei in range(ctx.n_emp) for woche in ctx.weeks
    )
    assert hoechstens > 1, "Ohne Regel müsste es mehr als einen Spätdienst geben"


def test_dienst_nur_am_wochenende():
    ctx = baue_kontext()
    ctx.model.maximize(
        sum(ctx.X[ei, di, 2] for ei in range(ctx.n_emp) for di in range(ctx.n_days))
    )
    b.dienst_nur_an(ctx, "Wochenend", 5, 6)   # Samstag, Sonntag
    solver = loese(ctx)
    for di, wt in enumerate(ctx.weekdays):
        if wt in (5, 6):
            continue
        for ei in range(ctx.n_emp):
            assert not eingeteilt(solver, ctx, ei, di, 2)


def test_person_frei_am_freitag():
    ctx = baue_kontext()
    ctx.model.maximize(sum(ctx.X.values()))
    b.person_frei_an(ctx, "Carl", 4)   # Freitag
    solver = loese(ctx)
    for di, wt in enumerate(ctx.weekdays):
        if wt != 4:
            continue
        for si in range(ctx.n_shifts):
            assert not eingeteilt(solver, ctx, 3, di, si)


def test_nur_diese_dienste():
    ctx = baue_kontext()
    ctx.model.maximize(sum(ctx.X.values()))
    b.nur_diese_dienste(ctx, "Bea", "Früh")
    solver = loese(ctx)
    for di in range(ctx.n_days):
        assert not eingeteilt(solver, ctx, 2, di, 1)   # kein Spätdienst
        assert not eingeteilt(solver, ctx, 2, di, 2)   # kein Wochenenddienst


def test_niemals_dienst():
    ctx = baue_kontext()
    ctx.model.maximize(sum(ctx.X.values()))
    b.niemals_dienst(ctx, "Carl", "Spät")
    solver = loese(ctx)
    for di in range(ctx.n_days):
        assert not eingeteilt(solver, ctx, 3, di, 1)


def test_nicht_gemeinsam():
    ctx = baue_kontext()
    ctx.model.maximize(sum(ctx.X.values()))
    b.nicht_gemeinsam(ctx, "Anna", "Bea")
    solver = loese(ctx)
    for di in range(ctx.n_days):
        for si in range(ctx.n_shifts):
            zusammen = eingeteilt(solver, ctx, 1, di, si) and eingeteilt(solver, ctx, 2, di, si)
            assert not zusammen


def test_immer_eine_fachkraft():
    ctx = baue_kontext()
    ctx.model.maximize(sum(ctx.X.values()))
    b.immer_eine_fachkraft(ctx, "Früh", "erzieher", "leitung")
    solver = loese(ctx)
    for di in range(ctx.n_days):
        besetzt = [ei for ei in range(ctx.n_emp) if eingeteilt(solver, ctx, ei, di, 0)]
        if not besetzt:
            continue
        rollen = {ctx.employees[ei]["rolle"] for ei in besetzt}
        assert rollen & {"erzieher", "leitung"}, f"Tag {di} nur mit Hilfskräften besetzt"


def test_fachkraftregel_ohne_fachkraefte_wirft_fehler():
    ctx = baue_kontext()
    with pytest.raises(RegelFehler) as fehler:
        b.immer_eine_fachkraft(ctx, "Früh", "gibtsnicht")
    assert "ins Leere" in str(fehler.value)


def test_feste_gruppe():
    ctx = baue_kontext()
    ctx.model.maximize(sum(ctx.G.values()))
    b.feste_gruppe(ctx, "Anna", "Bienen")
    solver = loese(ctx)
    for di in range(ctx.n_days):
        assert solver.value(ctx.G[1, di, 0]) == 0   # nicht Marienkäfer


def test_feste_gruppe_ohne_gruppenplanung_wirft_fehler():
    ctx = baue_kontext(mit_gruppen=False)
    with pytest.raises(RegelFehler):
        b.feste_gruppe(ctx, "Anna", "Bienen")


# ── Das Paket als Ganzes ────────────────────────────────────────────────────

def test_kita_paket_ist_registriert():
    ids = [p["id"] for p in verfuegbare_pakete()]
    assert "kita_sonnenschein" in ids


def test_kita_paket_laeuft_und_berichtet():
    ctx = baue_kontext()
    bericht = apply_pack("kita_sonnenschein", ctx)
    assert bericht["angewendet"] is True
    assert "Kita Sonnenschein" in bericht["name"]
    # Jede Regel muss sich im Protokoll wiederfinden
    protokoll = " ".join(bericht["regeln"])
    assert "Gruppe" in protokoll
    assert "spät" in protokoll.lower()
    assert "Fachkraft" in protokoll


def test_kita_paket_wirkt_im_geloesten_plan():
    ctx = baue_kontext()
    ctx.model.maximize(sum(ctx.X.values()))
    apply_pack("kita_sonnenschein", ctx)
    solver = loese(ctx)
    # Franka in keiner Gruppe
    for di in range(ctx.n_days):
        for gi in range(ctx.n_groups):
            assert solver.value(ctx.G[0, di, gi]) == 0
    # Höchstens ein Spätdienst je Woche
    for ei in range(ctx.n_emp):
        for woche in ctx.weeks:
            assert sum(1 for di in woche if eingeteilt(solver, ctx, ei, di, 1)) <= 1


def test_unbekanntes_paket_verhindert_die_planung_nicht():
    ctx = baue_kontext()
    bericht = apply_pack("gibt_es_nicht", ctx)
    assert bericht["angewendet"] is False
    assert bericht["fehler"]


def test_kein_paket_ist_kein_fehler():
    assert apply_pack(None, baue_kontext()) is None
    assert apply_pack("", baue_kontext()) is None


def test_paket_id_kann_keinen_fremden_modulpfad_adressieren():
    # Ein Paketname darf niemals irgendein Modul im System laden
    for boese in ["../../os", "os.path", "solver", "__builtins__"]:
        bericht = apply_pack(boese, baue_kontext())
        assert bericht["angewendet"] is False


def test_fehler_im_paket_verhindert_die_planung_nicht():
    """Ein kaputtes Paket muss auffallen, aber den Kunden nicht lahmlegen."""
    import sys
    import types
    modul = types.ModuleType("rulepacks.kunden.kaputt")
    modul.META = {"kunde": "Test", "version": 1}
    def apply(ctx):
        raise ValueError("absichtlich kaputt")
    modul.apply = apply
    sys.modules["rulepacks.kunden.kaputt"] = modul
    try:
        bericht = apply_pack("kaputt", baue_kontext())
        assert bericht["angewendet"] is False
        assert "absichtlich kaputt" in bericht["fehler"]
    finally:
        del sys.modules["rulepacks.kunden.kaputt"]
