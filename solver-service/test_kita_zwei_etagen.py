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
# §164 Kein Dienst endet zwischen 15:30 und 17:00. Der Tag hört entweder mit
# dem Spätdienst auf, mit dem Nachmittag um 15:30 oder 15:00 — oder früher,
# weil jemand um sechs angefangen hat oder weniger Stunden arbeitet.
#
# Die Springerin hat keine Früh- und Spätdienste, deshalb gibt es auch keine
# Fünfstundenvarianten davon.
SCHICHTEN = [
    {"id": "f8", "name": "Frühdienst 8", "typ": "frueh", "von": "06:00", "bis": "14:30"},
    {"id": "f7", "name": "Frühdienst 7", "typ": "frueh", "von": "06:00", "bis": "13:30"},
    {"id": "f6", "name": "Frühdienst 6", "typ": "frueh", "von": "06:00", "bis": "12:30"},
    {"id": "s8", "name": "Spätdienst 8", "typ": "spaet", "von": "08:30", "bis": "17:00"},
    {"id": "s7", "name": "Spätdienst 7", "typ": "spaet", "von": "09:30", "bis": "17:00"},
    {"id": "s6", "name": "Spätdienst 6", "typ": "spaet", "von": "10:30", "bis": "17:00"},
    {"id": "t8", "name": "Tagdienst 8", "typ": "mittel", "von": "07:00", "bis": "15:30"},
    # §164 Der Nachmittagsdienst für die Siebenstundenkräfte: Er endet um
    # 15:30 statt um 15:00 und zählt damit für die Nachmittagsbesetzung mit.
    {"id": "t7n", "name": "Nachmittag 7", "typ": "mittel", "von": "08:00", "bis": "15:30"},
    {"id": "t7", "name": "Tagdienst 7", "typ": "mittel", "von": "07:30", "bis": "15:00"},
    {"id": "t6", "name": "Tagdienst 6", "typ": "mittel", "von": "08:00", "bis": "14:30"},
    {"id": "t5", "name": "Kernzeit 5 (9 Uhr)", "typ": "mittel", "von": "09:00", "bis": "14:00"},
    {"id": "t5f", "name": "Kernzeit 5 (8 Uhr)", "typ": "mittel", "von": "08:00", "bis": "13:00"},
]

TYP = {s["id"]: s["typ"] for s in SCHICHTEN}
SCHICHTEN_NACH_ID = {s["id"]: s for s in SCHICHTEN}
NETTO = {"f8": 480, "f7": 420, "f6": 360,
         "s8": 480, "s7": 420, "s6": 360,
         "t8": 480, "t7n": 420, "t7": 420, "t6": 360, "t5": 300, "t5f": 300}
ETAGE_VON_GRUPPE = {g["id"]: g["etageId"] for g in GRUPPEN}

