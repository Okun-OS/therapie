/**
 * §152 Technische und organisatorische Maßnahmen (Art. 32 DSGVO).
 *
 * WARUM DAS CODE IST UND KEIN WORD-DOKUMENT
 * Eine TOM-Liste im Textverarbeitungsprogramm beschreibt den Tag, an dem sie
 * geschrieben wurde. Ein halbes Jahr später steht dort, was einmal geplant
 * war. Bei einer Prüfung ist genau das der Moment, in dem es unangenehm wird:
 * Man hat ein Dokument, das nicht stimmt, und das ist schlimmer als keines.
 *
 * Deshalb trägt hier jede Maßnahme einen BELEG — den Pfad zu der Datei, in der
 * sie tatsächlich steht. Ein Test prüft, dass es die Datei gibt. Wer eine
 * Maßnahme herausnimmt, ohne den Eintrag zu ändern, bekommt einen roten Lauf
 * statt ein stilles Dokument.
 *
 * WARUM EIN STAND „betreiber" EXISTIERT
 * Verschlüsselung im Ruhezustand, Sicherungen und Netzverschlüsselung stellt
 * die Plattform bereit, nicht unser Code. Das als eigene Leistung auszugeben
 * wäre gelogen — und es ist auch nicht nötig: Art. 32 fragt, ob die Maßnahme
 * wirkt, nicht wer sie gebaut hat. Sie ist dann Sache des Vertrags mit dem
 * Betreiber, und genau darauf weist der Eintrag hin.
 *
 * DIE GLIEDERUNG
 * Art. 32 Abs. 1 nennt vier Stichworte, ist aber keine Gliederung. Prüfer
 * erwarten bis heute die acht Rubriken aus der alten Anlage zu §9 BDSG —
 * Zutritt, Zugang, Zugriff, Weitergabe, Eingabe, Auftrag, Verfügbarkeit,
 * Trennung. Danach ist hier sortiert, weil ein Dokument, das der Prüfer
 * wiedererkennt, schneller abgehakt ist.
 */

export type Rubrik =
  | 'zutritt'
  | 'zugang'
  | 'zugriff'
  | 'weitergabe'
  | 'eingabe'
  | 'auftrag'
  | 'verfuegbarkeit'
  | 'trennung'
  | 'ueberpruefung'

export const RUBRIKEN: Record<Rubrik, string> = {
  zutritt: 'Zutrittskontrolle — wer physisch an die Anlage kommt',
  zugang: 'Zugangskontrolle — wer sich am System anmelden kann',
  zugriff: 'Zugriffskontrolle — wer welche Daten sehen und ändern darf',
  weitergabe: 'Weitergabekontrolle — Daten auf dem Transportweg',
  eingabe: 'Eingabekontrolle — wer wann was geändert hat',
  auftrag: 'Auftragskontrolle — Verarbeitung nur nach Weisung',
  verfuegbarkeit: 'Verfügbarkeit und Belastbarkeit',
  trennung: 'Trennungsgebot — Daten verschiedener Auftraggeber',
  ueberpruefung: 'Überprüfung, Bewertung und Evaluierung (Art. 32 Abs. 1 lit. d)',
}

export type Stand =
  /** Steht im Code dieses Programms und ist nachgewiesen */
  | 'umgesetzt'
  /** Stellt die Plattform bereit — Sache des Vertrags mit ihr */
  | 'betreiber'
  /** Teilweise da, mit benannter Lücke */
  | 'teilweise'
  /** Noch nicht da */
  | 'offen'

export const STAND_TEXT: Record<Stand, string> = {
  umgesetzt: 'umgesetzt',
  betreiber: 'durch den Betreiber',
  teilweise: 'teilweise',
  offen: 'offen',
}

export interface Massnahme {
  id: string
  rubrik: Rubrik
  bezeichnung: string
  /** Was genau geschieht — in Sätzen, nicht in Stichworten */
  beschreibung: string
  stand: Stand
  /** Die Datei, in der es steht. Ein Test prüft, dass es sie gibt. */
  beleg?: string
  /** Was noch fehlt — Pflicht, sobald der Stand nicht „umgesetzt" ist */
  luecke?: string
}

