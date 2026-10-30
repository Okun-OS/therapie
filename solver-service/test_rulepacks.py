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


def loese_mit_ziel(ctx):
    """
    §268 Wie `loese`, aber mit dem Ziel des Pakets.

    `loese` darüber löst nur: Es sucht IRGENDEINE zulässige Lösung. Für harte
    Regeln genügt das — eine verbotene Zuteilung ist dort gar nicht möglich.

    Für WEICHE Regeln genügt es nicht, und das ist eine Falle: `ctx.strafe`
    sammelt die Kosten nur ein; minimiert werden sie erst vom echten
    Rechendienst. Wer eine weiche Regel mit `loese` prüft, prüft, ob der
    Solver zufällig das Richtige tut — und bekommt eine Prüfung, die mal grün
    und mal rot ist, ohne dass sich am Programm etwas geändert hätte.
    """
    if ctx.kosten:
        ctx.model.minimize(sum(ctx.kosten))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    status = solver.solve(ctx.model)
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE), "Aufgabe nicht lösbar"
    return solver


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


# ── §161 Rollenbasierte Bausteine und das Musterpaket ───────────────────────

def pflege_kontext(tage=14, mit_gruppen=True, mit_nacht=True, mit_azubi=True):
    """
    Eine Pflegeeinrichtung statt einer Kita — das Musterpaket ist dafür
    gebaut. Bewusst mit Nachtdienst und einer Person in Ausbildung, weil
    genau daran die Regeln hängen, die es hinzufügt.
    """
    ctx = baue_kontext(tage=tage, mit_gruppen=mit_gruppen)
    ctx.employees = [
        {"id": "e1", "name": "Frauke Leit", "rolle": "leitung"},
        {"id": "e2", "name": "Anna Fischer", "rolle": "pflegefachkraft"},
        {"id": "e3", "name": "Bea Klein", "rolle": "pflegefachkraft"},
        {"id": "e4", "name": "Carl Ohm", "rolle": "pflegehilfskraft"},
        {"id": "e5", "name": "Dana Neu", "rolle": "pflegehilfskraft"},
    ]
    if mit_azubi:
        ctx.employees.append({"id": "e6", "name": "Emil Lern", "rolle": "auszubildender"})

    ctx.shifts = [
        {"id": "s1", "name": "Frühdienst", "typ": "frueh"},
        {"id": "s2", "name": "Spätdienst", "typ": "spaet"},
    ]
    if mit_nacht:
        ctx.shifts.append({"id": "s3", "name": "Nachtdienst", "typ": "nacht"})

    # Variablen neu aufbauen, weil sich Personen und Dienste geändert haben.
    from ortools.sat.python import cp_model as cm
    model = cm.CpModel()
    ctx.model = model
    ctx.X = {
        (ei, di, si): model.new_bool_var(f"x{ei}_{di}_{si}")
        for ei in range(len(ctx.employees))
        for di in range(ctx.n_days)
        for si in range(len(ctx.shifts))
    }
    ctx.G = {
        (ei, di, gi): model.new_bool_var(f"g{ei}_{di}_{gi}")
        for ei in range(len(ctx.employees))
        for di in range(ctx.n_days)
        for gi in range(ctx.n_groups)
    }
    for ei in range(len(ctx.employees)):
        for di in range(ctx.n_days):
            model.add(sum(ctx.X[ei, di, si] for si in range(len(ctx.shifts))) <= 1)
    ctx.protokoll = []
    return ctx


def test_rolle_ohne_gruppe_trifft_ueber_die_rolle():
    ctx = pflege_kontext()
    b.rolle_ohne_gruppe(ctx, "leitung")
    solver = loese(ctx)
    for di in range(ctx.n_days):
        for gi in range(ctx.n_groups):
            assert solver.value(ctx.G[0, di, gi]) == 0


def test_rolle_ohne_gruppe_wirft_wenn_die_rolle_fehlt():
    ctx = pflege_kontext()
    with pytest.raises(RegelFehler):
        b.rolle_ohne_gruppe(ctx, "hausmeister")


