"""
§126 Regelpaket: Kita Sonnenschein.

Aufgenommen am 11.09.2026 nach dem Gespräch über den Betriebsablauf.

Dieses Paket ist zugleich das Beispiel, an dem sich jedes weitere orientiert.
Es bildet genau die Fälle ab, an denen die Planung im August gescheitert ist —
und zwar so, dass man beim Lesen versteht, WARUM der Betrieb es so hält.
"""

from __future__ import annotations

from .. import bausteine as b

META = {
    "kunde": "Kita Sonnenschein",
    "version": 1,
    "beschreibung": "Zwei Etagen, vier Gruppen, Früh- und Spätdienst im Wechsel.",
    "aufgenommen": "2026-09-11",
}


def apply(ctx) -> None:
    # Die Leitung steht im Plan, arbeitet aber nicht in einer Gruppe: sie ist
    # den Tag über zwischen Büro, Elterngesprächen und Vertretung unterwegs.
    # Stand sie in einer Gruppe, sah der Plan besetzt aus und war es nicht.
    b.leitung_ohne_gruppe(ctx, "Franka")

    # Höchstens ein Spätdienst je Woche und Person. Der Spätdienst geht bis
    # 17:30 und die meisten Erzieherinnen holen danach eigene Kinder ab —
    # zwei in einer Woche hält der Betrieb nicht durch.
    #
    # Genau diese Regel hat im August nicht gegriffen: der Rechendienst kannte
    # die Kalenderwochen damals noch gar nicht, und die Regel lief still ins
    # Leere. Seither prüft der Versionsabgleich (§97), ob der Rechendienst
    # überhaupt kann, was eine Regel verlangt.
    b.hoechstens_pro_woche(ctx, "spät", 1)

    # Im Frühdienst wird aufgeschlossen und die erste Gruppe zusammengelegt.
    # Das darf keine Hilfskraft allein machen — es braucht jemanden, der im
    # Zweifel eine Entscheidung trifft.
    b.immer_eine_fachkraft(ctx, "früh", "erzieher", "leitung")
