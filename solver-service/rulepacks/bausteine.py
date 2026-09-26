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
    ei = ctx.person(name)
    person = ctx.employees[ei].get("name", name)

    gruppen_si = {}
    for stunden, anzahl in muster.items():
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

    teile = ", ".join(f"{a}× {st} Std." for st, a in sorted(muster.items(), reverse=True))
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
                auf_etage = sum(ctx.G[ei, di, gi] for gi in gis)
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
            ctx.melde_wenn(
                fehlt, "hart",
                f"{et_name}: kein {dienst_typ.capitalize()}dienst am "
                f"{ctx.days[di]} — die Etage wird nicht "
                + ("geöffnet." if dienst_typ.startswith("frueh") else "geschlossen."),
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