def test_rolle_niemals_dienst():
    ctx = pflege_kontext()
    b.rolle_niemals_dienst(ctx, "nacht", "auszubildend")
    solver = loese(ctx)
    azubi = len(ctx.employees) - 1
    nacht = ctx.dienst("Nacht")
    for di in range(ctx.n_days):
        assert solver.value(ctx.X[azubi, di, nacht]) == 0


def test_hoechstens_am_stueck_begrenzt_den_block():
    ctx = pflege_kontext()
    nacht = ctx.dienst("Nacht")
    # Damit die Grenze überhaupt greifen MUSS: möglichst viele Nächte
    for ei in range(ctx.n_emp):
        for di in range(ctx.n_days):
            ctx.model.add(ctx.X[ei, di, nacht] == 1).only_enforce_if(
                ctx.model.new_bool_var(f"frei{ei}_{di}").negated())
    b.hoechstens_am_stueck(ctx, "nacht", 3)
    solver = loese(ctx)
    for ei in range(ctx.n_emp):
        folge = 0
        for di in range(ctx.n_days):
            folge = folge + 1 if solver.value(ctx.X[ei, di, nacht]) == 1 else 0
            assert folge <= 3, f"{ctx.employees[ei]['name']} hat {folge} Nächte am Stück"


def test_freies_wochenende_laesst_ein_ganzes_frei():
    ctx = pflege_kontext()
    # Ohne Gegendruck waere ein leerer Plan die einfachste Loesung. Deshalb
    # wird verlangt, dass jede Person an moeglichst vielen Tagen arbeitet —
    # erst dann zeigt sich, ob die Regel wirklich ein Wochenende freihaelt.
    for ei in range(ctx.n_emp):
        ctx.model.add(
            sum(ctx.X[ei, di, si]
                for di in range(ctx.n_days)
                for si in range(len(ctx.shifts))) >= ctx.n_days - 2)
    b.freies_wochenende(ctx, 1)
    solver = loese(ctx)
    for ei in range(ctx.n_emp):
        frei = 0
        for di in range(ctx.n_days - 1):
            if ctx.weekdays[di] != 5:
                continue
            sa = sum(solver.value(ctx.X[ei, di, si]) for si in range(len(ctx.shifts)))
            so = sum(solver.value(ctx.X[ei, di + 1, si]) for si in range(len(ctx.shifts)))
            if sa == 0 and so == 0:
                frei += 1
        assert frei >= 1, f"{ctx.employees[ei]['name']} hat kein ganzes Wochenende frei"


def test_freies_wochenende_ohne_wochenende_im_plan():
    # Ein Plan von Montag bis Freitag enthaelt kein vollstaendiges Wochenende.
    ctx = pflege_kontext(tage=5)
    b.freies_wochenende(ctx, 1)
    assert any("nichts zu tun" in z and "Wochenende" in z for z in ctx.protokoll)


def test_freies_wochenende_wirft_wenn_es_nicht_reichen_kann():
    ctx = pflege_kontext(tage=14)
    with pytest.raises(RegelFehler):
        b.freies_wochenende(ctx, 5)


def test_nie_allein_stellt_begleitung_sicher():
    ctx = pflege_kontext()
    azubi = len(ctx.employees) - 1
    # Der Azubi soll moeglichst oft eingeteilt werden — sonst waere die Regel
    # dadurch erfuellt, dass er gar nicht arbeitet.
    ctx.model.add(
        sum(ctx.X[azubi, di, si]
            for di in range(ctx.n_days)
            for si in range(len(ctx.shifts))) >= 8)
    b.nie_allein(ctx, "auszubildend")
    solver = loese(ctx)
    eingeteilt_tage = 0
    for di in range(ctx.n_days):
        for si in range(len(ctx.shifts)):
            if solver.value(ctx.X[azubi, di, si]) != 1:
                continue
            eingeteilt_tage += 1
            andere = sum(
                solver.value(ctx.X[a, di, si])
                for a in range(ctx.n_emp) if a != azubi)
            assert andere >= 1, "Azubi steht allein im Dienst"
    assert eingeteilt_tage >= 8


