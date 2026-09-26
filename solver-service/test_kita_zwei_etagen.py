"""
§163 Abnahme des Kundenpakets „Kita – zwei Etagen, acht Gruppen".

Geprüft wird nicht, ob die Regeln durchlaufen, sondern ob der GELÖSTE Plan
sich an sie hält. Ein Regelpaket, das fehlerfrei durchläuft und nichts bewirkt,
ist der teuerste Fehler überhaupt — es sieht aus, als würde es wirken.

WARUM HIER DER ECHTE RECHENDIENST LÄUFT UND KEIN NACHBAU
Der erste Anlauf dieser Prüfung baute ein eigenes kleines Modell und legte nur
die Regeln des Pakets hinein. Das war zu wenig: Die Hälfte dessen, was einen
brauchbaren Plan ausmacht, steuert der Rechendienst selbst bei —
Stammgruppentreue, Mindestbesetzung, Wunscherfüllung, Stundenziel, die Strafe
für Arbeit ohne Gruppenzuordnung. Der Nachbau meldete prompt zwei Fehler, die
es im echten Modell nie gab. Seither läuft hier `solve()`.

ZWEI LÄUFE, UND DER ZWEITE IST DER EIGENTLICHE

    DER LEERE LAUF
    Alle da, niemand krank, keine Wünsche. Hier muss jede harte Regel
    punktgenau sitzen: Tagesmuster, Wochenstunden, freie Tage, genau ein Früh-
    und Spätdienst je Etage, Gruppe 1 mit zwei Personen, Leitung außen vor.
    Wenn es hier klemmt, klemmt es überall.

    DER SCHWERE LAUF
    Urlaub, Krankheit, Wunschlisten, Vorbelastung aus den Vorwochen. Ein Plan,
    der nur im Sonnenschein funktioniert, ist keiner — im Betrieb ist immer
    jemand weg. Hier wird geprüft, dass die harten Regeln halten, die weichen
    nachgeben und jedes Nachgeben im Bericht steht.

    python3 -m pytest test_kita_zwei_etagen.py -q
"""

from __future__ import annotations

import os
from datetime import date, timedelta

import pytest

from solver import solve


# ── Der Betrieb, wie er im Regelwerk steht ──────────────────────────────────

UNTEN = "et-unten"
OBEN = "et-oben"

GRUPPEN = [
    {"id": "g1", "name": "Gruppe 1", "typ": "gruppe", "etageId": UNTEN, "mindestbesetzung": 1},
    {"id": "g2", "name": "Gruppe 2", "typ": "gruppe", "etageId": UNTEN, "mindestbesetzung": 1},
    {"id": "g3", "name": "Gruppe 3", "typ": "gruppe", "etageId": UNTEN, "mindestbesetzung": 1},
    {"id": "g4", "name": "Gruppe 4", "typ": "gruppe", "etageId": UNTEN, "mindestbesetzung": 1},
    {"id": "g5", "name": "Gruppe 5", "typ": "gruppe", "etageId": OBEN, "mindestbesetzung": 1},
    {"id": "g6", "name": "Gruppe 6", "typ": "gruppe", "etageId": OBEN, "mindestbesetzung": 1},
    {"id": "g7", "name": "Gruppe 7", "typ": "gruppe", "etageId": OBEN, "mindestbesetzung": 1},
    {"id": "g8", "name": "Gruppe 8", "typ": "gruppe", "etageId": OBEN, "mindestbesetzung": 1},
]

ETAGEN = [
    # mindestbesetzung 0: Die Etagenabdeckung regelt das Regelpaket mit „genau
    # einer", nicht der allgemeine Mechanismus mit „mindestens so viele".
    {"id": UNTEN, "name": "untere Etage", "typ": "etage", "mindestbesetzung": 0},
    {"id": OBEN, "name": "obere Etage", "typ": "etage", "mindestbesetzung": 0},
]

