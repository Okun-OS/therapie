"""
§185 Regelpaket: Wohngruppe mit fünf Bewohnern.

Aufgenommen am 03.10.2026 nach dem schriftlichen Regelwerk des Kunden
(„Grundlagen für die Dienstplanerstellung").

WAS DIESEN BETRIEB AUSMACHT — UND WARUM ER ANDERS TICKT ALS DIE KITA
Eine Wohngruppe hat keine Gruppen und keine Etagen. Es gibt einen Ort, fünf
Bewohner und elf Menschen, die sich die Woche teilen. Die Frage ist deshalb
nicht „wer steht wo", sondern „wann sind wie viele da":

    06:30   jemand muss aufschließen, die Bewohner stehen auf
    07:45   die Betreuung wird dichter, der Tag beginnt
    18:00   die Bewohner werden weniger, einer reicht wieder
    21:45   jemand bleibt bis zum Schluss

Dazwischen darf keine Minute leer sein. Genau das ist der Unterschied zur
Kita: Dort stand die Frage im Vordergrund, wer welche Gruppe betreut; hier
steht die Zeitachse im Vordergrund.

DIE FÜNF PUNKTE, AN DENEN EIN AUTOMATISCHER PLAN HIER SCHEITERT

  1. DIE LÜCKE, DIE AUF DEM PAPIER NICHT ZU SEHEN IST. „Täglich ein Frühdienst
     und ein Spätdienst" klingt vollständig. Endet der Frühdienst um 14:00 und
     beginnt der Spätdienst um 16:30, steht die Gruppe zweieinhalb Stunden
     leer — und der Plan sieht besetzt aus.

  2. BÜROZEIT IST ARBEITSZEIT, ABER KEINE BETREUUNG. Wer von acht bis vier im
     Büro sitzt, steht im Dienstplan. Zählte er zur Besetzung, rechnete sich
     die Gruppe reich: auf dem Papier zwei Leute, in Wirklichkeit einer.

  3. DER BETREUUNGSSCHLÜSSEL IST EIN WUNSCH, KEINE ZAHL. Angestrebt sind zwei
     Bewohner je Kraft, vertretbar sind drei. Wer nur das Vertretbare einträgt,
     bekommt dauerhaft die schlechtere Besetzung — der Rechendienst hat dann
     keinen Grund, mehr zu tun.

  4. DAS WOCHENENDE IST EIN ANDERER BETRIEB. Freitags fahren zwei bis drei
     Bewohner nach Hause. Am Wochenende genügen dann zwei Kerndienste. Wer die
     Werktagsbesetzung durchzieht, verplant Menschen, die niemand braucht —
     und sie fehlen am Montag.

  5. DAS PENSUM MUSS NICHT AUFGEHEN. Dieser Betrieb sagt ausdrücklich: Plus-
     und Minusstunden sind gewollt und werden später gezielt abgebaut
     (−30 bis +45 Stunden). Ihn zu zwingen, jeden Monat auf null zu landen,
     nimmt ihm genau die Beweglichkeit, mit der er arbeitet. Das ist das
     GEGENTEIL der Kita-Regel, und beides ist richtig — für seinen Betrieb.

WAS HIER BEWUSST NICHT STEHT

  DIE MENSCHEN. Kein Vorname, keine Stundenzahl, kein Urlaubsanspruch. Wer
  wie viel arbeitet, wer welche Funktion hat, wer feste freie Tage hat — das
  steht in den Personalakten und wird dort gepflegt (§181). Dieses Paket
  beschreibt das Haus und überlebt damit jeden Personalwechsel.

  DIE FIXTERMINE. Teamsitzung, WWS-Sitzung, Gesamtsitzung der Leitungen: Das
  Regelwerk des Kunden nennt sie selbst als ersten Schritt der Planung —
  „genehmigte Urlaube und Abwesenheiten eintragen, fixe Sitzungen und
  Leitungstermine eintragen". Sie stehen fest, bevor gerechnet wird, und
  gehören als Termin in den Plan, nicht als Regel ins Paket.

  DIE BEWOHNERZAHL JE TAG. Der Schlüssel hängt daran, wie viele Bewohner da
  sind. Das System weiß es nicht — es kennt Personal, keine Bewohner. Deshalb
  die Näherung über den Wochentag: werktags voll, am Wochenende reduziert.
  Eine Woche mit dauerhaft drei Bewohnern trägt die Leitung als Ausnahme ein.
  Eine erfundene Bewohnerverwaltung wäre schlimmer als diese Näherung.
"""

from __future__ import annotations

