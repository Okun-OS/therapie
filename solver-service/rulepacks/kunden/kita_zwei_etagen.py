"""
§163 Regelpaket: Kita mit zwei Etagen und acht Gruppen.

Aufgenommen am 26.09.2026 nach dem schriftlichen Regelwerk des Kunden.

WAS DIESEN BETRIEB AUSMACHT
Sechzehn Kräfte, zwei Etagen, acht Gruppen, geöffnet Montag bis Freitag von
06:00 bis 17:00. Jede Etage braucht jeden Tag jemanden, der aufschließt, und
jemanden, der abschließt. Die Wochenstunden sind vertraglich auf feste
Tagesmuster verteilt — hier wird nicht „irgendwie vierzig Stunden" gearbeitet,
sondern fünfmal acht.

DIE VIER PUNKTE, AN DENEN EIN AUTOMATISCHER PLAN HIER SCHEITERT

  1. TAGESMUSTER. Ohne sie verteilt der Rechendienst die Wochenstunden
     beliebig — zehn Stunden am Montag, sechs am Dienstag. Die Woche stimmt,
     der Plan ist unbrauchbar.

  2. ARBEITSZEIT GEGEN ANWESENHEIT. Acht Arbeitsstunden sind achteinhalb
     Stunden im Haus. Wer mit der Anwesenheit rechnet, schreibt jedem
     Achtstündler zweieinhalb Stunden Mehrarbeit in die Woche.

  3. GENAU EIN FRÜH- UND SPÄTDIENST JE ETAGE. Nicht „mindestens einer": Zwei
     Frühdienste auf derselben Etage sind eine verschenkte Kraft am Vormittag.

  4. FAIRNESS ÜBER DIE ZEITRAUMGRENZE. Wer vier Wochen in Folge den Spätdienst
     hatte, fängt in jeder neuen Planung bei null an — für den Betroffenen ist
     das der Unterschied zwischen einem fairen Plan und einem, der sich fair
     ausrechnet.

WAS HIER BEWUSST NICHT STEHT
Die Dienstzeiten. Sie stehen in den Schichten des Standorts, nicht im Paket —
06:00–14:30 für acht Stunden, 08:30–17:00 für den Spätdienst und so fort. Das
Paket spricht über ARBEITSSTUNDEN und findet die passenden Dienste selbst.
Legt der Betrieb eine weitere Achtstundenschicht an, gilt die Regel weiter.

Ebenfalls nicht hier: welcher der vier Arbeitstage bei Heike der
Sechsstundentag ist. Das Regelwerk lässt es offen und sagt, es solle
konfigurierbar sein — also entscheidet es der Plan, und wer einen festen Tag
will, trägt ihn als Wunsch ein. Eine erfundene Festlegung wäre schlimmer als
keine (§27 des Regelwerks).
"""

from __future__ import annotations

from .. import bausteine as b
from ..context import RegelFehler

META = {
    "kunde": "Kita – zwei Etagen, acht Gruppen",
    "version": 1,
    "beschreibung":
        "16 Kräfte auf zwei Etagen. Feste Tagesmuster statt frei verteilter "
        "Wochenstunden, genau ein Früh- und Spätdienst je Etage, Gruppe 1 nie "
        "unter zwei Personen, Springerin unten, Leitung nur im Notfall — und "
        "Fairness über die Zeitraumgrenze hinweg, den Freitag eigens gezählt.",
    "aufgenommen": "2026-09-26",
}

# ── Die Belegschaft, wie sie im Regelwerk steht ─────────────────────────────
#
# Gesucht wird über einen Namensteil. Er muss im Betrieb eindeutig sein — ist
# er es nicht, meldet sich der Sucher laut, statt die falsche Person zu
# treffen. Genau dafür gibt es ihn.

# Name → Tagesmuster in Arbeitsstunden (nicht Anwesenheit!)
TAGESMUSTER: dict[str, dict[float, int]] = {
    # Untere Etage
    "Marin":     {8: 5},
    "Shelley":   {8: 5},
    "Stephanie": {7: 5},
    "Christina": {7: 5},
    "Juliane":   {7: 5},
    "Kristine":  {8: 5},
    "Tim":       {8: 5},
    "Sophia":    {7: 5},
    # Obere Etage
    "Heike":     {8: 3, 6: 1},   # Freitag frei
    "Corinna":   {8: 5},
    "Susan":     {8: 5},
    "Katrin K":  {8: 4},         # Dienstag frei
    "Daniel":    {7: 5},
    "Annika":    {8: 3},         # Donnerstag und Freitag frei
    "Felix":     {8: 5},
    # Springerin
    "Nicole":    {5: 5},
}