# Die Dienstzeiten des Betriebs: geöffnet 06:00–17:00. Acht Arbeitsstunden sind
# achteinhalb Stunden Anwesenheit; fünf Stunden gehen ohne Pause.
SCHICHTEN = [
    {"id": "f8", "name": "Frühdienst 8", "typ": "frueh", "von": "06:00", "bis": "14:30"},
    {"id": "f7", "name": "Frühdienst 7", "typ": "frueh", "von": "06:00", "bis": "13:30"},
    {"id": "f6", "name": "Frühdienst 6", "typ": "frueh", "von": "06:00", "bis": "12:30"},
    {"id": "f5", "name": "Frühdienst 5", "typ": "frueh", "von": "06:00", "bis": "11:00"},
    {"id": "s8", "name": "Spätdienst 8", "typ": "spaet", "von": "08:30", "bis": "17:00"},
    {"id": "s7", "name": "Spätdienst 7", "typ": "spaet", "von": "09:30", "bis": "17:00"},
    {"id": "s6", "name": "Spätdienst 6", "typ": "spaet", "von": "10:30", "bis": "17:00"},
    {"id": "s5", "name": "Spätdienst 5", "typ": "spaet", "von": "12:00", "bis": "17:00"},
    {"id": "t8", "name": "Tagdienst 8", "typ": "mittel", "von": "07:00", "bis": "15:30"},
    {"id": "t7", "name": "Tagdienst 7", "typ": "mittel", "von": "07:30", "bis": "15:00"},
    {"id": "t6", "name": "Tagdienst 6", "typ": "mittel", "von": "08:00", "bis": "14:30"},
    {"id": "t5", "name": "Tagdienst 5", "typ": "mittel", "von": "09:00", "bis": "14:00"},
]

TYP = {s["id"]: s["typ"] for s in SCHICHTEN}
NETTO = {"f8": 480, "f7": 420, "f6": 360, "f5": 300,
         "s8": 480, "s7": 420, "s6": 360, "s5": 300,
         "t8": 480, "t7": 420, "t6": 360, "t5": 300}
ETAGE_VON_GRUPPE = {g["id"]: g["etageId"] for g in GRUPPEN}

# Vorname, Wochenstunden, Stammgruppe, Rolle.
# Zwei heißen Katrin — genau wie im Regelwerk des Kunden.
BELEGSCHAFT = [
    ("Marin Berg",      40, "g1", "erzieher"),
    ("Shelley Frei",    40, "g1", "erzieher"),
    ("Stephanie Lang",  35, "g2", "erzieher"),
    ("Christina Weiß",  35, "g2", "erzieher"),
    ("Juliane Roth",    35, "g3", "erzieher"),
    ("Kristine Mai",    40, "g3", "erzieher"),
    ("Tim Sommer",      40, "g4", "erzieher"),
    ("Sophia Klein",    35, "g4", "erzieher"),
    ("Heike Stein",     30, "g5", "erzieher"),
    ("Corinna Vogel",   40, "g5", "erzieher"),
    ("Susan Hart",      40, "g6", "erzieher"),
    ("Katrin K Nolte",  32, "g7", "erzieher"),
    ("Daniel Fuchs",    35, "g7", "erzieher"),
    ("Annika Peters",   24, "g7", "erzieher"),
    ("Felix Arndt",     40, "g8", "erzieher"),
    ("Katrin Ulrich",   32, "g8", "erzieher"),
    ("Nicole Sprung",   25, None, "springer"),
    # Leitungszeit steht nicht im Dienstplan — deshalb 0 Sollstunden für
    # die Planung. Ihre 40 Vertragsstunden stehen im Lohnprofil.
    ("Franke Leitner",   0, None, "leitung"),
]

ID_VON = {name: name.split()[0].lower() + "-" + name.split()[-1].lower()
          for name, *_ in BELEGSCHAFT}
NAME_VON = {v: k for k, v in ID_VON.items()}


