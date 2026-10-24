"""
§185 Abnahme für das Regelpaket „Wohngruppe – fünf Bewohner".

WAS HIER GEPRUEFT WIRD
Nicht, ob die Bausteine durchlaufen — ob der GELOESTE Plan sich daran haelt.
Eine Regel, die ins Leere laeuft, ist der teuerste Fehler ueberhaupt: Sie sieht
aus, als wuerde sie wirken.

    python3 -m pytest test_wohngruppe.py -q

WARUM DIE MENSCHEN HIER KEINE NAMEN HABEN
„Leitung", „FaBe 1", „Assistenz 2" — das ist kein Platzhalter aus Bequemlichkeit,
sondern die Probe aufs Exempel. Seit §181 steht in einem Regelpaket kein Name
mehr; alles Persoenliche kommt aus den Stammdaten. Wenn dieses Paket mit einer
Belegschaft funktioniert, die es nie gesehen hat, ist das bewiesen. Und die
echten Namen des Kunden haben in einer Pruefdatei ohnehin nichts verloren.
"""

from __future__ import annotations

import os
from datetime import date, timedelta

import pytest

from solver import solve


# ── Der Betrieb, wie die App ihn schickt ────────────────────────────────────

SCHICHTEN = [
    {"id": "s1",  "name": "1 Früh",             "typ": "frueh", "von": "06:30", "bis": "14:00"},
    {"id": "s2",  "name": "2 Früh lang",        "typ": "frueh", "von": "06:30", "bis": "16:30"},
    {"id": "s3",  "name": "3 Tag",              "typ": "mittel", "von": "07:45", "bis": "19:15"},
    {"id": "s4",  "name": "4Bf Tag kurz früh",  "typ": "mittel", "von": "07:15", "bis": "16:30"},
    {"id": "s5",  "name": "5 Tag ab Mittag",    "typ": "mittel", "von": "11:30", "bis": "19:15"},
    {"id": "s6",  "name": "6 Mitteldienst",     "typ": "mittel", "von": "09:00", "bis": "18:15"},
    {"id": "s7",  "name": "7 Spät",             "typ": "spaet", "von": "13:45", "bis": "21:45"},
    {"id": "s8",  "name": "8 Spät lang",        "typ": "spaet", "von": "11:30", "bis": "21:45"},
    # Arbeitszeit, aber KEINE Betreuung — daran haengt die halbe Pruefdatei.
    {"id": "sb",  "name": "Büro ganzer Tag",    "typ": "mittel", "von": "08:00", "bis": "16:00"},
    {"id": "sl",  "name": "Büro Leitungsdienst", "typ": "mittel", "von": "08:00", "bis": "18:00"},
]
SCHICHT_NACH_ID = {s["id"]: s for s in SCHICHTEN}
BUERO = {"sb", "sl"}

# Name, Stunden, Funktion
BELEGSCHAFT = [
    ("Leitung",     37.8, "Gruppenleitung"),
    ("Stellv",      33.6, "Stellvertretende Gruppenleitung"),
    ("FaBe 1",      33.6, "FaBe"),
    ("FaBe 2",      33.6, "FaBe"),
    ("FaBe 3",      29.4, "FaBe"),
    ("FaBe 4",      33.6, "FaBe"),
    ("Assistenz 1", 33.6, "Betreuungsassistent"),
    ("Assistenz 2", 33.6, "Betreuungsassistent"),
    ("Aushilfe 1",   8.4, "FaBe"),
    ("Aushilfe 2",   4.2, "FaBe"),
]
ID_VON = {name: f"p{i}" for i, (name, *_) in enumerate(BELEGSCHAFT)}
NAME_VON = {v: k for k, v in ID_VON.items()}

START = date(2026, 10, 12)          # ein Montag
TAGE = [(START + timedelta(days=i)).isoformat() for i in range(14)]
WOCHENENDE = [t for i, t in enumerate(TAGE) if (START + timedelta(days=i)).weekday() >= 5]
WERKTAGE = [t for t in TAGE if t not in WOCHENENDE]