from .. import bausteine as b

META = {
    "kunde": "Wohngruppe – fünf Bewohner",
    "version": 1,
    "beschreibung":
        "Eine Wohngruppe, elf Menschen, keine Gruppen — gedacht wird über die "
        "Zeitachse. Durchgehende Betreuung von 06:30 bis 21:45 ohne Lücke, "
        "tagsüber zwei bis drei Bewohner je Kraft, am Wochenende reduziert, "
        "Bürozeit zählt nicht zur Betreuung, Führungsaufgaben nur für "
        "Leitung und Stellvertretung — und ein Stundenband von −30 bis +45 "
        "statt eines Pensums, das jeden Monat auf null aufgehen muss.",
    "aufgenommen": "2026-10-03",
}

# ── Was in diesem Betrieb keine Betreuung ist ───────────────────────────────
#
# Über den Namensteil, nicht über die Dienstart: „Büro" und „Tagdienst" sind
# beide vom Typ „mittel", und das ist auch richtig so. Wer hier einen Dienst
# ergänzt, der Arbeitszeit ist, aber keine Betreuung — eine Fortbildung etwa —,
# trägt ihn hier ein.
KEINE_BETREUUNG = ("Büro", "Sitzung", "Fortbildung")

# Die Funktionen aus den Stammdaten. Sie stehen hier als Begriff, nicht als
# Person: Wer die Leitung ist, steht in der Personalakte.
LEITUNG = "Gruppenleitung"
STELLVERTRETUNG = "Stellvertretende Gruppenleitung"
OHNE_FUEHRUNG = "Betreuungsassistent"

# Montag bis Freitag sind alle fünf Bewohner da; am Wochenende oft nur zwei
# bis drei.
WERKTAGE = (0, 1, 2, 3, 4)
WOCHENENDE = (5, 6)


