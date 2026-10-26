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
      <p>Auf Servern in der Schweiz. Keine Bekanntgabe ins Ausland, kein Verkauf und keine Vermietung von Daten.</p>
      <h2>Weitergabe</h2>
      <p>Daten gehen an Anbieter nur, wenn Sie einen Wechsel selbst auslösen. An Krankenkassen geben wir keine Daten weiter.</p>
      <h2>Aufbewahrung und Löschung</h2>
      <p>Bis Sie Ihr Konto löschen. Die Löschung unter «Konto» ist sofort und endgültig. Sitzungen laufen nach 30 Tagen ab.</p>
      <h2>Ihre Rechte</h2>
      <p>Auskunft, Berichtigung, Löschung und Datenherausgabe (Art. 25 ff. DSG). Den Export finden Sie unter «Konto».</p>
      <h2>Cookies</h2>
      <p>Nur ein technisch notwendiges Sitzungs-Cookie. Kein Tracking, keine Werbe-Cookies.</p>
    </article>
  );
}
