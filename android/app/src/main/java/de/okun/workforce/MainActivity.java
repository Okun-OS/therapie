package de.okun.workforce;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * §280 Die Hülle — und was sie tut, wenn kein Netz da ist.
 *
 * GEMELDET nach dem ersten Lauf aus dem Play Store: „Offline geht nix." Die
 * App zeigte im Flugmodus einen schwarzen Bildschirm.
 *
 * WARUM DER DIENST-ARBEITER DAS NICHT LÖST
 * Er greift in einer Android-WebView nur in Nachladungen einer bereits
 * geladenen Seite ein, nicht in die oberste Navigation. Der Aufruf von
 * okun-workforce.com scheitert also unterhalb von ihm; er kommt gar nicht
 * zum Zug. Was ohne Netz bleibt, ist allein, was IM Programm liegt.
 *
 * WAS HIER DESHALB PASSIERT
 * 1. Beim Start wird gefragt, ob überhaupt ein Netz da ist. Wenn nicht, wird
 *    die mitgelieferte Seite geladen, statt es mit dem Server zu versuchen.
 *    Capacitor hat dafür eine eigene Vorkehrung (`errorPath` bei einem Fehler
 *    der Hauptseite) — die ist auf dem Gerät nicht angesprungen, und ein
 *    schwarzer Bildschirm ist das schlechteste aller Ergebnisse. Gefragt wird
 *    deshalb selbst, bevor es schiefgehen kann.
 *
 * 2. In jede Seite der WebView wird ein kleines Objekt gelegt, `OkunOffline`.
 *    Die mitgelieferte Seite läuft unter `https://localhost` und sieht den
 *    Speicher der Anwendung nicht — über dieses Objekt bekommt sie trotzdem,
 *    was sie anzeigen soll, und gibt zurück, was jemand ohne Netz gestempelt
 *    hat.
 *
 * WAS HIER NICHT PASSIERT
 * Senden. Gestempeltes wird nur gemerkt. Abgeschickt wird es von der
 * Anwendung über die bestehende Warteschlange, die Wiederholung, Reihenfolge
 * und Beurteilung der Antwort schon kennt.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        /*
         * Die Brücke wird eingehängt, sobald es eine WebView gibt. Für die
         * Offline-Seite ist das sicher früh genug: Die wird gleich darunter
         * selbst geladen, und bei einem Seitenaufbau ist das Objekt da.
         *
         * Beim Start MIT Netz kann es sein, dass die erste Seite sie noch
         * nicht sieht — Android hängt ein solches Objekt erst beim nächsten
         * Seitenaufbau ein. Die Anwendung kommt damit zurecht: Sie legt ihren
         * Stand bei jedem Laden neu ab, nicht nur einmal.
         */
        getBridge()
            .getWebView()
            .addJavascriptInterface(new OkunOffline(this, getBridge().getAppUrl()), "OkunOffline");

        if (!netzVorhanden()) {
            String notfall = getBridge().getErrorUrl();
            if (notfall != null) {
                getBridge().getWebView().loadUrl(notfall);
            }
        }
    }

    /**
     * Ist überhaupt ein Netz da?
     *
     * Gefragt wird nach der Fähigkeit, nicht nach der Erreichbarkeit unseres
     * Servers — das wäre ein Netzaufruf und würde den Start verzögern. Im
     * Zweifel wird „ja" angenommen: Ein unnötiger Versuch kostet eine
     * Sekunde, eine unnötige Offline-Seite kostet das Vertrauen.
     */
    private boolean netzVorhanden() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        Network netz = cm.getActiveNetwork();
        if (netz == null) return false;
        NetworkCapabilities faehig = cm.getNetworkCapabilities(netz);
        return faehig != null && faehig.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    /**
     * Das Objekt, das in jeder Seite der WebView unter `OkunOffline` steht.
     *
     * Bewusst winzig: Es liest und schreibt zwei Werte in den Einstellungen
     * der App, mehr nicht. Kein Dateizugriff, kein Netz, keine Weitergabe von
     * irgendetwas an irgendwen. Ein solches Objekt ist in JEDER Seite der
     * WebView sichtbar — deshalb darf es nichts können, was in fremden Händen
     * gefährlich wäre.
     */
    public static class OkunOffline {

        private static final String DATEI = "okun_offline";
        private static final String SCHNAPPSCHUSS = "schnappschuss";
        private static final String STEMPEL = "stempel";
        /** Mehr als das ist kein Arbeitstag mehr, sondern ein Fehler. */
        private static final int HOECHSTENS = 50;
        /** Grobe Obergrenze gegen eine Seite, die den Speicher vollschreibt. */
        private static final int ZEICHEN_GRENZE = 20_000;

        private final SharedPreferences speicher;
        private final String appAdresse;

        OkunOffline(Context ctx, String appAdresse) {
            this.speicher = ctx.getSharedPreferences(DATEI, Context.MODE_PRIVATE);
            this.appAdresse = appAdresse == null ? "" : appAdresse;
        }

        /**
         * Wohin „Erneut versuchen" führt.
         *
         * Aus der Einstellung der Hülle, nicht fest eingetippt: Eine
         * Testanlage wird über `OKUN_APP_URL` angesteuert, und eine
         * Notfallseite, die stur auf die Hauptanlage zeigt, führte von dort
         * aus ins Leere.
         */
        @JavascriptInterface
        public String appAdresse() {
            return appAdresse;
        }

        @JavascriptInterface
        public void schnappschussSchreiben(String json) {
            if (json == null || json.length() > ZEICHEN_GRENZE) return;
            speicher.edit().putString(SCHNAPPSCHUSS, json).apply();
        }

        @JavascriptInterface
        public String schnappschussLesen() {
            return speicher.getString(SCHNAPPSCHUSS, "");
        }

        /**
         * Einen Stempel anhängen.
         *
         * Angehängt, nicht ersetzt: Wer im Funkloch kommt, Pause macht und
         * geht, hat drei Handgriffe gemacht, und alle drei müssen nachkommen.
         */
        @JavascriptInterface
        public void stempelMerken(String json) {
            if (json == null || json.length() > ZEICHEN_GRENZE) return;
            try {
                JSONObject neu = new JSONObject(json);
                JSONArray liste = gemerkte();
                if (liste.length() >= HOECHSTENS) return;
                liste.put(neu);
                speicher.edit().putString(STEMPEL, liste.toString()).apply();
            } catch (Exception egal) {
                // Eine unbrauchbare Zeile wird nicht gemerkt. Sie zu merken
                // hieße, sie später zwanzigmal gegen den Server zu schicken.
            }
        }

        @JavascriptInterface
        public String stempelHolen() {
            return gemerkte().toString();
        }

        /**
         * Erst leeren, wenn die Anwendung bestätigt hat, dass sie die Stempel
         * übernommen hat. Ein Absturz zwischen Holen und Einreihen wäre sonst
         * ein verlorener Arbeitstag.
         */
        @JavascriptInterface
        public void stempelLeeren() {
            speicher.edit().remove(STEMPEL).apply();
        }

        private JSONArray gemerkte() {
            try {
                String roh = speicher.getString(STEMPEL, "[]");
                return new JSONArray(roh == null || roh.isEmpty() ? "[]" : roh);
            } catch (Exception egal) {
                return new JSONArray();
            }
        }
    }
}
