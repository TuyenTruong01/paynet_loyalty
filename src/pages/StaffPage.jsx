import { Plus, Save, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { useState } from 'react';
import { shortAddress } from '../utils/format.js';
import { MANAGER_WALLET, rolePermissionLabel } from '../utils/roles.js';

const emptyStaff = {
  name: '',
  role: 'cashier',
  wallet: '',
  active: true,
};

export default function StaffPage({ staffMembers = [], isManager, onSaveStaff, onDisableStaff, currentWallet }) {
  const [draft, setDraft] = useState(emptyStaff);
  const [editingId, setEditingId] = useState(null);

  function startEdit(member) {
    setEditingId(member.id || member.wallet);
    setDraft({
      id: member.id,
      name: member.name || '',
      role: member.roleKey || String(member.role || 'cashier').toLowerCase(),
      wallet: member.wallet || '',
      active: member.active !== false,
    });
  }

  function resetForm() {
    setEditingId(null);
    setDraft(emptyStaff);
  }

  async function submit(event) {
    event.preventDefault();
    if (!isManager) return;
    if (!draft.wallet.trim()) return alert('Wallet address is required.');
    if (!draft.name.trim()) return alert('Staff name is required.');
    await onSaveStaff?.(draft);
    resetForm();
  }

  return (
    <section className="page-stack">
      <section className="panel full-page-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Access Control</p>
            <h2>Staff & Whitelist</h2>
          </div>
          <span className={`badge ${isManager ? 'ok' : 'warn'}`}><ShieldCheck size={14} /> {rolePermissionLabel(isManager)}</span>
        </div>

        <div className="staff-notice">
          <UserCog size={22} />
          <div>
            <strong>Manager wallet</strong>
            <span>{MANAGER_WALLET}</span>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Staff</th>
              <th>Wallet Address</th>
              <th>Role</th>
              <th>Status</th>
              <th>Permission</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffMembers.map((member, index) => {
              const isCurrent = String(member.wallet).toLowerCase() === String(currentWallet).toLowerCase();
              const isManagerRow = String(member.wallet).toLowerCase() === MANAGER_WALLET.toLowerCase() || String(member.role).toLowerCase() === 'manager';
              return (
                <tr key={member.id || member.wallet}>
                  <td>{index + 1}</td>
                  <td><strong>{member.avatar || '👤'} {member.name}</strong>{isCurrent && <span className="inline-tag">Current</span>}</td>
                  <td><code>{shortAddress(member.wallet)}</code></td>
                  <td>{member.role}</td>
                  <td><span className={`badge ${member.active === false ? 'bad' : 'ok'}`}>{member.active === false ? 'Inactive' : 'Active'}</span></td>
                  <td>{isManagerRow ? 'Full management access' : 'POS / checkout access'}</td>
                  <td className="action-cell">
                    <button type="button" className="small-action" disabled={!isManager} onClick={() => startEdit(member)}>Edit</button>
                    <button type="button" className="small-action danger" disabled={!isManager || isManagerRow} onClick={() => onDisableStaff?.(member)}><Trash2 size={14} /> Disable</button>
                  </td>
                </tr>
              );
            })}
            {!staffMembers.length && <tr><td colSpan="7" className="empty-row">No staff wallets found.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">Manager Only</p><h2>{editingId ? 'Edit Staff Wallet' : 'Add Staff Wallet'}</h2></div>
          {editingId && <button type="button" onClick={resetForm}>Cancel edit</button>}
        </div>
        {!isManager ? (
          <div className="locked-box">
            <ShieldCheck size={30} />
            <strong>Only the manager wallet can add or edit staff.</strong>
            <span>Staff wallets can use POS and view operational data, but cannot change whitelist, products, inventory, or settings.</span>
          </div>
        ) : (
          <form className="staff-form" onSubmit={submit}>
            <label>Staff Name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Cashier name" /></label>
            <label>Wallet Address<input value={draft.wallet} onChange={event => setDraft({ ...draft, wallet: event.target.value })} placeholder="0x..." /></label>
            <label>Role<select value={draft.role} onChange={event => setDraft({ ...draft, role: event.target.value })}><option value="cashier">Cashier</option><option value="warehouse">Warehouse</option><option value="accountant">Accountant</option><option value="manager">Manager</option></select></label>
            <label>Status<select value={draft.active ? 'active' : 'inactive'} onChange={event => setDraft({ ...draft, active: event.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <button className="primary" type="submit">{editingId ? <Save size={16} /> : <Plus size={16} />} {editingId ? 'Save Staff' : 'Add Staff'}</button>
          </form>
        )}
      </section>
    </section>
  );
}
