"""
§99 Regelpakete — programmierte Dienstplanlogik je Kunde.

Warum es das gibt
-----------------
OKUN Workforce ist ein Produkt, das für alle Kunden gleich läuft: Zeiterfassung,
Urlaub, Vertretung, Mitarbeiter-App, Zuschläge, Lohnvorbereitung. Nur die
DIENSTPLANUNG ist in jedem Betrieb anders — und genau dort scheitert
Selbstkonfiguration regelmäßig.

Deshalb wird dieser eine Teil pro Kunde von Hand programmiert: als echter,
versionierter Python-Code in diesem Verzeichnis, mit Git-Historie, Review und
eigenen Abnahmetests. Nicht als KI-erzeugter Schnipsel in einer Datenbankzeile.

Das ist ausdrücklich etwas anderes als die Custom-Constraints aus §70/§98:

    Custom-Constraints          Regelpakete (hier)
    ------------------------    --------------------------------
    Kunde/KI schreibt sie       OKUN programmiert sie
    liegen in der Datenbank     liegen im Repo, unter Versionskontrolle
    laufen in einer Sandbox     laufen als normaler Code (volle Sprache)
    sofort änderbar             Änderung geht über Deploy und Test
    Selbst-Stufe                Betreut-Stufe

Beides läuft nebeneinander. Ein Standort kann ein Regelpaket haben UND zusätzlich
eigene Regeln pflegen.

Ein Paket schreiben
-------------------
Neue Datei `kunden/<paket-id>.py` mit:

    META = {"kunde": "Kita Krümelkiste", "version": 1}

    def apply(ctx):
        kita.leitung_ohne_gruppe(ctx, "Franka")
        kita.max_ein_frueh_und_spaet_pro_woche(ctx)

`ctx` ist der Planungskontext (siehe context.py) mit Modell, Variablen, Personal,
Diensten, Gruppen und Wochen — plus Helfern, die die üblichen Fehler vermeiden
(Person nicht gefunden, Dienst nicht gefunden, Gruppe leer).

Gebunden wird ein Paket über `Location.rulePackId` in der App.

Die Einrichtung im Paket (§201)
-------------------------------
Ein Paket kann zusätzlich `EINRICHTUNG` mitbringen: Arbeitstage, Dienstzeiten,
Etagen und Gruppen, Basiswerte. Weist OKUN das Paket einem Standort zu, legt
die App davon an, was dort noch FEHLT — Bestehendes überschreibt sie nie.

Vorher stand das in Skripten (`scripts/kunde-wohngruppe.mjs`) und Testdaten,
die jemand von Hand gegen die Datenbank laufen lassen musste. Wer nur das Paket
zuwies, hatte einen Standort mit Regeln, aber ohne Dienste — und keinen Plan.
Der Kunde richtet seit §201 nichts mehr selbst ein; also muss es hier stehen.

    EINRICHTUNG = {
        "arbeitstage": ["Mo", "Di", "Mi", "Do", "Fr"],
        "dienstzeiten": [
            {"name": "Frühdienst", "art": "frueh", "von": "06:00", "bis": "14:30"},
        ],
        "struktur": [
            {"name": "Erdgeschoss", "typ": "etage"},
            {"name": "Bärenbande", "typ": "gruppe", "etage": "Erdgeschoss", "mindestbesetzung": 2},
        ],
        "basiswerte": {"maxWochenstunden": 40, "ruhezeitStunden": 11, "maxFolgetage": 5},
    }
"""

from __future__ import annotations

import importlib
import logging
import pkgutil
from types import ModuleType

log = logging.getLogger("solver.rulepacks")

# Nur aus diesem Paket wird geladen — eine Paket-ID kann niemals einen
# beliebigen Modulpfad adressieren.
_KUNDEN_PAKET = f"{__name__}.kunden"


def verfuegbare_pakete() -> list[dict]:
    """Alle hinterlegten Kundenpakete mit ihren Kopfdaten."""
    try:
        kunden = importlib.import_module(_KUNDEN_PAKET)
    except ModuleNotFoundError:
        return []
    gefunden: list[dict] = []
    for info in pkgutil.iter_modules(kunden.__path__):
        if info.name.startswith("_"):
            continue
        mod = _lade_modul(info.name)
        if mod is None:
            continue
        meta = dict(getattr(mod, "META", {}))
        meta["id"] = info.name
        einrichtung, fehler = einrichtung_von(mod)
        if einrichtung is not None:
            meta["einrichtung"] = einrichtung
        if fehler:
            meta["einrichtungFehler"] = fehler
        gefunden.append(meta)
    return sorted(gefunden, key=lambda m: m["id"])


WOCHENTAGE = ("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So")
DIENSTARTEN = ("frueh", "spaet", "mittel", "nacht")


def _uhrzeit(wert) -> bool:
    if not isinstance(wert, str) or len(wert) != 5 or wert[2] != ":":
        return False
    stunde, minute = wert[:2], wert[3:]
    return stunde.isdigit() and minute.isdigit() and int(stunde) < 24 and int(minute) < 60


