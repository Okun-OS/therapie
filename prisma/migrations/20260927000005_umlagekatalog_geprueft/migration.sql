-- §176 Der Katalog ist geprueft.
--
-- Am 27.09.2026 wurden alle 79 Staende von 24 Kassen gegen die
-- Veroeffentlichung der jeweiligen Kasse gehalten — Webseite, Merkblatt oder
-- Rechengroessen-PDF. KEINE EINZIGE ABWEICHUNG. Zum Vergleich: Bei den
-- Pfaendungstabellen waren zwei von acht falsch.
--
-- Die Notiz haelt je Kasse fest, wogegen geprueft wurde und was dabei
-- herauskam. Wer im naechsten Jahr die neuen Saetze holt, sieht daran, was
-- beim letzten Mal wie belegt war.

UPDATE "UmlageKatalog" AS k SET
  "geprueft" = true,
  "notiz" = v.notiz,
  "updatedAt" = CURRENT_TIMESTAMP
FROM (VALUES
  ('AOK Baden-Württemberg', '27.09.2026 gegen aok.de/fk/bw: 50/60/70/80 % und U2 deckungsgleich'),
  ('AOK Bayern', '27.09.2026 gegen aok.de/fk/bayern: 50/60/70/80 % und U2 deckungsgleich'),
  ('AOK Bremen/Bremerhaven', '27.09.2026 gegen aok.de/fk/bremen: 50/60/70 % und U2 deckungsgleich'),
  ('AOK Hessen', '27.09.2026 gegen aok.de/fk/hessen: 50/60/70/80 % und U2 deckungsgleich'),
  ('AOK Niedersachsen', '27.09.2026 gegen aok.de/fk/niedersachsen: 55/65/75 % und U2 deckungsgleich'),
  ('AOK NordWest', '27.09.2026 gegen aok.de/fk/nordwest: 50/60/70/80 % und U2 deckungsgleich'),
  ('AOK Nordost', '27.09.2026 gegen aok.de/fk/nordost: 55/65 % und U2 deckungsgleich'),
  ('AOK PLUS', '27.09.2026 gegen aok.de/fk/plus: 50/65 % und U2 deckungsgleich'),
  ('AOK Rheinland-Pfalz/Saarland', '27.09.2026 gegen aok.de/fk/rps: 50/60/70/80 % und U2 deckungsgleich'),
  ('AOK Rheinland/Hamburg', '27.09.2026 gegen aok.de/fk/rh: 50/60/70 % und U2 deckungsgleich'),
  ('AOK Sachsen-Anhalt', '27.09.2026 gegen aok.de/fk/sachsen-anhalt: 40/50/70 % deckungsgleich, auch die Anhebung der U2 von 0,43 auf 0,49 % zum 1.7.'),
  ('BARMER', '27.09.2026 gegen barmer.de: 50/65/80 % und U2 deckungsgleich'),
  ('BIG direkt gesund', '27.09.2026 gegen big-direkt.de: 60/80 % und U2 deckungsgleich'),
  ('DAK-Gesundheit', '27.09.2026 gegen dak.de: beide Zeitraeume deckungsgleich, auch die Absenkung zum 1.9.'),
  ('IKK classic', '27.09.2026 gegen die Rechengroessen der IKK classic (Stand 01.01.2026 und 01.08.2026): beide Staende deckungsgleich, auch die Senkung zum 1.8.'),
  ('KNAPPSCHAFT', '27.09.2026 gegen das Merkblatt der Knappschaft (Jan 2026) und die Pressemitteilung vom 9.12.2025: U1 0,80 % (gesenkt von 1,1 %) bei 80 % Erstattung, U2 0,22 %'),
  ('Kaufmännische Krankenkasse – KKH', '27.09.2026 gegen kkh.de: 50/70/80 % und U2 deckungsgleich'),
  ('Pronova BKK', '27.09.2026 gegen pronovabkk.de: 50/60 % und U2 deckungsgleich'),
  ('SBK Siemens-Betriebskrankenkasse', '27.09.2026 gegen sbk.org: 50/70 % und U2 deckungsgleich'),
  ('SECURVITA Krankenkasse', '27.09.2026 gegen securvita.de: 50/60/80 % und U2 deckungsgleich'),
  ('Techniker Krankenkasse', '27.09.2026 gegen tk.de: 50/70/80 % und U2 deckungsgleich'),
  ('VIACTIV Krankenkasse', '27.09.2026 gegen die Beitragsuebersicht 2026 der VIACTIV: 50/60/80 % und U2 deckungsgleich. Die Webseite fuehrt dieselben Zahlen noch als Stand 2025 — massgeblich ist das Dokument fuer 2026'),
  ('hkk Krankenkasse (Handelskrankenkasse)', '27.09.2026 gegen hkk.de: 50/60/80 % und U2 deckungsgleich'),
  ('mhplus Betriebskrankenkasse', '27.09.2026 gegen mhplus-krankenkasse.de: 50/70/80 % und U2 deckungsgleich')
) AS v(kasse, notiz)
WHERE k."kasse" = v.kasse;
