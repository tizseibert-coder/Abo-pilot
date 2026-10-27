export default function Privacy() {
  return (
    <article style={{ maxWidth: 720 }}>
      <h1>Datenschutzerklärung</h1>
      <p className="notice small">Entwurf für die Beta. Vor dem öffentlichen Start durch eine Fachperson für Datenschutzrecht prüfen lassen.</p>
      <h2>Verantwortliche Stelle</h2>
      <p>[Abo-Pilot AG, Adresse, E-Mail datenschutz@…]</p>
      <h2>Welche Daten wir bearbeiten und wozu</h2>
      <ul>
        <li><strong>Konto:</strong> E-Mail, Passwort (nur als Hash), Name und Adresse – zur Anmeldung und für Ihre Kündigungsbriefe.</li>
        <li><strong>Verträge:</strong> Anbieter, Preis, Laufzeit, Fristen, Kunden-/Vertragsnummer – zur Fristenberechnung und für Wechselvergleiche.</li>
        <li><strong>Hochgeladene Rechnungen:</strong> werden nur im Arbeitsspeicher ausgelesen und nicht gespeichert. Gespeichert werden nur die Felder, die Sie bestätigen.</li>
      </ul>
      <h2>Wo die Daten liegen</h2>
      <p>Auf Servern in der Schweiz. Kein Verkauf und keine Vermietung von Daten.</p>
      <h2>Dienstleister (Auftragsbearbeiter)</h2>
      <ul>
        <li><strong>Foto-Erkennung (optional):</strong> Wenn Sie ein Foto einer Rechnung hochladen, wird es zur Auswertung an Anthropic (USA) übermittelt und dort nicht für Training verwendet. Grundlage: Ihre Einwilligung durch den Upload sowie vertragliche Garantien (Art. 16 DSG). Alternative ohne Übermittlung: QR-Code scannen (Auswertung nur in Ihrem Browser) oder Text einfügen.</li>
        <li><strong>Digitale Unterschrift:</strong> Skribble AG (Schweiz) für die qualifizierte elektronische Signatur.</li>
        <li><strong>Briefversand:</strong> Pingen AG (Schweiz) für eingeschriebene Briefe, nur wenn Sie den Postversand wählen.</li>
        <li><strong>E-Mail-Versand:</strong> Schweizer E-Mail-Anbieter für die Übermittlung Ihrer Kündigung an den Anbieter, mit Kopie an Sie.</li>
      </ul>
      <h2>Weitergabe</h2>
      <p>Daten gehen an Anbieter nur, wenn Sie einen Wechsel oder eine Kündigung selbst auslösen – dann genau das Schreiben, das Sie unterschrieben haben. Krankenkassen erhalten von uns keine Kontakt- oder Profildaten für Werbung oder Offerten.</p>
      <h2>Aufbewahrung und Löschung</h2>
      <p>Bis Sie Ihr Konto löschen. Die Löschung unter «Konto» ist sofort und endgültig. Sitzungen laufen nach 30 Tagen ab.</p>
      <h2>Ihre Rechte</h2>
      <p>Auskunft, Berichtigung, Löschung und Datenherausgabe (Art. 25 ff. DSG). Den Export finden Sie unter «Konto».</p>
      <h2>Cookies</h2>
      <p>Nur ein technisch notwendiges Sitzungs-Cookie. Kein Tracking, keine Werbe-Cookies.</p>
    </article>
  );
}