# Name → feste freie Wochentage (0 = Montag)
FREIE_TAGE: dict[str, tuple[int, ...]] = {
    "Heike":    (4,),            # Freitag
    "Katrin K": (1,),            # Dienstag
    "Annika":   (3, 4),          # Donnerstag und Freitag
}

# ZWEI KOLLEGINNEN HEISSEN KATRIN
#
# Das Regelwerk nennt sie „Katrin K" (Gruppe 7, dienstags frei) und „Katrin"
# (Gruppe 8, mittwochs frei). Nach dem zweiten allein zu suchen trifft beide —
# und ein Sucher, der bei Mehrdeutigkeit rät, ist genau der Fehler, den dieses
# Programm nicht macht. Die Stammgruppe entscheidet.
#
# Absichtlich nicht der Nachname: Wer heiratet, heißt anders, und dann liefe
# die Regel ins Leere. Die Stammgruppe steht in den Stammdaten und wird dort
# gepflegt.
KATRIN_GRUPPE_8 = ("Katrin", "Gruppe 8")

# Wer regulär nicht in die Gruppenbesetzung gehört
LEITUNG = "Franke"
SPRINGERIN = "Nicole"


def _eindeutig(ctx, name: str) -> int | None:
    """
    Eine Person suchen, ohne den ganzen Plan zu kippen, wenn sie fehlt.

    Ein Kundenpaket soll laut scheitern, wenn eine Regel ins Leere läuft — das
    gilt für REGELN. Bei der Belegschaft ist es anders: Wer das Haus verlässt,
    wird im Programm inaktiv, und dann darf nicht der ganze Dienstplan
    ausfallen. Der Ausfall wird protokolliert; wer ihn liest, sieht sofort,
    dass das Paket nachgeführt gehört.
    """
    try:
        return ctx.person(name)
    except RegelFehler as fehler:
        ctx.notiere(f"Nicht im Plan: {name} — {fehler}")
        return None