def werktage(start: date, wochen: int) -> list[str]:
    """Montag bis Freitag — die Kita hat am Wochenende zu."""
    tage: list[str] = []
    d = start
    while len(tage) < wochen * 5:
        if d.weekday() < 5:
            tage.append(d.isoformat())
        d += timedelta(days=1)
    return tage


TAGE = werktage(date(2026, 10, 5), 2)          # zwei volle Kalenderwochen
WOCHE1, WOCHE2 = TAGE[:5], TAGE[5:]


def regelmodell(abwesend: dict[str, list[str]] | None = None,
                wuensche: dict[str, list[dict]] | None = None,
                historie: dict[str, dict] | None = None) -> dict:
    """Das Regelmodell, wie die App es an den Rechendienst schickt."""
    abwesend = abwesend or {}
    wuensche = wuensche or {}
    historie = historie or {}

    mitarbeiter = []
    for name, stunden, gruppe, rolle in BELEGSCHAFT:
        vorname = name.split()[0]
        mitarbeiter.append({
            "id": ID_VON[name],
            "name": name,
            "rolle": rolle,
            "einheiten": [gruppe] if gruppe else [g["id"] for g in GRUPPEN],
            "stammEinheitId": gruppe,
            "wochenstundenSoll": stunden,
            "arbeitstageProWoche": 5,
            "qualifikationen": [],
            "verfuegbareSchichtTypen": ["frueh", "spaet", "mittel"],
            "nichtVerfuegbarAn": [],
            "urlaubAn": abwesend.get(vorname, []),
            "wuensche": wuensche.get(vorname, []),
            "letzteSchichten": [],
            "belastungsHistorie": historie.get(vorname, {}),
        })

    return {
        "rulePackId": "kita_zwei_etagen",
        "zeitraum": {"von": TAGE[0], "bis": TAGE[-1], "arbeitstage": TAGE},
        "einheiten": ETAGEN + GRUPPEN,
        "schichten": [
            # minBesetzungGesamt 0: Wie viele wo stehen, entscheiden die
            # Gruppen- und Etagenregeln — nicht eine Zahl je Dienstart.
            {**s, "minBesetzungGesamt": 0, "uebernacht": False,
             "erforderlicheQualifikationen": []}
            for s in SCHICHTEN
        ],
        "harteRegeln": [
            {"typ": "max_wochenstunden", "wert": 40},
            {"typ": "min_ruhezeit", "wert": 11},
            {"typ": "max_folgetage", "wert": 5},
        ],
        "weicheRegeln": [],
        "fairness": {},
        "mitarbeiter": mitarbeiter,
        "pausenRegeln": {"thresholdMinutes": 360, "deductionMinutes": 30},
    }


def rechne(modell: dict) -> dict:
    os.environ["SOLVER_MAX_SECONDS"] = "90"
    return solve(modell)


# ── Auswertung ──────────────────────────────────────────────────────────────

class Plan:
    """Das Ergebnis des Rechendienstes, bequem befragbar."""

    def __init__(self, ergebnis: dict):
        self.roh = ergebnis
        self.paket = ergebnis.get("regelpaket") or {}
        self.eintrag: dict[tuple[str, str], dict] = {
            (e["mitarbeiterId"], e["datum"]): e
            for e in ergebnis.get("eintraege", [])
        }

    def dienst(self, name: str, tag: str) -> str | None:
        e = self.eintrag.get((ID_VON[name], tag))
        return e["schichtId"] if e else None

    def gruppe(self, name: str, tag: str) -> str | None:
        e = self.eintrag.get((ID_VON[name], tag))
        return e.get("einheitId") if e else None

    def tage(self, name: str, tage: list[str] | None = None) -> list[str]:
        return [t for t in (tage or TAGE) if self.dienst(name, t)]

    def minuten(self, name: str, tage: list[str]) -> int:
        return sum(NETTO[self.dienst(name, t)] for t in tage if self.dienst(name, t))

    def typen(self, name: str, tage: list[str] | None = None) -> list[str]:
        return [TYP[self.dienst(name, t)] for t in (tage or TAGE) if self.dienst(name, t)]

    def je_etage(self, tag: str, typ: str) -> dict[str, int]:
        """Wie viele Personen dieser Dienstart auf jeder Etage stehen."""
        zaehler = {UNTEN: 0, OBEN: 0}
        for (mid, t), e in self.eintrag.items():
            if t != tag or TYP[e["schichtId"]] != typ:
                continue
            etage = ETAGE_VON_GRUPPE.get(e.get("einheitId") or "")
            if etage:
                zaehler[etage] += 1
        return zaehler

    def in_gruppe(self, tag: str, gruppe: str) -> int:
        return sum(1 for (mid, t), e in self.eintrag.items()
                   if t == tag and e.get("einheitId") == gruppe)

    def verletzungen(self, art: str | None = None) -> list[dict]:
        alle = self.paket.get("verletzungen") or []
        return [v for v in alle if art is None or v["art"] == art]