def einrichtung_von(mod: ModuleType) -> tuple[dict | None, list[str]]:
    """
    §201 Die Einrichtung eines Pakets, geprüft.

    Geprüft wird HIER und nicht erst in der App: Eine Dienstzeit „25:00" oder
    eine Gruppe auf einer Etage, die es nicht gibt, soll beim Bauen des Pakets
    auffallen (test_rulepacks.py) und nicht beim ersten Kunden. Ist etwas
    falsch, wird die ganze Einrichtung NICHT gemeldet — eine halbe Einrichtung
    anzulegen wäre schlimmer als keine, denn danach überschreibt sie niemand.
    """
    roh = getattr(mod, "EINRICHTUNG", None)
    if roh is None:
        return None, []
    fehler: list[str] = []
    if not isinstance(roh, dict):
        return None, ["EINRICHTUNG ist kein dict."]

    tage = roh.get("arbeitstage", [])
    if not isinstance(tage, list) or any(t not in WOCHENTAGE for t in tage):
        fehler.append(f"arbeitstage unzulässig: {tage!r}")

    dienste = roh.get("dienstzeiten", [])
    namen: set[str] = set()
    for d in dienste if isinstance(dienste, list) else []:
        name = d.get("name") if isinstance(d, dict) else None
        if not name:
            fehler.append(f"Dienstzeit ohne Namen: {d!r}")
            continue
        if name in namen:
            fehler.append(f"Dienstzeit doppelt: {name}")
        namen.add(name)
        if d.get("art") not in DIENSTARTEN:
            fehler.append(f"{name}: art muss eine von {DIENSTARTEN} sein")
        if not (_uhrzeit(d.get("von")) and _uhrzeit(d.get("bis"))):
            fehler.append(f"{name}: von/bis müssen HH:MM sein")

    struktur = roh.get("struktur", [])
    etagen = {e.get("name") for e in struktur if isinstance(e, dict) and e.get("typ") == "etage"}
    for e in struktur if isinstance(struktur, list) else []:
        if not isinstance(e, dict) or not e.get("name") or e.get("typ") not in ("etage", "gruppe"):
            fehler.append(f"Struktur-Eintrag unzulässig: {e!r}")
        elif e.get("etage") and e["etage"] not in etagen:
            fehler.append(f'{e["name"]}: Etage „{e["etage"]}" gibt es in der Struktur nicht')

    basis = roh.get("basiswerte", {})
    if not isinstance(basis, dict) or any(
        not isinstance(basis.get(k), (int, float))
        for k in ("maxWochenstunden", "ruhezeitStunden", "maxFolgetage") if k in basis
    ):
        fehler.append(f"basiswerte unzulässig: {basis!r}")

    if fehler:
        log.error("[rulepacks] Einrichtung von %s fehlerhaft: %s", mod.__name__, fehler)
        return None, fehler
    return {
        "arbeitstage": list(tage),
        "dienstzeiten": [dict(d) for d in dienste],
        "struktur": [dict(e) for e in struktur],
        "basiswerte": dict(basis),
    }, []


def _lade_modul(pack_id: str) -> ModuleType | None:
    if not pack_id or not pack_id.replace("_", "").replace("-", "").isalnum():
        log.warning("[rulepacks] unzulaessige Paket-ID %r", pack_id)
        return None
    try:
        return importlib.import_module(f"{_KUNDEN_PAKET}.{pack_id.replace('-', '_')}")
    except ModuleNotFoundError:
        return None
    except Exception as exc:  # Syntaxfehler im Paket
        log.error("[rulepacks] Paket %r nicht ladbar: %s", pack_id, exc)
        return None


def apply_pack(pack_id: str | None, ctx) -> dict | None:
    """
    Regelpaket eines Standorts anwenden.

    Rückgabe ist ein Bericht wie bei den Custom-Constraints, damit ein Problem
    im Plan sichtbar wird statt im Log zu verschwinden (§96). Ein fehlendes oder
    fehlerhaftes Paket darf die Planung nie verhindern — der Kunde bekommt einen
    Plan, aber mit deutlichem Hinweis.
    """
    if not pack_id:
        return None

    mod = _lade_modul(pack_id)
    if mod is None:
        return {
            "id": pack_id,
            "name": f"Regelpaket „{pack_id}“",
            "angewendet": False,
            "fehler": "Regelpaket nicht gefunden oder nicht ladbar.",
        }

    meta = getattr(mod, "META", {})
    name = f'{meta.get("kunde", pack_id)} (v{meta.get("version", "?")})'
    apply_fn = getattr(mod, "apply", None)
    if not callable(apply_fn):
        return {"id": pack_id, "name": name, "angewendet": False,
                "fehler": "Das Regelpaket hat keine apply(ctx)-Funktion."}

    try:
        apply_fn(ctx)
    except Exception as exc:
        log.exception("[rulepacks] Paket %r fehlgeschlagen", pack_id)
        return {"id": pack_id, "name": name, "angewendet": False,
                "fehler": f"{type(exc).__name__}: {exc}"[:300]}

    return {
        "id": pack_id,
        "name": name,
        "angewendet": True,
        "regeln": list(ctx.protokoll),
    }
