/**
 * Application shell. Intentionally minimal — the harness is in place, the
 * screens are not. Start with `/build-screen client.overview`.
 *
 * The i18n runtime is NOT yet installed; that is Day-1 task 1 (see
 * context/40-architecture.md). Until it is, `// i18n-exempt` is the only
 * legitimate escape and it is reserved for proper nouns.
 *
 * @requirement FR-04
 */
export default function App() {
  return (
    <main className="shell">
      {/* i18n-exempt — proper noun, identical in every locale */}
      <h1>ARUSIQ</h1>
    </main>
  );
}