@pytest.fixture(scope="module")
def leer() -> Plan:
    p = Plan(rechne(regelmodell()))
    assert p.paket.get("angewendet") is True, p.paket.get("fehler")
    return p


@pytest.fixture(scope="module")
def schwer() -> Plan:
    p = Plan(rechne(regelmodell(
        abwesend={
            "Kristine": TAGE,            # zwei Wochen Urlaub, untere Etage
            # Gruppe 2 faellt in der zweiten Woche KOMPLETT aus. Das ist der
            # Fall, fuer den es die Springerin gibt: Ohne sie stuende die
            # Gruppe leer, und Marin und Shelley koennen Gruppe 1 nicht
            # verlassen, ohne dort unter zwei zu fallen.
            "Stephanie": WOCHE2,
            "Christina": WOCHE2,
            "Corinna": WOCHE1,           # eine Woche Urlaub, obere Etage
            "Tim": WOCHE2[1:4],          # krank, mitten in der Woche
            "Susan": WOCHE2[:2],         # krank, allein in Gruppe 6
        },
        wuensche={
            # Die Wunschliste: Stephanie will den Freitagsfrühdienst,
            # Sophia den Spätdienst am Montag, Daniel braucht einen Tag frei.
            "Stephanie": [{"datum": WOCHE1[4], "schichtId": "f7",
                           "typ": "wunsch", "prioritaet": 2}],
            "Juliane": [{"datum": WOCHE1[2], "schichtId": "f7",
                         "typ": "wunsch", "prioritaet": 3}],
            "Sophia": [{"datum": WOCHE1[0], "schichtId": "s7",
                        "typ": "wunsch", "prioritaet": 3}],
            "Daniel": [{"datum": WOCHE2[0], "typ": "wunschfrei"}],
        },
        historie={
            # Marin hatte in den Vorwochen auffällig viele Frühdienste,
            # Christina die Freitagsspätdienste.
            "Marin": {"fruehDienste": 8, "freitagFrueh": 4},
            "Christina": {"spaetDienste": 7, "freitagSpaet": 4},
        },
    )))
    assert p.paket.get("angewendet") is True, p.paket.get("fehler")
    return p


# ════════════════════════════════════════════════════════════════════════════
# DER LEERE LAUF — alle da, nichts dazwischen
# ════════════════════════════════════════════════════════════════════════════

def test_leer_jede_regel_greift(leer):
    text = " ".join(leer.paket["regeln"])
    # Kein „Übersprungen": In diesem Betrieb gibt es für jede Regel Daten.
    assert "bersprungen" not in text, text


def test_leer_es_gibt_einen_plan(leer):
    assert len(leer.eintrag) > 130, f"nur {len(leer.eintrag)} Einteilungen"


