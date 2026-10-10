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

Ebenfalls nicht hier: bei einer Vier-Tage-Kraft, welcher der Tage der kürzere
ist. Das Regelwerk lässt es offen und sagt, es solle konfigurierbar sein — also
entscheidet es der Plan, und wer einen festen Tag will, trägt ihn als Wunsch
ein. Eine erfundene Festlegung wäre schlimmer als keine (§27 des Regelwerks).

Und seit §181 nicht mehr hier: die Belegschaft. Tagesmuster, feste freie Tage,
Rollen und Vorlieben stehen in den Personalakten, wo sie hingehören. In dieser
Datei steht kein einziger Vorname mehr — sie beschreibt das Haus, nicht die
Menschen darin, und überlebt deshalb jeden Personalwechsel.
"""

from __future__ import annotations

from .. import bausteine as b

META = {
    "kunde": "Kita – zwei Etagen, acht Gruppen",
    "version": 6,
    "beschreibung":
        "Zwei Etagen, acht Gruppen. Feste Tagesmuster aus den Personalakten "
        "statt frei verteilter "
        "Wochenstunden, genau ein Früh- und Spätdienst je Etage, bis 15:30 "
        "genug Leute für den Nachmittag, Gruppe 1 nie unter zwei Personen, "
        "Springerin nur zur Kernzeit, Leitung nur im Notfall, Vertretung "
        "zuerst auf der eigenen Etage — und Fairness "
        "über die Zeitraumgrenze hinweg, den Freitag eigens gezählt.",
    "aufgenommen": "2026-09-26",
}

# ── Was dieses Paket NICHT mehr enthaelt ────────────────────────────────────
#
# §181 Bis zum 02.10.2026 standen hier drei Tabellen: die Tagesmuster von
# sechzehn Personen, ihre festen freien Tage und zwei Namen fuer Leitung und
# Springerin. Alle drei sind weg, und das ist der wichtigste Unterschied
# zwischen dieser und der vorigen Fassung.
#
# WARUM SIE HIER FALSCH WAREN
# „Stephanie arbeitet fuenfmal sieben Stunden" ist keine Aussage ueber diesen
# Betrieb, sondern ueber einen Arbeitsvertrag. Sie gehoert in die Personalakte,
# genau wie die Stundenzahl daneben. Hier gehoert hin, was gilt, wenn die halbe
# Belegschaft wechselt: dass jede Etage oeffnet und schliesst, dass Gruppe 1 nie
# unter zwei Personen faellt, dass wer abgibt jemanden zuruecklaesst.
#
# WAS DER AUSSCHLAG GAB
# Nicht die Ordnung, sondern ein Fehler. Standen Muster und Stundenzahl an zwei
# Orten, konnten sie einander widersprechen — und `exakte_wochenstunden` machte
# daraus einen Widerspruch im Modell. Nachgemessen im Demo-Betrieb: Stunden in
# der Maske von 35 auf 28 geaendert, und der Rechendienst fand fuer den GANZEN
# Standort keinen Plan mehr. Die Meldung nannte Urlaube, Ruhezeiten und das
# Stundenlimit — drei Ursachen, von denen keine zutraf.
#
# Jetzt kommt beides aus derselben Quelle und wird beim Speichern zusammen
# geprueft. Ein Personalwechsel geht dieses Paket nichts mehr an.

LEITUNG_ROLLE = "Leitung"
SPRINGER_ROLLE = "Springer"


def apply(ctx) -> None:
    # ── 1. Arbeitszeit ──────────────────────────────────────────────────────
    #
    # Zuerst die Tagesmuster, denn sie sperren alles, was nicht passt. Alle
    # weiteren Regeln arbeiten auf einem Modell, in dem niemand mehr eine
    # Dienstlänge bekommen kann, die sein Vertrag nicht kennt.
    #
    # §181 Die Muster kommen aus den Stammdaten, nicht von hier. Wer keines
    # hinterlegt hat, wird wie bisher frei verplant.
    #
    # Die festen freien Tage brauchen gar keine Regel mehr: Sie stehen als
    # `fixedOffDays` in der Personalakte und erreichen den Rechendienst schon
    # als „an diesem Tag nicht verfügbar".
    b.versuche(ctx, b.tagesmuster_aus_stammdaten)

    # Die Sollzeit exakt treffen, nicht ungefähr. Der Rechendienst bestraft
    # Abweichungen sonst nur und nimmt sie in Kauf, wenn es anderswo mehr
    # spart — hier soll die Planung weder Über- noch Minusstunden erzeugen.
    #
    # Die Leitung bleibt ausgenommen: Ihre vierzig Stunden sind Leitungszeit
    # und stehen nicht im Dienstplan. Ohne die Ausnahme zwänge die Regel sie
    # genau in die Gruppenbesetzung, aus der sie herausgehalten werden soll.
    # Ausgenommen wird über die FUNKTION, nicht über einen Namen — sonst gilt
    # die Ausnahme beim nächsten Leitungswechsel für die falsche Person.
    b.versuche(ctx, b.exakte_wochenstunden, 0, tuple(b.namen_mit_rolle(ctx, LEITUNG_ROLLE)))

    # ── 2. Öffnen und Schließen ─────────────────────────────────────────────
    #
    # Jede Etage braucht jeden Tag genau eine Kraft im Früh- und eine im
    # Spätdienst. Reisst das, steht es hinterher als harte Verletzung im
    # Bericht — die Etage bliebe sonst zu.
    b.versuche(ctx, b.genau_einer_je_etage, "frueh")
    b.versuche(ctx, b.genau_einer_je_etage, "spaet")

    # ── 2b. Der Nachmittag ──────────────────────────────────────────────────
    #
    # Morgens passiert wenig, nachmittags viel: Die Kinder sind wach, die
    # Eltern kommen, es wird abgeholt und erzählt. Deshalb zählt nicht, WIE
    # LANGE jemand da war, sondern BIS WANN.
    #
    # Neben dem Spätdienst bleibt auf jeder Etage mindestens eine Kraft bis
    # 15:30 — am besten zwei. Die zweite ist bewusst ein Wunsch und kein
    # Muss: An einem Tag mit zwei Krankmeldungen ist sie nicht zu halten, und
    # dann soll der Plan trotzdem entstehen.
    b.versuche(ctx, b.genug_bis_uhrzeit, "15:30", 1, 2)

    # Es gibt genau drei Arten, den Tag zu beenden: mit dem Spätdienst um
    # 17:00, mit dem Nachmittag um 15:30 oder 15:00, oder früher, weil jemand
    # um sechs angefangen hat. Ein Dienst, der um 16:00 endet, passt in keine
    # davon — er lässt jemanden gehen, wenn die Ablösung noch nicht da ist.
    #
    # Gesperrt wird es hier und nicht dem Zufall überlassen, dass niemand so
    # einen Dienst anlegt. Genau das passiert nämlich irgendwann.
    b.versuche(ctx, b.kein_dienstende_zwischen, "15:30", "17:00")

    # ── 3. Gruppe 1 ─────────────────────────────────────────────────────────
    #
    # Die einzige Gruppe, bei der die Mindestbesetzung nicht verhandelbar ist.
    # Fällt Marin oder Shelley aus, wird Ersatz organisiert — Nicole, eine
    # Kraft aus einer anderen Gruppe, im Notfall die Leitung.
    b.versuche(ctx, b.mindestens_in_gruppe, "Gruppe 1", 2)

    # ── 3b. Jede andere Gruppe ──────────────────────────────────────────────
    #
    # Jede Gruppe ist an jedem Tag besetzt — mindestens eine Person. Der
    # Rechendienst bestrafte das schon, MELDETE es aber nicht: In der Abnahme
    # stand Gruppe 7 zwei Tage leer, und der Bericht sagte „hart verletzt: 0".
    # Ein Plan, in dem eine Gruppe fehlt, sah aus wie ein normaler Plan.
    b.versuche(ctx, b.jede_gruppe_besetzt, 1)

    # ── 3c. Wer einspringt und wer nicht weg darf ───────────────────────────
    #
    # In einer Gruppe steht höchstens EINE fremde Kraft. Müssen zwei Gruppen
    # besetzt werden, dürfen auch zwei Leute kommen — aber je eine in jede.
    # Eine Gruppe, die nur aus Vertretungen besteht, ist keine Gruppe mehr:
    # Dann kennt niemand die Kinder.
    b.versuche(ctx, b.hoechstens_eine_vertretung_je_gruppe, 1)

    # Und: Wer geht, lässt jemanden zurück. „Jede Gruppe ist besetzt" reicht
    # nicht — die Gruppe kann besetzt sein, aber nur noch von einer Fremden.
    # Genau das ist passiert: Stephanie krank, Christina nach oben geschickt,
    # die Springerin rückte in Gruppe 2 nach. Auf dem Papier war alles besetzt;
    # in Wirklichkeit stand eine Gruppe, deren eigene Kraft da war, den ganzen
    # Tag mit einer Fremden da — und oben hätte die Springerin genauso gut
    # selbst einspringen können.
    b.versuche(ctx, b.nur_abgeben_wenn_jemand_bleibt)

    # Und aus einer Gruppe in der Eingewöhnung wird niemand abgezogen. Die
    # Kinder lernen gerade ein Gesicht; wer es ihnen wegnimmt, fängt von vorne
    # an. Die Sperre steht in den Stammdaten der Gruppe und hat ein
    # Ablaufdatum — eine ohne wäre in zwei Jahren noch da.
    b.versuche(ctx, b.abgabesperre_beachten)

    # §182 Und eine Gruppe, die unterwegs ist, bleibt unter sich: Sie braucht
    # keine Besetzung, es kommt niemand dazu, und es geht niemand weg. Bis
    # hierher gab es dafür nur die Maßnahme „aufteilen" — und die entsteht
    # erst, nachdem der Rechendienst gemeldet hat, dass er die Gruppe nicht
    # besetzen kann. Eine Leitung, die die Fahrt seit sechs Wochen im Kalender
    # stehen hat, konnte sie ihm nicht ansagen.
    b.versuche(ctx, b.unterwegs_beachten)

    # ── 4. Wer wo steht ─────────────────────────────────────────────────────
    #
    # Die Stammgruppen kommen aus den Stammdaten, nicht aus dem Paket: Der
    # Rechendienst bestraft das Verlassen der Stammgruppe schon von sich aus
    # (300 je Tag, 800 über die Etage hinweg). Eine zweite Regel daneben wäre
    # doppelt gemoppelt und beim nächsten Umzug einer Kraft veraltet.
    #
    # Was das Paket beisteuert, ist die REIHENFOLGE beim Vertreten: Fällt
    # jemand aus, wird die Lücke zuerst auf derselben Etage geschlossen. Wer
    # die Etage wechselt, kennt die Kinder nicht — weiß nicht, wer wo schläft,
    # wer was nicht isst und wer wen beißt. Beides ist besser als eine
    # unbesetzte Gruppe, aber in dieser Reihenfolge.
    b.versuche(ctx, b.vertretung_zuerst_auf_der_etage)

    # Dazu die beiden Ausnahmen von der Stammgruppen-Ordnung. §181 Über die
    # FUNKTION, nicht über einen Namen: Wer die Springerin ist, steht in den
    # Stammdaten und ändert sich dort.
    for springerin in b.namen_mit_rolle(ctx, SPRINGER_ROLLE):
        b.versuche(ctx, b.springer, springerin, "untere", "Gruppe 1")
        # Sie kommt zur Kernzeit — nicht zum Aufschließen und nicht zum
        # Abschließen. Wer sie in den Frühdienst steckt, hat eine Kraft
        # weniger, wenn alle Kinder da sind; und das Aufschließen soll
        # jemand machen, der die Gruppe kennt.
        b.versuche(ctx, b.nur_dienstarten, springerin, "mittel")

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
    for leitung in b.namen_mit_rolle(ctx, LEITUNG_ROLLE):
        b.versuche(ctx, b.nur_im_notfall, leitung)

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
    # §181 Hier standen zwei Namen mit ihren Abneigungen. Auch das ist keine
    # Betriebsregel: Welche Schicht jemand lieber mag, gehört in sein
    # Planungsprofil. Von dort kommt es jetzt — und zwar mit demselben
    # Gewicht wie vorher.
    #
    # Der generische Wunschmechanismus allein hat dafür nicht gereicht: Er
    # wiegt zu leicht, und in der Abnahme bekam die Kollegin ihren Spätdienst
    # trotzdem. Eine Vorliebe, die nur manchmal gilt, ist keine.
    b.versuche(ctx, b.vorlieben_aus_stammdaten)
