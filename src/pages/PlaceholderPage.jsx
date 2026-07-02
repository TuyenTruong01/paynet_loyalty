export default function PlaceholderPage({ title, description }) {
  return (
    <section className="placeholder-page panel">
      <p className="eyebrow">Module</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="placeholder-grid">
        <div><strong>Demo Ready</strong><span>UI shell is prepared for hackathon walkthrough.</span></div>
        <div><strong>Supabase Backed</strong><span>Can be connected to the existing tables next.</span></div>
        <div><strong>Arc First</strong><span>Crypto payment stays as the central flow.</span></div>
      </div>
    </section>
  );
}
