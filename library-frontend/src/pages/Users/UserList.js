import React, { useEffect, useState } from 'react';
import { useUsers } from '../../hooks/useUsers';
import { formatDate } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';

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
    return <div className="error">权限不足</div>;
  }

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">{error}</div>;

  const handleToggleStatus = (user) => {
    const action = user.is_active ? '禁用' : '启用';
    setConfirmDialog({
      title: `${action}用户`,
      message: `确定要${action}用户 "${user.username}" 吗？`,
      onConfirm: async () => {
        const result = await updateUserStatus(user.id, !user.is_active);
        if (result.success) {
          alert(`${action}成功`);
          fetchUsers(); // 刷新列表
        } else {
          alert(`操作失败: ${result.error}`);
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
          alert('密码重置成功');
        } else {
          alert(`密码重置失败: ${result.error}`);
        }
        setResetPasswordDialog(null);
      },
      onCancel: () => setResetPasswordDialog(null),
    });
  };

  const handlePromoteRole = (user) => {
    const newRole = user.role === 'reader' ? 'librarian' : 'admin';
    const roleName = newRole === 'librarian' ? '图书管理员' : '管理员';
    setConfirmDialog({
      title: '提升角色',
      message: `确定要将用户 "${user.username}" 的角色提升为 ${roleName} 吗？`,
      onConfirm: async () => {
        const result = await updateUserRole(user.id, newRole);
        if (result.success) {
          alert('角色提升成功');
          fetchUsers(); // 刷新列表
        } else {
          alert(`操作失败: ${result.error}`);
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  return (
    <div>
      <h2>用户管理</h2>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  {user.role === 'admin' ? '管理员' :
                   user.role === 'librarian' ? '图书管理员' : '读者'}
                </td>
                <td>{user.is_active ? '激活' : '未激活'}</td>
                <td>{formatDate(user.created_at)}</td>
                <td>
                  <button
                    className={`btn ${user.is_active ? 'btn-danger' : 'btn-success'}`}
                    onClick={() => handleToggleStatus(user)}
                  >
                    {user.is_active ? '禁用' : '启用'}
                  </button>
                  {hasPermission(ROLES.LIBRARIAN) && (
                    <button
                      className="btn btn-warning"
                      onClick={() => handleResetPassword(user)}
                    >
                      重置密码
                    </button>
                  )}
                  {hasPermission(ROLES.ADMIN) && user.role !== 'admin' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handlePromoteRole(user)}
                    >
                      提升角色
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 确认对话框 */}
      {confirmDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={confirmDialog.onConfirm}>
                确认
              </button>
              <button className="btn btn-secondary" onClick={confirmDialog.onCancel}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 重置密码对话框 */}
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

const ResetPasswordDialog = ({ user, onConfirm, onCancel }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      alert('密码长度至少6位');
      return;
    }
    onConfirm(newPassword);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>重置密码 - {user.username}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>新密码：</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength="6"
            />
          </div>
          <div className="form-group">
            <label>确认密码：</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength="6"
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">
              确认重置
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserList;