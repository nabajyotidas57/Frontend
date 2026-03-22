/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
import React, { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost";

const ROLE_MAP = {
  Manager: "manager",
  User: "user",
};
const ROLE_LABELS = Object.keys(ROLE_MAP);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function toLabel(roleKey) {
  const found = Object.entries(ROLE_MAP).find(([, v]) => v === roleKey);
  return found ? found[0] : roleKey;
}

function toKey(label) {
  return ROLE_MAP[label] ?? label.toLowerCase();
}

const PAGE_SIZE = 5;

// ─────────────────────────────────────────────────────────────────────────────
// StatusChip
// ─────────────────────────────────────────────────────────────────────────────
function StatusChip({ status }) {
  const chipClass =
    status === "Active"   ? "chip-green"  :
    status === "Inactive" ? "chip-yellow" :
    "chip-red";
  return <span className={`status-chip ${chipClass}`}>{status}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// RoleChip
// ─────────────────────────────────────────────────────────────────────────────
function RoleChip({ label, onRemove, disabled }) {
  return (
    <span className="role-chip" style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 6px 6px 0" }}>
      {label}
      {onRemove && (
        <button onClick={onRemove} disabled={disabled} title={`Remove ${label} role`} className="chip-remove-btn">
          ×
        </button>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast notification (replaces browser alert)
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    error:   { bg: "#fef2f2", border: "#fecaca", color: "#ef4444", icon: "🚨" },
    success: { bg: "#f0fdf4", border: "#bbf7d0", color: "#10b981", icon: "✅" },
    warning: { bg: "#fff7ed", border: "#fed7aa", color: "#f97316", icon: "⚠️" },
    info:    { bg: "#eff6ff", border: "#bfdbfe", color: "#3b82f6", icon: "ℹ️" },
  };
  const s = colors[type] || colors.info;

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 99999,
      display: "flex", alignItems: "center", gap: 10,
      padding: "13px 16px", borderRadius: 14,
      background: s.bg, border: `1px solid ${s.border}`,
      borderLeft: `4px solid ${s.color}`,
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      minWidth: 280, maxWidth: 400,
      animation: "slideInRight 0.3s ease",
    }}>
      <span style={{ fontSize: 16 }}>{s.icon}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{message}</span>
      <button onClick={onClose} style={{
        background: "none", border: "none", cursor: "pointer",
        fontSize: 18, color: "#64748b", padding: 0, lineHeight: 1,
      }}>×</button>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = "info") => {
    setToast({ message, type, id: Date.now() });
  }, []);
  const hide = useCallback(() => setToast(null), []);
  return { toast, show, hide };
}