def apply(ctx) -> None:
    # ── 1. Die beiden Ränder des Tages ──────────────────────────────────────
    #
    # Sie sind nicht verhandelbar: Um halb sieben stehen die Bewohner auf, und
    # bis Viertel vor zehn abends bleibt jemand da. Reißt einer der beiden,
    # steht es als harte Verletzung im Bericht — mit dem Tag dazu.
    b.versuche(ctx, b.mindestens_einer_ab_uhrzeit, "06:30", 1, KEINE_BETREUUNG)
    b.versuche(ctx, b.mindestens_einer_bis_uhrzeit, "21:45", 1, KEINE_BETREUUNG)

    # ── 2. Dazwischen keine Minute leer ─────────────────────────────────────
    #
    # Der Punkt, an dem Dienstpläne hier scheitern. Zwei besetzte Ränder sagen
    # nichts über die Mitte: Zwischen dem Ende des Frühdienstes und dem Beginn
    # des Spätdienstes kann eine Lücke klaffen, und auf dem Plan sieht beides
    # richtig aus.
    #
    # Bürozeit zählt dabei nicht mit — wer im Büro sitzt, ist nicht bei den
    # Bewohnern.
    b.versuche(ctx, b.durchgehend_besetzt, "06:30", "21:45", 1, KEINE_BETREUUNG)

    # ── 3. Der Betreuungsschlüssel tagsüber ─────────────────────────────────
    #
    # Fünf Bewohner, angestrebt zwei je Kraft (also drei Personen), vertretbar
    # drei je Kraft (also zwei). Beides gehört in den Plan, und zwar
    # unterschiedlich schwer: Die Untergrenze wiegt fast wie ein Muss, der
    # Wunsch ist einer.
    #
    # Zwischen 06:30 und 07:45 und ab 18:00 gilt das NICHT: Dort darf eine
    # Kraft allein für alle fünf zuständig sein — das sagt das Regelwerk
    # ausdrücklich, und es ist der Grund, warum dieses Fenster später anfängt
    # und früher aufhört als der Betrieb.
    # Und eine Obergrenze: Vier Menschen bei fünf Bewohnern sind kein besserer
    # Plan, sondern verschenkte Stunden — sie fehlen am Wochenende und am
    # Monatsende. Weich, denn ein Übergabefenster darf kurz darüber liegen.
    b.versuche(ctx, b.besetzung_im_fenster, "07:45", "18:00", 2, 3, WERKTAGE,
               KEINE_BETREUUNG, 4)

    # ── 4. Das Wochenende ist ein anderer Betrieb ───────────────────────────
    #
    # Freitags fahren zwei bis drei Bewohner nach Hause. Bei drei Bewohnern
    # oder weniger genügen die beiden Kerndienste — Früh ab 06:30, Spät bis
    # 21:45 —, solange sie ineinandergreifen. Das „Ineinandergreifen" steht
    # schon in Punkt 2 und gilt an allen sieben Tagen.
    #
    # Hier bleibt deshalb nur die Untergrenze von einer Person, und die ist
    # auch gleich der Wunsch: Wer am Wochenende drei Leute einplant, verplant
    # Menschen, die niemand braucht — und sie fehlen am Montag.
    b.versuche(ctx, b.besetzung_im_fenster, "07:45", "18:00", 1, 2, WOCHENENDE,
               KEINE_BETREUUNG, 2)

    # ── 5. Die gewünschte Montagsbesetzung ──────────────────────────────────
    #
    # Der Betrieb hat sich eine Kombination überlegt, die morgens gut
    # ineinandergreift. Ausdrücklich ein Wunsch: An einem Montag mit zwei
    # Krankmeldungen ist sie nicht zu halten, und dann soll der Plan trotzdem
    # entstehen. Ohne Gewicht landete sie allerdings nie im Plan — der
    # Rechendienst kennt sie nicht von selbst.
    b.versuche(ctx, b.wunschbesetzung_am_wochentag, 0,
               ("Früh", "Tag kurz früh", "Tag ", "Spät"))

    # ── 6. Wer führen darf ──────────────────────────────────────────────────
    #
    # „Betreuungsassistenten übernehmen keine Führungsaufgaben." Über die
    # FUNKTION, nicht über Namen: Wer Betreuungsassistent ist, steht in der
    # Personalakte und ändert sich dort.
    b.versuche(ctx, b.rolle_niemals_dienst, "Leitungsdienst", OHNE_FUEHRUNG)

    # ── 7. Das Stundenband ──────────────────────────────────────────────────
    #
    # Das Gegenteil der Kita-Regel, und mit Absicht. Dieser Betrieb sagt
    # ausdrücklich: Minusstunden bis −30, Plusstunden bis +45, später gezielt
    # abgebaut durch freie Tage. Wer ihn auf null zwingt, nimmt ihm die
    # Beweglichkeit, mit der er arbeitet.
    b.versuche(ctx, b.stundenband, 30, 45)

    # ── 8. Was gemeldet, aber nicht verhindert wird ─────────────────────────
    #
    # „Im Normalfall dürfen maximal drei gleichzeitig Urlaub haben." Urlaube
    # sind genehmigt, wenn geplant wird — daran kann der Rechendienst nichts
    # ändern. Er kann aber sagen, dass die Regel an diesem Tag gerissen ist,
    # BEVOR jemand sich wundert, warum der Plan nicht aufgeht.
    b.versuche(ctx, b.hoechstens_gleichzeitig_abwesend, 3)

    # ── 9. Fairness über die Zeitraumgrenze ─────────────────────────────────
    #
    # Der Rechendienst gleicht innerhalb des Zeitraums aus; über dessen Grenze
    # sieht er nichts. Wer vier Wochen in Folge den Spätdienst hatte, fängt in
    # jeder neuen Planung bei null an. Diese Zähler kommen aus der
    # Belastungshistorie der App und schließen die Lücke.
    #
    # In dieser Wohngruppe zählt vor allem der Spätdienst: Er endet um
    # Viertel vor zehn, und wer ihn hat, hat den Abend nicht.
    b.versuche(ctx, b.historische_fairness, "spaet", "spaetDienste")
    b.versuche(ctx, b.historische_fairness, "frueh", "fruehDienste")

    # ── 10. Ein freies Wochenende ───────────────────────────────────────────
    #
    # Steht NICHT im Regelwerk des Kunden — es ist eine Zugabe, und sie gehört
    # als solche benannt. Sieben der zehn Menschen arbeiten laut Regelwerk auch
    # am Wochenende; eine Obergrenze für Wochenenddienste allein reicht dann
    # nicht. Wer jeden Samstag arbeitet und jeden Sonntag frei hat, hat nie ein
    # Wochenende.
    #
    # EINS, nicht zwei. Der erste Entwurf stand hier auf zwei — und in einem
    # Zeitraum von zwei Wochen gibt es genau zwei Wochenenden. Die Regel
    # verlangte damit, dass JEDER beide frei hat, und der Rechendienst
    # lieferte einen Plan, in dem die Wohngruppe an allen vier Wochenendtagen
    # unbesetzt war. Gemeldet hat er es sauber — gerechnet hat er trotzdem
    # Unsinn, weil die Regel Unsinn verlangte.
    b.versuche(ctx, b.freies_wochenende, 1)
