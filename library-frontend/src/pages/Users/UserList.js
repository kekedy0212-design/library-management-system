import React, { useEffect, useState } from 'react';
import { useUsers } from '../../hooks/useUsers';
import { formatDate } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import MdCard from '../../components/MdCard';

const UserList = () => {
  const { users, loading, error, fetchUsers, updateUserStatus, updateUserRole, resetUserPassword } = useUsers();
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState(null);

  useEffect(() => {
    if (hasPermission(ROLES.LIBRARIAN)) {
      fetchUsers();
    }
  }, [fetchUsers]);

  if (!hasPermission(ROLES.LIBRARIAN)) {
    return <div style={{ color: 'var(--md-sys-color-error)', padding: '20px' }}>Insufficient permissions.</div>;
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Loading Users...</div>;
  if (error) return <div style={{ color: 'var(--md-sys-color-error)', padding: '20px' }}>{error}</div>;

  const handleToggleStatus = (user) => {
    const action = user.is_active ? 'Disable' : 'Enable';
    setConfirmDialog({
      title: `${action} User`,
      message: `Are you sure you want to ${action.toLowerCase()} user "${user.username}"?`,
      confirmLabel: action,
      isDanger: user.is_active,
      onConfirm: async () => {
        const result = await updateUserStatus(user.id, !user.is_active);
        if (result.success) {
          fetchUsers();
        } else {
          alert(`Operation failed: ${result.error}`);
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const handleResetPassword = (user) => {
    setResetPasswordDialog({
      user,
      onConfirm: async (newPassword) => {
        const result = await resetUserPassword(user.id, newPassword);
        if (result.success) {
          alert('Password reset successfully');
        } else {
          alert(`Failed to reset password: ${result.error}`);
        }
        setResetPasswordDialog(null);
      },
      onCancel: () => setResetPasswordDialog(null),
    });
  };

  const handlePromoteRole = (user) => {
    const newRole = user.role === 'reader' ? 'librarian' : 'admin';
    const roleName = newRole === 'librarian' ? 'Librarian' : 'Administrator';
    setConfirmDialog({
      title: 'Promote Role',
      message: `Promote "${user.username}" to ${roleName}?`,
      confirmLabel: 'Promote',
      isDanger: false,
      onConfirm: async () => {
        const result = await updateUserRole(user.id, newRole);
        if (result.success) {
          fetchUsers();
        } else {
          alert(`Operation failed: ${result.error}`);
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '400', marginBottom: '24px', color: 'var(--md-sys-color-on-surface)' }}>
        User Management
      </h2>

      <MdCard variant="elevated">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Joined</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                  <td style={tdStyle}>{user.username}</td>
                  <td style={tdStyle}>{user.email}</td>
                  <td style={tdStyle}>
                    <RoleBadge role={user.role} />
                  </td>
                  <td style={tdStyle}>
                    <StatusDot active={user.is_active} />
                    {user.is_active ? 'Active' : 'Inactive'}
                  </td>
                  <td style={tdStyle}>{formatDate(user.created_at)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        style={user.is_active ? ghostBtnDanger : ghostBtnSuccess}
                        onClick={() => handleToggleStatus(user)}
                      >
                        {user.is_active ? 'Disable' : 'Enable'}
                      </button>

                      <button style={ghostBtnPrimary} onClick={() => handleResetPassword(user)}>
                        Reset PWD
                      </button>

                      {hasPermission(ROLES.ADMIN) && user.role !== 'admin' && (
                        <button style={filledBtnSmall} onClick={() => handlePromoteRole(user)}>
                          Promote
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MdCard>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <Dialog
          title={confirmDialog.title}
          onCancel={confirmDialog.onCancel}
        >
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '24px' }}>
            {confirmDialog.message}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button style={textBtn} onClick={confirmDialog.onCancel}>Cancel</button>
            <button
              style={confirmDialog.isDanger ? filledBtnDanger : filledBtnPrimary}
              onClick={confirmDialog.onConfirm}
            >
              {confirmDialog.confirmLabel}
            </button>
          </div>
        </Dialog>
      )}

      {/* Reset Password Dialog */}
      {resetPasswordDialog && (
        <ResetPasswordDialog
          user={resetPasswordDialog.user}
          onConfirm={resetPasswordDialog.onConfirm}
          onCancel={resetPasswordDialog.onCancel}
        />
      )}
    </div>
  );
};

// --- MD3 Sub-Components ---

const ResetPasswordDialog = ({ user, onConfirm, onCancel }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    onConfirm(newPassword);
  };

  return (
    <Dialog title={`Reset Password - ${user.username}`} onCancel={onCancel}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>New Password</label>
          <input
            type="password"
            style={inputStyle}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength="6"
          />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>Confirm Password</label>
          <input
            type="password"
            style={inputStyle}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength="6"
          />
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" style={textBtn} onClick={onCancel}>Cancel</button>
          <button type="submit" style={filledBtnPrimary}>Confirm Reset</button>
        </div>
      </form>
    </Dialog>
  );
};

const Dialog = ({ title, children, onCancel }) => (
  <div style={overlayStyle} onClick={onCancel}>
    <div style={modalStyle} onClick={e => e.stopPropagation()}>
      <h3 style={{ marginTop: 0, marginBottom: '16px', fontWeight: '400', fontSize: '1.5rem' }}>{title}</h3>
      {children}
    </div>
  </div>
);

const RoleBadge = ({ role }) => {
  const styles = {
    admin: { bg: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)', label: 'Admin' },
    librarian: { bg: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)', label: 'Librarian' },
    reader: { bg: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface-variant)', label: 'Reader' }
  };
  const s = styles[role] || styles.reader;
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '500',
      backgroundColor: s.bg, color: s.color
    }}>
      {s.label}
    </span>
  );
};

const StatusDot = ({ active }) => (
  <span style={{
    display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', marginRight: '8px',
    backgroundColor: active ? '#4CAF50' : '#F44336'
  }} />
);

// --- Styles ---

const thStyle = { padding: '16px', color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.85rem', fontWeight: '500' };
const tdStyle = { padding: '16px', verticalAlign: 'middle', fontSize: '0.9rem' };

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
};

const modalStyle = {
  backgroundColor: 'var(--md-sys-color-surface-container-high, #fff)',
  padding: '24px', borderRadius: '28px', width: '100%', maxWidth: '400px',
  boxShadow: 'var(--md-sys-elevation-level3)'
};

const inputStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--md-sys-color-outline)',
  backgroundColor: 'transparent', boxSizing: 'border-box', marginTop: '4px'
};

const labelStyle = { fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' };

const ghostBtnBase = {
  background: 'none', border: 'none', padding: '6px 12px', borderRadius: '8px',
  cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500'
};

const ghostBtnPrimary = { ...ghostBtnBase, color: 'var(--md-sys-color-primary)' };
const ghostBtnDanger = { ...ghostBtnBase, color: 'var(--md-sys-color-error)' };
const ghostBtnSuccess = { ...ghostBtnBase, color: '#2E7D32' };

const filledBtnBase = {
  border: 'none', padding: '10px 24px', borderRadius: '100px', cursor: 'pointer', fontWeight: '500'
};

const filledBtnPrimary = { ...filledBtnBase, backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' };
const filledBtnDanger = { ...filledBtnBase, backgroundColor: 'var(--md-sys-color-error)', color: 'var(--md-sys-color-on-error)' };
const filledBtnSmall = { ...filledBtnBase, padding: '6px 16px', fontSize: '0.85rem', backgroundColor: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' };
const textBtn = { ...ghostBtnBase, padding: '10px 24px' };

export default UserList;