@pytest.mark.parametrize("name,soll,dienste", [
    ("Marin Berg", 2400, 5),        # 40 h → 5 × 8
    ("Stephanie Lang", 2100, 5),    # 35 h → 5 × 7
    ("Katrin K Nolte", 1920, 4),    # 32 h → 4 × 8
    ("Katrin Ulrich", 1920, 4),     # 32 h → 4 × 8
    ("Annika Peters", 1440, 3),     # 24 h → 3 × 8
    ("Nicole Sprung", 1500, 5),     # 25 h → 5 × 5
    ("Heike Stein", 1800, 4),       # 30 h → 3 × 8 + 1 × 6
])
def test_leer_wochenstunden_und_tagesmuster(leer, name, soll, dienste):
    for woche in (WOCHE1, WOCHE2):
        gearbeitet = leer.tage(name, woche)
        assert len(gearbeitet) == dienste, \
            f"{name}: {len(gearbeitet)} Arbeitstage statt {dienste} in {woche[0]}"
        assert leer.minuten(name, woche) == soll, \
            f"{name}: {leer.minuten(name, woche)} statt {soll} Minuten"


def test_leer_heike_genau_drei_mal_acht_und_einmal_sechs(leer):
    for woche in (WOCHE1, WOCHE2):
        laengen = sorted(NETTO[leer.dienst("Heike Stein", t)]
                         for t in leer.tage("Heike Stein", woche))
        assert laengen == [360, 480, 480, 480], laengen


def test_leer_niemand_bekommt_eine_fremde_dienstlaenge(leer):
    """Eine 35-Stunden-Kraft arbeitet nie acht Stunden an einem Tag."""
    erlaubt = {"Marin Berg": {480}, "Stephanie Lang": {420},
               "Juliane Roth": {420}, "Nicole Sprung": {300},
               "Heike Stein": {480, 360}}
    for name, laengen in erlaubt.items():
        for t in leer.tage(name):
            assert NETTO[leer.dienst(name, t)] in laengen, \
                f"{name} am {t}: {NETTO[leer.dienst(name, t)]} Minuten"


@pytest.mark.parametrize("name,wochentag", [
    ("Heike Stein", 4),        # Freitag
    ("Katrin K Nolte", 1),     # Dienstag
    ("Annika Peters", 3),      # Donnerstag
    ("Annika Peters", 4),      # Freitag
    ("Katrin Ulrich", 2),      # Mittwoch
])
def test_leer_feste_freie_tage(leer, name, wochentag):
    for t in TAGE:
        if date.fromisoformat(t).weekday() != wochentag:
            continue
        assert leer.dienst(name, t) is None, \
            f"{name} arbeitet am {t} — das ist der feste freie Tag"


@pytest.mark.parametrize("typ", ["frueh", "spaet"])
def test_leer_genau_ein_dienst_je_etage(leer, typ):
    for t in TAGE:
        zaehler = leer.je_etage(t, typ)
        assert zaehler[UNTEN] == 1, f"untere Etage am {t}: {zaehler[UNTEN]}× {typ}"
        assert zaehler[OBEN] == 1, f"obere Etage am {t}: {zaehler[OBEN]}× {typ}"


def test_leer_gruppe_eins_immer_zu_zweit(leer):
    for t in TAGE:
        assert leer.in_gruppe(t, "g1") >= 2, \
            f"Gruppe 1 am {t}: {leer.in_gruppe(t, 'g1')} Personen"


def test_leer_die_leitung_bleibt_draussen(leer):
    assert leer.tage("Franke Leitner") == [], \
        "Die Leitung wurde in die Gruppenbesetzung verplant"


def test_leer_hoechstens_ein_frueh_und_ein_spaet_je_woche(leer):
    for name, *_ in BELEGSCHAFT:
        for woche in (WOCHE1, WOCHE2):
            typen = leer.typen(name, woche)
            assert typen.count("frueh") <= 1, f"{name}: {typen}"
            assert typen.count("spaet") <= 1, f"{name}: {typen}"


def test_leer_vorlieben_werden_beachtet(leer):
    # Bei voller Besetzung gibt es genug andere — die Vorliebe muss greifen.
    assert "spaet" not in leer.typen("Juliane Roth"), "Juliane hat Spätdienst"
    assert "frueh" not in leer.typen("Felix Arndt"), "Felix hat Frühdienst"