def test_nie_allein_wirft_wenn_niemand_begleiten_kann():
    ctx = pflege_kontext()
    for e in ctx.employees:
        e["rolle"] = "auszubildender"
    with pytest.raises(RegelFehler):
        b.nie_allein(ctx, "auszubildend")


# ── versuche(): fuer Musterpakete, nicht fuer Kundenpakete ──────────────────

def test_versuche_ueberspringt_und_protokolliert():
    ctx = pflege_kontext()
    erfolg = b.versuche(ctx, b.rolle_ohne_gruppe, "hausmeister")
    assert erfolg is False
    assert any("bersprungen" in z for z in ctx.protokoll)
    # Der Grund muss dabeistehen, sonst hilft das Protokoll niemandem
    assert any("hausmeister" in z for z in ctx.protokoll)


def test_versuche_meldet_erfolg():
    ctx = pflege_kontext()
    assert b.versuche(ctx, b.rolle_ohne_gruppe, "leitung") is True


# ── Das Musterpaket als Ganzes ──────────────────────────────────────────────

def test_musterpaket_ist_auffindbar():
    ids = [p["id"] for p in verfuegbare_pakete()]
    assert "muster_pflege" in ids
    muster = [p for p in verfuegbare_pakete() if p["id"] == "muster_pflege"][0]
    assert muster.get("muster") is True


def test_musterpaket_laeuft_auf_einer_pflegeeinrichtung():
    ctx = pflege_kontext()
    bericht = apply_pack("muster_pflege", ctx)
    assert bericht["angewendet"] is True, bericht.get("fehler")
    loese(ctx)
    text = " ".join(bericht["regeln"])
    assert "Fachkraft" in text
    assert "Nie allein" in text
    assert "Wochenende" in text


def test_musterpaket_haelt_seine_regeln_im_geloesten_plan_ein():
    ctx = pflege_kontext()
    azubi = len(ctx.employees) - 1
    nacht = ctx.dienst("Nacht")
    # Gegendruck: moeglichst viel Arbeit, sonst beweist ein leerer Plan nichts.
    for ei in range(ctx.n_emp):
        ctx.model.add(
            sum(ctx.X[ei, di, si]
                for di in range(ctx.n_days)
                for si in range(len(ctx.shifts))) >= 8)
    apply_pack("muster_pflege", ctx)
    solver = loese(ctx)

    for di in range(ctx.n_days):
        # Der Azubi ist nie im Nachtdienst und nie allein
        assert solver.value(ctx.X[azubi, di, nacht]) == 0
        # Die Leitung auch nicht
        assert solver.value(ctx.X[0, di, nacht]) == 0
        for si in range(len(ctx.shifts)):
            if solver.value(ctx.X[azubi, di, si]) == 1:
                begleitung = sum(
                    solver.value(ctx.X[a, di, si])
                    for a in range(ctx.n_emp) if a != azubi)
                assert begleitung >= 1


def test_musterpaket_ueberspringt_was_nicht_passt():
    # Eine Einrichtung ohne Nachtdienst, ohne Gruppen und ohne Azubi: Das
    # Musterpaket muss trotzdem durchlaufen und sagen, was es ausgelassen hat.
    ctx = pflege_kontext(mit_gruppen=False, mit_nacht=False, mit_azubi=False)
    bericht = apply_pack("muster_pflege", ctx)
    assert bericht["angewendet"] is True, bericht.get("fehler")
    text = " ".join(bericht["regeln"])
    assert "bersprungen" in text
    loese(ctx)


def test_kundenpaket_scheitert_weiterhin_laut():
    # Das Gegenstueck: Ein Kundenpaket, dessen Person es nicht gibt, darf
    # NICHT stillschweigend durchlaufen.
    ctx = pflege_kontext()
    bericht = apply_pack("kita_sonnenschein", ctx)
    assert bericht["angewendet"] is False
    assert bericht["fehler"]


