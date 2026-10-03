"""
§126 Bausteine — die Regeln, die in vielen Betrieben gleich aussehen.

Ein Kundenpaket soll kurz und lesbar sein. Wer es in einem Jahr wieder aufmacht,
muss in zehn Zeilen sehen, wie dieser Betrieb tickt — nicht in dreihundert.

Deshalb liegen hier die wiederkehrenden Muster. Sie sind bewusst eng benannt:
`leitung_ohne_gruppe` statt `constraint_17`. Der Name ist die Dokumentation.

Jeder Baustein
  * wirft einen Fehler, wenn er niemanden trifft (siehe context.py) — eine
    Regel, die ins Leere läuft, ist der teuerste Fehler überhaupt,
  * schreibt ins Protokoll, was er getan hat.

Was hier NICHT hineingehört: Regeln, die nur bei einem einzigen Kunden gelten.
Die stehen in seinem Paket. Ein Baustein rechtfertigt sich erst ab dem zweiten
Betrieb, der ihn braucht.
"""

from __future__ import annotations

from .context import PlanKontext, RegelFehler


# ── Personen und Rollen ─────────────────────────────────────────────────────

def leitung_ohne_gruppe(ctx: PlanKontext, *namen: str) -> None:
    """
    Die Leitung wird keiner Gruppe fest zugeordnet.

    Der Fall, aus dem dieser Baustein entstanden ist: In einer Kita stand die
    Leitung im Gruppenplan, obwohl sie den ganzen Tag zwischen Büro, Eltern und
    Vertretung unterwegs ist. Der Plan sah voll aus und war es nicht.
    """
    if not ctx.gruppen_aktiv:
        ctx.notiere("Leitung ohne Gruppe: keine Gruppenplanung aktiv — nichts zu tun.")
        return
    for name in namen:
        ei = ctx.person(name)
        for di in range(ctx.n_days):
            for gi in range(ctx.n_groups):
                ctx.model.add(ctx.G[ei, di, gi] == 0)
        ctx.notiere(f"{ctx.employees[ei].get('name', name)} wird keiner Gruppe zugeordnet.")


def nur_diese_dienste(ctx: PlanKontext, name: str, *dienst_namen: str) -> None:
    """Eine Person arbeitet ausschließlich in bestimmten Diensten."""
    ei = ctx.person(name)
    erlaubt = set()
    for teil in dienst_namen:
        erlaubt.update(ctx.dienste(teil))
    if not erlaubt:
        raise RegelFehler(f"Keine der Dienstarten {dienst_namen} gefunden.")
    for di in range(ctx.n_days):
        for si in range(ctx.n_shifts):
            if si not in erlaubt:
                ctx.model.add(ctx.X[ei, di, si] == 0)
    namen = ", ".join(ctx.shifts[s].get("name", "?") for s in sorted(erlaubt))
    ctx.notiere(f"{ctx.employees[ei].get('name', name)} arbeitet nur in: {namen}.")


def niemals_dienst(ctx: PlanKontext, name: str, dienst_teil: str) -> None:
    """Eine Person wird für einen bestimmten Dienst nie eingeplant."""
    ei = ctx.person(name)
    for si in ctx.dienste(dienst_teil):
        for di in range(ctx.n_days):
            ctx.model.add(ctx.X[ei, di, si] == 0)
    ctx.notiere(
        f"{ctx.employees[ei].get('name', name)} wird nie für „{dienst_teil}“ eingeplant.")


# ── Häufigkeit je Woche ─────────────────────────────────────────────────────

def hoechstens_pro_woche(ctx: PlanKontext, dienst_teil: str, anzahl: int,
                         nur_fuer: list[int] | None = None) -> None:
    """
    Ein Dienst darf je Woche höchstens so oft auf dieselbe Person fallen.

    Der Klassiker: „höchstens ein Spätdienst pro Woche". Das war die Regel, die
    im August nicht gegriffen hat, weil der Rechendienst die Wochen noch gar
    nicht kannte — seither wird jede Regel daraufhin geprüft, ob sie wirklich
    wirkt (§97).
    """
    si_liste = ctx.dienste(dienst_teil)
    personen = nur_fuer if nur_fuer is not None else range(ctx.n_emp)
    for ei in personen:
        for woche in ctx.weeks:
            ctx.model.add(
                sum(ctx.X[ei, di, si] for di in woche for si in si_liste) <= anzahl
            )
    wer = "alle" if nur_fuer is None else f"{len(list(personen))} Personen"
    ctx.notiere(
        f"Höchstens {anzahl}× „{dienst_teil}“ je Woche ({wer}, {len(ctx.weeks)} Wochen).")


def mindestens_pro_woche(ctx: PlanKontext, dienst_teil: str, anzahl: int,
                         nur_fuer: list[int] | None = None) -> None:
    """Ein Dienst muss je Woche mindestens so oft auf dieselbe Person fallen."""
    si_liste = ctx.dienste(dienst_teil)
    personen = list(nur_fuer) if nur_fuer is not None else list(range(ctx.n_emp))
    for ei in personen:
        for woche in ctx.weeks:
            ctx.model.add(
                sum(ctx.X[ei, di, si] for di in woche for si in si_liste) >= anzahl
            )
    ctx.notiere(f"Mindestens {anzahl}× „{dienst_teil}“ je Woche für {len(personen)} Personen.")


def hoechstens_im_zeitraum(ctx: PlanKontext, dienst_teil: str, anzahl: int) -> None:
    """Ein Dienst fällt im ganzen Planungszeitraum höchstens so oft auf eine Person."""
    si_liste = ctx.dienste(dienst_teil)
    for ei in range(ctx.n_emp):
        ctx.model.add(
            sum(ctx.X[ei, di, si] for di in range(ctx.n_days) for si in si_liste) <= anzahl
        )
    ctx.notiere(f"Höchstens {anzahl}× „{dienst_teil}“ im gesamten Zeitraum.")


# ── Wochentage ──────────────────────────────────────────────────────────────

def dienst_nur_an(ctx: PlanKontext, dienst_teil: str, *wochentage: int) -> None:
    """
    Ein Dienst findet nur an bestimmten Wochentagen statt (0 = Montag).

    Zum Beispiel der Wochenenddienst einer Einrichtung, die sonst zu hat.
    """
    erlaubt = set(wochentage)
    si_liste = ctx.dienste(dienst_teil)
    for di, wt in enumerate(ctx.weekdays):
        if wt in erlaubt:
            continue
        for si in si_liste:
            for ei in range(ctx.n_emp):
                ctx.model.add(ctx.X[ei, di, si] == 0)
    tage = ", ".join(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][w] for w in sorted(erlaubt))
    ctx.notiere(f"„{dienst_teil}“ nur an: {tage}.")


def person_frei_an(ctx: PlanKontext, name: str, *wochentage: int) -> None:
    """Eine Person arbeitet an bestimmten Wochentagen grundsätzlich nicht."""
    ei = ctx.person(name)
    frei = set(wochentage)
    for di, wt in enumerate(ctx.weekdays):
        if wt not in frei:
            continue
        for si in range(ctx.n_shifts):
            ctx.model.add(ctx.X[ei, di, si] == 0)
    tage = ", ".join(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][w] for w in sorted(frei))
    ctx.notiere(f"{ctx.employees[ei].get('name', name)} arbeitet nie an: {tage}.")


# ── Besetzung ───────────────────────────────────────────────────────────────

def mindestens_besetzt(ctx: PlanKontext, dienst_teil: str, anzahl: int) -> None:
    """An jedem Tag, an dem der Dienst stattfindet, sind mindestens so viele da."""
    si_liste = ctx.dienste(dienst_teil)
    for di in range(ctx.n_days):
        for si in si_liste:
            ctx.model.add(
                sum(ctx.X[ei, di, si] for ei in range(ctx.n_emp)) >= anzahl
            )
    ctx.notiere(f"„{dienst_teil}“ täglich mit mindestens {anzahl} Personen besetzt.")


def immer_eine_fachkraft(ctx: PlanKontext, dienst_teil: str,
                         *rollen: str) -> None:
    """
    In jedem Dienst dieser Art ist mindestens eine Fachkraft eingeteilt.

    Ohne diese Regel setzt der Rechendienst rechnerisch korrekt eine Schicht
    nur aus Hilfskräften zusammen — fachlich ist das ein Kunstfehler.
    """
    fachkraefte = ctx.mit_rolle(*rollen)
    if not fachkraefte:
        raise RegelFehler(
            f"Keine Person mit den Rollen {rollen} gefunden — "
            "die Fachkraftregel würde ins Leere laufen."
        )
    si_liste = ctx.dienste(dienst_teil)
    for di in range(ctx.n_days):
        for si in si_liste:
            besetzt = sum(ctx.X[ei, di, si] for ei in range(ctx.n_emp))
            fach = sum(ctx.X[ei, di, si] for ei in fachkraefte)
            # Nur wenn der Dienst überhaupt besetzt ist, muss eine Fachkraft dabei sein
            ctx.model.add(fach * ctx.n_emp >= besetzt)
    ctx.notiere(
        f"In „{dienst_teil}“ ist immer mindestens eine Fachkraft "
        f"({', '.join(rollen)}) dabei — {len(fachkraefte)} kommen infrage.")


# ── Paare und Zuordnungen ───────────────────────────────────────────────────

def nicht_gemeinsam(ctx: PlanKontext, name_a: str, name_b: str) -> None:
    """Zwei Personen werden nie in denselben Dienst eingeteilt."""
    a, b = ctx.person(name_a), ctx.person(name_b)
    for di in range(ctx.n_days):
        for si in range(ctx.n_shifts):
            ctx.model.add(ctx.X[a, di, si] + ctx.X[b, di, si] <= 1)
    ctx.notiere(
        f"{ctx.employees[a].get('name', name_a)} und "
        f"{ctx.employees[b].get('name', name_b)} arbeiten nie im selben Dienst.")


def feste_gruppe(ctx: PlanKontext, name: str, gruppe_teil: str) -> None:
    """Eine Person arbeitet ausschließlich in einer Gruppe."""
    if not ctx.gruppen_aktiv:
        raise RegelFehler(
            f"Feste Gruppe für {name}: an diesem Standort ist keine "
            "Gruppenplanung aktiv."
        )
    ei = ctx.person(name)
    gi = ctx.gruppe(gruppe_teil)
    for di in range(ctx.n_days):
        for andere in range(ctx.n_groups):
            if andere != gi:
                ctx.model.add(ctx.G[ei, di, andere] == 0)
    ctx.notiere(
        f"{ctx.employees[ei].get('name', name)} arbeitet nur in Gruppe "
        f"„{ctx.gruppen[gi].get('name', gruppe_teil)}“.")


# ── Rollen statt Namen ──────────────────────────────────────────────────────
#
# §161 Die Bausteine oben sprechen Menschen mit Namen an. Das ist für ein
# Kundenpaket richtig: Dort kennt man den Betrieb, und „Franka“ ist eindeutiger
# als „die Leitung“. Für ein Musterpaket, das jeder Betrieb bekommen kann, geht
# es nicht — es kennt keine Namen. Deshalb hier dieselben Regeln über die
# Rolle.