def test_leer_alle_bleiben_in_ihrer_stammgruppe(leer):
    stamm = {name: g for name, _, g, _ in BELEGSCHAFT if g}
    fremd = [
        (name, t, leer.gruppe(name, t))
        for name, g in stamm.items()
        for t in leer.tage(name)
        if leer.gruppe(name, t) and leer.gruppe(name, t) != g
    ]
    assert fremd == [], f"Einsätze außerhalb der Stammgruppe ohne Not: {fremd}"


def test_leer_nicole_steht_in_gruppe_eins(leer):
    # Ohne Vertretungsbedarf ist Gruppe 1 ihr Platz.
    gruppen = [leer.gruppe("Nicole Sprung", t) for t in leer.tage("Nicole Sprung")]
    assert gruppen.count("g1") >= 8, gruppen


def test_leer_keine_einzige_verletzung(leer):
    assert leer.verletzungen() == [], leer.verletzungen()


# ════════════════════════════════════════════════════════════════════════════
# DER SCHWERE LAUF — Urlaub, Krankheit, Wünsche, Vorbelastung
# ════════════════════════════════════════════════════════════════════════════

def test_schwer_es_gibt_ueberhaupt_einen_plan(schwer):
    assert len(schwer.eintrag) > 110, f"nur {len(schwer.eintrag)} Einteilungen"


def test_schwer_niemand_arbeitet_im_urlaub(schwer):
    for name, tage in (("Kristine Mai", TAGE), ("Corinna Vogel", WOCHE1),
                       ("Tim Sommer", WOCHE2[1:4]), ("Susan Hart", WOCHE2[:2])):
        for t in tage:
            assert schwer.dienst(name, t) is None, \
                f"{name} arbeitet am {t} trotz Abwesenheit"


def test_schwer_wunschfrei_wird_eingehalten(schwer):
    assert schwer.dienst("Daniel Fuchs", WOCHE2[0]) is None, \
        "Daniel arbeitet trotz Wunschfrei"


@pytest.mark.parametrize("name,wochentag", [
    ("Heike Stein", 4), ("Katrin K Nolte", 1),
    ("Annika Peters", 3), ("Katrin Ulrich", 2),
])
def test_schwer_feste_freie_tage_halten_auch_jetzt(schwer, name, wochentag):
    for t in TAGE:
        if date.fromisoformat(t).weekday() != wochentag:
            continue
        assert schwer.dienst(name, t) is None, \
            f"{name} arbeitet am festen freien Tag {t}"


def test_schwer_gruppe_eins_haelt(schwer):
    for t in TAGE:
        assert schwer.in_gruppe(t, "g1") >= 2, \
            f"Gruppe 1 am {t}: {schwer.in_gruppe(t, 'g1')} Personen"


def test_schwer_etagen_werden_weiter_geoeffnet_und_geschlossen(schwer):
    for t in TAGE:
        for typ in ("frueh", "spaet"):
            zaehler = schwer.je_etage(t, typ)
            assert zaehler[UNTEN] == 1, f"untere Etage am {t}: {zaehler[UNTEN]}× {typ}"
            assert zaehler[OBEN] == 1, f"obere Etage am {t}: {zaehler[OBEN]}× {typ}"


def test_schwer_volle_wochen_treffen_die_sollzeit_trotzdem(schwer):
    """Wer selbst nicht abwesend ist, arbeitet seine Stunden — auch wenn
    ringsum Leute fehlen."""
    abwesend = {"Kristine Mai", "Corinna Vogel", "Tim Sommer", "Susan Hart",
                "Stephanie Lang", "Christina Weiß",
                "Franke Leitner", "Daniel Fuchs"}
    soll = {name: stunden * 60 for name, stunden, _, _ in BELEGSCHAFT}
    for name, *_ in BELEGSCHAFT:
        if name in abwesend:
            continue
        for woche in (WOCHE1, WOCHE2):
            assert schwer.minuten(name, woche) == soll[name], \
                f"{name}: {schwer.minuten(name, woche)} statt {soll[name]} Minuten"