def test_freies_wochenende_raeumt_die_gruppe_nicht_leer():
    """
    §185 Eine Fairnessregel darf die Betreuung nicht aushebeln.

    „Mindestens ein freies Wochenende" ist über einen Monat gedacht. In einem
    Plan über EINE Woche gibt es genau ein Wochenende — die Regel verlangte
    damit, dass es JEDER frei hat, und der Rechendienst lieferte einen Plan, in
    dem samstags und sonntags niemand da war. Gemeldet hat er es sauber;
    gerechnet hat er trotzdem Unsinn, weil die Regel Unsinn verlangte.

    Gefunden beim ersten echten Wochenplan eines Kunden, nicht durch eine
    Prüfung.
    """
    ctx = pflege_kontext(tage=7)
    b.freies_wochenende(ctx, 1)

    # Verlangt wird jetzt ausdrücklich, dass am Samstag jemand arbeitet — so
    # wie es jede Wohngruppe verlangt. Hat die Regel das Wochenende gesperrt,
    # ist die Aufgabe damit unlösbar, und `loese` bricht ab.
    wochenende = [di for di, wt in enumerate(ctx.weekdays) if wt >= 5]
    assert wochenende, "Der Prüfzeitraum enthält gar kein Wochenende"
    ctx.model.add(
        sum(ctx.X[ei, di, si]
            for ei in range(ctx.n_emp)
            for di in wochenende
            for si in range(len(ctx.shifts))) >= 1
    )
    solver = loese(ctx)

    gearbeitet = sum(
        solver.value(ctx.X[ei, di, si])
        for ei in range(ctx.n_emp)
        for di in wochenende
        for si in range(len(ctx.shifts))
    )
    assert gearbeitet > 0, "Niemand darf am Wochenende arbeiten — die Gruppe wäre leer"
    assert any("greift hier gar nicht" in z for z in ctx.protokoll), ctx.protokoll


def test_freies_wochenende_gilt_weiter_wenn_der_zeitraum_lang_genug_ist():
    """Die Gegenprobe: Über vier Wochen bekommt der Betrieb, was er bestellt hat."""
    ctx = pflege_kontext(tage=28)
    b.freies_wochenende(ctx, 2)
    assert any("Mindestens 2 ganze" in z for z in ctx.protokoll), ctx.protokoll


# ── §202 Die Einrichtung im Paket ───────────────────────────────────────────

def test_kundenpakete_bringen_eine_gueltige_einrichtung_mit():
    """Wer ein Kundenpaket zuweist, soll danach planen können — dafür braucht
    der Standort Dienstzeiten. Ein Paket ohne sie wäre wieder die Lücke, die
    §202 schließt."""
    pakete = {p["id"]: p for p in verfuegbare_pakete()}
    for pid in ("kita_zwei_etagen", "kita_sonnenschein", "wohngruppe_fuenf"):
        p = pakete[pid]
        assert not p.get("einrichtungFehler"), (pid, p.get("einrichtungFehler"))
        e = p["einrichtung"]
        assert e["dienstzeiten"], pid
        assert e["arbeitstage"], pid


def test_wohngruppe_plant_sieben_tage_und_die_kita_fuenf():
    pakete = {p["id"]: p for p in verfuegbare_pakete()}
    assert len(pakete["wohngruppe_fuenf"]["einrichtung"]["arbeitstage"]) == 7
    assert pakete["kita_zwei_etagen"]["einrichtung"]["arbeitstage"] == ["Mo", "Di", "Mi", "Do", "Fr"]


def test_vorlage_bringt_keine_einrichtung_mit():
    """Eine Vorlage ist für niemanden gemacht — erfundene Dienstzeiten wären
    schlimmer als keine."""
    muster = [p for p in verfuegbare_pakete() if p["id"] == "muster_pflege"][0]
    assert "einrichtung" not in muster


