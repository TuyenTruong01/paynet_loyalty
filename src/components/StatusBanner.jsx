import { RefreshCw } from 'lucide-react';

export default function StatusBanner({ message, onReload }) {
  return (
    <div className="db-banner">
      <strong>Supabase</strong>
      <span>{message}</span>
      <button type="button" onClick={onReload}>
        <RefreshCw size={15} /> Reload
      </button>
    </div>
  );
}