def regelmodell(abwesend: dict[str, list[str]] | None = None) -> dict:
    abwesend = abwesend or {}
    return {
        "rulePackId": "wohngruppe_fuenf",
        "zeitraum": {"von": TAGE[0], "bis": TAGE[-1], "arbeitstage": TAGE},
        "einheiten": [{"id": "g1", "name": "Wohngruppe", "typ": "gruppe",
                       "mindestbesetzung": 1}],
        "schichten": [
            {**s, "minBesetzungGesamt": 0, "uebernacht": False,
             "erforderlicheQualifikationen": []}
            for s in SCHICHTEN
        ],
        "harteRegeln": [
            {"typ": "max_wochenstunden", "wert": 42},
            {"typ": "min_ruhezeit", "wert": 11},
            {"typ": "max_folgetage", "wert": 6},
        ],
        "weicheRegeln": [],
        "fairness": {"wochenendArbeit": True},
        "mitarbeiter": [
            {
                "id": ID_VON[name],
                "name": name,
                "rolle": funktion,
                "position": funktion,
                "funktion": funktion,
                "einheiten": ["g1"],
                "stammEinheitId": "g1",
                "wochenstundenSoll": stunden,
                "arbeitstageProWoche": max(1, round(stunden / 8)),
                "qualifikationen": [],
                "verfuegbareSchichtTypen": ["frueh", "spaet", "mittel"],
                "nichtVerfuegbarAn": [],
                "urlaubAn": abwesend.get(name, []),
                "wuensche": [],
                "letzteSchichten": [],
                "belastungsHistorie": {},
            }
            for name, stunden, funktion in BELEGSCHAFT
        ],
        "pausenRegeln": {"thresholdMinutes": 360, "deductionMinutes": 30},
    }


def rechne(modell: dict, sekunden: str = "60") -> dict:
    os.environ["SOLVER_MAX_SECONDS"] = sekunden
    return solve(modell)


# ── Auswertung ──────────────────────────────────────────────────────────────

def minuten(zeit: str) -> int:
    h, m = zeit.split(":")
    return int(h) * 60 + int(m)


class Plan:
    def __init__(self, roh: dict):
        self.roh = roh
        self.eintraege = roh.get("eintraege", [])

    def am_tag(self, tag: str) -> list[dict]:
        return [e for e in self.eintraege if e.get("datum") == tag]

    def betreuend_um(self, tag: str, uhrzeit: str) -> list[str]:
        """Wer zu dieser Zeit BETREUT — Büro zählt nicht."""
        punkt = minuten(uhrzeit)
        drin = []
        for e in self.am_tag(tag):
            s = SCHICHT_NACH_ID.get(e.get("schichtId"))
            if not s or e.get("schichtId") in BUERO:
                continue
            if minuten(s["von"]) <= punkt < minuten(s["bis"]):
                drin.append(NAME_VON.get(e["mitarbeiterId"], e["mitarbeiterId"]))
        return drin

    def dienste_von(self, name: str) -> list[str]:
        return [e["schichtId"] for e in self.eintraege
                if e.get("mitarbeiterId") == ID_VON[name]]

    def stunden_von(self, name: str) -> float:
        gesamt = 0.0
        for sid in self.dienste_von(name):
            s = SCHICHT_NACH_ID.get(sid)
            if not s:
                continue
            dauer = minuten(s["bis"]) - minuten(s["von"])
            if dauer >= 360:
                dauer -= 30
            gesamt += dauer / 60
        return gesamt

    @property
    def paket(self) -> dict:
        return self.roh.get("regelpaket") or {}

    def verletzungen(self, art: str) -> list[str]:
        return [v.get("text", "") for v in self.roh.get("regelverletzungen", [])
                if v.get("art") == art]


@pytest.fixture(scope="module")
def plan() -> Plan:
    p = Plan(rechne(regelmodell()))
    paket = p.paket
    assert paket.get("angewendet"), f"Regelpaket lief nicht: {paket.get('fehler')}"
    return p


# ── Dass überhaupt etwas herauskommt ────────────────────────────────────────

def test_es_gibt_einen_plan(plan):
    assert len(plan.eintraege) > 50, f"nur {len(plan.eintraege)} Einträge"


def test_das_paket_wurde_angewendet(plan):
    assert plan.paket.get("angewendet") is True
    assert len(plan.paket.get("regeln") or []) >= 8, plan.paket.get("regeln")


# ── Die beiden Ränder des Tages ─────────────────────────────────────────────

def test_jeden_tag_faengt_jemand_um_halb_sieben_an(plan):
    """Um 06:30 stehen die Bewohner auf. Ist dann niemand da, ist die Gruppe
    unbetreut — das ist keine Unterbesetzung, das ist ein anderer Zustand."""
    for tag in TAGE:
        assert plan.betreuend_um(tag, "06:30"), f"{tag}: niemand um 06:30"


def test_jeden_tag_bleibt_jemand_bis_viertel_vor_zehn(plan):
    for tag in TAGE:
        assert plan.betreuend_um(tag, "21:30"), f"{tag}: niemand abends"