def test_schwer_die_vorbelastung_verschiebt_die_fruehdienste(schwer):
    # Marin brachte acht Frühdienste mit. Bei sonst gleichwertigen Lösungen
    # bekommt sie jetzt weniger als jemand ohne Vorbelastung.
    assert schwer.typen("Marin Berg").count("frueh") == 0, \
        "Marin bekommt trotz Vorbelastung Frühdienste"


def test_schwer_die_freitagsvorbelastung_wirkt_eigenstaendig(schwer):
    freitage = [t for t in TAGE if date.fromisoformat(t).weekday() == 4]
    spaet = [t for t in freitage
             if schwer.dienst("Christina Weiß", t)
             and TYP[schwer.dienst("Christina Weiß", t)] == "spaet"]
    assert spaet == [], f"Christina hat Freitagsspätdienste: {spaet}"


def test_schwer_die_leitung_bleibt_wenn_irgend_moeglich_draussen(schwer):
    tage = schwer.tage("Franke Leitner")
    assert tage == [], f"Die Leitung musste an {len(tage)} Tagen einspringen"


def test_schwer_nicole_verlaesst_gruppe_eins_wenn_sie_gebraucht_wird(schwer):
    """
    Die Springerin klebt nicht an ihrem Lieblingsplatz.

    Der erste Anlauf dieser Pruefung erzeugte gar keinen Vertretungsbedarf:
    In jeder Gruppe blieb jemand uebrig, also blieb Nicole zu Recht in Gruppe 1
    — und die Pruefung schlug fehl, obwohl der Plan richtig war. Jetzt faellt
    Gruppe 2 in der zweiten Woche vollstaendig aus.
    """
    gearbeitet = schwer.tage("Nicole Sprung")
    assert len(gearbeitet) >= 9, f"Nicole arbeitet nur {len(gearbeitet)} Tage"
    in_zwei = [t for t in WOCHE2 if schwer.gruppe("Nicole Sprung", t) == "g2"]
    assert in_zwei, (
        "Gruppe 2 stand leer und Nicole blieb in Gruppe 1: "
        + str({t: schwer.gruppe("Nicole Sprung", t) for t in WOCHE2})
    )


def test_schwer_gruppe_zwei_bleibt_besetzt(schwer):
    """Auch die Gruppe ohne eigene Leute wird nicht einfach zugemacht."""
    for t in WOCHE2:
        assert schwer.in_gruppe(t, "g2") >= 1, \
            f"Gruppe 2 am {t} unbesetzt"


def test_schwer_nicole_bleibt_auf_ihrer_etage(schwer):
    for t in schwer.tage("Nicole Sprung"):
        g = schwer.gruppe("Nicole Sprung", t)
        if g:
            assert ETAGE_VON_GRUPPE[g] == UNTEN, \
                f"Nicole steht am {t} in {g} — das ist die obere Etage"


def test_schwer_jede_verletzung_ist_lesbar_und_eingeordnet(schwer):
    for v in schwer.verletzungen():
        assert v["art"] in ("hart", "weich"), v
        assert len(v["text"]) > 20, v
        assert v["anzahl"] >= 1, v


def test_schwer_keine_harte_verletzung(schwer):
    """Vier Ausfälle trägt dieser Betrieb noch ohne Bruch."""
    assert schwer.verletzungen("hart") == [], schwer.verletzungen("hart")


def test_schwer_der_bericht_zaehlt_die_verletzungen(schwer):
    assert "hartVerletzt" in schwer.paket
    assert "weichVerletzt" in schwer.paket
    assert schwer.paket["hartVerletzt"] == len(schwer.verletzungen("hart"))
    assert schwer.paket["weichVerletzt"] == len(schwer.verletzungen("weich"))


