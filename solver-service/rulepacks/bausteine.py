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
