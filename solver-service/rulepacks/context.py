"""
§99 Planungskontext — die Arbeitsfläche, auf der Regelpakete geschrieben werden.

Der Kontext bündelt Modell, Entscheidungsvariablen und Stammdaten und ergänzt
Helfer für die Zugriffe, bei denen erfahrungsgemäß Fehler passieren:

  * Person nicht gefunden (Tippfehler, Vor-/Nachname vertauscht)
  * Dienst nicht gefunden (Name im Betrieb anders als in der Software)
  * Gruppe leer oder Gruppenplanung gar nicht aktiv

Alle Sucher melden sich LAUT, wenn sie nichts finden: sie werfen einen Fehler
statt still nichts zu tun. Eine Regel, die niemanden trifft, ist der teuerste
Fehler überhaupt — sie sieht aus, als würde sie wirken.

Jede angewandte Regel wird protokolliert. Das Protokoll landet im Plan und
beantwortet die Frage „welche Regeln haben hier eigentlich gegriffen?“.
"""

from __future__ import annotations

from dataclasses import dataclass, field


class RegelFehler(Exception):
    """Ein Regelpaket passt nicht zu den Daten des Standorts."""


@dataclass
class PlanKontext:
    model: object                    # cp_model.CpModel
    X: dict                          # (ei, di, si) -> BoolVar  (Mitarbeiter/Tag/Dienst)
    G: dict                          # (ei, di, gi) -> BoolVar  (Mitarbeiter/Tag/Gruppe)
    employees: list[dict]
    shifts: list[dict]
    gruppen: list[dict]
    etagen: list[dict]
    days: list[str]
    weekdays: list[int]              # 0 = Montag … 6 = Sonntag
    weeks: list[list[int]]           # Tages-Indizes je Kalenderwoche
    protokoll: list[str] = field(default_factory=list)

    # §163 Netto-Arbeitsminuten je Dienst — Anwesenheit minus Pause.
    #
    # Ein Regelpaket, das ueber Arbeitszeit spricht, muss den Unterschied
    # kennen: 06:00–14:30 sind 8:30 Anwesenheit und 8:00 Arbeitszeit. Wer mit
    # der Anwesenheit rechnet, baut jedem Achtstuendler eine halbe Stunde
    # Ueberzeit in die Woche.
    netto_je_dienst: list[int] = field(default_factory=list)

    # §163 Kostenterme, die das Paket zum Ziel des Solvers beisteuert.
    #
    # Bisher konnte ein Regelpaket nur VERBIETEN. Fuer die Haelfte dessen, was
    # ein Betrieb ueber seinen Dienstplan sagt, reicht das nicht: „moeglichst
    # nicht", „fair ueber die Wochen", „nur im Notfall" sind Bewertungen, keine
    # Verbote. Ein Verbot daraus zu machen erzeugt entweder einen unloesbaren
    # Plan oder eine stillschweigend ignorierte Regel.
    kosten: list = field(default_factory=list)

    # §163 Anzeiger, die nach dem Loesen ausgewertet werden.
    #
    # Ob eine weiche Regel wirklich gerissen ist, weiss man erst, wenn der Plan
    # steht. Hier merkt sich das Paket die Variablen, an denen man es ablesen
    # kann — der Solver wertet sie nach dem Loesen aus und schreibt das
    # Ergebnis in den Bericht. Ohne das waere „Regelverletzungen transparent
    # machen" nicht mehr als ein Vorsatz.
    anzeiger: list = field(default_factory=list)

    # ── Dimensionen ──────────────────────────────────────────────────────────
    @property
    def n_emp(self) -> int: return len(self.employees)
    @property
    def n_days(self) -> int: return len(self.days)
    @property
    def n_shifts(self) -> int: return len(self.shifts)
    @property
    def n_groups(self) -> int: return len(self.gruppen)

    def notiere(self, text: str) -> None:
        self.protokoll.append(text)

    # ── Bewerten statt verbieten (§163) ──────────────────────────────────────
    def strafe(self, gewicht: int, term) -> None:
        """
        Einen Kostenterm zum Ziel des Solvers beisteuern.

        Je hoeher das Gewicht, desto unwilliger weicht der Plan davon ab. Zur
        Einordnung, was der Solver selbst schon vergibt:

            10 000  eine unbesetzte Pflichtstelle
               500  Arbeit ohne Gruppenzuordnung
               300  Verlassen der Stammgruppe (800 ueber die Etage hinweg)
               200  Abweichung vom bestehenden Plan
                30  eine Minute ueber der Wochensollzeit
                20  eine Minute darunter

        Wer hier 1 000 000 vergibt, hat kein starkes Gewicht gewaehlt, sondern
        ein Verbot gebaut — dann gehoert es auch als Verbot geschrieben.
        """
        if gewicht <= 0:
            return
        self.kosten.append(gewicht * term)

    def melde_wenn(self, variable, art: str, text: str) -> None:
        """
        Nach dem Loesen melden, falls diese Variable nicht null ist.

        `art` ist "hart" oder "weich". Der Unterschied gehoert in den Bericht:
        Eine gerissene Fairnessregel ist etwas anderes als eine Gruppe, die
        nicht besetzt werden konnte — und wer beides gleich anzeigt, bringt
        niemanden dazu, das Zweite ernst zu nehmen.
        """
        if art not in ("hart", "weich"):
            raise RegelFehler(f'Unbekannte Art "{art}" — erlaubt sind "hart" und "weich".')
        self.anzeiger.append({"variable": variable, "art": art, "text": text})

    # ── Zeit ─────────────────────────────────────────────────────────────────
    def netto(self, si: int) -> int:
        """Netto-Arbeitsminuten eines Dienstes (ohne Pause)."""
        if not self.netto_je_dienst:
            raise RegelFehler(
                "Dieser Rechendienst liefert keine Netto-Arbeitszeiten. "
                "Regeln ueber Arbeitsstunden brauchen sie — Version pruefen."
            )
        return self.netto_je_dienst[si]

    def dienste_mit_stunden(self, *stunden: float) -> list[int]:
        """
        Dienste, deren NETTO-Arbeitszeit einer dieser Stundenzahlen entspricht.

        Damit laesst sich ein Tagesmuster ausdruecken, ohne die Dienste beim
        Namen zu nennen: „Marin arbeitet Dienste zu acht Stunden" gilt auch
        dann noch, wenn der Betrieb eine weitere Achtstundenschicht anlegt.
        """
        gesucht = {int(round(st * 60)) for st in stunden}
        treffer = [si for si in range(self.n_shifts) if self.netto(si) in gesucht]
        if not treffer:
            vorhanden = sorted({self.netto(si) / 60 for si in range(self.n_shifts)})
            raise RegelFehler(
                f"Kein Dienst mit {list(stunden)} Arbeitsstunden. "
                f"Vorhanden sind: {vorhanden} Stunden."
            )
        return treffer

    def ist_freitag(self, di: int) -> bool:
        return self.weekdays[di] == 4

    def historie(self, ei: int, schluessel: str) -> int:
        """Ein Zaehler aus der Belastungshistorie, 0 wenn er fehlt."""
        h = self.employees[ei].get("belastungsHistorie") or {}
        try:
            return max(0, int(h.get(schluessel, 0) or 0))
        except (TypeError, ValueError):
            return 0

    def abwesend_an(self, ei: int) -> set:
        """Tage, an denen diese Person ohnehin nicht planbar ist."""
        e = self.employees[ei]
        raus = set(e.get("urlaubAn") or []) | set(e.get("nichtVerfuegbarAn") or [])
        for w in e.get("wuensche") or []:
            if w.get("typ") == "wunschfrei" and w.get("datum"):
                raus.add(w["datum"])
        return raus

    def volle_woche(self, ei: int, woche: list[int]) -> bool:
        """Ist diese Person in dieser Woche an keinem Tag abwesend?"""
        raus = self.abwesend_an(ei)
        return not any(self.days[di] in raus for di in woche)

    # ── Personen finden ──────────────────────────────────────────────────────
    def person(self, name: str) -> int:
        """
        Index EINER Person über einen Namensteil. Wirft, wenn niemand oder
        mehrere passen — beides wäre im Dienstplan ein stiller Fehler.
        """
        treffer = self.personen(name)
        if len(treffer) > 1:
            namen = ", ".join(self.employees[i].get("name", "?") for i in treffer)
            raise RegelFehler(f'„{name}“ passt auf mehrere Personen: {namen}. Bitte eindeutiger angeben.')
        return treffer[0]

    def personen(self, *namensteile: str) -> list[int]:
        """Indizes aller Personen, deren Name einen der Teile enthält."""
        gesucht = [t.strip().lower() for t in namensteile if t and t.strip()]
        if not gesucht:
            raise RegelFehler("Kein Name angegeben.")
        treffer = [
            ei for ei, e in enumerate(self.employees)
            if any(t in str(e.get("name", "")).lower() for t in gesucht)
        ]
        if not treffer:
            bekannt = ", ".join(str(e.get("name", "?")) for e in self.employees[:12])
            raise RegelFehler(f'Niemand gefunden für {list(namensteile)}. Vorhanden sind: {bekannt}')
        return treffer

    def person_in_gruppe(self, name: str, gruppe_teil: str) -> int:
        """
        §163 Eine Person ueber Namen UND Stammgruppe finden.

        Zwei Kolleginnen heissen Katrin. Ein Regelwerk, das nur Vornamen
        nennt, ist damit mehrdeutig — und `person()` weigert sich zu Recht,
        eine davon zu raten. Die Stammgruppe entscheidet: Sie steht in den
        Stammdaten, wird dort gepflegt und ist eindeutig.

        Das ist ausdruecklich besser als ein Nachname im Regelpaket: Wer
        heiratet, heisst anders, und dann laeuft die Regel ins Leere.
        """
        gi = self.gruppe(gruppe_teil)
        gruppen_id = self.gruppen[gi].get("id")
        gesucht = name.strip().lower()
        treffer = [
            ei for ei, e in enumerate(self.employees)
            if gesucht in str(e.get("name", "")).lower()
            and e.get("stammEinheitId") == gruppen_id
        ]
        if not treffer:
            in_gruppe = ", ".join(
                str(e.get("name", "?")) for e in self.employees
                if e.get("stammEinheitId") == gruppen_id
            ) or "niemand"
            raise RegelFehler(
                f'Niemand namens „{name}" in Gruppe '
                f'„{self.gruppen[gi].get("name", gruppe_teil)}". Dort stehen: {in_gruppe}'
            )
        if len(treffer) > 1:
            namen = ", ".join(self.employees[i].get("name", "?") for i in treffer)
            raise RegelFehler(
                f'„{name}" passt in dieser Gruppe auf mehrere Personen: {namen}.'
            )
        return treffer[0]

    def person_optional(self, name: str) -> int | None:
        """Wie person(), aber ohne Fehler — für Regeln, die nur manchmal greifen."""
        try:
            return self.person(name)
        except RegelFehler:
            return None

    def mit_rolle(self, *rollen: str) -> list[int]:
        """Personen nach Funktion/Position, z.B. „Leitung“, „Springer“."""
        gesucht = [r.strip().lower() for r in rollen]
        return [
            ei for ei, e in enumerate(self.employees)
            if any(g in f'{e.get("rolle", "")} {e.get("position", "")} {e.get("funktion", "")}'.lower()
                   for g in gesucht)
        ]

    # ── Dienste finden ───────────────────────────────────────────────────────
    def dienste_vom_typ(self, *typen: str) -> list[int]:
        """Indizes aller Dienste eines Typs: frueh, spaet, mittel, nacht."""
        gesucht = {t.strip().lower() for t in typen}
        return [si for si, s in enumerate(self.shifts) if str(s.get("typ", "")).lower() in gesucht]

    def dienst(self, name_teil: str) -> int:
        """Index EINES Dienstes über einen Namensteil."""
        treffer = self.dienste(name_teil)
        if len(treffer) > 1:
            namen = ", ".join(self.shifts[i].get("name", "?") for i in treffer)
            raise RegelFehler(f'„{name_teil}“ passt auf mehrere Dienste: {namen}.')
        return treffer[0]

    def dienste(self, *namensteile: str) -> list[int]:
        gesucht = [t.strip().lower() for t in namensteile if t and t.strip()]
        treffer = [
            si for si, s in enumerate(self.shifts)
            if any(t in str(s.get("name", "")).lower() for t in gesucht)
        ]
        if not treffer:
            bekannt = ", ".join(str(s.get("name", "?")) for s in self.shifts)
            raise RegelFehler(f'Kein Dienst gefunden für {list(namensteile)}. Vorhanden sind: {bekannt}')
        return treffer

    # ── Gruppen und Etagen ───────────────────────────────────────────────────
    @property
    def gruppen_aktiv(self) -> bool:
        return self.n_groups > 0

    def gruppe(self, name_teil: str) -> int:
        treffer = [
            gi for gi, g in enumerate(self.gruppen)
            if name_teil.strip().lower() in str(g.get("name", "")).lower()
        ]
        if not treffer:
            bekannt = ", ".join(str(g.get("name", "?")) for g in self.gruppen)
            raise RegelFehler(f'Keine Gruppe „{name_teil}“. Vorhanden sind: {bekannt}')
        if len(treffer) > 1:
            raise RegelFehler(f'„{name_teil}“ passt auf mehrere Gruppen.')
        return treffer[0]

    def gruppen_der_etage(self, etage_name_teil: str) -> list[int]:
        et = [
            e for e in self.etagen
            if etage_name_teil.strip().lower() in str(e.get("name", "")).lower()
        ]
        if not et:
            bekannt = ", ".join(str(e.get("name", "?")) for e in self.etagen)
            raise RegelFehler(f'Keine Etage „{etage_name_teil}“. Vorhanden sind: {bekannt}')
        et_id = et[0].get("id")
        return [gi for gi, g in enumerate(self.gruppen) if g.get("etageId") == et_id]

    # ── Tage ─────────────────────────────────────────────────────────────────
    def tage_am_wochentag(self, *wochentage: int) -> list[int]:
        """Tages-Indizes für bestimmte Wochentage (0 = Montag)."""
        gesucht = set(wochentage)
        return [di for di, wt in enumerate(self.weekdays) if wt in gesucht]

    # ── Bausteine für Bedingungen ────────────────────────────────────────────
    def arbeitet(self, ei: int, di: int):
        """Term: Person ei arbeitet an Tag di (0 oder 1)."""
        return sum(self.X[ei, di, si] for si in range(self.n_shifts))

    def arbeitet_typ(self, ei: int, di: int, *typen: str):
        """Term: Person ei hat an Tag di einen Dienst dieser Art."""
        sis = self.dienste_vom_typ(*typen)
        return sum(self.X[ei, di, si] for si in sis)

    def steht_in_gruppe(self, ei: int, di: int, gi: int):
        return self.G[ei, di, gi]
