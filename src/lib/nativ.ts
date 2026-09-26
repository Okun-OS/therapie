/**
 * §139 Die Brücke zur nativen Hülle.
 *
 * Dieselbe Anwendung läuft an drei Orten: im Browser am Schreibtisch, als
 * Web-App auf dem Startbildschirm und in der Hülle aus dem App Store. Der
 * Unterschied darf nicht durch den ganzen Programmtext sickern — sonst steht
 * überall „wenn App, dann anders", und niemand weiß mehr, was wo passiert.
 *
 * Deshalb liegt der Unterschied hier, an einer Stelle, und zwar nach einer
 * festen Regel: JEDE Funktion hier funktioniert auch ohne Hülle. Die Kamera
 * fällt auf die Dateiauswahl zurück, die Sperre auf „keine Sperre", die
 * Push-Anmeldung auf den Weg über den Browser. Nichts hier darf eine Seite
 * kaputtmachen, die jemand am Schreibtisch öffnet.
 *
 * Geladen wird alles erst beim Gebrauch (`await import`). Sonst schleppte
 * jeder Seitenaufruf im Browser die nativen Teile mit, die er nie braucht.
 */

export type Plattform = 'ios' | 'android' | 'web'

/** Läuft das hier in der nativen Hülle — oder nur im Browser? */
export function istApp(): boolean {
  if (typeof window === 'undefined') return false
  const c = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return c?.isNativePlatform?.() === true
}

export function plattform(): Plattform {
  if (typeof window === 'undefined') return 'web'
  const c = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  const p = c?.getPlatform?.()
  return p === 'ios' || p === 'android' ? p : 'web'
}

// ── Kamera ─────────────────────────────────────────────────────────────────

/**
 * Ein Foto aufnehmen — für den Krankenschein.
 *
 * Im Browser gibt es `null` zurück; dort übernimmt das Dateifeld mit
 * `capture="environment"`, das auf dem Telefon ebenfalls die Kamera öffnet.
 * Der Unterschied ist der Weg zurück: Die Hülle liefert ein fertig
 * verkleinertes Bild. Ein Krankenschein aus einer 12-Megapixel-Kamera sind
 * fünf Megabyte — im Funkloch überträgt sich das nicht.
 */
export async function kameraFoto(): Promise<File | null> {
  if (!istApp()) return null
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    const foto = await Camera.getPhoto({
      quality: 70,
      // Ein Blatt Papier braucht keine volle Auflösung, aber es muss lesbar
      // bleiben: Auf dem Krankenschein stehen Daten, die über Lohnfortzahlung
      // entscheiden.
      width: 1600,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      // Fragen statt bestimmen: Wer den Schein schon abfotografiert hat,
      // nimmt ihn aus der Galerie.
      source: CameraSource.Prompt,
      promptLabelHeader: 'Bescheinigung',
      promptLabelPhoto: 'Aus der Galerie wählen',
      promptLabelPicture: 'Foto aufnehmen',
      promptLabelCancel: 'Abbrechen',
    })
    if (!foto.webPath) return null
    const daten = await fetch(foto.webPath).then(r => r.blob())
    const endung = foto.format || 'jpeg'
    return new File([daten], `bescheinigung.${endung}`, { type: `image/${endung}` })
  } catch {
    // Abgebrochen oder keine Erlaubnis — beides ist keine Störung, sondern
    // eine Entscheidung. Der Aufrufer zeigt dann einfach nichts an.
    return null
  }
}

// ── Face ID und Fingerabdruck ──────────────────────────────────────────────

export interface Biometrielage {
  moeglich: boolean
  /** Wie es auf diesem Gerät heißt — „Face ID" ist kein „Fingerabdruck" */
  name: string
}

export async function biometrielage(): Promise<Biometrielage> {
  if (!istApp()) return { moeglich: false, name: '' }
  try {
    const { BiometricAuth, BiometryType } = await import('@aparajita/capacitor-biometric-auth')
    const lage = await BiometricAuth.checkBiometry()
    const namen: Record<number, string> = {
      [BiometryType.touchId]: 'Touch ID',
      [BiometryType.faceId]: 'Face ID',
      [BiometryType.fingerprintAuthentication]: 'Fingerabdruck',
      [BiometryType.faceAuthentication]: 'Gesichtserkennung',
      [BiometryType.irisAuthentication]: 'Iriserkennung',
    }
    return {
      moeglich: lage.isAvailable,
      name: namen[lage.biometryType] ?? 'Gerätesperre',
    }
  } catch {
    return { moeglich: false, name: '' }
  }
}

/**
 * Nach dem Gesicht oder dem Finger fragen.
 *
 * `true` heißt: erkannt. Alles andere heißt `false` — auch der Abbruch. Die
 * Sperre lässt im Zweifel NICHT durch; bei Lohn- und Personaldaten ist das
 * die einzig vertretbare Richtung.
 */
export async function biometriePruefen(grund: string): Promise<boolean> {
  if (!istApp()) return false
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
    await BiometricAuth.authenticate({
      reason: grund,
      cancelTitle: 'Abbrechen',
      androidTitle: 'OKUN Workforce',
      androidSubtitle: grund,
      // Wer den Finger nicht ans Telefon bekommt (Handschuhe, Pflegehandschuhe,
      // Verband), muss trotzdem an seinen Dienstplan kommen.
      allowDeviceCredential: true,
      iosFallbackTitle: 'Code eingeben',
    })
    return true
  } catch {
    return false
  }
}

// ── Push ───────────────────────────────────────────────────────────────────

export interface PushErgebnis {
  ok: boolean
  /** Warum es nicht ging — für die Anzeige, nicht fürs Protokoll */
  grund?: string
}

/**
 * Für native Benachrichtigungen anmelden.
 *
 * Der Unterschied zum Browser ist kein Detail: Eine Web-Benachrichtigung
 * erreicht ein iPhone nur, wenn die Seite auf dem Startbildschirm liegt und
 * der Dienst-Arbeiter lebt. Der native Weg (APNs, FCM) erreicht das Telefon
 * auch dann, wenn die App seit Tagen zu ist — und genau das braucht ein
 * kurzfristiger Ausfall um sechs Uhr morgens.
 */
export async function pushAnmelden(): Promise<PushErgebnis> {
  if (!istApp()) return { ok: false, grund: 'nicht die App' }
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const erlaubnis = await PushNotifications.requestPermissions()
    if (erlaubnis.receive !== 'granted') {
      return { ok: false, grund: 'keine Erlaubnis' }
    }

    // §139 Auf Android muss der Kanal existieren, BEVOR eine Nachricht mit
    // seinem Namen ankommt — sonst verschluckt das System sie wortlos. Der
    // Server schickt `channel_id: 'okun'`; beides muss zusammenpassen.
    if (plattform() === 'android') {
      await PushNotifications.createChannel({
        id: 'okun',
        name: 'Dienst und Schicht',
        description: 'Ausfälle, Planänderungen, Anträge und Nachrichten.',
        importance: 5,
        visibility: 0,   // nicht im Sperrbildschirm: es geht um Personaldaten
      }).catch(() => {})
    }

    // Die Kennung des Geräts kommt erst als Ereignis zurück, nicht als
    // Rückgabewert. Also warten — aber nicht ewig.
    const kennung = await new Promise<string | null>(fertig => {
      let erledigt = false
      const schluss = (wert: string | null) => {
        if (erledigt) return
        erledigt = true
        fertig(wert)
      }
      PushNotifications.addListener('registration', t => schluss(t.value))
      PushNotifications.addListener('registrationError', () => schluss(null))
      PushNotifications.register()
      setTimeout(() => schluss(null), 15000)
    })

    if (!kennung) return { ok: false, grund: 'keine Gerätekennung' }

    const r = await fetch('/api/push/geraet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kennung, plattform: plattform() }),
    })
    if (!r.ok) return { ok: false, grund: 'konnte nicht hinterlegt werden' }
    // Merken, um das Gerät beim Abmelden wieder austragen zu können.
    try { window.localStorage.setItem(GERAET_SCHLUESSEL, kennung) } catch { /* egal */ }
    return { ok: true }
  } catch {
    return { ok: false, grund: 'unerwarteter Fehler' }
  }
}

const GERAET_SCHLUESSEL = 'okun_geraetekennung'

/**
 * Das Gerät beim Abmelden wieder austragen.
 *
 * Ohne das bekäme das Telefon weiter Benachrichtigungen für jemanden, der sich
 * abgemeldet hat. Auf einem geteilten Diensttelefon stünde der nächste Ausfall
 * der Vorgängerin im Sperrbildschirm des Nachfolgers.
 */
export async function pushAbmelden(): Promise<void> {
  if (typeof window === 'undefined') return
  let kennung: string | null = null
  try { kennung = window.localStorage.getItem(GERAET_SCHLUESSEL) } catch { return }
  if (!kennung) return
  try { window.localStorage.removeItem(GERAET_SCHLUESSEL) } catch { /* egal */ }
  // Ohne `keepalive` bricht der Aufruf mitten im Abmelden ab, wenn die Seite
  // schon wechselt — und das Gerät bliebe eingetragen.
  await fetch('/api/push/geraet', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kennung }),
    keepalive: true,
  }).catch(() => {})
}

/**
 * Was passiert, wenn jemand auf eine Benachrichtigung tippt.
 *
 * Ohne das landet er auf der Startseite und sucht selbst — bei „Dienst am
 * Samstag frei geworden" ist das genau die Reibung, die dazu führt, dass
 * niemand einspringt.
 */
export async function pushAntippenBehandeln(gehe: (pfad: string) => void): Promise<void> {
  if (!istApp()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.addListener('pushNotificationActionPerformed', e => {
      const ziel = e.notification.data?.url
      if (typeof ziel === 'string' && ziel.startsWith('/')) gehe(ziel)
    })
  } catch { /* ohne Hülle gibt es nichts zu behandeln */ }
}

// ── Anzeige ────────────────────────────────────────────────────────────────

/**
 * Den oberen Rand richtig einfärben und den Startbildschirm wegnehmen.
 *
 * Klingt nach Kosmetik, ist aber der erste Eindruck: Eine Hülle, die eine
 * weiße Statusleiste über dunklem Kopf zeigt, sieht aus wie ein Lesezeichen —
 * und genau danach sucht die Prüfung bei Apple.
 */
export async function anzeigeEinrichten(): Promise<void> {
  if (!istApp()) return
  try {
    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
    ])
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    if (plattform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#1A1D1F' }).catch(() => {})
    }
    await SplashScreen.hide().catch(() => {})
  } catch { /* nicht schlimm */ }
}