# ── Der Punkt, an dem Dienstpläne hier scheitern ────────────────────────────

def test_keine_luecke_zwischen_halb_sieben_und_viertel_vor_zehn(plan):
    """
    „Täglich ein Frühdienst und ein Spätdienst" klingt vollständig. Endet der
    Frühdienst um 14:00 und beginnt der Spätdienst um 16:30, steht die Gruppe
    zweieinhalb Stunden leer — und auf dem Plan sieht beides besetzt aus.
    """
    for tag in TAGE:
        for punkt in range(minuten("06:30"), minuten("21:45"), 15):
            uhr = f"{punkt // 60:02d}:{punkt % 60:02d}"
            assert plan.betreuend_um(tag, uhr), f"{tag} um {uhr}: Lücke in der Betreuung"


# ── Der Betreuungsschlüssel ─────────────────────────────────────────────────

def test_werktags_tagsueber_mindestens_zwei(plan):
    """Fünf Bewohner, vertretbar drei je Kraft — also zwei Personen."""
    for tag in WERKTAGE:
        for uhr in ("07:45", "09:00", "11:30", "14:00", "16:00", "17:45"):
            da = plan.betreuend_um(tag, uhr)
            assert len(da) >= 2, f"{tag} um {uhr}: nur {da}"


def test_am_wochenende_genuegt_eine_person(plan):
    """
    Die Gegenprobe zum Schlüssel. Freitags fahren zwei bis drei Bewohner nach
    Hause; am Wochenende genügen die beiden Kerndienste. Wird dort dieselbe
    Besetzung geplant wie werktags, verplant der Betrieb Menschen, die niemand
    braucht — und sie fehlen am Montag.
    """
    werktags = [len(plan.betreuend_um(t, "11:00")) for t in WERKTAGE]
    wochenends = [len(plan.betreuend_um(t, "11:00")) for t in WOCHENENDE]
    assert all(n >= 1 for n in wochenends), wochenends
    assert sum(wochenends) / len(wochenends) < sum(werktags) / len(werktags), (
        f"Wochenende {wochenends} ist nicht schwächer besetzt als werktags {werktags}"
    )


# ── Büro ist Arbeitszeit, aber keine Betreuung ──────────────────────────────

def test_buero_zaehlt_nicht_zur_besetzung(plan):
    """
    Der Fehler, der sich am leichtesten einschleicht: Wer von acht bis vier im
    Büro sitzt, steht im Dienstplan. Zählte er mit, rechnete sich die Gruppe
    reich — auf dem Papier zwei Leute, in Wirklichkeit einer.

    Geprüft wird an den Tagen, an denen überhaupt jemand Büro hat: Dort müssen
    NEBEN dem Bürodienst noch genug Betreuende stehen.
    """
    mit_buero = [
        (e["datum"], NAME_VON.get(e["mitarbeiterId"]))
        for e in plan.eintraege if e.get("schichtId") in BUERO
    ]
    assert mit_buero, "Niemand hat Bürozeit — dann prüft dieser Test nichts"
    for tag, wer in mit_buero:
        if tag in WOCHENENDE:
            continue
        da = plan.betreuend_um(tag, "11:00")
        assert wer not in da, f"{wer} steht am {tag} im Büro UND in der Betreuung"
        assert len(da) >= 2, f"{tag}: {wer} im Büro, aber nur {da} in der Betreuung"


# ── Wer führen darf ─────────────────────────────────────────────────────────

def test_assistenz_bekommt_keinen_leitungsdienst(plan):
    """„Betreuungsassistenten übernehmen keine Führungsaufgaben.\""""
    for name, _, funktion in BELEGSCHAFT:
        if funktion != "Betreuungsassistent":
            continue
        assert "sl" not in plan.dienste_von(name), f"{name} hat den Leitungsdienst"


def test_die_leitung_darf_ihn_sehr_wohl(plan):
    """
    Die Gegenprobe. Ohne sie wäre der Test oben auch dann grün, wenn der
    Leitungsdienst gar nicht vergeben würde — und niemand merkte, dass die
    Bürozeit der Leitung im Plan fehlt.
    """
    erlaubt = [n for n, _, f in BELEGSCHAFT
               if f in ("Gruppenleitung", "Stellvertretende Gruppenleitung", "FaBe")]
    vergeben = any("sl" in plan.dienste_von(n) or "sb" in plan.dienste_von(n)
                   for n in erlaubt)
    assert vergeben, "Es wurde überhaupt keine Bürozeit geplant"