def rolle_ohne_gruppe(ctx: PlanKontext, *rollen: str) -> None:
    """
    Wer diese Rolle hat, wird keiner Gruppe fest zugeordnet.

    Dieselbe Überlegung wie bei `leitung_ohne_gruppe`, nur ohne Namen: Die
    Leitung ist den Tag über zwischen Büro, Angehörigen und Vertretung
    unterwegs. Steht sie in einer Gruppe, sieht der Plan besetzt aus und ist
    es nicht.
    """
    if not ctx.gruppen_aktiv:
        ctx.notiere("Leitung ohne Gruppe: keine Gruppenplanung aktiv — nichts zu tun.")
        return
    treffer = ctx.mit_rolle(*rollen)
    if not treffer:
        raise RegelFehler(
            f"Niemand mit den Rollen {rollen} gefunden — die Regel würde ins "
            "Leere laufen."
        )
    for ei in treffer:
        for di in range(ctx.n_days):
            for gi in range(ctx.n_groups):
                ctx.model.add(ctx.G[ei, di, gi] == 0)
    namen = ", ".join(ctx.employees[ei].get("name", "?") for ei in treffer)
    ctx.notiere(f"Keiner Gruppe zugeordnet: {namen}.")


def rolle_niemals_dienst(ctx: PlanKontext, dienst_teil: str, *rollen: str) -> None:
    """Wer diese Rolle hat, wird für diesen Dienst nie eingeplant."""
    treffer = ctx.mit_rolle(*rollen)
    if not treffer:
        raise RegelFehler(
            f"Niemand mit den Rollen {rollen} gefunden — die Regel würde ins "
            "Leere laufen."
        )
    si_liste = ctx.dienste(dienst_teil)
    for ei in treffer:
        for di in range(ctx.n_days):
            for si in si_liste:
                ctx.model.add(ctx.X[ei, di, si] == 0)
    namen = ", ".join(ctx.employees[ei].get("name", "?") for ei in treffer)
    ctx.notiere(f"Nie für „{dienst_teil}“ eingeplant: {namen}.")


# ── Folgen und Blöcke ───────────────────────────────────────────────────────

def hoechstens_am_stueck(ctx: PlanKontext, dienst_teil: str, anzahl: int) -> None:
    """
    Höchstens so viele dieser Dienste hintereinander.

    Der Rechendienst begrenzt die Arbeitstage am Stück, aber nicht die
    Dienstart. Drei Nachtdienste hintereinander sind etwas anderes als drei
    Frühdienste, und der Unterschied steht in keiner allgemeinen Regel — er
    steht in der Belastung.

    Gezählt wird über KALENDERtage: Ein Fenster, das eine Lücke im Plan
    enthält, wird übersprungen, sonst würde über die Lücke hinweg gezählt.
    """
    from datetime import date, timedelta

    si_liste = ctx.dienste(dienst_teil)
    tag_index = {tag: di for di, tag in enumerate(ctx.days)}

    fenster_gesamt = 0
    for start in range(ctx.n_days):
        beginn = date.fromisoformat(ctx.days[start])
        fenster: list[int] = []
        for versatz in range(anzahl + 1):
            tag = (beginn + timedelta(days=versatz)).isoformat()
            if tag in tag_index:
                fenster.append(tag_index[tag])
        if len(fenster) != anzahl + 1:
            continue
        fenster_gesamt += 1
        for ei in range(ctx.n_emp):
            ctx.model.add(
                sum(ctx.X[ei, di, si] for di in fenster for si in si_liste)
                <= anzahl
            )
    ctx.notiere(
        f"Höchstens {anzahl}× „{dienst_teil}“ am Stück "
        f"({fenster_gesamt} geprüfte Zeitfenster)."
    )


def freies_wochenende(ctx: PlanKontext, mindestens: int = 1) -> None:
    """
    Mindestens so viele GANZE Wochenenden frei.

    Eine Obergrenze für Wochenenddienste allein reicht nicht: Wer jeden Samstag
    arbeitet und jeden Sonntag frei hat, hat nie ein Wochenende. Für jemanden
    mit Familie ist das der Unterschied, an dem eine Stelle scheitert.

    Gezählt werden nur vollständige Wochenenden im Plan — ein Plan, der am
    Sonntag beginnt, hat kein erstes Wochenende.
    """
    from datetime import date, timedelta

    tag_index = {tag: di for di, tag in enumerate(ctx.days)}
    paare: list[tuple[int, int]] = []
    for di, wt in enumerate(ctx.weekdays):
        if wt != 5:                                  # Samstag
            continue
        sonntag = (date.fromisoformat(ctx.days[di]) + timedelta(days=1)).isoformat()
        if sonntag in tag_index:
            paare.append((di, tag_index[sonntag]))

    if not paare:
        ctx.notiere(
            "Freies Wochenende: im Plan liegt kein vollständiges Wochenende — "
            "nichts zu tun."
        )
        return
    if len(paare) < mindestens:
        raise RegelFehler(
            f"{mindestens} freie Wochenenden verlangt, der Plan enthält aber "
            f"nur {len(paare)} vollständige. Die Regel wäre nicht erfüllbar."
        )

    for ei in range(ctx.n_emp):
        frei_vars = []
        for nr, (sa, so) in enumerate(paare):
            frei = ctx.model.new_bool_var(f"we_frei_{ei}_{nr}")
            arbeit = sum(
                ctx.X[ei, di, si]
                for di in (sa, so)
                for si in range(ctx.n_shifts)
            )
            # frei == 1  →  an beiden Tagen kein Dienst
            ctx.model.add(arbeit == 0).only_enforce_if(frei)
            ctx.model.add(arbeit >= 1).only_enforce_if(frei.negated())
            frei_vars.append(frei)
        ctx.model.add(sum(frei_vars) >= mindestens)

    ctx.notiere(
        f"Mindestens {mindestens} ganze(s) Wochenende(n) frei je Person "
        f"({len(paare)} vollständige Wochenenden im Plan)."
    )


# ── Wer nicht allein arbeiten darf ──────────────────────────────────────────

def nie_allein(ctx: PlanKontext, *rollen: str) -> None:
    """
    Wer diese Rolle hat, ist nie allein im Dienst.

    Auszubildende, Praktikantinnen, Helferinnen in Anleitung: Sie dürfen im
    Dienst sein, aber nicht als einzige. Der Rechendienst weiß das nicht — für
    ihn ist eine besetzte Schicht eine besetzte Schicht.

    Das ist keine Feinheit. Wer allein im Nachtdienst steht und die Aufgabe
    nicht verantworten darf, ist im Ernstfall der Person ausgeliefert, um die
    es geht.
    """
    treffer = ctx.mit_rolle(*rollen)
    if not treffer:
        raise RegelFehler(
            f"Niemand mit den Rollen {rollen} gefunden — die Regel würde ins "
            "Leere laufen."
        )
    andere = [ei for ei in range(ctx.n_emp) if ei not in set(treffer)]
    if not andere:
        raise RegelFehler(
            "Alle Beschäftigten fallen unter diese Rollen — dann kann niemand "
            "die Begleitung übernehmen."
        )
    for ei in treffer:
        for di in range(ctx.n_days):
            for si in range(ctx.n_shifts):
                begleitung = sum(ctx.X[a, di, si] for a in andere)
                # Ist die Person eingeteilt, muss mindestens eine andere dabei sein.
                ctx.model.add(begleitung >= ctx.X[ei, di, si])
    namen = ", ".join(ctx.employees[ei].get("name", "?") for ei in treffer)
    ctx.notiere(f"Nie allein im Dienst: {namen}.")


# ── Für Musterpakete: Regeln, die auch fehlschlagen dürfen ──────────────────

def versuche(ctx: PlanKontext, regel, *args, **kwargs) -> bool:
    """
    Eine Regel anwenden, die nicht zu jedem Betrieb passen muss.

    NUR FÜR MUSTERPAKETE. In einem Kundenpaket ist eine Regel, die ins Leere
    läuft, der teuerste Fehler überhaupt — dort soll sie laut scheitern. Ein
    Musterpaket kennt den Betrieb aber nicht: Es weiß nicht, ob es Nachtdienste
    gibt, ob mit Gruppen geplant wird oder ob jemand als Auszubildender
    geführt wird. Dass eine Regel dort nicht greift, ist der Normalfall.

    Deshalb wird hier nicht geschwiegen, sondern PROTOKOLLIERT: Im Plan steht
    hinterher, welche Regel warum übersprungen wurde. Wer das Musterpaket zu
    seinem eigenen machen will, liest an dieser Liste ab, was noch fehlt.
    """
    try:
        regel(ctx, *args, **kwargs)
        return True
    except RegelFehler as fehler:
        ctx.notiere(f"Übersprungen ({regel.__name__}): {fehler}")
        return False


# ════════════════════════════════════════════════════════════════════════════
# §163 Bausteine, die BEWERTEN statt zu verbieten
#
# Die Bausteine oben setzen Verbote: etwas ist erlaubt oder nicht. Die Haelfte
# dessen, was ein Betrieb ueber seinen Dienstplan sagt, laesst sich so nicht
# ausdruecken — „moeglichst nicht“, „fair ueber die Wochen“, „nur im Notfall“.
# Wer daraus ein Verbot macht, bekommt entweder einen unloesbaren Plan oder
# eine Regel, die im Ernstfall alles blockiert.
#
# Diese Bausteine geben dem Solver stattdessen Gewichte und merken sich, woran
# man nach dem Loesen ablesen kann, ob die Regel gehalten hat.
# ════════════════════════════════════════════════════════════════════════════


# ── Arbeitszeit: das Tagesmuster ────────────────────────────────────────────

def tagesmuster(ctx: PlanKontext, name: str,
                muster: dict[float, int]) -> None:
    """
    Das verbindliche Wochenmuster einer Person in Arbeitsstunden je Tag.

        tagesmuster(ctx, "Heike", {8: 3, 6: 1})

    heisst: drei Tage zu acht Arbeitsstunden, ein Tag zu sechs — jede Woche,
    nicht im Durchschnitt.

    WARUM DAS EIN EIGENER BAUSTEIN IST
    Ohne ihn verteilt der Solver die Wochenstunden beliebig: zehn Stunden am
    Montag, sechs am Dienstag, neun am Mittwoch. Rechnerisch stimmt die Woche,
    im Betrieb ist der Plan unbrauchbar — und arbeitszeitrechtlich meist auch
    nicht haltbar.

    Gerechnet wird in NETTO-Arbeitsstunden. Ein Achtstundendienst dauert
    achteinhalb Stunden Anwesenheit; wer nach Anwesenheit sucht, findet ihn
    nicht.

    In Wochen mit Abwesenheit gilt das Muster NICHT: Wer drei Tage Urlaub hat,
    kann keine vier Tage arbeiten. Dann greifen die ueblichen weichen Regeln.
    """
    _tagesmuster_anwenden(ctx, ctx.person(name), muster)


def namen_mit_rolle(ctx: PlanKontext, *rollen: str) -> list[str]:
    """
    §181 Die Namen aller Personen mit dieser Funktion — fuer Regeln, die eine
    ROLLE meinen und keinen Menschen.

    „Die Leitung springt nur im Notfall ein" ist eine Aussage ueber eine
    Funktion. Steht stattdessen ein Vorname im Paket, laeuft die Regel ins
    Leere, sobald jemand anderes die Leitung uebernimmt — und zwar lautlos:
    Der Plan entsteht weiter, nur ohne diese Regel.

    Die Rolle kommt aus den Stammdaten (`position` / `funktion`) und wird dort
    gepflegt. Findet sich niemand, ist das kein Fehler: Nicht jeder Betrieb hat
    eine Springerin. Es steht im Protokoll, damit es jemand sieht.
    """
    treffer = ctx.mit_rolle(*rollen)
    if not treffer:
        ctx.notiere(f"Niemand mit der Funktion {list(rollen)} — Regel entfaellt.")
        return []
    return [ctx.employees[ei].get("name", "") for ei in treffer if ctx.employees[ei].get("name")]