def test_fehlerhafte_einrichtung_wird_ganz_abgelehnt():
    """Die Gegenprobe zur Prüfung: Ohne sie wäre „keine Fehler" bei den echten
    Paketen auch dann grün, wenn gar nicht geprüft würde."""
    from types import ModuleType
    from rulepacks import einrichtung_von

    kaputt = ModuleType("kaputt")
    kaputt.EINRICHTUNG = {
        "arbeitstage": ["Mo", "Montag"],
        "dienstzeiten": [{"name": "Früh", "art": "frueh", "von": "25:00", "bis": "14:00"},
                         {"name": "Früh", "art": "irgendwas", "von": "06:00", "bis": "14:00"}],
        "struktur": [{"name": "Gruppe 1", "typ": "gruppe", "etage": "gibt es nicht"}],
    }
    einrichtung, fehler = einrichtung_von(kaputt)
    assert einrichtung is None
    text = " ".join(fehler)
    for erwartet in ("arbeitstage", "HH:MM", "doppelt", "art muss", "gibt es in der Struktur nicht"):
        assert erwartet in text, (erwartet, fehler)

    heil = ModuleType("heil")
    heil.EINRICHTUNG = {"arbeitstage": ["Mo"], "dienstzeiten": [
        {"name": "Früh", "art": "frueh", "von": "06:00", "bis": "14:00"}]}
    einrichtung, fehler = einrichtung_von(heil)
    assert fehler == [] and einrichtung["dienstzeiten"][0]["name"] == "Früh"


# ── §268 Abstand statt Menge ────────────────────────────────────────────────
#
# Zwei Bausteine, die nicht fragen „wie viele", sondern „wie weit
# auseinander". Geprüft wird auch hier am GELÖSTEN Plan: Eine Regel, die
# durchläuft und nichts bewirkt, ist der teuerste Fehler überhaupt.

def _freitage(ctx):
    return [di for di in range(ctx.n_days) if ctx.ist_freitag(di)]


def _spaetdienst_erzwingen(ctx, tage, wer):
    """An diesen Tagen MUSS genau eine der Personen den Spätdienst haben."""
    si = ctx.dienste_vom_typ("spaet")[0]
    for di in tage:
        ctx.model.add(sum(ctx.X[ei, di, si] for ei in wer) == 1)


def test_freitag_nicht_zweimal_in_folge():
    """Zwei Freitage, zwei Personen — dann muss gewechselt werden."""
    ctx = baue_kontext()
    freitage = _freitage(ctx)
    assert len(freitage) == 2, "Der Aufbau soll genau zwei Freitage haben"

    # Nur zwei Personen kommen in Frage, und an beiden Freitagen wird einer
    # gebraucht. Ohne die Regel darf dieselbe Person beide nehmen.
    _spaetdienst_erzwingen(ctx, freitage, [1, 2])
    b.nicht_zwei_freitage_in_folge(ctx, "spaet", "letzterFreitagSpaet")

    solver = loese_mit_ziel(ctx)
    si = ctx.dienste_vom_typ("spaet")[0]
    wer = [
        next(ei for ei in (1, 2) if eingeteilt(solver, ctx, ei, di, si))
        for di in freitage
    ]
    assert wer[0] != wer[1], (
        f"Beide Freitage gingen an dieselbe Person ({ctx.employees[wer[0]]['name']})."
    )


def test_freitag_ohne_die_regel_darf_es_dieselbe_person_sein():
    """
    Die Gegenprobe. Ohne sie bewiese der Test oben nur, dass der Solver
    zufällig gewechselt hat — und wäre auch dann grün, wenn die Regel nichts
    tut.
    """
    ctx = baue_kontext()
    freitage = _freitage(ctx)
    _spaetdienst_erzwingen(ctx, freitage, [1, 2])
    # Eine Person an beiden Freitagen ausdrücklich belohnen, indem die andere
    # am zweiten Freitag gesperrt wird: Ohne die Regel ist das lösbar.
    si = ctx.dienste_vom_typ("spaet")[0]
    ctx.model.add(ctx.X[2, freitage[1], si] == 0)

    solver = loese_mit_ziel(ctx)
    assert eingeteilt(solver, ctx, 1, freitage[1], si), (
        "Ohne die Regel müsste Person 1 den zweiten Freitag nehmen können."
    )


