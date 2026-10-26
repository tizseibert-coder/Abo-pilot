'use client';

export function ConfirmSubmit({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="secondary"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}>
      Drucken / als PDF speichern
    </button>
  );
}
