# Die Domain einrichten — okun-workforce.com

Die Domain liegt bei **Squarespace**, die Anwendung läuft bei **Railway**.
Beides muss einmal verbunden werden. Rechne mit einer halben Stunde Arbeit
und bis zu zwei Stunden Warten.

> **Sie zeigt direkt auf die nackte Domain** — `okun-workforce.com`, ohne
> `app.` und ohne `www.` davor. Website und Anmeldung sind dieselbe Seite;
> eine Unterdomain wäre hier falsch.

---

## Was du wissen musst, bevor du anfängst

Eine Domain zeigt über einen Eintrag im DNS auf einen Server. Für die nackte
Domain (bei Squarespace heißt sie `@`) gibt es dafür zwei Arten von Einträgen:

- **A-Record** — zeigt auf eine feste IP-Adresse. **Railway hat keine feste
  IP**, also fällt der aus.
- **ALIAS-Record** — zeigt auf einen Namen und löst ihn laufend nach.
  **Das ist der richtige.** Squarespace kann ihn, Railway akzeptiert ihn.

Ein normaler **CNAME** geht auf der nackten Domain nicht — das verbieten die
DNS-Regeln selbst, nicht Squarespace. Für `www.` ist CNAME dagegen richtig.

---

## Schritt 1 — Bei Railway die Domain anmelden

**Zuerst hier, nicht bei Squarespace.** Railway nennt dir erst danach die
Werte, die du drüben eintragen musst.

1. Railway öffnen → das Projekt → den Service, auf dem **die App** läuft
   (nicht `solver`, nicht die Datenbank)
2. **Settings → Networking → Custom Domain**
3. `okun-workforce.com` eintragen
4. Dasselbe noch einmal für `www.okun-workforce.com`

Railway zeigt dir daraufhin **zwei Zeilen je Domain**: einen Zielnamen (etwas
wie `abc123.up.railway.app`) und einen TXT-Eintrag zur Bestätigung.

> **Beide sind nötig.** Ohne den TXT-Eintrag liefert die Domain später einen
> 404 — die Seite ist dann da, aber Railway weiß nicht, dass sie dir gehört.

**Schreib dir die vier Werte auf** oder lass das Fenster offen.

---

## Schritt 2 — Bei Squarespace die alten Einträge entfernen

Squarespace zeigt die Domain gerade auf sein eigenes Hosting. Diese Einträge
**kollidieren** mit dem ALIAS und müssen weg, sonst lässt Squarespace den
neuen Eintrag gar nicht erst zu.

Squarespace → **Domains** → `okun-workforce.com` → **DNS** → **DNS Settings**

Unter *Custom Records* entfernen:

| Typ | Name | Was da steht |
|---|---|---|
| A | `@` | `198.185.159.144` |
| A | `@` | `198.185.159.145` |
| A | `@` | `198.49.23.144` |
| A | `@` | `198.49.23.145` |
| CNAME | `www` | `ext-sq.squarespace.com` |

Das sind die vier Squarespace-Hosting-Adressen und die www-Weiterleitung
dorthin — Stand 28.09.2026, nachgeprüft. Stehen bei dir andere da, gilt
trotzdem: **alles mit Name `@` vom Typ A oder AAAA muss weg**, und `www` vom
Typ CNAME auch.

> **Finger weg von allem anderen.** MX, TXT mit `v=spf1`, DKIM, `_domainkey`,
> CAA — das ist E-Mail und Zertifikatskram. Wer die löscht, bekommt keine
> Post mehr.

---

## Schritt 3 — Die neuen Einträge setzen

Immer noch unter *Custom Records*, jetzt **Add record**:

| Typ | Name | Data |
|---|---|---|
| **ALIAS** | `@` | der Zielname von Railway, z. B. `abc123.up.railway.app` |
| **CNAME** | `www` | derselbe Zielname von Railway |
| **TXT** | wie Railway es nennt | der Bestätigungswert von Railway |

Hat Railway für `www` einen eigenen TXT genannt, den auch.

**Ohne Schrägstrich am Ende, ohne `https://` davor** — nur der nackte Name.

---

## Schritt 4 — Warten und prüfen

DNS-Änderungen brauchen Zeit; meist zehn Minuten, manchmal zwei Stunden.

Prüfen kannst du es ohne Hilfsmittel:

1. **Railway** zeigt neben der Domain einen Haken, sobald es passt
2. **`https://okun-workforce.com` aufrufen** — es muss die Anmeldeseite
   kommen, und das Schloss im Browser muss zu sein. Railway stellt das
   Zertifikat selbst aus, sobald der DNS-Eintrag greift; das dauert nach dem
   Haken noch ein paar Minuten.
3. **`https://www.okun-workforce.com`** — dasselbe Ergebnis

Kommt eine Squarespace-Seite, ist Schritt 2 nicht vollständig gewesen.
Kommt ein 404 von Railway, fehlt der TXT-Eintrag.

---

## Schritt 5 — Die Anwendung weiß noch nichts davon

Zwei Variablen bei Railway (Service der App → *Variables*):

```dotenv
APP_URL=https://okun-workforce.com
```

`APP_URL` steht in jedem Link, den das System per E-Mail verschickt —
Einladungen, Passwort zurücksetzen, Benachrichtigungen. Steht dort noch die
alte Adresse, führen alle Links dorthin.

Falls der Fehlerkreislauf läuft (`FEHLERKREISLAUF.md`), auch:

```dotenv
FUNDE_URL=https://okun-workforce.com
```

---

## Was schon eingetragen ist

Im Code ist die Domain seit dem 28.09.2026 die Voreinstellung — du musst
dort nichts tun:

| Wo | Was |
|---|---|
| `capacitor.config.ts` | die Telefon-Hülle lädt `okun-workforce.com` |
| `android/…/capacitor.config.json` · `ios/…/capacitor.config.json` | dasselbe in den erzeugten Dateien |
| `ios/App/App/Info.plist` | `WKAppBoundDomains` — ohne diesen Eintrag laufen in Apples WebView keine Dienst-Arbeiter, und der Offline-Zwischenspeicher (§138) wäre tot |
| `desktop/haupt.js` | das Programm für den Rechner zeigt dorthin |

Eine Testanlage erreicht man weiterhin über `OKUN_APP_URL` beim Bauen, ohne
den Code anzufassen.

---

## Wenn der ALIAS nicht greift

Squarespace steht nicht auf Railways Liste der ausdrücklich unterstützten
Anbieter — die nennt Cloudflare, DNSimple, Namecheap und bunny.net. Die
Technik passt (Squarespace bietet ALIAS an, Railway akzeptiert ALIAS), aber
eine Zusage von beiden Seiten ist das nicht.

Sollte es nach zwei Stunden nicht gehen, ist der Ausweg kein Drama:

1. Kostenloses Konto bei **Cloudflare**, Domain hinzufügen
2. Cloudflare liest die vorhandenen Einträge ein und nennt zwei Nameserver
3. Diese beiden bei Squarespace unter *Nameservers* eintragen
4. Bei Cloudflare für `@` einen **CNAME** auf den Railway-Zielnamen setzen —
   Cloudflare macht daraus automatisch das Richtige
5. **SSL/TLS muss auf „Full" stehen, nicht „Full (strict)"** — sonst
   Endlosschleife

Die Domain bleibt dabei bei Squarespace gekauft. Es zieht nur die Verwaltung
der DNS-Einträge um.