def test_freitag_die_vorgeschichte_zaehlt_mit():
    """
    Wer am Freitag VOR dem Zeitraum den Spätdienst hatte, bekommt den ersten
    Freitag im Zeitraum nicht — sonst fängt die Rotation bei jeder neuen
    Planung von vorne an.
    """
    ctx = baue_kontext()
    freitage = _freitage(ctx)
    ersterFreitag = ctx.days[freitage[0]]

    from datetime import date, timedelta
    j, m, t = (int(x) for x in ersterFreitag.split("-"))
    davor = (date(j, m, t) - timedelta(days=7)).isoformat()
    ctx.employees[1]["belastungsHistorie"] = {"letzterFreitagSpaet": davor}

    _spaetdienst_erzwingen(ctx, [freitage[0]], [1, 2])
    b.nicht_zwei_freitage_in_folge(ctx, "spaet", "letzterFreitagSpaet")

    solver = loese_mit_ziel(ctx)
    si = ctx.dienste_vom_typ("spaet")[0]
    assert eingeteilt(solver, ctx, 2, freitage[0], si), (
        "Der erste Freitag ging an die Person, die ihn schon in der Vorwoche hatte."
    )


def test_abstand_verteilt_auf_verschiedene_leute():
    """
    Zwei Spätdienste in zwei Wochen, Regel „höchstens einer in zwei Wochen":
    Sie müssen an verschiedene Personen gehen.
    """
    ctx = baue_kontext()
    si = ctx.dienste_vom_typ("spaet")[0]
    _spaetdienst_erzwingen(ctx, [1, 8], [1, 2])
    b.hoechstens_alle_n_wochen(ctx, "spaet", 2, "letzterSpaet")

    solver = loese_mit_ziel(ctx)
    wer = [
        next(ei for ei in (1, 2) if eingeteilt(solver, ctx, ei, di, si))
        for di in (1, 8)
    ]
    assert wer[0] != wer[1], "Beide Spätdienste gingen an dieselbe Person."


def test_abstand_die_vorgeschichte_schiebt_nach_hinten():
    """
    Wer gestern den Spätdienst hatte, bekommt ihn nicht gleich wieder —
    solange es eine Alternative gibt.
    """
    ctx = baue_kontext()
    si = ctx.dienste_vom_typ("spaet")[0]

    from datetime import date, timedelta
    j, m, t = (int(x) for x in ctx.days[0].split("-"))
    gestern = (date(j, m, t) - timedelta(days=1)).isoformat()
    ctx.employees[1]["belastungsHistorie"] = {"letzterSpaet": gestern}

    _spaetdienst_erzwingen(ctx, [0], [1, 2])
    b.hoechstens_alle_n_wochen(ctx, "spaet", 4, "letzterSpaet")

    solver = loese_mit_ziel(ctx)
    assert eingeteilt(solver, ctx, 2, 0, si), (
        "Der Spätdienst ging an die Person, die ihn gestern schon hatte."
    )


def test_abstand_meldet_sich_im_protokoll():
    """
    Beide Bausteine müssen sagen, was sie getan haben. Ein Regelpaket, dessen
    Wirkung man nicht nachlesen kann, lässt sich nicht abnehmen.
    """
    ctx = baue_kontext()
    b.nicht_zwei_freitage_in_folge(ctx, "spaet", "letzterFreitagSpaet")
    b.hoechstens_alle_n_wochen(ctx, "spaet", 4, "letzterSpaet")
    text = " ".join(ctx.protokoll)
    assert "Freitagsrotation" in text and "Abstandsregel" in text, text
    assert "Vorgeschichte" in text or "vor dem Zeitraum" in text, text