# ── Das Stundenband ─────────────────────────────────────────────────────────

def test_niemand_laeuft_aus_dem_stundenband(plan):
    """−30 bis +45 Stunden über den Zeitraum — so steht es im Regelwerk."""
    for name, stunden, _ in BELEGSCHAFT:
        soll = stunden * 2          # zwei volle Wochen
        ist = plan.stunden_von(name)
        assert soll - 30 <= ist <= soll + 45, (
            f"{name}: {ist:.1f} statt {soll:.1f} Std."
        )


def test_das_band_zwingt_nicht_auf_null(plan):
    """
    Die Gegenprobe, und sie ist der eigentliche Punkt dieses Pakets.

    Die Kita verlangt die Sollzeit auf die Minute. Dieser Betrieb will
    ausdrücklich das Gegenteil: Plus- und Minusstunden sind gewollt und werden
    später gezielt abgebaut. Ein Band, das in der Praxis doch jeden auf null
    zwingt, wäre `exakte_wochenstunden` unter anderem Namen.
    """
    abweichungen = [
        abs(plan.stunden_von(n) - s * 2) for n, s, _ in BELEGSCHAFT
    ]
    assert max(abweichungen) > 0.5, (
        "Alle treffen ihre Sollzeit exakt — das Band wirkt wie ein Zwang"
    )


# ── Dass das Paket niemanden beim Namen kennt ───────────────────────────────

def test_das_paket_kennt_keinen_einzigen_namen():
    """
    §181 Ein Regelpaket beschreibt das Haus, nicht die Belegschaft. Diese
    Prüfung schlägt an, sobald wieder ein Vorname in den Code wandert — und
    zwar bevor die Person das Haus verlässt und die Regel lautlos ins Leere
    läuft.

    Dass der Plan oben überhaupt entsteht, ist der zweite Teil desselben
    Beweises: Diese Prüfdatei benutzt eine erfundene Belegschaft, die das Paket
    nie gesehen hat.
    """
    import re
    from pathlib import Path

    quelle = (Path(__file__).parent / "rulepacks" / "kunden"
              / "wohngruppe_fuenf.py").read_text(encoding="utf-8")
    ohne_docstrings = re.sub(r'"""(?:.|\n)*?"""', "", quelle)
    code = "\n".join(z.split("#")[0] for z in ohne_docstrings.splitlines())

    # Die echten Vornamen aus dem Regelwerk des Kunden.
    namen = ["Arwed", "Kurt", "Jochen", "Stephanie", "Andrea", "Lorena",
             "Manuela", "Sarah", "Fabienne", "Spanehl", "Steffen", "Gärtner",
             "Kohler", "Stitrich", "Bucher", "Stirnimann", "Wolf",
             "Stendelmann"]
    gefunden = [n for n in namen if re.search(r"\b" + n, code)]
    assert gefunden == [], (
        f"Diese Namen stehen im ausführbaren Teil des Regelpakets: {gefunden}"
    )


# ── Was passiert, wenn es eng wird ──────────────────────────────────────────

@pytest.fixture(scope="module")
def mit_urlaub() -> Plan:
    """Drei gleichzeitig im Urlaub — die Obergrenze des Regelwerks."""
    return Plan(rechne(regelmodell({
        "FaBe 1": TAGE[:7], "FaBe 2": TAGE[:7], "Assistenz 1": TAGE[:7],
    })))


def test_mit_drei_im_urlaub_entsteht_trotzdem_ein_plan(mit_urlaub):
    assert mit_urlaub.eintraege, "Kein Plan trotz erlaubter Urlaubslage"
    assert mit_urlaub.paket.get("angewendet") is True


def test_auch_dann_bleiben_die_raender_besetzt(mit_urlaub):
    """
    Die Ränder sind das Letzte, was fallen darf. Sie wiegen im Paket schwerer
    als jede andere Regel — genau dafür ist das Gewicht da.
    """
    for tag in TAGE[:7]:
        assert mit_urlaub.betreuend_um(tag, "06:30"), f"{tag}: morgens niemand"
        assert mit_urlaub.betreuend_um(tag, "21:30"), f"{tag}: abends niemand"


def test_und_niemand_arbeitet_im_urlaub(mit_urlaub):
    for name in ("FaBe 1", "FaBe 2", "Assistenz 1"):
        tage = [e["datum"] for e in mit_urlaub.eintraege
                if e.get("mitarbeiterId") == ID_VON[name]]
        assert not set(tage) & set(TAGE[:7]), f"{name} arbeitet im Urlaub: {tage}"