def tagesmuster_aus_stammdaten(ctx: PlanKontext) -> None:
    """
    §181 Jede Person arbeitet nach dem Muster, das in IHREN Stammdaten steht.

    WAS VORHER HIER WAR
    Eine Tabelle mit sechzehn Vornamen im Regelpaket des Kunden:

        TAGESMUSTER = {"Marin": {8: 5}, "Heike": {8: 3, 6: 1}, ...}

    Das hat zwei Dinge falsch gemacht. Es war erstens keine Betriebsregel,
    sondern eine Angabe aus sechzehn Arbeitsvertraegen — ein Regelpaket soll
    das Haus beschreiben, nicht die Belegschaft. Und es stand zweitens an
    einem anderen Ort als die Wochenstundenzahl, mit der es uebereinstimmen
    muss. Trug jemand in der Maske andere Stunden ein, widersprachen sich
    beide, und `exakte_wochenstunden` machte daraus einen Widerspruch im
    Modell: Dann kam nicht ein schlechterer Plan heraus, sondern GAR KEINER —
    fuer den ganzen Standort, mit einer Fehlermeldung, die drei Ursachen nannte,
    von denen keine zutraf.

    Jetzt kommt beides aus derselben Quelle und wird beim Speichern zusammen
    geprueft (`src/lib/tagesmuster.ts`). Ein Personalwechsel geht das Paket
    nichts mehr an: Wer neu kommt, bekommt Stunden und Muster in der Maske,
    und diese Regel greift von selbst.

    WER KEIN MUSTER HAT, BEHAELT DIE ALTE FREIHEIT
    Dann verteilt der Rechendienst die Wochenstunden wie bisher. Das ist
    Absicht — nicht jeder Betrieb arbeitet in festen Tagesportionen, und ein
    Muster zu erzwingen, das es nicht gibt, waere derselbe Fehler noch einmal.
    """
    mit_muster = 0
    for ei, e in enumerate(ctx.employees):
        muster = _muster_lesen(e.get("tagesmuster"))
        if not muster:
            continue
        _tagesmuster_anwenden(ctx, ei, muster)
        mit_muster += 1

    if mit_muster == 0:
        ctx.notiere(
            "Kein Tagesmuster in den Stammdaten — die Wochenstunden werden "
            "frei auf die Tage verteilt."
        )
    else:
        ctx.notiere(f"{mit_muster} Personen arbeiten nach ihrem festen Tagesmuster.")


def _muster_lesen(roh) -> dict[float, int]:
    """
    `[{"stunden": 8, "tage": 3}, ...]` → `{8: 3, ...}`.

    Was nicht passt, wird uebergangen statt zu werfen. Ein einzelner krummer
    Eintrag in den Stammdaten darf diese Person ungenauer planen — aber nicht
    den Dienstplan des ganzen Hauses verhindern. Geprueft wird beim Speichern,
    hier wird nur gelesen.
    """
    if not isinstance(roh, list):
        return {}
    muster: dict[float, int] = {}
    for teil in roh:
        if not isinstance(teil, dict):
            continue
        try:
            stunden = float(teil["stunden"])
            tage = int(teil["tage"])
        except (KeyError, TypeError, ValueError):
            continue
        if stunden <= 0 or tage <= 0:
            continue
        muster[stunden] = muster.get(stunden, 0) + tage
    return muster


def _tagesmuster_anwenden(ctx: PlanKontext, ei: int, muster: dict[float, int]) -> None:
    """Der gemeinsame Kern von `tagesmuster` und `tagesmuster_aus_stammdaten`."""
    person = ctx.employees[ei].get("name", "?")

    gruppen_si = {}
    for stunden in muster:
        gruppen_si[stunden] = ctx.dienste_mit_stunden(stunden)

    alle_erlaubt = set()
    for si_liste in gruppen_si.values():
        alle_erlaubt.update(si_liste)

    # Alles andere ist fuer diese Person gesperrt — sonst fuellt der Solver die
    # Luecke mit einer Dienstlaenge, die es im Vertrag nicht gibt.
    for di in range(ctx.n_days):
        for si in range(ctx.n_shifts):
            if si not in alle_erlaubt:
                ctx.model.add(ctx.X[ei, di, si] == 0)

    for woche in ctx.weeks:
        if not ctx.volle_woche(ei, woche):
            continue
        for stunden, anzahl in muster.items():
            ctx.model.add(
                sum(ctx.X[ei, di, si] for di in woche for si in gruppen_si[stunden])
                == anzahl
            )

    teile = ", ".join(f"{a}× {st:g} Std." for st, a in sorted(muster.items(), reverse=True))
    ctx.notiere(f"{person} arbeitet je volle Woche genau: {teile}.")


def exakte_wochenstunden(ctx: PlanKontext, abweichung_minuten: int = 0,
                         ausser: tuple[str, ...] = ()) -> None:
    """
    Die Wochenarbeitszeit muss die Sollzeit exakt treffen.

    Der Solver bestraft Abweichungen sonst nur (20 Cent je Minute darunter,
    30 darueber) — er nimmt sie also in Kauf, wenn es anderswo mehr spart. Ein
    Betrieb, der keine Ueber- und Minusstunden aus der Planung will, braucht
    daraus eine Bedingung.

    Nur fuer volle Wochen ohne Abwesenheit: Wer Urlaub hat, kann die Sollzeit
    nicht erreichen, und eine Bedingung, die das verlangt, macht den ganzen
    Plan unloesbar.

    `ausser` nimmt Personen aus, deren Wochenstunden NICHT im Dienstplan
    stehen — die Leitung etwa arbeitet vierzig Stunden, aber nicht in der
    Gruppenbesetzung. Ohne diese Ausnahme zwaenge die Regel sie genau dorthin,
    wo sie nicht hingehoert.
    """
    ausgenommen: set[int] = set()
    for name in ausser:
        try:
            ausgenommen.add(ctx.person(name))
        except RegelFehler:
            continue

    getroffen = 0
    for ei, emp in enumerate(ctx.employees):
        if ei in ausgenommen:
            continue
        soll = int(round(float(emp.get("wochenstundenSoll", 0) or 0) * 60))
        if soll <= 0:
            continue
        for woche in ctx.weeks:
            if not ctx.volle_woche(ei, woche):
                continue
            ist = sum(
                ctx.X[ei, di, si] * ctx.netto(si)
                for di in woche
                for si in range(ctx.n_shifts)
            )
            ctx.model.add(ist >= soll - abweichung_minuten)
            ctx.model.add(ist <= soll + abweichung_minuten)
            getroffen += 1
    ctx.notiere(
        f"Die Wochenarbeitszeit trifft die Sollzeit exakt "
        f"({getroffen} Personenwochen ohne Abwesenheit"
        + (f", {len(ausgenommen)} ausgenommen" if ausgenommen else "")
        + (f", Toleranz {abweichung_minuten} Min." if abweichung_minuten else "")
        + ")."
    )


# ── Besetzung: genau so viele, nicht mindestens ─────────────────────────────