export const MASSNAHMEN: Massnahme[] = [
  // ── Zutritt ──────────────────────────────────────────────────────────────
  {
    id: 'zutritt-rechenzentrum',
    rubrik: 'zutritt',
    bezeichnung: 'Rechenzentrum',
    beschreibung:
      'Das Programm und die Datenbank laufen bei Railway in Rechenzentren '
      + 'innerhalb der Europäischen Union. Eigene Geräte, auf die jemand '
      + 'zugreifen könnte, gibt es nicht — es existiert kein Server im Büro '
      + 'und keine lokale Kopie der Datenbank.',
    stand: 'betreiber',
    luecke:
      'Der physische Schutz ist Sache des Betreibers und Gegenstand des '
      + 'Vertrags mit ihm. Der Nachweis ist dessen Zertifizierung, nicht unser '
      + 'Code.',
  },

  // ── Zugang ───────────────────────────────────────────────────────────────
  {
    id: 'zugang-passwort',
    rubrik: 'zugang',
    bezeichnung: 'Passwörter werden nie im Klartext gespeichert',
    beschreibung:
      'Passwörter liegen als bcrypt-Wert mit Kostenfaktor 12. Aus der '
      + 'Datenbank lässt sich ein Passwort damit nicht zurückrechnen; selbst '
      + 'wer die ganze Tabelle hätte, müsste jedes Passwort einzeln raten.',
    stand: 'umgesetzt',
    beleg: 'src/lib/auth.ts',
  },
  {
    id: 'zugang-bremse',
    rubrik: 'zugang',
    bezeichnung: 'Schutz gegen Durchprobieren',
    beschreibung:
      'Fehlversuche werden je Konto und je Absenderadresse gezählt. Nach zehn '
      + 'Versuchen auf ein Konto oder vierzig von einer Verbindung innerhalb '
      + 'einer Viertelstunde wird für eine Viertelstunde abgewiesen. Die Sperre '
      + 'läuft von selbst ab — eine dauerhafte Kontosperre wäre eine Waffe '
      + 'gegen jeden, dessen E-Mail-Adresse bekannt ist. Die Adresse wird nur '
      + 'als gesalzenes Kürzel abgelegt, nicht im Klartext.',
    stand: 'umgesetzt',
    beleg: 'src/lib/anmeldeschutz.ts',
  },
  {
    id: 'zugang-zweiter-faktor',
    rubrik: 'zugang',
    bezeichnung: 'Zweiter Faktor',
    beschreibung:
      'Für jedes Konto lässt sich ein zweiter Faktor einschalten: eine '
      + 'Authenticator-App (TOTP) oder eine SMS. Der SMS-Weg ist auf fünf '
      + 'Versuche und zehn Minuten begrenzt; empfohlen wird die App, weil eine '
      + 'SMS nach NIST SP 800-63B durch SIM-Übernahme angreifbar ist.',
    stand: 'teilweise',
    beleg: 'src/lib/sms.ts',
    luecke:
      'Der zweite Faktor ist freiwillig und wird nicht erzwungen. Für Konten '
      + 'mit Zugriff auf Lohndaten gehört er zur Pflicht gemacht.',
  },
  {
    id: 'zugang-sitzung',
    rubrik: 'zugang',
    bezeichnung: 'Sitzungen',
    beschreibung:
      'Die Anmeldung liegt in einem signierten Cookie mit den Merkmalen '
      + 'httpOnly (kein Zugriff durch Skripte im Browser), secure (nur über '
      + 'verschlüsselte Verbindung) und sameSite=strict (kein Mitsenden von '
      + 'fremden Seiten aus, damit ein Klick auf einen fremden Link keine '
      + 'Aktion im Programm auslöst).',
    stand: 'teilweise',
    beleg: 'src/lib/session.ts',
    luecke:
      'Die Sitzung gilt dreißig Tage. Für ein Programm mit Lohn- und '
      + 'Gesundheitsdaten ist das lang; ein gestohlenes Gerät bleibt so lange '
      + 'angemeldet. Kürzere Laufzeit mit stiller Verlängerung wäre besser.',
  },

  // ── Zugriff ──────────────────────────────────────────────────────────────
  {
    id: 'zugriff-rollen',
    rubrik: 'zugriff',
    bezeichnung: 'Vier Rollen mit klarem Umfang',
    beschreibung:
      'Mitarbeiter sehen ausschließlich sich selbst. Die Standortleitung sieht '
      + 'ihren Standort. Die Unternehmensebene sieht ihr Unternehmen. Die '
      + 'Plattformrolle sieht keine Inhalte, sondern verwaltet Kunden und '
      + 'Zugänge. Entschieden wird das an EINER Stelle im Programm, nicht in '
      + 'jeder Ansicht einzeln — eine vergessene Prüfung in einer Ansicht wäre '
      + 'sonst ein Datenleck.',
    stand: 'umgesetzt',
    beleg: 'src/lib/scope.ts',
  },
  {
    id: 'zugriff-besondere-daten',
    rubrik: 'zugriff',
    bezeichnung: 'Gesundheitsdaten enger als der Rest',
    beschreibung:
      'Das betriebliche Eingliederungsmanagement (Art. 9 DSGVO) sieht die '
      + 'Standortleitung standardmäßig NICHT; die Unternehmensebene muss es '
      + 'ausdrücklich freischalten. Auch Pflichtnachweise lassen sich je Art '
      + 'auf „nur Unternehmensebene" stellen — und was nicht sichtbar ist, '
      + 'erscheint gar nicht erst in der Antwort, nicht ausgegraut.',
    stand: 'umgesetzt',
    beleg: 'src/app/api/bem/route.ts',
  },
  {
    id: 'zugriff-support',
    rubrik: 'zugriff',
    bezeichnung: 'Supportzugriff nur auf Freigabe des Kunden',
    beschreibung:
      'OKUN kann sich keinen Zugang zu Kundendaten verschaffen. Der Kunde '
      + 'erteilt ihn selbst, befristet auf eine feste Stundenzahl, jederzeit '
      + 'widerrufbar — und jeder Abruf währenddessen wird einzeln '
      + 'protokolliert.',
    stand: 'umgesetzt',
    beleg: 'src/app/api/support-access-grants/route.ts',
  },

  // ── Weitergabe ───────────────────────────────────────────────────────────
  {
    id: 'weitergabe-transport',
    rubrik: 'weitergabe',
    bezeichnung: 'Verschlüsselte Übertragung',
    beschreibung:
      'Der Zugang läuft ausschließlich über HTTPS. Die Verbindung zur '
      + 'Datenbank bleibt innerhalb des Netzes des Betreibers und verlässt es '
      + 'nicht.',
    stand: 'betreiber',
    luecke: 'Zertifikat und Netz stellt der Betreiber; Nachweis über dessen Vertrag.',
  },
  {
    id: 'weitergabe-dateien',
    rubrik: 'weitergabe',
    bezeichnung: 'Personalunterlagen werden nicht zwischengespeichert',
    beschreibung:
      'Verträge, Bescheinigungen und Lohnbelege gehen mit der Anweisung '
      + '„private, no-store" heraus. Sie landen damit weder in einem '
      + 'Zwischenspeicher des Browsers noch in einem Vermittler auf dem Weg.',
    stand: 'umgesetzt',
    beleg: 'src/app/api/files/[id]/route.ts',
  },
  {
    id: 'weitergabe-auskunft',
    rubrik: 'weitergabe',
    bezeichnung: 'Auskunft ohne fremde Daten',
    beschreibung:
      'Die Auskunft nach Art. 15 DSGVO kürzt, wo andere betroffen sind: Eine '
      + 'Vertretungsanfrage nennt Kollegen, ein Dienstplan zeigt, wer sonst '
      + 'Schicht hatte. Auskunft heißt „Ihre Daten", nicht „alles, wo Ihr Name '
      + 'vorkommt".',
    stand: 'umgesetzt',
    beleg: 'src/lib/dsgvo-auskunft.ts',
  },

  // ── Eingabe ──────────────────────────────────────────────────────────────
  {
    id: 'eingabe-protokoll',
    rubrik: 'eingabe',
    bezeichnung: 'Änderungsprotokoll',
    beschreibung:
      'Anlegen, Ändern, Löschen, Exportieren und fehlgeschlagene Anmeldungen '
      + 'werden mit Zeitpunkt, handelndem Konto und betroffenem Datensatz '
      + 'festgehalten. Das Protokoll selbst wird nicht gelöscht, sondern '
      + 'gesperrt aufbewahrt — sonst ließe sich die Spur mit der Tat '
      + 'beseitigen.',
    stand: 'umgesetzt',
    beleg: 'src/lib/audit.ts',
  },
  {
    id: 'eingabe-loeschbericht',
    rubrik: 'eingabe',
    bezeichnung: 'Jede Löschung hinterlässt einen Bericht',
    beschreibung:
      'Der Bericht hält je Datenart fest, was entfernt wurde und was bleiben '
      + 'musste — mit Begründung, ohne Personendaten. Ohne ihn ließe sich '
      + 'gegenüber der Aufsicht weder belegen, dass gelöscht wurde, noch '
      + 'warum etwas blieb.',
    stand: 'umgesetzt',
    beleg: 'src/lib/dsgvo-loeschung.ts',
  },

  // ── Auftrag ──────────────────────────────────────────────────────────────
  {
    id: 'auftrag-weisung',
    rubrik: 'auftrag',
    bezeichnung: 'Verarbeitung nur im Auftrag',
    beschreibung:
      'OKUN verarbeitet die Daten der Kunden ausschließlich für den Betrieb '
      + 'des Programms. Es findet keine Auswertung über Kunden hinweg statt, '
      + 'keine Weitergabe an Dritte zu eigenen Zwecken und kein Training von '
      + 'Sprachmodellen mit Kundendaten.',
    stand: 'umgesetzt',
    beleg: 'src/lib/assistent.ts',
  },
  {
    id: 'auftrag-unterauftrag',
    rubrik: 'auftrag',
    bezeichnung: 'Unterauftragsverarbeiter',
    beschreibung:
      'Die eingesetzten Dienstleister sind im Verarbeitungsverzeichnis einzeln '
      + 'aufgeführt, mit Zweck, Sitz und Stand des Vertrags.',
    stand: 'teilweise',
    beleg: 'src/lib/dsgvo-verzeichnis.ts',
    luecke:
      'Die Verträge zur Auftragsverarbeitung mit den Dienstleistern sind noch '
      + 'nicht durchgängig geschlossen. Der Stand steht je Dienstleister im '
      + 'Verzeichnis.',
  },

  // ── Verfügbarkeit ────────────────────────────────────────────────────────
  {
    id: 'verfuegbarkeit-sicherung',
    rubrik: 'verfuegbarkeit',
    bezeichnung: 'Sicherungen',
    beschreibung:
      'Die Datenbank wird vom Betreiber gesichert. Personalunterlagen liegen '
      + 'bewusst IN der Datenbank und nicht auf der Festplatte des Dienstes — '
      + 'die ist nach jedem Neustart leer und wäre für Arbeitsverträge '
      + 'untauglich. Damit sind sie von derselben Sicherung erfasst wie alles '
      + 'andere.',
    stand: 'betreiber',
    beleg: 'src/lib/file-storage.ts',
    luecke:
      'Ein dokumentierter Wiederherstellungstest fehlt. Eine Sicherung, die nie '
      + 'zurückgespielt wurde, ist eine Vermutung.',
  },
  {
    id: 'verfuegbarkeit-offline',
    rubrik: 'verfuegbarkeit',
    bezeichnung: 'Arbeiten ohne Netz',
    beschreibung:
      'Stempelzeiten und Anträge, die im Funkloch entstehen, werden auf dem '
      + 'Gerät gehalten und später nachgereicht. Sie gehen nicht verloren, '
      + 'wenn das Netz fehlt.',
    stand: 'umgesetzt',
    beleg: 'src/lib/warteschlange.ts',
  },

  // ── Trennung ─────────────────────────────────────────────────────────────
  {
    id: 'trennung-mandanten',
    rubrik: 'trennung',
    bezeichnung: 'Daten verschiedener Kunden bleiben getrennt',
    beschreibung:
      'Jeder Datensatz trägt die Kennung seines Kunden, und jede Abfrage '
      + 'schränkt darauf ein. Geprüft wird das nicht nur im Programm, sondern '
      + 'an jedem Nachweis gegen das laufende System: Zu jeder Fähigkeit gibt '
      + 'es die Gegenprobe, ob eine fremde Leitung dasselbe kann.',
    stand: 'umgesetzt',
    beleg: 'pruefungen/README.md',
  },

  // ── Überprüfung ──────────────────────────────────────────────────────────
  {
    id: 'ueberpruefung-nachweise',
    rubrik: 'ueberpruefung',
    bezeichnung: 'Automatische Prüfung vor jedem Ausrollen',
    beschreibung:
      'Bei jedem Push laufen Typprüfung, Datenbankwanderung, Modultests, Bau '
      + 'und über tausend Nachweise gegen ein frisch aufgesetztes System. Ein '
      + 'großer Teil davon sind Gegenproben auf Berechtigungen. Schlägt einer '
      + 'fehl, geht nichts raus.',
    stand: 'umgesetzt',
    beleg: '.github/workflows/pruefen.yml',
  },
  {
    id: 'ueberpruefung-datenkatalog',
    rubrik: 'ueberpruefung',
    bezeichnung: 'Das Löschkonzept kann nicht veralten',
    beschreibung:
      'Ein Test liest das Datenbankschema und hält es gegen den Datenkatalog. '
      + 'Kommt eine neue Tabelle mit Personenbezug dazu und wird nicht '
      + 'eingetragen, schlägt der Test fehl — nicht erst die Aufsichtsbehörde.',
    stand: 'umgesetzt',
    beleg: 'src/lib/__tests__/dsgvo-katalog.test.ts',
  },
]

/** Die Maßnahmen einer Rubrik. */
export function nachRubrik(r: Rubrik): Massnahme[] {
  return MASSNAHMEN.filter(m => m.rubrik === r)
}

/**
 * Was offen ist — der Teil, den man einem Prüfer von selbst zeigt.
 *
 * Eine TOM-Liste ohne Lücken glaubt niemand, und zu Recht: Sie sagt nur, dass
 * niemand genau hingesehen hat. Die benannte Lücke mit Begründung ist die
 * belastbarere Aussage.
 */
export function offenePunkte(): Massnahme[] {
  return MASSNAHMEN.filter(m => m.stand !== 'umgesetzt')
}

export function zusammenfassung(): Record<Stand, number> {
  const z: Record<Stand, number> = {
    umgesetzt: 0, betreiber: 0, teilweise: 0, offen: 0,
  }
  for (const m of MASSNAHMEN) z[m.stand]++
  return z
}