# Vorname, Wochenstunden, Stammgruppe, Rolle.
# Zwei heißen Katrin — genau wie im Regelwerk des Kunden.
# §181 Tagesmuster und feste freie Tage stehen jetzt bei der PERSON, nicht
# mehr im Regelpaket. Diese Tabelle ist damit genau das, was die App aus den
# Stammdaten schickt — und die Prüfungen darunter sind unverändert geblieben:
# Wenn dieselben Pläne herauskommen wie vorher, war die Verschiebung sauber.
#
# Name, Stunden, Gruppe, Rolle, Tagesmuster, feste freie Wochentage (0 = Mo),
# Schichtvorliebe
BELEGSCHAFT = [
    ("Marin Berg",      40, "g1", "erzieher", [(8, 5)], (), None),
    ("Shelley Frei",    40, "g1", "erzieher", [(8, 5)], (), None),
    ("Stephanie Lang",  35, "g2", "erzieher", [(7, 5)], (), None),
    ("Christina Weiß",  35, "g2", "erzieher", [(7, 5)], (), None),
    ("Juliane Roth",    35, "g3", "erzieher", [(7, 5)], (), "frueh"),
    ("Kristine Mai",    40, "g3", "erzieher", [(8, 5)], (), None),
    ("Tim Sommer",      40, "g4", "erzieher", [(8, 5)], (), None),
    ("Sophia Klein",    35, "g4", "erzieher", [(7, 5)], (), None),
    ("Heike Stein",     30, "g5", "erzieher", [(8, 3), (6, 1)], (4,), None),
    ("Corinna Vogel",   40, "g5", "erzieher", [(8, 5)], (), None),
    ("Susan Hart",      40, "g6", "erzieher", [(8, 5)], (), None),
    ("Katrin K Nolte",  32, "g7", "erzieher", [(8, 4)], (1,), None),
    ("Daniel Fuchs",    35, "g7", "erzieher", [(7, 5)], (), None),
    ("Annika Peters",   24, "g7", "erzieher", [(8, 3)], (3, 4), None),
    ("Felix Arndt",     40, "g8", "erzieher", [(8, 5)], (), "spaet"),
    ("Katrin Ulrich",   32, "g8", "erzieher", [(8, 4)], (2,), None),
    ("Nicole Sprung",   25, None, "springer", [(5, 5)], (), None),
    # Leitungszeit steht nicht im Dienstplan — deshalb 0 Sollstunden für
    # die Planung. Ihre 40 Vertragsstunden stehen im Lohnprofil. Kein Muster:
    # Wer nicht verplant wird, braucht keines.
    ("Franke Leitner",   0, None, "leitung", [], (), None),
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
    for name, stunden, gruppe, rolle, muster, freieTage, vorliebe in BELEGSCHAFT:
        vorname = name.split()[0]
        mitarbeiter.append({
            "id": ID_VON[name],
            "name": name,
            "rolle": rolle,
            # §181 Die App schickt beides mit: Die Rolle, damit das Paket
            # Leitung und Springerin über die Funktion findet statt über einen
            # Namen; und das Tagesmuster, weil es eine Angabe über diesen
            # Menschen ist und nicht über diesen Betrieb.
            "position": rolle,
            "funktion": rolle,
            "einheiten": [gruppe] if gruppe else [g["id"] for g in GRUPPEN],
            "stammEinheitId": gruppe,
            "wochenstundenSoll": stunden,
            "arbeitstageProWoche": 5,
            "tagesmuster": [{"stunden": st, "tage": n} for st, n in muster],
            **({"vorliebe": vorliebe} if vorliebe else {}),
            "qualifikationen": [],
            "verfuegbareSchichtTypen": ["frueh", "spaet", "mittel"],
            # §181 Feste freie Wochentage kommen als Datumsliste an — genau so
            # baut `rule-model-service.ts` sie aus `fixedOffDays` zusammen.
            "nichtVerfuegbarAn": [
                tag for tag in TAGE
                if date.fromisoformat(tag).weekday() in freieTage
            ],
            "urlaubAn": abwesend.get(vorname, []),
            "wuensche": wuensche.get(vorname, []),
            "letzteSchichten": [],
            "belastungsHistorie": historie.get(vorname, {}),
        })

    return {
        "rulePackId": "kita_zwei_etagen",
        "zeitraum": {"von": TAGE[0], "bis": TAGE[-1], "arbeitstage": TAGE},
        # §174 Kopien, keine Verweise.
        #
        # Hier standen die Modul-Dikts selbst. `modell_mit_sperre` schreibt
        # eine Abgabesperre HINEIN — und traf damit nicht diesen einen Lauf,
        # sondern die Vorlage: Jeder spätere Lauf erbte die Sperre, auch der
        # Notlauf und der leere Lauf. Aufgefallen ist es, weil eine Prüfung
        # allein bestand und im Gesamtlauf umfiel; die Ursache war nicht die
        # Regel, sondern eine Gruppe, die aus einem fremden Fall noch
        # gesperrt war. Regel 1 der Nachweis-README gilt auch hier.
        "einheiten": [dict(e) for e in ETAGEN + GRUPPEN],
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


# §174 Warum das Zeitbudget hier hoch liegt
#
# Das Paket rechnet zwei Wochen mit achtzehn Personen in unter zwei Sekunden.
# Die 60 kosten auf einer freien Maschine also nichts — sie sind der Abstand
# zur Grenze. Bei 30 Sekunden ist die Abnahme einmal umgekippt, waehrend
# nebenher der Rechendienst und die Nachweise liefen: Der Loeser kam nicht
# zum Optimum und lieferte einen brauchbaren, aber nicht den besten Plan.
# Eine Pruefung, die von der Auslastung der Maschine abhaengt, ist kein
# Sicherheitsnetz.
def rechne(modell: dict, sekunden: str = "60") -> dict:
    os.environ["SOLVER_MAX_SECONDS"] = sekunden
    return solve(modell)


def abnehmen(p: Plan, was: str, optimal: bool = True) -> Plan:
    """
    Der Lauf muss angekommen sein, bevor man sein Ergebnis befragt.

    ZWEI DINGE, DIE NICHT DASSELBE SIND
    „Das Paket lief" (`angewendet`) und „der Loeser ist fertig geworden"
    (OPTIMAL). Die meisten Pruefungen darunter lesen WEICHE Entscheidungen ab
    — „Christina hilft am Donnerstag aus, weil Stephanie bleibt". Solche
    Saetze gelten nur fuer den BESTEN Plan. Bricht der Loeser vorher ab, ist
    das Ergebnis brauchbar, aber nicht der beste — und die Pruefung schlaegt
    fehl mit der Meldung, die Regel greife nicht. Das ist falsch und schickt
    den naechsten Leser in die verkehrte Richtung. Genau das ist am 27.09.
    einmal passiert, waehrend die Maschine nebenher die Nachweise rechnete.

    `optimal=False` ist fuer die Laeufe, bei denen es NICHT um den besten Plan
    geht, sondern darum, dass ueberhaupt einer entsteht und dass das Nachgeben
    gemeldet wird. Dort darf dann aber auch keine Pruefung eine weiche
    Entscheidung ablesen.
    """
    assert p.paket.get("angewendet") is True, (
        f"{was}: Das Regelpaket lief nicht — {p.paket.get('fehler')}"
    )
    if optimal:
        assert p.optimal, (
            f"{was}: Der Rechendienst kam nicht zum Optimum, sondern brach mit "
            f"„{p.solver_tag}“ ab. Das ist keine Aussage ueber die Regeln, "
            "sondern ueber die Maschine: zu langsam oder zu beschaeftigt. Die "
            "Pruefungen auf diesem Lauf lesen weiche Entscheidungen ab und "
            "gelten nur fuer den besten Plan. Bitte das Zeitbudget in `rechne` "
            "erhoehen oder den Lauf allein wiederholen."
        )
    return p


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

    def ende(self, name: str, tag: str) -> str:
        return SCHICHTEN_NACH_ID[self.dienst(name, tag)]["bis"]

    def bis_uhrzeit(self, tag: str, etage: str, uhrzeit: str) -> int:
        """Wie viele Personen auf dieser Etage an diesem Tag bis dahin bleiben."""
        return sum(
            1 for (mid, t), e in self.eintrag.items()
            if t == tag
            and SCHICHTEN_NACH_ID[e["schichtId"]]["bis"] == uhrzeit
            and ETAGE_VON_GRUPPE.get(e.get("einheitId") or "") == etage
        )

    def verletzungen(self, art: str | None = None) -> list[dict]:
        alle = self.paket.get("verletzungen") or []
        return [v for v in alle if art is None or v["art"] == art]

    # §174 Der Rechenweg selbst, nicht nur sein Ergebnis.
    #
    # Der Rechendienst schreibt seinen Abschlusszustand in die Metadaten:
    # „ortools-cpsat-v2 (OPTIMAL, cost=97100, 1.8s)". OPTIMAL heisst: Es gibt
    # keinen besseren Plan. FEASIBLE heisst nur: Die Zeit war um, das hier war
    # das Beste, was bis dahin gefunden wurde.
    @property
    def solver_tag(self) -> str:
        return str((self.roh.get("metadaten") or {}).get("solver", ""))

    @property
    def optimal(self) -> bool:
        return "OPTIMAL" in self.solver_tag


@pytest.fixture(scope="module")
def leer() -> Plan:
    p = Plan(rechne(regelmodell()))
    abnehmen(p, "Der leere Lauf")
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
    abnehmen(p, "Der schwere Lauf")
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
    """
    §181 Die Vorliebe kommt nicht mehr aus dem Regelpaket.

    Dort standen zwei Namen mit ihren Abneigungen. Welche Schicht jemand
    lieber mag, ist aber eine Angabe ueber diesen Menschen — sie steht im
    Planungsprofil und erreicht den Rechendienst als weicher Wunsch, so wie
    hier nachgebaut. Die Zusage, die geprueft wird, ist dieselbe geblieben:
    Bei voller Besetzung gibt es genug andere, also muss die Vorliebe greifen.
    """
    # Die Vorlieben stehen in BELEGSCHAFT und reisen als `vorliebe` mit —
    # genau so, wie die App sie aus dem Planungsprofil schickt.
    assert "spaet" not in leer.typen("Juliane Roth"), "Juliane hat Spätdienst"
    assert "frueh" not in leer.typen("Felix Arndt"), "Felix hat Frühdienst"


def test_leer_alle_bleiben_in_ihrer_stammgruppe(leer):
    stamm = {name: g for name, _, g, *_ in BELEGSCHAFT if g}
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
    soll = {name: stunden * 60 for name, stunden, *_ in BELEGSCHAFT}
    for name, *_ in BELEGSCHAFT:
        if name in abwesend:
            continue
        for woche in (WOCHE1, WOCHE2):
            assert schwer.minuten(name, woche) == soll[name], \
                f"{name}: {schwer.minuten(name, woche)} statt {soll[name]} Minuten"


def test_schwer_die_vorbelastung_verschiebt_die_fruehdienste(schwer):
    """
    Marin brachte acht Frühdienste mit. Wo eine Wahl besteht, entscheidet die
    Vorgeschichte — wo keine besteht, kann sie nichts entscheiden.

    Diese Prüfung verlangte zuerst NULL Frühdienste über beide Wochen. Das
    war eine Forderung an das Ergebnis, nicht an die Regel, und sie wurde
    falsch, als eine andere Regel dazukam:

        KW 41 — sieben Kräfte auf der unteren Etage, fünf Frühdienste.
                Marin kann verschont werden, und sie wird es auch.
        KW 42 — Kristine im Urlaub, Stephanie und Christina krank: fünf
                Kräfte, fünf Frühdienste, höchstens einer je Person und
                Woche. Jede muss einen nehmen, auch Marin.

    Geprüft wird deshalb die Woche, in der es eine Wahl gibt.
    """
    assert schwer.typen("Marin Berg", WOCHE1).count("frueh") == 0, \
        "In einer Woche mit sieben Kräften bekommt Marin trotz Vorbelastung "
    # Und in der knappen Woche bleibt es bei höchstens einem — die
    # Fairnessregel gibt nach, sie bricht nicht.
    assert schwer.typen("Marin Berg", WOCHE2).count("frueh") <= 1


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
    # Knapperes Zeitbudget als sonst: Hier geht es nicht um den besten Plan,
    # sondern darum, DASS einer entsteht und dass das Nachgeben gemeldet wird.
    # Der Solver sucht in dieser Lage sehr lange nach kleinen Verbesserungen.
    p = Plan(rechne(regelmodell(abwesend={
        name.split()[0]: WOCHE1
        for name, *_ in BELEGSCHAFT
        if name.split()[0] not in bleiben
    }), sekunden="20"))
    # §174 Hier ausdruecklich OHNE Optimum: Das knappe Budget ist Absicht (s.o.),
    # und keine der Pruefungen auf diesem Lauf liest eine weiche Entscheidung ab
    # — sie pruefen harte Regeln und den Bericht.
    abnehmen(p, "Der Notlauf", optimal=False)
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
    for name, stunden, _, rolle, *_ in BELEGSCHAFT:
        if rolle == "leitung":
            continue
        for t in notlage.tage(name):
            laenge = NETTO[notlage.dienst(name, t)]
            assert laenge in (300, 360, 420, 480), f"{name} am {t}: {laenge}"

# ════════════════════════════════════════════════════════════════════════════
# §164 Der Nachmittag, die Dienstenden und die Springerin
# ════════════════════════════════════════════════════════════════════════════

def test_leer_niemand_geht_zwischen_halb_vier_und_fuenf(leer):
    """
    Es gibt genau drei Arten, den Tag zu beenden: Spätdienst um 17:00,
    Nachmittag um 15:30 oder 15:00, oder früher. Ein Dienst, der um 16:00
    endet, lässt jemanden gehen, wenn die Ablösung noch nicht da ist.
    """
    for name, *_ in BELEGSCHAFT:
        for t in leer.tage(name):
            ende = leer.ende(name, t)
            assert not ("15:30" < ende < "17:00"), \
                f"{name} am {t}: Dienstende {ende}"


@pytest.mark.parametrize("etage,etikett", [(UNTEN, "untere"), (OBEN, "obere")])
def test_leer_der_nachmittag_ist_besetzt(leer, etage, etikett):
    """Neben dem Spätdienst bleibt mindestens eine Kraft bis 15:30."""
    for t in TAGE:
        assert leer.bis_uhrzeit(t, etage, "15:30") >= 1, \
            f"{etikett} Etage am {t}: niemand bleibt bis 15:30"


def test_leer_meistens_bleiben_sogar_zwei_bis_halb_vier(leer):
    """
    Zwei sind der Wunsch, nicht die Pflicht. Bei voller Besetzung sollte er
    fast immer erfüllt sein — sonst ist das Gewicht zu schwach gewählt.
    """
    erfuellt = sum(1 for t in TAGE for etage in (UNTEN, OBEN)
                   if leer.bis_uhrzeit(t, etage, "15:30") >= 2)
    assert erfuellt >= 18, f"nur {erfuellt} von 20 Etagentagen mit zwei bis 15:30"


def test_leer_der_nachmittagsdienst_wird_wirklich_benutzt(leer):
    """
    Der Dienst von 08:00 bis 15:30 ist für die Siebenstundenkräfte neu. Wenn
    er nie vorkommt, war die ganze Übung umsonst.
    """
    benutzt = sum(1 for name, *_ in BELEGSCHAFT for t in leer.tage(name)
                  if leer.dienst(name, t) == "t7n")
    assert benutzt >= 3, f"der Nachmittagsdienst kommt nur {benutzt}× vor"


def test_leer_nicole_hat_keine_frueh_und_spaetdienste(leer):
    """
    Die Springerin kommt zur Kernzeit. Wer sie ins Aufschließen steckt, hat
    eine Kraft weniger, wenn alle Kinder da sind.
    """
    typen = leer.typen("Nicole Sprung")
    assert "frueh" not in typen, typen
    assert "spaet" not in typen, typen


def test_leer_nicole_faengt_um_acht_oder_neun_an(leer):
    for t in leer.tage("Nicole Sprung"):
        beginn = SCHICHTEN_NACH_ID[leer.dienst("Nicole Sprung", t)]["von"]
        assert beginn in ("08:00", "09:00"), f"Nicole beginnt am {t} um {beginn}"


def test_schwer_nicole_bleibt_auch_unter_druck_in_der_kernzeit(schwer):
    typen = schwer.typen("Nicole Sprung")
    assert "frueh" not in typen and "spaet" not in typen, typen


def test_schwer_der_nachmittag_haelt(schwer):
    """Vier Ausfälle ändern nichts daran, dass jemand bis 15:30 bleibt."""
    for t in TAGE:
        for etage in (UNTEN, OBEN):
            assert schwer.bis_uhrzeit(t, etage, "15:30") >= 1, \
                f"{etage} am {t}: niemand bis 15:30"


# ════════════════════════════════════════════════════════════════════════════
# §165 Vertretung sucht man zuerst nebenan
#
# Gruppe 8 steht am Mittwoch ohne eigene Kraft da: Katrin hat fest frei, Felix
# fällt aus. Jemand muss einspringen — und zwar von der oberen Etage, nicht
# von unten. Wer die Etage wechselt, kennt die Kinder nicht.
# ════════════════════════════════════════════════════════════════════════════

MITTWOCH1, MITTWOCH2 = WOCHE1[2], WOCHE2[2]


@pytest.fixture(scope="module")
def gruppe8() -> Plan:
    p = Plan(rechne(regelmodell(abwesend={"Felix": [MITTWOCH1, MITTWOCH2]})))
    abnehmen(p, "Gruppe 8 am Mittwoch")
    return p


def test_g8_die_gruppe_bleibt_besetzt(gruppe8):
    """Erst einmal: Sie wird nicht einfach zugemacht."""
    for t in (MITTWOCH1, MITTWOCH2):
        assert gruppe8.in_gruppe(t, "g8") >= 1, \
            f"Gruppe 8 am {t} unbesetzt — Katrin frei, Felix krank"


def test_g8_die_vertretung_kommt_von_der_eigenen_etage(gruppe8):
    """
    Der Kern der Regel: nicht jemanden hochziehen, wenn nebenan jemand frei ist.

    Der Rechendienst bestraft den Etagenwechsel schon von sich aus (800 statt
    300). Das reicht, solange nur eine Lücke zu füllen ist — bei zweien wird
    die Rechnung knapp. Deshalb legt das Paket noch etwas drauf.
    """
    stamm = {name: g for name, _, g, *_ in BELEGSCHAFT if g}
    for t in (MITTWOCH1, MITTWOCH2):
        vertreter = [
            name for name, *_ in BELEGSCHAFT
            if gruppe8.gruppe(name, t) == "g8" and stamm.get(name) != "g8"
        ]
        assert vertreter, f"am {t} vertritt niemand in Gruppe 8"
        for v in vertreter:
            herkunft = ETAGE_VON_GRUPPE[stamm[v]]
            assert herkunft == OBEN, \
                f"{v} wurde am {t} von der unteren Etage hochgezogen"


def test_g8_niemand_wechselt_ohne_not_die_etage(gruppe8):
    """Im ganzen Plan gibt es keinen einzigen Etagenwechsel."""
    stamm = {name: g for name, _, g, *_ in BELEGSCHAFT if g}
    wechsel = [
        (name, t, gruppe8.gruppe(name, t))
        for name, g in stamm.items()
        for t in gruppe8.tage(name)
        if gruppe8.gruppe(name, t)
        and ETAGE_VON_GRUPPE[gruppe8.gruppe(name, t)] != ETAGE_VON_GRUPPE[g]
    ]
    assert wechsel == [], f"Etagenwechsel ohne Not: {wechsel}"


def test_g8_der_ausfall_kostet_nur_den_betroffenen_seine_stunden(gruppe8):
    """Alle anderen arbeiten ihre Sollzeit weiter — die Lücke wird nicht
    auf die Kollegen umgelegt."""
    for name, stunden, _, rolle, *_ in BELEGSCHAFT:
        if rolle == "leitung" or name.startswith("Felix"):
            continue
        for woche in (WOCHE1, WOCHE2):
            assert gruppe8.minuten(name, woche) == stunden * 60, \
                f"{name}: {gruppe8.minuten(name, woche)} statt {stunden * 60}"


def test_g8_der_nachmittag_haelt_auch_hier(gruppe8):
    for t in TAGE:
        for etage in (UNTEN, OBEN):
            assert gruppe8.bis_uhrzeit(t, etage, "15:30") >= 1, \
                f"{etage} am {t}: niemand bis 15:30"


def test_g8_keine_harte_verletzung(gruppe8):
    assert gruppe8.verletzungen("hart") == [], gruppe8.verletzungen("hart")


# ════════════════════════════════════════════════════════════════════════════
# §166/§167 Wer einspringen darf, wer nicht weg darf — und was vorgeschlagen
# wird, wenn es nicht mehr reicht
# ════════════════════════════════════════════════════════════════════════════

DONNERSTAGE = [WOCHE1[3], WOCHE2[3]]
FREITAGE = [WOCHE1[4], WOCHE2[4]]


def modell_mit_sperre(abwesend: dict, gesperrt: tuple[str, ...]) -> dict:
    m = regelmodell(abwesend=abwesend)
    for e in m["einheiten"]:
        if e.get("id") in gesperrt:
            e["abgabeGesperrtBis"] = TAGE[-1]
            e["abgabeGrund"] = "Eingewöhnung"
    return m


@pytest.fixture(scope="module")
def obere_etage_bricht_weg() -> Plan:
    """
    Der Fall aus dem Betrieb: Beide Katrins im Urlaub, Heike krank, Daniel
    donnerstags und freitags weg, Stephanie freitags weg — und Gruppe 1, 3
    und 4 geben niemanden ab (Eingewöhnung).

    Auf der oberen Etage bleiben damit an manchen Tagen drei Kräfte für vier
    Gruppen. Helfen darf nur, wer aus Gruppe 2 kommt — oder die Springerin.
    """
    p = Plan(rechne(modell_mit_sperre(
        {"Katrin": TAGE, "Heike": TAGE,
         "Daniel": DONNERSTAGE + FREITAGE, "Stephanie": FREITAGE},
        ("g1", "g3", "g4"),
    )))
    abnehmen(p, "Die obere Etage bricht weg")
    return p


def test_sperre_niemand_verlaesst_eine_gesperrte_gruppe(obere_etage_bricht_weg):
    """Aus der Eingewöhnung wird niemand abgezogen — egal wie eng es wird."""
    stamm = {name: g for name, _, g, *_ in BELEGSCHAFT if g}
    for name, g in stamm.items():
        if g not in ("g1", "g3", "g4"):
            continue
        for t in obere_etage_bricht_weg.tage(name):
            assert obere_etage_bricht_weg.gruppe(name, t) == g, \
                f"{name} wurde am {t} aus der gesperrten {g} abgezogen"


def test_sperre_der_plan_geht_trotzdem_auf(obere_etage_bricht_weg):
    assert obere_etage_bricht_weg.verletzungen("hart") == [], \
        obere_etage_bricht_weg.verletzungen("hart")


def test_sperre_jede_gruppe_ist_besetzt(obere_etage_bricht_weg):
    for t in TAGE:
        for gid in ("g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"):
            mindest = 2 if gid == "g1" else 1
            assert obere_etage_bricht_weg.in_gruppe(t, gid) >= mindest, \
                f"{gid} am {t}: {obere_etage_bricht_weg.in_gruppe(t, gid)} Personen"


def test_hoechstens_eine_fremde_kraft_je_gruppe(obere_etage_bricht_weg):
    """
    Mehrere dürfen die Etage wechseln — aber nie zwei in dieselbe Gruppe.
    Eine Gruppe, die nur aus Vertretungen besteht, ist keine Gruppe mehr.
    """
    stamm = {name: g for name, _, g, *_ in BELEGSCHAFT if g}
    for t in TAGE:
        for gid in ("g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"):
            fremde = [
                name for name, *_ in BELEGSCHAFT
                if obere_etage_bricht_weg.gruppe(name, t) == gid
                and stamm.get(name) != gid
            ]
            assert len(fremde) <= 1, f"{gid} am {t}: {fremde}"


# ── Wenn es wirklich nicht mehr reicht ──────────────────────────────────────

@pytest.fixture(scope="module")
def nicht_mehr_loesbar() -> Plan:
    """Zusätzlich fallen die Springerin und Corinna aus, und Gruppe 2 ist
    ebenfalls gesperrt. Jetzt bleibt eine Gruppe übrig, für die niemand da
    ist."""
    p = Plan(rechne(modell_mit_sperre(
        {"Katrin": TAGE, "Heike": TAGE,
         "Daniel": DONNERSTAGE + FREITAGE, "Stephanie": FREITAGE,
         "Nicole": TAGE, "Corinna": TAGE},
        ("g1", "g2", "g3", "g4"),
    )))
    abnehmen(p, "Der Lauf ohne Loesung")
    return p


def test_notfall_die_luecke_wird_benannt(nicht_mehr_loesbar):
    hart = nicht_mehr_loesbar.verletzungen("hart")
    assert hart, "Eine Gruppe steht leer und niemand sagt es"
    assert all("unbesetzt" in v["text"] for v in hart), hart


def test_notfall_die_rechnung_steht_dabei(nicht_mehr_loesbar):
    """
    Nicht „Gruppe 7 unbesetzt", sondern „3 Kräfte für 4 Gruppen". Eine
    Leitung, die um sechs Uhr morgens entscheiden muss, braucht die Lücke in
    Zahlen, nicht ein rotes Ausrufezeichen.
    """
    for v in nicht_mehr_loesbar.verletzungen("hart"):
        assert "Kräfte eingeteilt für" in v["text"], v["text"]
        # Der Platzhalter muss gefüllt sein, nicht als {da} dastehen
        assert "{" not in v["text"], v["text"]


def test_notfall_es_gibt_einen_vorschlag(nicht_mehr_loesbar):
    v = nicht_mehr_loesbar.paket.get("vorschlag")
    assert v, "keine harte Verletzung ohne Vorschlag"
    assert v["massnahmen"], v
    assert all(m["typ"] == "aufteilen" for m in v["massnahmen"]), v["massnahmen"]


def test_notfall_der_vorschlag_ist_nachgerechnet(nicht_mehr_loesbar):
    """
    Der Kern: Es ist keine Vermutung. Der Dienst hat mit der Maßnahme ein
    zweites Mal gerechnet und weiß, ob es dann aufgeht.
    """
    v = nicht_mehr_loesbar.paket["vorschlag"]
    assert v["loest"] is True, v["restVerletzungen"]
    assert v["eintraege"], "zum Vorschlag gehört der Plan, der daraus folgt"


def test_notfall_aufteilen_heisst_nicht_zusammenlegen(nicht_mehr_loesbar):
    """Die Kinder gehen nach dem internen Aufteilungsplan in andere Gruppen —
    die Gruppe verschmilzt nicht mit einer anderen."""
    v = nicht_mehr_loesbar.paket["vorschlag"]
    text = " ".join(m["text"] for m in v["massnahmen"])
    assert "aufteilen" in text
    assert "Aufteilungsplan" in text
    assert "zusammenlegen" not in text


def test_notfall_die_leitung_springt_vorher_ein(nicht_mehr_loesbar):
    """Bevor eine Gruppe aufgeteilt wird, ist die Leitung dran."""
    assert nicht_mehr_loesbar.tage("Franke Leitner"), \
        "Die Leitung blieb im Büro, während eine Gruppe leer stand"


# ════════════════════════════════════════════════════════════════════════════
# §168 Wer geht, lässt jemanden zurück
#
# „Jede Gruppe ist besetzt" reicht nicht: Die Gruppe kann besetzt sein — von
# einer Fremden. Genau das war der Fehler im ersten Anlauf.
# ════════════════════════════════════════════════════════════════════════════

def test_niemand_verlaesst_die_gruppe_als_letzte_eigene_kraft(obere_etage_bricht_weg):
    """
    Christina darf donnerstags hoch, weil Stephanie in Gruppe 2 bleibt.
    Freitags ist Stephanie krank — dann bleibt Christina.
    """
    stamm = {name: g for name, _, g, *_ in BELEGSCHAFT if g}
    p = obere_etage_bricht_weg
    for name, eigene in stamm.items():
        for t in p.tage(name):
            if p.gruppe(name, t) == eigene:
                continue                      # steht in der eigenen Gruppe
            # Sie ist woanders — dann muss eine andere eigene Kraft dableiben.
            kollegen = [
                k for k, g in stamm.items()
                if g == eigene and k != name and p.gruppe(k, t) == eigene
            ]
            assert kollegen, (
                f"{name} verlässt am {t} {eigene} als letzte eigene Kraft — "
                f"dort steht dann nur noch eine Fremde."
            )


def test_freitags_bleibt_christina_und_nicole_geht_hoch(obere_etage_bricht_weg):
    """Der konkrete Fall, an dem der Fehler aufgefallen ist."""
    p = obere_etage_bricht_weg
    for freitag in FREITAGE:
        assert p.gruppe("Christina Weiß", freitag) == "g2", \
            f"Christina steht am {freitag} in {p.gruppe('Christina Weiß', freitag)}"
        assert p.gruppe("Nicole Sprung", freitag) == "g7", \
            f"Nicole steht am {freitag} in {p.gruppe('Nicole Sprung', freitag)}"


@pytest.fixture(scope="module")
def nur_christina_kann_hoch() -> Plan:
    """
    Dieselbe Notlage, aber ohne die Springerin.

    §174 WARUM DIESER UMWEG
    Die Vorgängerprüfung las am gewöhnlichen Lauf ab, ob Christina an
    IRGENDEINEM Donnerstag aushilft — und kippte gelegentlich um. Der Grund
    war nicht die Regel, sondern ein Gleichstand: Nicole hochzuschicken
    kostet ungefähr so viel wie Christina, und bei gleichen Kosten wählt der
    Löser irgendeine der gleich guten Lösungen. Die Prüfung hatte damit ein
    ERGEBNIS erwartet statt eine REGEL geprüft — derselbe Fehler, der in
    diesem Repo schon einmal aufgeschrieben wurde.

    Geprüft werden soll: Das Verbot ist keines, sondern eine Bedingung. Ist
    eine eigene Kraft da, die bleibt, DARF die andere gehen. Das lässt sich
    ohne Gleichstand prüfen, indem man Christina zur einzigen Möglichkeit
    macht: Nicole ist weg, Gruppe 7 hat niemanden Eigenes, und aus den
    gesperrten Gruppen kommt keiner. Hilft Christina dann immer noch nicht,
    ist die Regel ein Verbot — und Gruppe 7 bliebe leer.
    """
    p = Plan(rechne(modell_mit_sperre(
        {"Katrin": TAGE, "Heike": TAGE,
         "Daniel": DONNERSTAGE + FREITAGE, "Stephanie": FREITAGE,
         "Nicole": DONNERSTAGE},
        ("g1", "g3", "g4"),
    )))
    abnehmen(p, "Nur Christina kann hoch")
    return p


def test_donnerstags_darf_gruppe_zwei_jemanden_hochschicken(nur_christina_kann_hoch):
    """
    Die Regel ist kein Verbot der Vertretung — sie bindet sie an eine
    Bedingung: Eine geht, die andere bleibt.

    §174 WELCHE der beiden geht, steht NICHT in der Regel. Christina und
    Stephanie sind beide Stammkräfte von Gruppe 2; für den Löser sind die
    zwei Pläne gleich gut, und bei Gleichstand wählt er irgendeinen. Genau
    daran ist die Vorgängerprüfung umgekippt. Geprüft wird deshalb, was die
    Regel WIRKLICH sagt: genau eine von beiden oben, genau eine unten.
    """
    p = nur_christina_kann_hoch
    for donnerstag in DONNERSTAGE:
        oben = [n for n in ("Christina Weiß", "Stephanie Lang")
                if p.gruppe(n, donnerstag) == "g7"]
        unten = [n for n in ("Christina Weiß", "Stephanie Lang")
                 if p.gruppe(n, donnerstag) == "g2"]
        assert len(oben) == 1, (
            f"Am {donnerstag} hilft niemand aus Gruppe 2 in Gruppe 7 aus, "
            "obwohl nur von dort jemand kommen kann — die Bedingung ist zu "
            f"einem Verbot geworden. Oben: {oben or 'niemand'}."
        )
        assert len(unten) == 1, (
            f"Am {donnerstag} bleibt niemand Eigenes in Gruppe 2 zurück — "
            f"unten: {unten or 'niemand'}."
        )


def test_eine_gruppe_ohne_eigene_leute_darf_fremd_besetzt_sein(obere_etage_bricht_weg):
    """
    Die Regel verbietet NICHT, dass eine Fremde eine Gruppe allein führt,
    wenn von deren eigenen Leuten niemand da ist. Gruppe 7 ist genau das:
    Katrin im Urlaub, Daniel krank, Annika hat fest frei.
    """
    p = obere_etage_bricht_weg
    for freitag in FREITAGE:
        assert p.in_gruppe(freitag, "g7") >= 1, \
            "Gruppe 7 steht leer, obwohl eine Vertretung erlaubt wäre"


# ════════════════════════════════════════════════════════════════════════════
# §169 Die genehmigte Maßnahme wirkt
#
# Ein Vorschlag, den jemand abhakt, muss beim nächsten Rechnen auch etwas
# ändern — sonst ist das Genehmigen eine Geste. Und die abgelehnte darf
# NICHTS ändern, sonst hätte „nein" dieselbe Wirkung wie „ja".
# ════════════════════════════════════════════════════════════════════════════

def _notlage_modell() -> dict:
    return modell_mit_sperre(
        {"Katrin": TAGE, "Heike": TAGE,
         "Daniel": DONNERSTAGE + FREITAGE, "Stephanie": FREITAGE,
         "Nicole": TAGE, "Corinna": TAGE},
        ("g1", "g2", "g3", "g4"),
    )


def test_genehmigte_massnahme_raeumt_die_meldung_ab(nicht_mehr_loesbar):
    """
    Die Leitung hakt genau das ab, was das System vorgeschlagen hat. Beim
    nächsten Lauf — und der kommt nach jeder Krankmeldung — darf dieselbe
    Lücke nicht erneut gemeldet werden.
    """
    vorher = nicht_mehr_loesbar.verletzungen("hart")
    assert vorher, "Voraussetzung: es gab etwas zu genehmigen"

    modell = _notlage_modell()
    modell["massnahmen"] = [
        {"typ": m["typ"], "ziel": m["ziel"], "tag": m["tag"]}
        for m in nicht_mehr_loesbar.paket["vorschlag"]["massnahmen"]
    ]
    danach = Plan(rechne(modell))
    assert danach.paket.get("angewendet") is True, danach.paket.get("fehler")
    assert not danach.verletzungen("hart"), \
        f"trotz Genehmigung gemeldet: {danach.verletzungen('hart')}"


def test_genehmigte_massnahme_steht_im_protokoll(nicht_mehr_loesbar):
    """Wer den Plan später liest, muss sehen, WARUM die Gruppe leer blieb."""
    modell = _notlage_modell()
    erste = nicht_mehr_loesbar.paket["vorschlag"]["massnahmen"][0]
    modell["massnahmen"] = [
        {"typ": erste["typ"], "ziel": erste["ziel"], "tag": erste["tag"]}
    ]
    danach = Plan(rechne(modell))
    protokoll = " ".join(danach.paket.get("regeln") or [])
    assert "aufgeteilt" in protokoll, protokoll[-600:]


def test_eine_fremde_massnahme_raeumt_nichts_ab():
    """
    Die Gegenprobe: Eine Maßnahme für einen anderen Tag oder eine andere
    Gruppe darf die Meldung nicht verschlucken. Sonst genügte irgendein
    Häkchen, um jede Lücke verschwinden zu lassen.
    """
    modell = _notlage_modell()
    modell["massnahmen"] = [
        {"typ": "aufteilen", "ziel": "g7", "tag": "2019-01-01"},
        {"typ": "aufteilen", "ziel": "gibt-es-nicht", "tag": TAGE[0]},
    ]
    p = Plan(rechne(modell))
    assert p.verletzungen("hart"), \
        "eine fremde Maßnahme hat die echte Lücke zum Schweigen gebracht"


# ════════════════════════════════════════════════════════════════════════════
# §174 Die Gegenprobe zur Abnahme selbst
#
# `abnehmen` soll verhindern, dass ein abgebrochener Rechenlauf wie eine
# verletzte Regel aussieht. Eine Wache, die nie anschlägt, ist keine Wache —
# deshalb wird hier geprüft, dass sie es tut.
# ════════════════════════════════════════════════════════════════════════════

def _lauf_mit_status(status: str) -> Plan:
    """
    Ein Ergebnis mit gesetztem Abschlusszustand, ohne zu rechnen.

    Der erste Anlauf dieser Gegenprobe rechnete mit einer Sekunde Budget und
    hoffte auf einen Abbruch. Auf dieser Maschine kam der Löser in einer
    Sekunde durch — die Gegenprobe übersprang sich selbst und prüfte nichts.
    Eine Prüfung, die von der Geschwindigkeit der Maschine abhängt, ist keine.
    Hier wird deshalb genau das gesetzt, worum es geht.
    """
    return Plan({
        "eintraege": [],
        "metadaten": {"solver": f"ortools-cpsat-v2 ({status}, cost=1333250, 20.0s)"},
        "regelpaket": {"id": "kita_zwei_etagen", "angewendet": True},
    })


def test_abnahme_meldet_einen_abgebrochenen_lauf():
    """
    Kommt der Löser nicht zum Optimum, muss die Abnahme das SAGEN — und zwar
    so, dass niemand es für eine verletzte Regel hält.
    """
    with pytest.raises(AssertionError) as fehler:
        abnehmen(_lauf_mit_status("FEASIBLE"), "Ein abgebrochener Lauf")

    text = str(fehler.value)
    assert "nicht zum Optimum" in text, text
    assert "keine Aussage ueber die Regeln" in text, text
    # Die Meldung muss den wirklichen Abschlusszustand nennen, sonst rät der
    # Leser, woran es lag.
    assert "FEASIBLE" in text, text
    assert "Ein abgebrochener Lauf" in text, text


def test_abnahme_laesst_den_fertigen_lauf_durch():
    """Die Wache darf nicht immer anschlagen, sonst sagt sie nichts aus."""
    abnehmen(_lauf_mit_status("OPTIMAL"), "Ein fertiger Lauf")


def test_abnahme_laesst_einen_unfertigen_lauf_durch_wenn_er_gemeint_ist():
    """
    Die andere Hälfte: Wo ein brauchbarer Plan reicht, darf die Wache nicht
    im Weg stehen. Sonst müsste man sie umgehen, und dann ist sie weg.
    """
    abnehmen(_lauf_mit_status("FEASIBLE"), "Ein Lauf ohne Anspruch aufs Optimum",
             optimal=False)


def test_abnahme_meldet_auch_ein_paket_das_gar_nicht_lief():
    """Der andere Grund, aus dem ein Lauf nichts aussagt."""
    kaputt = Plan({
        "eintraege": [],
        "metadaten": {"solver": "ortools-cpsat-v2 (OPTIMAL, cost=0, 0.1s)"},
        "regelpaket": {"id": "kita_zwei_etagen", "angewendet": False,
                       "fehler": "Niemand mit der Rolle „leitung“ gefunden"},
    })
    with pytest.raises(AssertionError) as fehler:
        abnehmen(kaputt, "Ein Lauf ohne Paket")
    assert "Regelpaket lief nicht" in str(fehler.value), str(fehler.value)
    assert "leitung" in str(fehler.value), str(fehler.value)


def test_eine_sperre_bleibt_in_ihrem_eigenen_lauf():
    """
    §174 Die Gegenprobe zu dem Fehler, der diese Prüfdatei drei Läufe lang
    zum Flackern gebracht hat.

    `modell_mit_sperre` schrieb die Abgabesperre in die Modul-Vorlage statt
    in ein Modell. Jeder spätere Lauf erbte sie — auch der leere. Das kostete
    eine Stunde Suche an der falschen Stelle: Eine Prüfung bestand allein und
    fiel im Gesamtlauf um, und die Meldung sprach von einer Regel, während
    die Ursache eine fremd gesperrte Gruppe war.
    """
    modell_mit_sperre({}, ("g1", "g2", "g3", "g4"))
    danach = regelmodell()
    gesperrt = [e.get("id") for e in danach["einheiten"] if e.get("abgabeGesperrtBis")]
    assert gesperrt == [], (
        f"Die Sperre aus einem anderen Lauf klebt an der Vorlage: {gesperrt}"
    )
    # Und die Vorlage selbst ist auch unberührt.
    assert all("abgabeGesperrtBis" not in g for g in GRUPPEN), GRUPPEN


# ════════════════════════════════════════════════════════════════════════════
# §181 Die Gegenprobe zur Aufräumaktion
#
# Das Paket beschreibt das HAUS, nicht die Belegschaft. Diese beiden Prüfungen
# halten das fest — ohne sie wandert beim nächsten Kundenwunsch wieder ein
# Vorname hinein, und niemand merkt es, bis die Person das Haus verlässt.
# ════════════════════════════════════════════════════════════════════════════

def test_das_paket_kennt_keinen_einzigen_vornamen():
    """
    Im ausführbaren Teil des Pakets steht kein Name aus der Belegschaft.

    Kommentare und Erklärtexte dürfen Namen nennen — sie erzählen, was einmal
    passiert ist. Code darf es nicht: Ein Vorname im Code ist eine Regel, die
    beim nächsten Personalwechsel lautlos ins Leere läuft.
    """
    import re
    from pathlib import Path

    quelle = (Path(__file__).parent / "rulepacks" / "kunden"
              / "kita_zwei_etagen.py").read_text(encoding="utf-8")

    # Docstrings und Kommentare entfernen — übrig bleibt, was ausgeführt wird.
    ohne_docstrings = re.sub(r'"""(?:.|\n)*?"""', "", quelle)
    code = "\n".join(zeile.split("#")[0] for zeile in ohne_docstrings.splitlines())

    gefunden = [
        name.split()[0] for name, *_ in BELEGSCHAFT
        if re.search(r"\b" + re.escape(name.split()[0]) + r"\b", code)
    ]
    assert gefunden == [], (
        f"Diese Namen stehen im ausführbaren Teil des Regelpakets: {gefunden}. "
        "Angaben über einzelne Menschen gehören in die Personalakte."
    )


def test_ohne_tagesmuster_in_den_stammdaten_bleibt_der_plan_moeglich():
    """
    Wer kein Muster hinterlegt hat, wird verplant wie eh und je.

    Das ist die wichtigere Hälfte der Verschiebung: Nicht jeder Betrieb
    arbeitet in festen Tagesportionen. Ein Paket, das ohne Muster keinen Plan
    mehr zustande brächte, wäre für jeden zweiten Kunden unbrauchbar — und der
    Fehler fiele erst bei der Inbetriebnahme auf.
    """
    modell = regelmodell()
    for m in modell["mitarbeiter"]:
        m.pop("tagesmuster", None)
    plan = Plan(rechne(modell))
    assert plan.roh.get("eintraege"), "Ohne Tagesmuster kam gar kein Plan heraus"
    paket = plan.roh.get("regelpaket") or {}
    assert paket.get("angewendet"), f"Das Regelpaket lief nicht: {paket.get('fehler')}"
    # Und der Hinweis steht im Protokoll, statt still zu verschwinden.
    protokoll = " ".join(paket.get("regeln") or [])
    assert "Tagesmuster" in protokoll, protokoll