def genau_einer_je_etage(ctx: PlanKontext, dienst_typ: str,
                         gewicht: int = 30_000) -> None:
    """
    Auf jeder Etage genau eine Person in diesem Dienst — an jedem Plantag.

    „Genau eine“ und nicht „mindestens eine“: Zwei Frühdienste auf derselben
    Etage sind keine bessere Besetzung, sondern eine verschenkte Kraft am
    Vormittag, wenn alle Kinder da sind.

    WARUM MIT GEWICHT UND NICHT ALS VERBOT
    Weil ein Verbot den Plan unloesbar macht, sobald auf einer Etage niemand
    verfuegbar ist — und ein Betrieb mit vier Kranken braucht dann trotzdem
    einen Plan, nur eben mit einem deutlichen Hinweis. Das Gewicht liegt
    dreifach ueber der Unterbesetzungsstrafe des Solvers: Der Plan gibt diese
    Stelle erst auf, wenn es gar nicht anders geht. Und er meldet es.
    """
    if not ctx.etagen:
        raise RegelFehler(
            "Keine Etagen hinterlegt — eine Regel je Etage liefe ins Leere."
        )
    si_liste = ctx.dienste_vom_typ(dienst_typ)
    if not si_liste:
        si_liste = ctx.dienste(dienst_typ)

    for et in ctx.etagen:
        gis = [gi for gi, g in enumerate(ctx.gruppen) if g.get("etageId") == et.get("id")]
        if not gis:
            continue
        et_name = et.get("name", et.get("id"))
        for di in range(ctx.n_days):
            tag = ctx.days[di]
            # §167 Faellt der Dienst fuer diesen Tag aus (geaenderte
            # Oeffnungszeit), wird er auch nicht verlangt.
            if ctx.massnahme_aktiv(f"{dienst_typ}_entfaellt", et.get("id"), tag):
                ctx.notiere(
                    f"„{et_name}“ am {tag}: „{dienst_typ}“ entfällt "
                    "(geänderte Öffnungszeit)."
                )
                continue
            # Wer auf dieser Etage in diesem Dienst steht: Dienst UND Gruppe
            # dieser Etage muessen zusammenkommen.
            #
            # Gezaehlt wird je PERSON, nicht je Person und Gruppe. Beide Summen
            # sind ohnehin hoechstens eins — niemand hat zwei Dienste an einem
            # Tag, niemand steht in zwei Gruppen. Die erste Fassung legte eine
            # Hilfsvariable je Gruppe an und blies das Modell auf das Vierfache
            # auf; der Rechendienst fand in seinen fuenfzehn Sekunden dann nur
            # noch irgendeinen gueltigen Plan statt des besten. Sichtbar wurde
            # es daran, dass eine Vorliebe nicht mehr durchkam.
            hier = []
            for ei in range(ctx.n_emp):
                im_dienst = sum(ctx.X[ei, di, si] for si in si_liste)
                auf_etage = ctx.auf_etage(ei, di, et.get("id"))
                z = ctx.model.new_bool_var(f"et_{dienst_typ}_{di}_{ei}_{et.get('id')}")
                ctx.model.add(z <= im_dienst)
                ctx.model.add(z <= auf_etage)
                ctx.model.add(z >= im_dienst + auf_etage - 1)
                hier.append(z)

            fehlt = ctx.model.new_int_var(0, 1, f"etfehlt_{dienst_typ}_{di}_{et.get('id')}")
            zuviel = ctx.model.new_int_var(0, ctx.n_emp, f"etzuviel_{dienst_typ}_{di}_{et.get('id')}")
            ctx.model.add(sum(hier) + fehlt - zuviel == 1)
            ctx.strafe(gewicht, fehlt)
            # Einer zu viel ist ein Planungsfehler, kein Notstand — er kostet
            # spuerbar, aber lange nicht so viel wie eine unbesetzte Etage.
            ctx.strafe(max(1, gewicht // 20), zuviel)
            spaet = not dienst_typ.startswith("frueh")
            ctx.melde_wenn(
                fehlt, "hart",
                f"{et_name}: kein {dienst_typ.capitalize()}dienst am "
                f"{tag} — die Etage wird nicht "
                + ("geschlossen." if spaet else "geöffnet."),
                massnahme={
                    "typ": f"{dienst_typ}_entfaellt",
                    "ziel": et.get("id"),
                    "tag": tag,
                    "text": (
                        f"{et_name} am {tag} um 15:30 schließen statt um 17:00 — "
                        "betroffene Familien benachrichtigen."
                        if spaet else
                        f"{et_name} am {tag} später öffnen als 06:00 — "
                        "betroffene Familien benachrichtigen."
                    ),
                },
            )

    ctx.notiere(
        f"Auf jeder der {len(ctx.etagen)} Etagen genau ein „{dienst_typ}“ je Tag."
    )


def mindestens_in_gruppe(ctx: PlanKontext, gruppe_teil: str, anzahl: int,
                         gewicht: int = 50_000) -> None:
    """
    Diese Gruppe ist nie mit weniger als so vielen Personen besetzt.

    Der Solver kennt schon eine Mindestbesetzung je Gruppe. Dieser Baustein
    ist fuer die eine Gruppe, bei der es wirklich nicht verhandelbar ist —
    etwa weil dort die Jüngsten betreut werden. Er wiegt fuenfmal schwerer als
    die allgemeine Unterbesetzung und meldet sich, wenn er reisst.
    """
    gi = ctx.gruppe(gruppe_teil)
    name = ctx.gruppen[gi].get("name", gruppe_teil)
    for di in range(ctx.n_days):
        # §182 Ist die Gruppe an diesem Tag unterwegs, braucht sie niemanden.
        # Ohne das waere eine Gruppenfahrt eine gemeldete Unterbesetzung — und
        # zwar die am schwersten wiegende, die dieses Paket kennt.
        if ctx.ist_unterwegs(gi, ctx.days[di]):
            continue
        fehlt = ctx.model.new_int_var(0, anzahl, f"g1fehlt_{di}_{gi}")
        ctx.model.add(
            sum(ctx.G[ei, di, gi] for ei in range(ctx.n_emp)) + fehlt >= anzahl
        )
        ctx.strafe(gewicht, fehlt)
        ctx.melde_wenn(
            fehlt, "hart",
            f"{name} am {ctx.days[di]} unter der Mindestbesetzung von {anzahl}.",
        )
    ctx.notiere(f"„{name}“ ist immer mit mindestens {anzahl} Personen besetzt.")


# ── Haeufigkeit mit Ausnahme ────────────────────────────────────────────────

def hoechstens_pro_woche_weich(ctx: PlanKontext, dienst_typ: str, anzahl: int,
                               gewicht: int = 8_000) -> None:
    """
    Höchstens so oft je Woche — aufweichbar, wenn es nicht anders geht.

    Der harte Bruder dieses Bausteins (`hoechstens_pro_woche`) ist richtig,
    solange genug Leute da sind. Fallen vier aus, macht er den Plan unloesbar,
    und der Betrieb steht ohne alles da.

    Hier darf die Grenze ueberschritten werden — es kostet, und es steht
    hinterher im Bericht, bei wem und wie oft. Das ist der Unterschied
    zwischen „die Regel gilt nicht“ und „die Regel musste weichen“.
    """
    si_liste = ctx.dienste_vom_typ(dienst_typ) or ctx.dienste(dienst_typ)
    for ei in range(ctx.n_emp):
        person = ctx.employees[ei].get("name", ei)
        for wi, woche in enumerate(ctx.weeks):
            ueber = ctx.model.new_int_var(0, len(woche), f"ueber_{dienst_typ}_{ei}_{wi}")
            ctx.model.add(
                sum(ctx.X[ei, di, si] for di in woche for si in si_liste)
                <= anzahl + ueber
            )
            ctx.strafe(gewicht, ueber)
            ctx.melde_wenn(
                ueber, "weich",
                f"{person}: mehr als {anzahl}× „{dienst_typ}“ in der Woche ab "
                f"{ctx.days[woche[0]]} — Fairnessregel wegen personeller "
                "Unterbesetzung überschritten.",
            )
    ctx.notiere(
        f"Höchstens {anzahl}× „{dienst_typ}“ je Woche — bei Unterbesetzung "
        "überschreitbar, dann sichtbar im Bericht."
    )


# ── Vorlieben ───────────────────────────────────────────────────────────────

def moeglichst_nicht(ctx: PlanKontext, name: str, dienst_typ: str,
                     gewicht: int = 2_000) -> None:
    """
    Diese Person bekommt diesen Dienst möglichst nicht.

    Eine Vorliebe, kein Verbot: Wenn es sonst keinen gueltigen Plan gibt,
    bekommt sie ihn trotzdem. Das Gewicht liegt unter dem einer unbesetzten
    Stelle — sonst waere aus der Vorliebe ein Verbot geworden, das sich nur
    anders schreibt.
    """
    ei = ctx.person(name)
    si_liste = ctx.dienste_vom_typ(dienst_typ) or ctx.dienste(dienst_typ)
    for di in range(ctx.n_days):
        for si in si_liste:
            ctx.strafe(gewicht, ctx.X[ei, di, si])
    ctx.notiere(
        f"{ctx.employees[ei].get('name', name)} bekommt „{dienst_typ}“ "
        "möglichst nicht (Vorliebe, kein Verbot)."
    )


def vorlieben_aus_stammdaten(ctx: PlanKontext, gewicht: int = 2_000) -> None:
    """
    §181 Schichtvorlieben aus dem Planungsprofil — statt Namen im Regelpaket.

    WAS HIER VORHER IM PAKET STAND
    Zwei Zeilen mit zwei Vornamen: die eine moeglichst nicht in den
    Spaetdienst, der andere moeglichst nicht in den Fruehdienst. Auch das ist
    keine Betriebsregel, sondern eine Angabe ueber zwei Menschen — und beim
    naechsten Personalwechsel stand sie fuer die Falschen da.

    DIE LESART, UND WARUM SIE AUSGESCHRIEBEN GEHOERT
    In den Stammdaten steht, welche Schichtart jemand BEVORZUGT. Diese Regel
    liest daraus die Abneigung gegen die gegenueberliegende: Wer frueh
    bevorzugt, bekommt moeglichst keinen Spaetdienst, und umgekehrt. Der
    Mitteldienst bleibt davon unberuehrt — er ist fuer niemanden die
    unangenehme Schicht, und wer ihn ausschloesse, haette aus einer Vorliebe
    eine Dienstplansperre gemacht.

    Ausdruecklich eine Vorliebe, kein Verbot. Das Gewicht liegt unter dem einer
    unbesetzten Stelle (10 000) und unter der Fairness ueber die Wochen — sonst
    truege die Vorliebe des einen dauerhaft jemand anderes.
    """
    GEGENTEIL = {"frueh": "spaet", "spaet": "frueh"}
    beachtet = 0
    for ei, e in enumerate(ctx.employees):
        vorliebe = str(e.get("vorliebe") or "").strip().lower()
        unerwuenscht = GEGENTEIL.get(vorliebe)
        if not unerwuenscht:
            continue
        si_liste = ctx.dienste_vom_typ(unerwuenscht)
        if not si_liste:
            continue
        treffer = sum(ctx.X[ei, di, si] for di in range(ctx.n_days) for si in si_liste)
        ctx.strafe(gewicht, treffer)
        beachtet += 1
        ctx.notiere(
            f'{e.get("name", "?")} bevorzugt {vorliebe} — moeglichst kein {unerwuenscht}.'
        )
    if beachtet == 0:
        ctx.notiere("Keine Schichtvorlieben in den Stammdaten hinterlegt.")


def nur_im_notfall(ctx: PlanKontext, name: str, gewicht: int = 9_000) -> None:
    """
    Diese Person wird nur eingeplant, wenn es ohne sie nicht geht.

    Fuer die Leitung: Sie gehoert ins Haus, aber nicht in den Gruppenplan. Wer
    sie als normale Kraft verplant, hat eine Stelle mehr besetzt und eine
    Leitung weniger — und das faellt erst auf, wenn niemand ans Telefon geht.

    WO DAS GEWICHT IN DER LEITER STEHT, IST DER GANZE PUNKT
    Sie ist die LETZTE Reserve, nicht die erste. Vor ihr kommen: jemanden in
    eine andere Gruppe schicken (300, ueber die Etage 800) und jemandem einen
    zweiten Frueh- oder Spaetdienst zumuten (8 000). Nach ihr kommt, was
    wirklich nicht passieren darf: eine unbesetzte Gruppe (10 000), eine Etage,
    die nicht geoeffnet wird (30 000), Gruppe 1 unter zwei Personen (50 000).

    Mit 9 000 liegt sie genau dazwischen. Ein hoeherer Wert macht sie zur
    Zierde — dann bleibt lieber eine Gruppe leer, als dass die Leitung
    einspringt, und das will niemand.

    ACHTUNG BEI DEN STAMMDATEN
    Steht die Leitung mit ihren vollen Wochenstunden im System, zieht das
    Stundenziel des Rechendienstes gegen diese Regel: Eine nicht erreichte
    Wochensollzeit kostet 20 je Minute, bei 40 Stunden also 48 000 in der
    Woche — mehr, als ihr Einsatz kostet. Dann wird sie doch verplant.
    Leitungszeit gehoert nicht in den Dienstplan; die Wochenstunden im
    Lohnprofil bleiben davon unberuehrt.
    """
    ei = ctx.person(name)
    person = ctx.employees[ei].get("name", name)
    soll = float(ctx.employees[ei].get("wochenstundenSoll", 0) or 0)
    if soll > 0:
        ctx.notiere(
            f"ACHTUNG: {person} soll nur im Notfall eingeplant werden, steht "
            f"aber mit {soll:g} Wochenstunden im Dienstplan. Das Stundenziel "
            "zieht gegen die Regel — die Sollzeit für die Dienstplanung "
            "gehört auf null, ihre Leitungszeit steht im Lohnprofil."
        )
    eingesetzt = []
    for di in range(ctx.n_days):
        arbeitet = ctx.model.new_bool_var(f"notfall_{ei}_{di}")
        ctx.model.add(arbeitet == sum(ctx.X[ei, di, si] for si in range(ctx.n_shifts)))
        ctx.strafe(gewicht, arbeitet)
        eingesetzt.append(arbeitet)
    gesamt = ctx.model.new_int_var(0, ctx.n_days, f"notfall_summe_{ei}")
    ctx.model.add(gesamt == sum(eingesetzt))
    ctx.melde_wenn(
        gesamt, "weich",
        f"{person} musste als Notfallreserve in die Gruppenbesetzung.",
    )
    # §164 Und immer, auch wenn nichts war: Die Leitung will wissen, ob sie
    # in der kommenden Woche Leitungsdienst hat oder irgendwo aushelfen muss.
    # Eine Null ist hier eine Aussage, keine Stille.
    ctx.melde_immer(
        gesamt,
        f"{person}: an {{n}} von {ctx.n_days} Tagen als Aushilfe in der "
        f"Gruppenbesetzung, sonst Leitungsdienst.",
    )
    ctx.notiere(f"{person} wird nur im Notfall eingeplant.")


def springer(ctx: PlanKontext, name: str, etage_teil: str,
             lieblingsgruppe: str | None = None,
             gewicht_etage: int = 1_500, gewicht_gruppe: int = 200) -> None:
    """
    Eine Springerin: kein fester Platz, aber ein bevorzugter Bereich.

    Zwei Gewichte, und die Reihenfolge ist der ganze Punkt:

      * Die Etage wiegt schwer — sie ist der Bereich, den die Person kennt.
      * Die Lieblingsgruppe wiegt leicht. Dort steht sie, WENN nichts anderes
        ansteht. Sobald anderswo jemand fehlt, gibt sie den Platz auf, weil
        die Unterbesetzung dort tausendfach mehr kostet.

    Waeren beide Gewichte gleich schwer, klebte die Springerin in ihrer
    Lieblingsgruppe fest und waere keine Springerin mehr.
    """
    ei = ctx.person(name)
    person = ctx.employees[ei].get("name", name)
    eigene = set(ctx.gruppen_der_etage(etage_teil))
    for di in range(ctx.n_days):
        for gi in range(ctx.n_groups):
            if gi not in eigene:
                ctx.strafe(gewicht_etage, ctx.G[ei, di, gi])

    if lieblingsgruppe:
        lieb = ctx.gruppe(lieblingsgruppe)
        for di in range(ctx.n_days):
            for gi in range(ctx.n_groups):
                if gi != lieb:
                    ctx.strafe(gewicht_gruppe, ctx.G[ei, di, gi])
        ctx.notiere(
            f"{person} springt vorrangig auf „{etage_teil}“ ein und steht sonst "
            f"in „{ctx.gruppen[lieb].get('name', lieblingsgruppe)}“."
        )
    else:
        ctx.notiere(f"{person} springt vorrangig auf „{etage_teil}“ ein.")


# ── Fairness ueber die Wochen ───────────────────────────────────────────────

def historische_fairness(ctx: PlanKontext, dienst_typ: str, schluessel: str,
                         gewicht: int = 120) -> None:
    """
    Wer diesen Dienst zuletzt oft hatte, bekommt ihn jetzt seltener.

    Der Solver gleicht Dienste INNERHALB des geplanten Zeitraums aus. Über die
    Zeitraumgrenze hinweg sieht er nichts: Wer vier Wochen in Folge den
    Spaetdienst hatte, faengt in jeder neuen Planung bei null an. Für die
    Betroffenen ist das der Unterschied zwischen einem fairen Plan und einem,
    der sich fair ausrechnet.

    Gezaehlt wird aus der Belastungshistorie, die die App mitliefert. Das
    Gewicht wird MIT dem Zaehler multipliziert: Wer zehn hatte, zahlt
    zehnfach.
    """
    si_liste = ctx.dienste_vom_typ(dienst_typ) or ctx.dienste(dienst_typ)
    belastet = 0
    for ei in range(ctx.n_emp):
        last = ctx.historie(ei, schluessel)
        if last <= 0:
            continue
        belastet += 1
        for di in range(ctx.n_days):
            for si in si_liste:
                ctx.strafe(gewicht * last, ctx.X[ei, di, si])
    ctx.notiere(
        f"Historische Fairness „{dienst_typ}“: {belastet} Personen bringen eine "
        f"Vorbelastung aus „{schluessel}“ mit."
    )


def freitagsfairness(ctx: PlanKontext, dienst_typ: str, schluessel: str,
                     gewicht: int = 400) -> None:
    """
    Der Freitag wird eigens fair verteilt.

    Ein Freitagsspaetdienst ist nicht dasselbe wie ein Dienstagsspaetdienst —
    er kostet das Wochenende seinen Anfang. Wer ihn dreimal hintereinander
    hatte, hat rechnerisch genauso viele Spaetdienste wie alle anderen und
    trotzdem dreimal kein Wochenende.

    Deshalb ein eigener Zaehler und ein eigenes Gewicht, deutlich ueber dem
    der gewoehnlichen Verteilung.
    """
    si_liste = ctx.dienste_vom_typ(dienst_typ) or ctx.dienste(dienst_typ)
    freitage = [di for di in range(ctx.n_days) if ctx.ist_freitag(di)]
    if not freitage:
        ctx.notiere(f"Freitagsfairness „{dienst_typ}“: kein Freitag im Plan.")
        return

    # Vorbelastung aus der Historie
    for ei in range(ctx.n_emp):
        last = ctx.historie(ei, schluessel)
        if last > 0:
            for di in freitage:
                for si in si_liste:
                    ctx.strafe(gewicht * last, ctx.X[ei, di, si])

    # Und innerhalb des Zeitraums: die Spanne zwischen dem, der die meisten
    # Freitagsdienste hat, und dem mit den wenigsten.
    if len(freitage) >= 2 and ctx.n_emp >= 2:
        hoch = ctx.model.new_int_var(0, len(freitage), f"fr_max_{dienst_typ}")
        tief = ctx.model.new_int_var(0, len(freitage), f"fr_min_{dienst_typ}")
        for ei in range(ctx.n_emp):
            cnt = sum(ctx.X[ei, di, si] for di in freitage for si in si_liste)
            ctx.model.add(hoch >= cnt)
            ctx.model.add(tief <= cnt)
        spanne = ctx.model.new_int_var(0, len(freitage), f"fr_spanne_{dienst_typ}")
        ctx.model.add(spanne == hoch - tief)
        ctx.strafe(gewicht, spanne)

    ctx.notiere(
        f"Freitagsfairness „{dienst_typ}“: {len(freitage)} Freitage im Plan, "
        "eigener Zähler und eigenes Gewicht."
    )


# ── Wenn zwei gleich heissen ────────────────────────────────────────────────

def tagesmuster_in_gruppe(ctx: PlanKontext, name: str, gruppe_teil: str,
                          muster: dict[float, int]) -> None:
    """Wie `tagesmuster`, aber ueber Name UND Stammgruppe eindeutig gemacht."""
    ei = ctx.person_in_gruppe(name, gruppe_teil)
    tagesmuster(ctx, ctx.employees[ei]["name"], muster)


def person_in_gruppe_frei_an(ctx: PlanKontext, name: str, gruppe_teil: str,
                             *wochentage: int) -> None:
    """Wie `person_frei_an`, aber ueber Name UND Stammgruppe eindeutig."""
    ei = ctx.person_in_gruppe(name, gruppe_teil)
    person_frei_an(ctx, ctx.employees[ei]["name"], *wochentage)


# ════════════════════════════════════════════════════════════════════════════
# §164 Wann jemand geht, zaehlt mehr als wie lange er da war
#
# In einer Kita ist der Nachmittag die anstrengende Zeit: Die Kinder sind wach,
# die Eltern kommen, es wird abgeholt und erzaehlt. Morgens passiert wenig.
#
# Der Rechendienst kennt aber nur Stundenzahlen. Fuer ihn ist eine
# Achtstundenkraft von 06:00 bis 14:30 dasselbe wie eine von 07:00 bis 15:30 —
# fuer den Betrieb ist es der Unterschied zwischen einem ruhigen und einem
# ueberforderten Nachmittag.
# ════════════════════════════════════════════════════════════════════════════

def genug_bis_uhrzeit(ctx: PlanKontext, uhrzeit: str, mindestens: int = 1,
                      am_besten: int = 2, gewicht_mindest: int = 20_000,
                      gewicht_wunsch: int = 3_000) -> None:
    """
    Auf jeder Etage bleiben genug Leute bis zu dieser Uhrzeit.

    Zwei Stufen, und beide braucht es:

      MINDESTENS — darunter geht es nicht. Wer allein mit dem Spaetdienst
      dasteht, kann sich nicht kurz abwenden, und genau dann passiert etwas.

      AM BESTEN — das ist der Normalfall, den man anstreben will. Er ist
      bewusst weich: An einem Tag mit zwei Krankmeldungen ist er nicht zu
      halten, und dann soll der Plan trotzdem entstehen.

    Der Spaetdienst zaehlt hier NICHT mit: Er endet spaeter und ist ohnehin da.
    Gemeint sind die Kraefte, die neben ihm bis zum Nachmittag bleiben.
    """
    if not ctx.etagen:
        raise RegelFehler(
            "Keine Etagen hinterlegt — eine Regel je Etage liefe ins Leere."
        )
    si_liste = ctx.dienste_bis(uhrzeit)
    if not si_liste:
        enden = sorted({ctx.shifts[si].get("bis", "?") for si in range(ctx.n_shifts)})
        raise RegelFehler(
            f"Kein Dienst endet um {uhrzeit}. Vorhandene Dienstenden: {enden}. "
            "Ohne einen solchen Dienst kann die Regel nichts bewirken — er "
            "gehoert am Standort angelegt."
        )

    for et in ctx.etagen:
        gis = [gi for gi, g in enumerate(ctx.gruppen) if g.get("etageId") == et.get("id")]
        if not gis:
            continue
        et_name = et.get("name", et.get("id"))
        for di in range(ctx.n_days):
            hier = []
            for ei in range(ctx.n_emp):
                bis_dann = sum(ctx.X[ei, di, si] for si in si_liste)
                auf_etage = ctx.auf_etage(ei, di, et.get("id"))
                z = ctx.model.new_bool_var(f"bis_{uhrzeit}_{di}_{ei}_{et.get('id')}")
                ctx.model.add(z <= bis_dann)
                ctx.model.add(z <= auf_etage)
                ctx.model.add(z >= bis_dann + auf_etage - 1)
                hier.append(z)
            anzahl = sum(hier)

            fehlt = ctx.model.new_int_var(0, mindestens, f"bismin_{di}_{et.get('id')}")
            ctx.model.add(anzahl + fehlt >= mindestens)
            ctx.strafe(gewicht_mindest, fehlt)
            ctx.melde_wenn(
                fehlt, "hart",
                f"{et_name} am {ctx.days[di]}: niemand bleibt bis {uhrzeit} — "
                "der Nachmittag haengt allein am Spätdienst.",
            )

            if am_besten > mindestens:
                knapp = ctx.model.new_int_var(0, am_besten, f"bissoll_{di}_{et.get('id')}")
                ctx.model.add(anzahl + knapp >= am_besten)
                ctx.strafe(gewicht_wunsch, knapp)

    ctx.notiere(
        f"Auf jeder Etage bleiben bis {uhrzeit} mindestens {mindestens}, "
        f"am besten {am_besten} Personen (neben dem Spätdienst)."
    )


def kein_dienstende_zwischen(ctx: PlanKontext, nach: str, vor: str) -> None:
    """
    In diesem Zeitfenster endet kein Dienst.

    Der Betrieb kennt genau drei Arten, einen Tag zu beenden: mit dem
    Spaetdienst um 17:00, mit dem Nachmittag um 15:30 oder um 15:00, oder
    frueher, weil jemand um sechs angefangen hat oder weniger Stunden hat.
    Ein Dienst, der um 16:00 endet, gehoert in keine dieser Schubladen — er
    laesst jemanden gehen, wenn die Ablösung noch nicht da ist.

    Die Regel sperrt solche Dienste fuer alle, statt sich darauf zu verlassen,
    dass niemand sie anlegt. Genau das passiert naemlich irgendwann.
    """
    von_min = ctx._minuten(nach)
    bis_min = ctx._minuten(vor)
    betroffen = [
        si for si in range(ctx.n_shifts)
        if von_min < ctx.dienstende(si) < bis_min
    ]
    if not betroffen:
        ctx.notiere(
            f"Kein Dienst endet zwischen {nach} und {vor} — nichts zu sperren."
        )
        return
    for si in betroffen:
        for ei in range(ctx.n_emp):
            for di in range(ctx.n_days):
                ctx.model.add(ctx.X[ei, di, si] == 0)
    namen = ", ".join(ctx.shifts[si].get("name", "?") for si in betroffen)
    ctx.notiere(
        f"Gesperrt, weil zwischen {nach} und {vor} endend: {namen}."
    )


def nur_dienstarten(ctx: PlanKontext, name: str, *typen: str) -> None:
    """
    Diese Person arbeitet nur in Diensten dieser Art.

    Fuer die Springerin: Sie kommt zur Kernzeit, nicht zum Aufschliessen und
    nicht zum Abschliessen. Wer sie in den Fruehdienst steckt, hat eine Kraft
    weniger, wenn alle Kinder da sind — und das Aufschliessen soll ohnehin
    jemand machen, der die Gruppe kennt.
    """
    ei = ctx.person(name)
    erlaubt: set[int] = set()
    for t in typen:
        erlaubt.update(ctx.dienste_vom_typ(t))
    if not erlaubt:
        raise RegelFehler(f"Keine Dienste der Art {typen} gefunden.")
    for di in range(ctx.n_days):
        for si in range(ctx.n_shifts):
            if si not in erlaubt:
                ctx.model.add(ctx.X[ei, di, si] == 0)
    ctx.notiere(
        f"{ctx.employees[ei].get('name', name)} arbeitet nur in Diensten der "
        f"Art: {', '.join(typen)}."
    )


# ── §165 Vertretung sucht man zuerst nebenan ────────────────────────────────

def vertretung_zuerst_auf_der_etage(ctx: PlanKontext,
                                    gewicht_etage: int = 2_500) -> None:
    """
    Faellt jemand aus, wird die Luecke zuerst auf derselben Etage geschlossen.

    WARUM DAS NICHT VON SELBST PASSIERT
    Der Rechendienst bestraft das Verlassen der Stammgruppe schon: 300 im Haus,
    800 ueber die Etage hinweg. Das reicht, solange nur eine Luecke zu fuellen
    ist. Sind es zwei, wird die Rechnung schnell knapp, und dann zieht er
    jemanden hoch oder runter, obwohl nebenan jemand frei gewesen waere.

    WARUM DAS IM BETRIEB ZAEHLT
    Wer die Etage wechselt, kennt die Kinder nicht, weiss nicht, wer wo
    schlaeft, wer was nicht isst und wer wen beisst. Eine Vertretung aus der
    Nachbargruppe ist eine Vertretung; eine von der anderen Etage ist ein
    fremdes Gesicht. Beides ist besser als eine unbesetzte Gruppe — aber in
    dieser Reihenfolge.

    Der Aufschlag kommt ZU den 800 des Rechendienstes hinzu. Er liegt bewusst
    unter der Strafe fuer eine unbesetzte Gruppe (10 000): Wenn es auf der
    eigenen Etage niemanden gibt, wird trotzdem jemand geholt.
    """
    etage_von_gruppe = {g["id"]: g.get("etageId") for g in ctx.gruppen}
    betroffen = 0
    for ei, emp in enumerate(ctx.employees):
        stamm = emp.get("stammEinheitId")
        if not stamm or stamm not in etage_von_gruppe:
            continue          # Springer und Leitung haben keine eigene Etage
        eigene_etage = etage_von_gruppe[stamm]
        if not eigene_etage:
            continue
        betroffen += 1
        for gi, g in enumerate(ctx.gruppen):
            if g.get("etageId") == eigene_etage:
                continue
            for di in range(ctx.n_days):
                ctx.strafe(gewicht_etage, ctx.G[ei, di, gi])

    ctx.notiere(
        f"Vertretung zuerst auf der eigenen Etage: Ein Wechsel über die Etage "
        f"hinweg kostet zusätzlich ({betroffen} Personen mit fester Etage)."
    )


# ════════════════════════════════════════════════════════════════════════════
# §166 Wer darf wo einspringen — und wer darf nicht weg
# ════════════════════════════════════════════════════════════════════════════

def hoechstens_eine_vertretung_je_gruppe(ctx: PlanKontext, anzahl: int = 1) -> None:
    """
    In einer Gruppe steht hoechstens eine fremde Kraft.

    NICHT: hoechstens einer wechselt die Etage. Muessen zwei Gruppen besetzt
    werden, duerfen auch zwei Leute kommen — aber je eine in jede, nicht zwei
    in dieselbe.

    Der Grund steht nicht in der Rechnung, sondern in der Gruppe: Eine Gruppe,
    die nur noch aus Vertretungen besteht, ist keine Gruppe mehr. Dann kennt
    niemand die Kinder, niemand weiss, wer wo schlaeft und wer was nicht isst.
    Eine fremde Kraft neben den eigenen Leuten ist Vertretung; zwei sind eine
    Uebernahme — und dann ist der ehrlichere Weg, die Gruppe aufzuteilen.

    Als fremd zaehlt, wer diese Gruppe nicht als Stammgruppe hat. Auch die
    Springerin und die Leitung: Sie gehoeren zum Haus, aber nicht zu dieser
    Gruppe.
    """
    for gi, g in enumerate(ctx.gruppen):
        fremde = [ei for ei in range(ctx.n_emp) if ei not in set(ctx.stammkraefte(gi))]
        if not fremde:
            continue
        for di in range(ctx.n_days):
            ctx.model.add(sum(ctx.G[ei, di, gi] for ei in fremde) <= anzahl)
    ctx.notiere(
        f"In jeder Gruppe steht höchstens {anzahl} fremde Kraft — mehrere "
        "dürfen die Etage wechseln, aber nie zwei in dieselbe Gruppe."
    )


def jede_gruppe_besetzt(ctx: PlanKontext, anzahl: int = 1,
                        gewicht: int = 25_000) -> None:
    """
    Jede Gruppe ist an jedem Plantag besetzt.

    Der Rechendienst kennt zwar eine Mindestbesetzung je Gruppe und bestraft
    ihre Unterschreitung mit 10 000 — aber er MELDET sie nicht. Genau das ist
    in der Abnahme aufgefallen: Gruppe 7 stand zwei Tage leer, und der Bericht
    sagte „hart verletzt: 0". Ein Plan, in dem eine Gruppe fehlt, sieht dann
    aus wie ein normaler Plan.

    Hier wird beides nachgeholt: ein eigenes Gewicht und vor allem eine
    Meldung, die sagt, welche Gruppe an welchem Tag leer steht — und wie viele
    Kraefte auf dieser Etage ueberhaupt zur Verfuegung standen. Aus „unbesetzt"
    wird damit eine Rechnung, aus der sich etwas ableiten laesst.
    """
    for gi, g in enumerate(ctx.gruppen):
        name = g.get("name", g.get("id"))
        etage_id = g.get("etageId")
        gleiche_etage = [
            gj for gj, x in enumerate(ctx.gruppen) if x.get("etageId") == etage_id
        ]
        for di in range(ctx.n_days):
            tag = ctx.days[di]
            # §167 Ist die Gruppe fuer diesen Tag aufgeteilt, braucht sie keine
            # Besetzung mehr — die Kinder sind nach dem internen
            # Aufteilungsplan in anderen Gruppen.
            if ctx.massnahme_aktiv("aufteilen", g.get("id"), tag):
                ctx.notiere(f"„{name}“ ist am {tag} aufgeteilt — keine Besetzung nötig.")
                continue

            # §182 Dasselbe, nur vorher statt hinterher: Die Leitung wusste
            # schon, dass diese Gruppe unterwegs ist, und hat es eingetragen.
            if ctx.ist_unterwegs(gi, tag):
                continue

            fehlt = ctx.model.new_int_var(0, anzahl, f"grp_fehlt_{di}_{gi}")
            ctx.model.add(
                sum(ctx.G[ei, di, gi] for ei in range(ctx.n_emp)) + fehlt >= anzahl
            )
            ctx.strafe(gewicht, fehlt)

            # Die Rechnung dazu: Wie viele standen an diesem Tag auf dieser
            # Etage, und wie viele Gruppen wollten besetzt werden?
            auf_etage = ctx.model.new_int_var(0, ctx.n_emp, f"etzahl_{di}_{etage_id}")
            ctx.model.add(auf_etage == sum(
                ctx.G[ei, di, gj] for ei in range(ctx.n_emp) for gj in gleiche_etage
            ))
            ctx.melde_wenn(
                fehlt, "hart",
                f"{name} am {tag} unbesetzt — auf dieser Etage waren "
                f"{{da}} Kräfte eingeteilt für {len(gleiche_etage)} Gruppen.",
                zahlen={"da": auf_etage},
                massnahme={
                    "typ": "aufteilen",
                    "ziel": g.get("id"),
                    "tag": tag,
                    "text": f"{name} am {tag} aufteilen — die Kinder nach dem "
                            "internen Aufteilungsplan auf die anderen Gruppen.",
                },
            )
    ctx.notiere(
        f"Jede der {ctx.n_groups} Gruppen ist an jedem Tag mit mindestens "
        f"{anzahl} Person besetzt — und eine Lücke wird mit der Rechnung dazu "
        "gemeldet."
    )


def unterwegs_beachten(ctx: PlanKontext) -> None:
    """
    §182 Eine Gruppe, die unterwegs ist, bleibt unter sich.

    Gruppenfahrt, Projektwoche, Schliesszeit: Die Leitung weiss es vorher und
    traegt es an der Gruppe ein, mit Anfang und Ende. Zwei Dinge folgen daraus,
    und beide gehen in dieselbe Richtung — niemand soll im Plan an einem Ort
    stehen, an dem er in Wirklichkeit nicht ist.

      1. ES KOMMT NIEMAND VON AUSSEN DAZU. Eine fremde Kraft in eine Gruppe zu
         schicken, die auf dem Bus sitzt, hilft niemandem — sie fehlt dann
         anderswo, und zwar echt.

      2. ES GEHT NIEMAND WEG. Wer zu dieser Gruppe gehoert, ist mit unterwegs.
         Ihn in eine andere Gruppe zu planen hiesse: Der Dienstplan sagt, er
         sei im Haus, und er sitzt im Bus. Das ist die gefaehrlichere der
         beiden Richtungen, denn der Plan sieht dabei vollstaendig aus.

    Was NICHT folgt: Die Kraefte sind nicht abwesend. Eine Fahrt ist
    Arbeitszeit — sie behalten ihre Dienste und ihre Stunden. Wer nicht
    mitfaehrt, wird wie immer ueber eine Abwesenheit erfasst.

    Die Mindestbesetzung der Gruppe entfaellt an diesen Tagen; das steht in
    `jede_gruppe_besetzt` und `mindestens_in_gruppe`, weil es dort hingehoert.
    """
    if not ctx.gruppen_aktiv:
        ctx.notiere("Gruppen unterwegs: keine Gruppenplanung aktiv — nichts zu tun.")
        return

    unterwegs = 0
    for gi, g in enumerate(ctx.gruppen):
        tage = [di for di in range(ctx.n_days) if ctx.ist_unterwegs(gi, ctx.days[di])]
        if not tage:
            continue
        unterwegs += 1
        eigene = set(ctx.stammkraefte(gi))
        for di in tage:
            for ei in range(ctx.n_emp):
                if ei in eigene:
                    # Die eigenen Kraefte bleiben bei ihrer Gruppe.
                    for gj in range(ctx.n_groups):
                        if gj != gi:
                            ctx.model.add(ctx.G[ei, di, gj] == 0)
                else:
                    ctx.model.add(ctx.G[ei, di, gi] == 0)
        ctx.notiere(
            f"„{g.get('name', gi)}“ ist vom {g.get('unterwegsVon')} bis "
            f"{g.get('unterwegsBis')} unterwegs "
            f"({g.get('unterwegsGrund') or 'ohne Angabe'}) — keine Besetzung "
            f"noetig, und niemand kommt oder geht."
        )

    if unterwegs == 0:
        ctx.notiere("Keine Gruppe ist in diesem Zeitraum unterwegs.")


def abgabesperre_beachten(ctx: PlanKontext) -> None:
    """
    Aus einer gesperrten Gruppe wird niemand abgezogen.

    Eine Kita in der Eingewoehnung gibt niemanden ab: Die Kinder lernen gerade
    ein Gesicht, und wer es ihnen wegnimmt, faengt von vorne an. Das ist keine
    Planungsgroesse, sondern eine paedagogische Entscheidung — sie steht in den
    Stammdaten der Gruppe und hat ein Ablaufdatum.

    Die Sperre gilt nur fuer das ABGEBEN. Wer in einer gesperrten Gruppe
    arbeitet, bleibt dort; wer von aussen hilft, darf trotzdem kommen.
    """
    gesperrt = 0
    for gi, g in enumerate(ctx.gruppen):
        eigene = ctx.stammkraefte(gi)
        if not eigene:
            continue
        tage = [di for di in range(ctx.n_days) if ctx.gibt_niemanden_ab(gi, ctx.days[di])]
        if not tage:
            continue
        gesperrt += 1
        for ei in eigene:
            for di in tage:
                for gj in range(ctx.n_groups):
                    if gj != gi:
                        ctx.model.add(ctx.G[ei, di, gj] == 0)
        ctx.notiere(
            f"„{g.get('name', gi)}“ gibt bis {g.get('abgabeGesperrtBis')} "
            f"niemanden ab ({g.get('abgabeGrund') or 'ohne Angabe'})."
        )
    if gesperrt == 0:
        ctx.notiere("Keine Gruppe ist für Abgaben gesperrt.")


def nur_abgeben_wenn_jemand_bleibt(ctx: PlanKontext) -> None:
    """
    §168 Eine Kraft verlaesst ihre Gruppe nur, wenn dort eine eigene bleibt.

    DER FEHLER, DEN DIESE REGEL SCHLIESST
    „Jede Gruppe ist besetzt" reicht nicht. Die Gruppe kann besetzt sein — von
    einer Fremden. Genau das ist passiert: Stephanie war krank, Christina wurde
    aus Gruppe 2 nach oben geschickt, und die Springerin rueckte in Gruppe 2
    nach. Auf dem Papier war jede Gruppe besetzt. In Wirklichkeit stand eine
    Gruppe, deren eigene Kraft da war, den ganzen Tag mit einer Fremden da.

    Das ist doppelt falsch: Die Kinder in Gruppe 2 verlieren ihr Gesicht, und
    die Vertretung oben haette genauso die Springerin uebernehmen koennen.

    WAS DIE REGEL NICHT VERBIETET
    Dass eine Gruppe von einer einzelnen Fremden gefuehrt wird, wenn von ihren
    eigenen Leuten NIEMAND da ist. Dann gibt es keine Wahl, und die Vertretung
    ist besser als eine geschlossene Gruppe.

    Ist die Gruppe fuer den Tag aufgeteilt, gilt die Regel nicht — dann sind
    die Kinder ohnehin woanders.
    """
    betroffen = 0
    for gi, g in enumerate(ctx.gruppen):
        eigene = ctx.stammkraefte(gi)
        if len(eigene) < 2:
            # Mit nur einer eigenen Kraft kann nie jemand abgegeben werden,
            # ohne die Gruppe fremd zu besetzen — das erledigt die Regel
            # unten von selbst (andere_da ist dann immer 0).
            pass
        for ei in eigene:
            betroffen += 1
            for di in range(ctx.n_days):
                if ctx.massnahme_aktiv("aufteilen", g.get("id"), ctx.days[di]):
                    continue
                # Arbeitet sie an diesem Tag in einer ANDEREN Gruppe?
                weg = sum(
                    ctx.G[ei, di, gj] for gj in range(ctx.n_groups) if gj != gi
                )
                # Bleibt eine andere eigene Kraft in der Stammgruppe?
                bleibt = sum(ctx.G[ek, di, gi] for ek in eigene if ek != ei)
                ctx.model.add(weg <= bleibt)
    ctx.notiere(
        f"Eine Kraft verlässt ihre Stammgruppe nur, wenn dort eine andere "
        f"eigene Kraft bleibt ({betroffen} Personenbindungen). Ist niemand "
        "von der Gruppe da, darf eine Fremde übernehmen."
    )


# ════════════════════════════════════════════════════════════════════════════
# §185 Bausteine für Betriebe, die über ZEITFENSTER denken statt über Gruppen
#
# Das Kita-Paket (§163 ff.) denkt in Gruppen und Etagen: Wer steht wo, wer gibt
# wen ab. Eine Wohngruppe mit fünf Bewohnern denkt anders — dort gibt es nur
# einen Ort, und die Frage ist, WANN wie viele Menschen da sind. „Ab 06:30 muss
# jemand da sein", „zwischen 07:45 und 18:00 sollen es zwei bis drei sein",
# „bis 21:45 bleibt jemand".
#
# Diese Bausteine kommen neu HINZU. Kein vorhandener wird geändert: Das
# Kita-Paket und seine Abnahmeprüfungen müssen unverändert grün bleiben, und
# genau das ist die Gegenprobe zu diesem Block.
#
# WARUM NUR AN DEN WECHSELPUNKTEN GERECHNET WIRD
# Eine Besetzung über ein Zeitfenster ließe sich minutenweise prüfen — das
# wären bei zehn Stunden sechshundert Bedingungen je Tag und Person. Die
# Besetzung ändert sich aber nur dort, wo ein Dienst anfängt oder aufhört.
# Geprüft wird deshalb an diesen Punkten; dazwischen kann sich nichts tun.
# ════════════════════════════════════════════════════════════════════════════

def _uhrzeit(zeit: str) -> int:
    """„06:30" → 390 Minuten seit Mitternacht."""
    stunde, minute = zeit.split(":")
    return int(stunde) * 60 + int(minute)


def _wechselpunkte(ctx: PlanKontext, von: int, bis: int) -> list[int]:
    """
    Die Zeitpunkte, an denen sich die Besetzung ändern KANN.

    Das sind die Anfänge aller Dienste innerhalb des Fensters, dazu sein
    eigener Anfang. Enden brauchen wir nicht: Geht jemand, sinkt die Besetzung
    — gemessen wird sie aber ab dem nächsten Anfang ohnehin neu, und der
    Fensteranfang deckt den Rest.
    """
    punkte = {von}
    for si in range(ctx.n_shifts):
        beginn = ctx.dienstbeginn(si)
        if von < beginn < bis:
            punkte.add(beginn)
        ende = ctx.dienstende(si)
        if von < ende < bis:
            # Nach dem Ende eines Dienstes ist eine Kraft weniger da. Der
            # Zeitpunkt selbst zählt noch zur Anwesenheit, deshalb eine Minute
            # später nachsehen.
            punkte.add(ende)
    return sorted(punkte)


def _betreuend(ctx: PlanKontext, ausser: tuple[str, ...]) -> list[int]:
    """
    Welche Dienste als BETREUUNG zählen — und welche nicht.

    §185 Bürozeit ist Arbeitszeit, aber keine Betreuung. Wer von acht bis vier
    im Büro sitzt, steht im Dienstplan und ist trotzdem nicht bei den
    Bewohnern. Zählte er mit, rechnete sich die Gruppe reich: Auf dem Papier
    wären zwei Leute da, in Wirklichkeit einer.

    Dasselbe gilt für Sitzungen. Beides wird über einen Namensteil
    ausgeschlossen, nicht über die Dienstart — „Büro" und „Tagdienst" sind
    beide vom Typ „mittel", und das ist auch richtig so.
    """
    if not ausser:
        return list(range(ctx.n_shifts))
    teile = [a.strip().lower() for a in ausser if a.strip()]
    return [
        si for si in range(ctx.n_shifts)
        if not any(teil in str(ctx.shifts[si].get("name", "")).lower() for teil in teile)
    ]


def _anwesend(ctx: PlanKontext, di: int, zeitpunkt: int,
              ausser: tuple[str, ...] = ()):
    """Die Summe aller BETREUENDEN Dienste, die zu diesem Zeitpunkt laufen."""
    laufende = [
        si for si in _betreuend(ctx, ausser)
        if ctx.dienstbeginn(si) <= zeitpunkt < ctx.dienstende(si)
    ]
    if not laufende:
        return None
    return sum(ctx.X[ei, di, si] for ei in range(ctx.n_emp) for si in laufende)


def mindestens_einer_ab_uhrzeit(ctx: PlanKontext, uhrzeit: str, anzahl: int = 1,
                                ausser_dienste: tuple[str, ...] = (),
                                gewicht: int = 30_000) -> None:
    """
    §185 Jeden Tag beginnt jemand spätestens zu dieser Uhrzeit.

    In einer Wohngruppe heißt das: Um halb sieben steht jemand auf der Gruppe,
    weil die Bewohner dann aufstehen. Reißt das, ist niemand da, wenn der erste
    Bewohner aus dem Zimmer kommt — das ist keine Unterbesetzung, das ist eine
    unbetreute Gruppe.

    Weich, aber teuer. Ein Verbot machte den Plan unlösbar, sobald drei Leute
    krank sind; dann steht der Betrieb ganz ohne Plan da. So kostet es, und es
    steht hinterher im Bericht, an welchem Tag.
    """
    grenze = _uhrzeit(uhrzeit)
    passende = [si for si in _betreuend(ctx, ausser_dienste)
                if ctx.dienstbeginn(si) <= grenze]
    if not passende:
        raise RegelFehler(
            f"Kein Dienst beginnt um {uhrzeit} oder früher. "
            f"Vorhanden: {sorted({ctx.shifts[si].get('von') for si in range(ctx.n_shifts)})}"
        )

    for di in range(ctx.n_days):
        fehlt = ctx.model.new_int_var(0, anzahl, f"frueh_fehlt_{di}")
        ctx.model.add(
            sum(ctx.X[ei, di, si] for ei in range(ctx.n_emp) for si in passende)
            + fehlt >= anzahl
        )
        ctx.strafe(gewicht, fehlt)
        ctx.melde_wenn(
            fehlt, "hart",
            f"Am {ctx.days[di]} fängt niemand um {uhrzeit} an — die Gruppe wäre "
            "morgens unbetreut.",
        )
    ctx.notiere(f"Täglich mindestens {anzahl} Dienst(e) ab spätestens {uhrzeit}.")


def mindestens_einer_bis_uhrzeit(ctx: PlanKontext, uhrzeit: str, anzahl: int = 1,
                                 ausser_dienste: tuple[str, ...] = (),
                                 gewicht: int = 30_000) -> None:
    """
    §185 Jeden Tag bleibt jemand mindestens bis zu dieser Uhrzeit.

    Das Gegenstück zu `mindestens_einer_ab_uhrzeit`. In einer Wohngruppe heißt
    es: Bis Viertel vor zehn ist jemand da, weil die Bewohner bis dahin
    wachsind.

    Es gibt dafür schon `genug_bis_uhrzeit` — der zählt aber JE ETAGE und
    gehört damit zu einem Betrieb mit Etagen und Gruppen. Eine Wohngruppe hat
    einen Ort. Ein Baustein, der ohne Etagen stillschweigend nichts tut, wäre
    hier die gefährlichste Variante: Die Regel stünde im Paket und wirkte nicht.
    """
    grenze = _uhrzeit(uhrzeit)
    passende = [si for si in _betreuend(ctx, ausser_dienste)
                if ctx.dienstende(si) >= grenze]
    if not passende:
        raise RegelFehler(
            f"Kein Dienst reicht bis {uhrzeit}. "
            f"Vorhanden: {sorted({ctx.shifts[si].get('bis') for si in range(ctx.n_shifts)})}"
        )

    for di in range(ctx.n_days):
        fehlt = ctx.model.new_int_var(0, anzahl, f"spaet_fehlt_{di}")
        ctx.model.add(
            sum(ctx.X[ei, di, si] for ei in range(ctx.n_emp) for si in passende)
            + fehlt >= anzahl
        )
        ctx.strafe(gewicht, fehlt)
        ctx.melde_wenn(
            fehlt, "hart",
            f"Am {ctx.days[di]} bleibt niemand bis {uhrzeit} — die Gruppe wäre "
            "abends unbetreut.",
        )
    ctx.notiere(f"Täglich mindestens {anzahl} Dienst(e) bis mindestens {uhrzeit}.")


def durchgehend_besetzt(ctx: PlanKontext, von: str, bis: str, mindestens: int = 1,
                        ausser_dienste: tuple[str, ...] = (),
                        gewicht: int = 30_000) -> None:
    """
    §185 Zwischen diesen Uhrzeiten ist immer jemand da — ohne Lücke.

    „Jeden Tag ein Frühdienst und ein Spätdienst" genügt dafür nicht: Endet der
    Frühdienst um 14:00 und beginnt der Spätdienst um 16:30, steht die Gruppe
    zweieinhalb Stunden leer, und auf dem Plan sieht beides besetzt aus.

    Geprüft wird an den Wechselpunkten (siehe oben). Die Meldung nennt die
    Uhrzeit, nicht nur den Tag — eine Leitung, die „am 14.10. unterbesetzt"
    liest, sucht sonst den ganzen Tag ab.
    """
    a, b = _uhrzeit(von), _uhrzeit(bis)
    if b <= a:
        raise RegelFehler(f"Das Fenster {von}–{bis} endet vor seinem Anfang.")

    luecken = 0
    for di in range(ctx.n_days):
        for punkt in _wechselpunkte(ctx, a, b):
            da = _anwesend(ctx, di, punkt, ausser_dienste)
            if da is None:
                # Zu dieser Zeit gibt es gar keinen Dienst — das ist eine Lücke
                # im Dienstkatalog, nicht im Plan. Sie gehört gemeldet, lässt
                # sich aber nicht wegplanen.
                ctx.notiere(
                    f"Kein Dienst deckt {punkt // 60:02d}:{punkt % 60:02d} ab — "
                    f"das Fenster {von}–{bis} ist mit den vorhandenen "
                    "Dienstzeiten nicht lückenlos zu besetzen."
                )
                continue
            fehlt = ctx.model.new_int_var(0, mindestens, f"luecke_{di}_{punkt}")
            ctx.model.add(da + fehlt >= mindestens)
            ctx.strafe(gewicht, fehlt)
            ctx.melde_wenn(
                fehlt, "hart",
                f"Am {ctx.days[di]} um {punkt // 60:02d}:{punkt % 60:02d} ist "
                f"niemand auf der Gruppe.",
            )
            luecken += 1
    ctx.notiere(
        f"Zwischen {von} und {bis} ist immer mindestens {mindestens} Person da "
        f"({luecken} geprüfte Zeitpunkte)."
    )


def besetzung_im_fenster(ctx: PlanKontext, von: str, bis: str,
                         mindestens: int, am_besten: int,
                         nur_wochentage: tuple[int, ...] | None = None,
                         ausser_dienste: tuple[str, ...] = (),
                         gewicht_mindest: int = 20_000,
                         gewicht_wunsch: int = 3_000) -> None:
    """
    §185 Der Betreuungsschlüssel tagsüber — als Untergrenze und als Wunsch.

    Eine Wohngruppe mit fünf Bewohnern strebt tagsüber zwei Bewohner je Kraft
    an und kommt notfalls mit dreien aus. Beides gehört in den Plan, und zwar
    unterschiedlich schwer: Die Untergrenze ist fast ein Muss, der Wunsch ist
    einer. Wer nur das Muss einträgt, bekommt dauerhaft die schlechtere
    Besetzung, weil der Rechendienst keinen Grund hat, mehr zu tun.

    `nur_wochentage` grenzt das Fenster ein (0 = Montag). Am Wochenende sind in
    dieser Gruppe oft nur zwei bis drei Bewohner da — dann gilt ein anderer
    Schlüssel, und derselbe Baustein wird ein zweites Mal mit anderen Zahlen
    aufgerufen.
    """
    a, b = _uhrzeit(von), _uhrzeit(bis)
    tage = [
        di for di in range(ctx.n_days)
        if nur_wochentage is None or ctx.weekdays[di] in nur_wochentage
    ]
    if not tage:
        ctx.notiere(f"Besetzung {von}–{bis}: kein passender Wochentag im Zeitraum.")
        return

    for di in tage:
        for punkt in _wechselpunkte(ctx, a, b):
            da = _anwesend(ctx, di, punkt, ausser_dienste)
            if da is None:
                continue
            uhr = f"{punkt // 60:02d}:{punkt % 60:02d}"

            unter = ctx.model.new_int_var(0, mindestens, f"unter_{di}_{punkt}")
            ctx.model.add(da + unter >= mindestens)
            ctx.strafe(gewicht_mindest, unter)
            ctx.melde_wenn(
                unter, "hart",
                f"Am {ctx.days[di]} um {uhr} sind weniger als {mindestens} "
                "Personen da.",
            )

            if am_besten > mindestens:
                fehlt = ctx.model.new_int_var(0, am_besten - mindestens,
                                              f"wunsch_{di}_{punkt}")
                ctx.model.add(da + fehlt >= am_besten)
                ctx.strafe(gewicht_wunsch, fehlt)

    zusatz = '' if nur_wochentage is None else f" (nur {sorted(nur_wochentage)})"
    ctx.notiere(
        f"Zwischen {von} und {bis}{zusatz}: mindestens {mindestens}, "
        f"am besten {am_besten} Personen."
    )


def wunschbesetzung_am_wochentag(ctx: PlanKontext, wochentag: int,
                                 dienst_teile: tuple[str, ...],
                                 gewicht: int = 4_000) -> None:
    """
    §185 An diesem Wochentag ist diese Dienstkombination erwünscht.

    Der Betrieb hat sich eine Montagsbesetzung überlegt, die morgens gut
    ineinandergreift. Das ist kein Muss — an einem Montag mit zwei
    Krankmeldungen ist sie nicht zu halten, und dann soll der Plan trotzdem
    entstehen. Es ist aber auch nicht nichts: Ohne Gewicht landet die
    Kombination nie im Plan, weil der Rechendienst sie nicht kennt.
    """
    tage = ctx.tage_am_wochentag(wochentag)
    if not tage:
        ctx.notiere(f"Wunschbesetzung: kein {wochentag} im Zeitraum.")
        return

    gefunden = []
    for teil in dienst_teile:
        si_liste = ctx.dienste(teil)
        gefunden.append((teil, si_liste))

    for di in tage:
        for teil, si_liste in gefunden:
            fehlt = ctx.model.new_bool_var(f"wunschdienst_{di}_{teil}")
            ctx.model.add(
                sum(ctx.X[ei, di, si] for ei in range(ctx.n_emp) for si in si_liste)
                + fehlt >= 1
            )
            ctx.strafe(gewicht, fehlt)

    namen = ", ".join(t for t, _ in gefunden)
    tagName = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag',
               'Samstag', 'Sonntag'][wochentag]
    ctx.notiere(f"{tagName}s erwünscht: {namen} ({len(tage)} Tage im Zeitraum).")


def stundenband(ctx: PlanKontext, minus_max: float, plus_max: float,
                gewicht: int = 40) -> None:
    """
    §185 Das Pensum muss nicht auf null aufgehen — aber es darf nicht weglaufen.

    Das Gegenteil von `exakte_wochenstunden`, und mit Absicht: Dieser Betrieb
    sagt ausdrücklich, dass Plus- und Minusstunden erwünscht sind und später
    gezielt abgebaut werden. Wer ihn zwingt, jeden Monat auf null zu landen,
    nimmt ihm genau die Beweglichkeit, mit der er arbeitet.

    Innerhalb des Bandes kostet die Abweichung nichts. Außerhalb kostet sie je
    Minute — dann steht sie auch im Bericht.

    WAS DIESER BAUSTEIN NOCH NICHT KANN
    Er sieht nur den geplanten Zeitraum. Der mitgebrachte Stundenstand aus den
    Vormonaten steht in der Personalakte (`hoursBalance`), erreicht den
    Rechendienst aber bisher nicht. Wer bei +40 Stunden in den Monat geht, darf
    nach dieser Regel trotzdem noch einmal +45 aufbauen. Das gehört
    nachgezogen, und bis dahin steht es hier, damit niemand mehr annimmt, als
    da ist.
    """
    minus_minuten = int(round(minus_max * 60))
    plus_minuten = int(round(plus_max * 60))

    betroffen = 0
    for ei, emp in enumerate(ctx.employees):
        wochensoll = float(emp.get("wochenstundenSoll", 0) or 0)
        if wochensoll <= 0:
            continue

        volle = [w for w in ctx.weeks if ctx.volle_woche(ei, w)]
        if not volle:
            continue

        soll = int(round(wochensoll * 60)) * len(volle)
        ist = sum(
            ctx.X[ei, di, si] * ctx.netto(si)
            for w in volle for di in w for si in range(ctx.n_shifts)
        )

        ueber = ctx.model.new_int_var(0, 100_000, f"band_ueber_{ei}")
        unter = ctx.model.new_int_var(0, 100_000, f"band_unter_{ei}")
        ctx.model.add(ist - soll <= plus_minuten + ueber)
        ctx.model.add(soll - ist <= minus_minuten + unter)
        ctx.strafe(gewicht, ueber)
        ctx.strafe(gewicht, unter)

        name = emp.get("name", ei)
        ctx.melde_wenn(
            ueber, "weich",
            f"{name} baut mehr als {plus_max:g} Plusstunden auf.",
        )
        ctx.melde_wenn(
            unter, "weich",
            f"{name} rutscht weiter als {minus_max:g} Stunden ins Minus.",
        )
        betroffen += 1

    ctx.notiere(
        f"Stundenband −{minus_max:g} bis +{plus_max:g} Stunden über den "
        f"Zeitraum ({betroffen} Personen). Innerhalb des Bandes kostet die "
        "Abweichung nichts."
    )


def hoechstens_gleichzeitig_abwesend(ctx: PlanKontext, anzahl: int) -> None:
    """
    §185 Eine Meldung, kein Verbot: An diesem Tag sind zu viele gleichzeitig weg.

    Urlaube sind schon genehmigt, wenn geplant wird — der Rechendienst kann
    daran nichts ändern. Er kann aber sagen, dass die Regel des Betriebs an
    diesem Tag gerissen ist, und zwar BEVOR jemand sich wundert, warum der Plan
    nicht aufgeht.

    Deshalb steht hier keine Bedingung. Eine Bedingung über etwas, das
    feststeht, macht den Plan unlösbar und erklärt nichts.
    """
    gemeldet = 0
    for di in range(ctx.n_days):
        tag = ctx.days[di]
        weg = [
            ctx.employees[ei].get("name", ei)
            for ei in range(ctx.n_emp)
            if tag in ctx.abwesend_an(ei)
        ]
        if len(weg) > anzahl:
            gemeldet += 1
            ctx.notiere(
                f"Am {tag} sind {len(weg)} Personen gleichzeitig abwesend "
                f"(erlaubt: {anzahl}) — {', '.join(weg)}."
            )
    if gemeldet == 0:
        ctx.notiere(f"An keinem Tag sind mehr als {anzahl} Personen gleichzeitig abwesend.")