// ─────────────────────────────────────────────────────────────────────────────
// RoleManagerModal
// ─────────────────────────────────────────────────────────────────────────────
function RoleManagerModal({ user, onClose }) {
  const [currentRoles, setCurrentRoles] = useState([]);
  const [loadingRoles, setLoadingRoles]  = useState(true);
  const [selectedRole, setSelectedRole]  = useState(ROLE_LABELS[0]);
  const [busy, setBusy]                  = useState(false);
  const [error, setError]                = useState(null);
  const [success, setSuccess]            = useState(null);

  const fetchCurrentRoles = useCallback(async () => {
    setLoadingRoles(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user.id}/roles`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const roles = json.data ?? json;
      const roleKeys = roles.map(r => r.name).filter(name => Object.values(ROLE_MAP).includes(name));
      setCurrentRoles(roleKeys);
    } catch (err) {
      setError("Could not load current roles: " + err.message);
    }
    setLoadingRoles(false);
  }, [user.id]);

  useEffect(() => { fetchCurrentRoles(); }, [fetchCurrentRoles]);

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess(null); }
    else          { setSuccess(msg); setError(null); }
    setTimeout(() => { setError(null); setSuccess(null); }, 3000);
  };

  const handleAssign = async () => {
    const roleKey = toKey(selectedRole);
    if (currentRoles.includes(roleKey)) { flash(`${selectedRole} is already listed.`, true); return; }
    setBusy(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/users/${user.id}/roles?role_name=${encodeURIComponent(roleKey)}`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      await fetchCurrentRoles();
      flash(`✓ ${selectedRole} assigned`);
    } catch (err) { flash("Assign failed: " + err.message, true); }
    setBusy(false);
  };

  const handleRemove = async (roleKey) => {
    setBusy(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/users/${user.id}/roles?role_name=${encodeURIComponent(roleKey)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      await fetchCurrentRoles();
      flash(`✓ ${toLabel(roleKey)} removed`);
    } catch (err) { flash("Remove failed: " + err.message, true); }
    setBusy(false);
  };

  const handleReplace = async (oldRoleKey) => {
    const newRoleKey = toKey(selectedRole);
    if (oldRoleKey === newRoleKey) { flash("Pick a different role.", true); return; }
    setBusy(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/users/${user.id}/roles?old_role=${encodeURIComponent(oldRoleKey)}&new_role=${encodeURIComponent(newRoleKey)}`,
        { method: "PUT", credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      await fetchCurrentRoles();
      flash(`✓ Replaced ${toLabel(oldRoleKey)} → ${selectedRole}`);
    } catch (err) { flash("Replace failed: " + err.message, true); }
    setBusy(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card modal-card" style={{ width: 480 }}>
        <div className="card-head">
          <h3>🛡️ Manage Roles</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="um-user-summary">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>

        <div className="um-section">
          <label>Current Roles</label>
          {loadingRoles ? (
            <span className="um-muted-text">Loading…</span>
          ) : currentRoles.length === 0 ? (
            <div className="um-empty-box">No roles assigned. Add one below.</div>
          ) : (
            <div>
              {currentRoles.map(roleKey => (
                <RoleChip key={roleKey} label={toLabel(roleKey)} disabled={busy} onRemove={() => handleRemove(roleKey)} />
              ))}
            </div>
          )}
        </div>

        <hr className="um-divider" />

        <div className="um-section">
          <label>Assign or Replace Role</label>
          <div className="um-flex-row">
            <select className="um-input" value={selectedRole} onChange={e => setSelectedRole(e.target.value)} disabled={busy}>
              {ROLE_LABELS.map(r => <option key={r}>{r}</option>)}
            </select>
            <button className="add-btn admin-add-btn" onClick={handleAssign} disabled={busy}>+ Assign</button>
          </div>

          {currentRoles.length > 0 && (
            <div className="um-replace-area">
              <span className="um-muted-text">Or replace an existing role:</span>
              <div className="um-flex-wrap">
                {currentRoles.map(roleKey => (
                  <button key={roleKey} onClick={() => handleReplace(roleKey)} disabled={busy} className="um-replace-btn">
                    {toLabel(roleKey)} → {selectedRole}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error   && <div className="um-alert error">{error}</div>}
        {success && <div className="um-alert success">{success}</div>}

        <div className="um-modal-footer">
          <button className="um-btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main UserManagement component
// ─────────────────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState({ email: "", role: "User" });
  const [formError, setFormError] = useState(null);
  const [deleting, setDeleting]   = useState(false);

  const fileInputRef = useRef(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  // ── Load users ─────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const json = await res.json();
      const data = json.data ?? json;

      setUsers(data.map(u => ({
        // Support different id field names from various backends
        id:     u.id || u.userId || u.keycloakId || u.sub || u.user_id || "",
        name:   u.firstName
                  ? `${u.firstName} ${u.lastName || ""}`.trim()
                  : u.name || u.username || "—",
        email:  u.email || u.emailAddress || "",
        status: u.enabled !== undefined
                  ? (u.enabled ? "Active" : "Inactive")
                  : (u.status || "Active"),
      })));
    } catch (err) {
      showToast("Failed to load users: " + err.message, "error");
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Add user ───────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    setFormError(null);
    if (!form.email)
      return setFormError("Email is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return setFormError("Invalid email address.");

    try {
      const res = await fetch(`${API_BASE}/admin/bulk-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify([{
          username: form.email.split("@")[0],
          email:    form.email,
          role:     toKey(form.role),
        }]),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

      const result = await res.json();
      const list   = result.data ?? result;
      const failed = Array.isArray(list) ? list.filter(r => r.status === "failed" || r.error) : [];
      if (failed.length > 0)
        return setFormError("Failed: " + (failed[0].error || "Unknown error"));

      await loadUsers();
      setModal(null);
      showToast("User created successfully!", "success");
    } catch (err) {
      setFormError("Add user failed: " + err.message);
    }
  };

  // ── Delete user ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    const userId = modal?.user?.id;

    // Guard: make sure we have a valid ID before calling the API
    if (!userId) {
      showToast("Cannot delete: user ID is missing. Check your backend response.", "error");
      console.error("Delete attempted with missing user id. User object:", modal?.user);
      return;
    }

    setDeleting(true);
    try {
      const url = `${API_BASE}/admin/users/${userId}`;
      console.log("DELETE →", url); // debug: visible in browser DevTools console

      const res = await fetch(url, { method: "DELETE", credentials: "include" });

      if (!res.ok) {
        // Try to extract a meaningful error message from the response body
        let errBody = "";
        try { errBody = await res.text(); } catch (_) {}

        // Parse JSON error if backend returns JSON
        let errMsg = errBody;
        try {
          const parsed = JSON.parse(errBody);
          errMsg = parsed.message || parsed.error || parsed.detail || errBody;
        } catch (_) {}

        throw new Error(`HTTP ${res.status}: ${errMsg || "Internal Server Error"}`);
      }

      await loadUsers();
      setModal(null);
      showToast("User deleted successfully.", "success");
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Delete failed: " + err.message, "error");
    }
    setDeleting(false);
  };

  // ── CSV import ─────────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async (event) => {
      const usersToCreate = event.target.result
        .split("\n").slice(1)
        .filter(l => l.trim())
        .map(line => {
          const [, email, role] = line.split(",");
          const cleanEmail = email?.trim();
          if (!cleanEmail) return null;
          return { username: cleanEmail.split("@")[0], email: cleanEmail, _role: role?.trim() || "user" };
        })
        .filter(Boolean);

      if (!usersToCreate.length) {
        showToast("No valid users found in CSV.", "warning");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/admin/bulk-users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(usersToCreate.map(u => ({ username: u.username, email: u.email, role: u._role }))),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

        const result = await res.json();
        await loadUsers();
        const ok = (result.data ?? result).filter?.(r => r.status === "created").length ?? usersToCreate.length;
        showToast(`Import complete. ${ok} user(s) created.`, "success");
      } catch (err) {
        showToast("Import failed: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const filtered   = users.filter(u =>
    [u.name, u.email, u.status].join(" ").toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="card flex-1" style={{ display: "flex", flexDirection: "column" }}>

      {/* Toast */}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* HEADER */}
      <div className="card-head um-header">
        <div className="search-box">
          <span>🔍</span>
          <input
            placeholder="Search users…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="um-actions">
          <button className="add-btn um-btn-secondary" onClick={() => fileInputRef.current.click()}>
            📤 Import CSV
          </button>
          <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={handleFileUpload} />
          <button
            className="add-btn admin-add-btn"
            onClick={() => { setForm({ email: "", role: "User" }); setFormError(null); setModal({ type: "add" }); }}
          >
            + Add User
          </button>
        </div>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="um-loading">Loading users…</div>
      ) : (
        <div className="user-table">
          <div className="table-head um-table-grid">
            <span className="th">User</span>
            <span className="th">Status</span>
            <span className="th">Actions</span>
          </div>

          {paged.map(u => (
            <div key={u.id || u.email} className="table-row um-table-grid">
              <div className="td user-cell">
                <div className="mini-av admin-av">
                  {u.name !== "—" ? u.name.substring(0, 2).toUpperCase() : "U"}
                </div>
                <div>
                  <div className="cell-name">{u.name}</div>
                  <div className="cell-sub">{u.email}</div>
                </div>
              </div>
              <div className="td"><StatusChip status={u.status} /></div>
              <div className="td action-cell">
                <button onClick={() => setModal({ type: "roles", user: u })} className="action-btn" title="Manage Roles">🛡️</button>
                <button onClick={() => setModal({ type: "delete", user: u })} className="action-btn" title="Delete User">🗑️</button>
              </div>
            </div>
          ))}

          {paged.length === 0 && (
            <div className="um-empty-box" style={{ marginTop: 20 }}>
              No users found matching your search.
            </div>
          )}
        </div>
      )}

      {/* PAGINATION */}
      <div className="um-pagination">
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="um-page-btn">Prev</button>
        <span>Page <strong>{page}</strong> of {totalPages}</span>
        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="um-page-btn">Next</button>
      </div>

      {/* ── ADD USER MODAL ── */}
      {modal?.type === "add" && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="card modal-card">
            <div className="card-head">
              <h3>Add New User</h3>
              <button onClick={() => setModal(null)} className="close-btn">×</button>
            </div>
            <div className="um-flex-col">
              <input
                placeholder="Email Address"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className={`um-input${formError && !form.email ? " invalid" : ""}`}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="um-input"
              >
                {ROLE_LABELS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            {formError && <div className="um-alert error" style={{ margin: "0 20px" }}>{formError}</div>}
            <div className="um-modal-footer">
              <button className="um-btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="add-btn admin-add-btn" onClick={handleAdd}>Create User</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {modal?.type === "delete" && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="card modal-card" style={{ width: 420 }}>
            <div className="card-head">
              <h3>🗑️ Delete User</h3>
              <button onClick={() => setModal(null)} className="close-btn">×</button>
            </div>

            <div style={{ padding: "20px 20px 0" }}>
              {/* Show warning if user ID is missing */}
              {!modal.user?.id && (
                <div className="um-alert error" style={{ marginBottom: 12 }}>
                  ⚠️ Warning: User ID not found. Delete may fail. Check backend response.
                </div>
              )}

              <p style={{ fontSize: 14, color: "var(--text-sub)", lineHeight: 1.6 }}>
                Are you sure you want to permanently delete{" "}
                <strong style={{ color: "var(--text-main)" }}>{modal.user?.email}</strong>?{" "}
                This action cannot be undone.
              </p>

              {/* Debug info — remove in production */}
              {import.meta.env.DEV && (
                <p style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 8, fontFamily: "monospace" }}>
                  ID: {modal.user?.id || "⚠️ missing"}
                </p>
              )}
            </div>

            <div className="um-modal-footer">
              <button className="um-btn-secondary" onClick={() => setModal(null)} disabled={deleting}>
                Cancel
              </button>
              <button
                className="add-btn"
                style={{ background: "#ef4444", opacity: deleting ? 0.7 : 1 }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ROLE MANAGER MODAL ── */}
      {modal?.type === "roles" && (
        <RoleManagerModal user={modal.user} onClose={() => setModal(null)} />
      )}
    </div>
  );
}