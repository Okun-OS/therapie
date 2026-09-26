"""
§161 Musterregelpaket Pflege — das Paket, mit dem ein neuer Kunde anfängt.

WOZU EIN MUSTERPAKET
Ein Kundenpaket entsteht im Gespräch über den Betriebsablauf. Bis dieses
Gespräch stattgefunden hat, steht ein neuer Kunde ohne Regelpaket da: Der
Rechendienst kennt dann nur die allgemeinen Grenzen (Arbeitszeit, Ruhezeit,
Tage am Stück) und weiß nichts über Fachkraftquoten, Leitung oder
Auszubildende. Sein erster Plan sieht dadurch gut aus und ist fachlich falsch.

Dieses Paket schließt die Lücke mit dem, was in fast jeder Einrichtung gilt.
Es ist ausdrücklich ein AUSGANGSPUNKT, kein fertiges Kundenpaket:

    Musterpaket (hier)              Kundenpaket
    ----------------------------    --------------------------------
    kennt den Betrieb nicht         entsteht aus dem Gespräch
    spricht über Rollen             spricht über Namen
    überspringt, was nicht passt    scheitert laut, wenn etwas fehlt
    für alle gleich                 für diesen einen Betrieb

WARUM ES ÜBERSPRINGT STATT ZU SCHEITERN
Weil es den Betrieb nicht kennt. Ob es Nachtdienste gibt, ob mit Gruppen
geplant wird, ob jemand als Auszubildender geführt ist — all das weiß ein
Musterpaket nicht. Jede Regel läuft deshalb durch `b.versuche`: Passt sie
nicht, steht im Protokoll, WARUM sie übersprungen wurde. Diese Liste ist die
Tagesordnung für das Gespräch, aus dem das eigene Paket entsteht.

In einem Kundenpaket wäre dasselbe Verhalten ein Fehler. Dort ist eine Regel,
die ins Leere läuft, das Teuerste, was passieren kann — sie sieht aus, als
würde sie wirken.
"""

from __future__ import annotations

from .. import bausteine as b

META = {
    "kunde": "Muster Pflege (Vorlage)",
    "version": 1,
    "beschreibung":
        "Ausgangspaket für eine neue Einrichtung: Fachkraft je Dienst, "
        "Leitung frei für Leitungsaufgaben, Azubis nie allein, "
        "Nachtdienstblöcke begrenzt, ein ganzes Wochenende frei. "
        "Was nicht passt, wird übersprungen und protokolliert.",
    "aufgenommen": "2026-09-26",
    "muster": True,
}

# Wie eine Fachkraft in den Stammdaten heißen kann. Die Begriffe kommen aus
# den Sektoren, für die OKUN Workforce gebaut ist — Pflege, Eingliederungs-
# hilfe, Kita. Gesucht wird in Rolle, Position und Funktion, jeweils als
# Teilzeichenkette: „Pflegefachkraft" trifft auf „fachkraft".
FACHKRAFT = (
    "fachkraft", "examiniert", "pflegefach", "erzieher",
    "heilerziehungspfleger", "heilpädagog", "leitung", "fachlich",
)

# Wer nicht allein Verantwortung trägt.
IN_ANLEITUNG = ("azubi", "auszubildend", "praktikant", "schüler", "fsj", "bfd")

LEITUNG = ("leitung", "pdl", "wbl", "einrichtungsleitung")


def apply(ctx) -> None:
    # ── Fachlichkeit ────────────────────────────────────────────────────────
    # In jedem Dienst ist mindestens eine Fachkraft. Ohne diese Regel setzt
    # der Rechendienst rechnerisch korrekt eine Schicht nur aus Hilfskräften
    # zusammen. Rechnerisch ist der Plan dann voll; fachlich ist er ein
    # Kunstfehler, und im Prüfbericht steht es später als Mangel.
    for dienst in ("früh", "spät", "nacht"):
        b.versuche(ctx, b.immer_eine_fachkraft, dienst, *FACHKRAFT)

    # Wer noch in Anleitung ist, steht nie allein im Dienst. Das ist keine
    # Feinheit: Wer allein im Nachtdienst steht und die Aufgabe nicht
    # verantworten darf, ist im Ernstfall der Person ausgeliefert, um die es
    # geht.
    b.versuche(ctx, b.nie_allein, *IN_ANLEITUNG)

    # Und im Nachtdienst gar nicht. Nachts ist niemand da, den man fragen
    # kann — die Anleitung, die den Einsatz rechtfertigt, findet tagsüber statt.
    b.versuche(ctx, b.rolle_niemals_dienst, "nacht", *IN_ANLEITUNG)

    # ── Leitung ─────────────────────────────────────────────────────────────
    # Die Leitung steht im Plan, aber nicht in einer Gruppe: Sie ist den Tag
    # über zwischen Büro, Angehörigen, Behörden und Vertretung unterwegs.
    # Stand sie fest in einer Gruppe, sähe der Plan besetzt aus und wäre es
    # nicht.
    b.versuche(ctx, b.rolle_ohne_gruppe, *LEITUNG)

    # Keine Nachtdienste für die Leitung. Nicht, weil sie es nicht könnte,
    # sondern weil sie am nächsten Vormittag erreichbar sein muss — und nach
    # einem Nachtdienst ist sie das nicht.
    b.versuche(ctx, b.rolle_niemals_dienst, "nacht", *LEITUNG)

    # ── Belastung ───────────────────────────────────────────────────────────
    # Höchstens drei Nachtdienste am Stück. Der Rechendienst begrenzt die
    # Arbeitstage am Stück, aber nicht die Dienstart — drei Nächte sind etwas
    # anderes als drei Frühdienste, und der Unterschied steht in keiner
    # allgemeinen Regel, sondern in der Belastung.
    b.versuche(ctx, b.hoechstens_am_stueck, "nacht", 3)

    # Mindestens ein ganzes Wochenende frei. Eine Obergrenze für
    # Wochenenddienste allein reicht nicht: Wer jeden Samstag arbeitet und
    # jeden Sonntag frei hat, hat nie ein Wochenende. Für jemanden mit Familie
    # ist das der Unterschied, an dem eine Stelle scheitert.
    b.versuche(ctx, b.freies_wochenende, 1)