# ════════════════════════════════════════════════════════════════════════════
# DER NOTLAUF — wenn es wirklich nicht mehr reicht
# ════════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="module")
def notlage() -> Plan:
    """
    Der Ernstfall: In der ersten Woche sind nur noch vier Kräfte da.

    Der erste Anlauf dieser Prüfung blockierte fünf von acht Kräften der oberen
    Etage und erwartete einen Hinweis. Es kam keiner — zu Recht: Die untere
    Etage hatte genug Leute, um auszuhelfen, und der Plan war sauber. Die
    Prüfung hatte ein Ergebnis erwartet statt eine Regel geprüft.

    Jetzt bleiben Marin und Shelley (Gruppe 1, untere Etage) sowie Felix und
    Katrin K (obere Etage). Katrin K hat dienstags frei — dann steht die obere
    Etage mit einer einzigen Kraft da, die nicht gleichzeitig öffnen und
    schließen kann. Hier MUSS etwas nachgeben, und genau das wird geprüft:
    dass der Plan trotzdem entsteht, dass die Leitung als letzte Reserve
    einspringt und dass beides im Bericht steht.
    """
    bleiben = {"Marin", "Shelley", "Felix", "Katrin", "Franke"}
    p = Plan(rechne(regelmodell(abwesend={
        name.split()[0]: WOCHE1
        for name, *_ in BELEGSCHAFT
        if name.split()[0] not in bleiben
    })))
    assert p.paket.get("angewendet") is True, p.paket.get("fehler")
    return p


def test_notlage_es_gibt_trotzdem_einen_plan(notlage):
    """Kein Plan wäre die schlechteste Antwort — dann steht der Betrieb ohne alles da."""
    in_woche1 = [t for t in WOCHE1 for name, *_ in BELEGSCHAFT
                 if notlage.dienst(name, t)]
    assert len(in_woche1) >= 15, f"nur {len(in_woche1)} Einteilungen in der Notwoche"


def test_notlage_wird_gemeldet_und_nicht_verschwiegen(notlage):
    alle = notlage.verletzungen()
    assert alle, "Fünf Ausfälle und kein einziger Hinweis — das kann nicht sein"


def test_notlage_die_leitung_springt_ein(notlage):
    """Sie ist die letzte Reserve — und der Ernstfall ist da."""
    tage = notlage.tage("Franke Leitner")
    assert tage, "Die obere Etage stand leer und die Leitung blieb im Büro"


def test_notlage_der_einsatz_der_leitung_steht_im_bericht(notlage):
    # Was nicht sein darf: einspringen, ohne dass es jemand erfährt.
    hinweis = [v for v in notlage.verletzungen() if "Notfallreserve" in v["text"]]
    assert hinweis, notlage.verletzungen()
    assert hinweis[0]["art"] == "weich", hinweis[0]


def test_notlage_gruppe_eins_haelt_auch_jetzt(notlage):
    """Die einzige Besetzungsregel, die nicht verhandelbar ist."""
    for t in WOCHE1:
        assert notlage.in_gruppe(t, "g1") >= 2, \
            f"Gruppe 1 am {t}: {notlage.in_gruppe(t, 'g1')} Personen"


def test_notlage_feste_freie_tage_gelten_auch_in_der_not(notlage):
    # Was auch immer nachgibt: der freie Tag nicht. Er ist vereinbart.
    for t in TAGE:
        if date.fromisoformat(t).weekday() == 1:
            assert notlage.dienst("Katrin K Nolte", t) is None, \
                f"Katrin K arbeitet am Dienstag {t}"
        if date.fromisoformat(t).weekday() in (3, 4):
            assert notlage.dienst("Annika Peters", t) is None, \
                f"Annika arbeitet am {t}"


def test_notlage_niemand_bekommt_eine_fremde_dienstlaenge(notlage):
    """Auch in der Not wird keine Arbeitszeit erfunden."""
    for name, stunden, _, rolle in BELEGSCHAFT:
        if rolle == "leitung":
            continue
        for t in notlage.tage(name):
            laenge = NETTO[notlage.dienst(name, t)]
            assert laenge in (300, 360, 420, 480), f"{name} am {t}: {laenge}"
