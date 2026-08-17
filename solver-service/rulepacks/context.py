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
