"""
§126 Die Regelpakete der einzelnen Kunden.

Je Kunde eine Datei. Der Dateiname ist die Paket-ID, die am Standort hinterlegt
wird (`Location.rulePackId`).

Ein Paket besteht aus zwei Dingen:

    META  = {"kunde": "...", "version": 1, "beschreibung": "..."}
    apply(ctx) -> None

Mehr nicht. Die Regeln selbst kommen aus `bausteine.py`, solange sie dort
passen; was nur bei diesem einen Kunden gilt, steht direkt im Paket — mit
einem Satz dazu, WARUM der Betrieb es so hält.

Dieser eine Satz ist wichtiger als der Code darunter. In einem Jahr weiß
niemand mehr, warum Franka keiner Gruppe zugeordnet wird — außer es steht da.
"""