def apply(ctx) -> None:
    # ── 1. Arbeitszeit ──────────────────────────────────────────────────────
    #
    # Zuerst die Tagesmuster, denn sie sperren alles, was nicht passt. Alle
    # weiteren Regeln arbeiten auf einem Modell, in dem niemand mehr eine
    # Dienstlänge bekommen kann, die sein Vertrag nicht kennt.
    for name, muster in TAGESMUSTER.items():
        if _eindeutig(ctx, name) is None:
            continue
        b.versuche(ctx, b.tagesmuster, name, muster)

    b.versuche(ctx, b.tagesmuster_in_gruppe, *KATRIN_GRUPPE_8, {8: 4})

    # Feste freie Tage. Sie stehen NACH den Mustern, weil ein Muster von vier
    # Arbeitstagen und ein freier Dienstag zusammengehören: erst beides
    # ergibt „Montag, Mittwoch, Donnerstag, Freitag".
    for name, tage in FREIE_TAGE.items():
        if _eindeutig(ctx, name) is None:
            continue
        b.versuche(ctx, b.person_frei_an, name, *tage)

    b.versuche(ctx, b.person_in_gruppe_frei_an, *KATRIN_GRUPPE_8, 2)

    # Die Sollzeit exakt treffen, nicht ungefähr. Der Rechendienst bestraft
    # Abweichungen sonst nur und nimmt sie in Kauf, wenn es anderswo mehr
    # spart — hier soll die Planung weder Über- noch Minusstunden erzeugen.
    # Franke bleibt ausgenommen: Ihre vierzig Stunden sind Leitungszeit und
    # stehen nicht im Dienstplan. Ohne die Ausnahme zwänge die Regel sie
    # genau in die Gruppenbesetzung, aus der sie herausgehalten werden soll.
    b.versuche(ctx, b.exakte_wochenstunden, 0, (LEITUNG,))

    # ── 2. Öffnen und Schließen ─────────────────────────────────────────────
    #
    # Jede Etage braucht jeden Tag genau eine Kraft im Früh- und eine im
    # Spätdienst. Reisst das, steht es hinterher als harte Verletzung im
    # Bericht — die Etage bliebe sonst zu.
    b.versuche(ctx, b.genau_einer_je_etage, "frueh")
    b.versuche(ctx, b.genau_einer_je_etage, "spaet")

    # ── 3. Gruppe 1 ─────────────────────────────────────────────────────────
    #
    # Die einzige Gruppe, bei der die Mindestbesetzung nicht verhandelbar ist.
    # Fällt Marin oder Shelley aus, wird Ersatz organisiert — Nicole, eine
    # Kraft aus einer anderen Gruppe, im Notfall die Leitung.
    b.versuche(ctx, b.mindestens_in_gruppe, "Gruppe 1", 2)

    # ── 4. Wer wo steht ─────────────────────────────────────────────────────
    #
    # Die Stammgruppen kommen aus den Stammdaten, nicht aus dem Paket: Der
    # Rechendienst bestraft das Verlassen der Stammgruppe schon von sich aus
    # (300 je Tag, 800 über die Etage hinweg). Eine zweite Regel daneben wäre
    # doppelt gemoppelt und beim nächsten Umzug einer Kraft veraltet.
    #
    # Was das Paket beisteuert, sind die beiden Ausnahmen von dieser Ordnung:
    if _eindeutig(ctx, SPRINGERIN) is not None:
        b.versuche(ctx, b.springer, SPRINGERIN, "untere", "Gruppe 1")

    # Die Leitung: NUR über das Gewicht, nicht über ein Verbot.
    #
    # Hier stand zuerst zusätzlich `rolle_ohne_gruppe("leitung")` — sie sollte
    # keiner Gruppe zugeordnet werden. Das Regelwerk sagt aber beides: keine
    # reguläre Gruppenbesetzung UND Einsatz zur Gruppenabdeckung im Notfall.
    # Das Verbot gewann, und damit konnte sie auch dann nicht einspringen, wenn
    # eine Etage sonst zubliebe.
    #
    # Aufgefallen ist es in der Abnahme: In der Notwoche stand die obere Etage
    # mit einer einzigen Kraft da, die nicht gleichzeitig öffnen und schließen
    # kann — und die Leitung blieb im Büro. Jetzt regelt es allein das Gewicht:
    # teuer genug, dass sie im Normalbetrieb außen vor bleibt, günstiger als
    # eine Etage, die nicht aufmacht.
    if _eindeutig(ctx, LEITUNG) is not None:
        b.versuche(ctx, b.nur_im_notfall, LEITUNG)

    # ── 5. Verteilung der Früh- und Spätdienste ─────────────────────────────
    #
    # Höchstens einer je Woche und Person — aufweichbar, wenn zu viele fehlen.
    # Ein Verbot wäre hier falsch: Es macht den Plan unlösbar, sobald vier
    # krank sind, und der Betrieb steht ohne alles da. So kostet es, und es
    # steht hinterher im Bericht, bei wem und wie oft.
    b.versuche(ctx, b.hoechstens_pro_woche_weich, "frueh", 1)
    b.versuche(ctx, b.hoechstens_pro_woche_weich, "spaet", 1)

    # ── 6. Fairness über die Wochen ─────────────────────────────────────────
    #
    # Der Rechendienst gleicht innerhalb des Zeitraums aus. Über dessen Grenze
    # sieht er nichts. Diese vier Zähler kommen aus der Belastungshistorie der
    # App und schließen die Lücke.
    b.versuche(ctx, b.historische_fairness, "frueh", "fruehDienste")
    b.versuche(ctx, b.historische_fairness, "spaet", "spaetDienste")
    b.versuche(ctx, b.freitagsfairness, "frueh", "freitagFrueh")
    b.versuche(ctx, b.freitagsfairness, "spaet", "freitagSpaet")

    # ── 7. Persönliche Vorlieben ────────────────────────────────────────────
    #
    # Ausdrücklich Vorlieben, keine Verbote. Sie wiegen weniger als eine
    # unbesetzte Stelle und weniger als die Fairness über die Wochen — sonst
    # trüge die Vorliebe des einen dauerhaft jemand anderes.
    for name, typ in (("Juliane", "spaet"), ("Felix", "frueh")):
        if _eindeutig(ctx, name) is None:
            continue
        b.versuche(ctx, b.moeglichst_nicht, name, typ)
