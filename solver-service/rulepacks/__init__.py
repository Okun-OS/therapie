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
        gefunden.append(meta)
    return sorted(gefunden, key=lambda m: m["id"])


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
