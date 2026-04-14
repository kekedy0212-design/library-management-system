import React from 'react';
import { useSelector } from 'react-redux';
import { isAuthenticated, getUserRole } from '../utils/auth';
import MdCard from '../components/MdCard';

// 导入 Material Web 组件
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';
import '@material/web/divider/divider.js';
import '@material/web/chips/assist-chip.js'; // 新增 Chip 组件

const Dashboard = () => {
  const { user } = useSelector(state => state.auth);

  if (!isAuthenticated()) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', padding: '20px' }}>
        <MdCard variant="elevated" style={{ maxWidth: '400px', textAlign: 'center', padding: '40px' }}>
          <div style={{ color: 'var(--md-sys-color-primary)', marginBottom: '16px' }}>
            <md-icon style={{ fontSize: '48px', width: '48px', height: '48px' }}>lock</md-icon>
          </div>
          <h2 style={{ margin: '0 0 12px 0', font: 'var(--md-sys-typescale-headline-small-font)' }}>
            Access Restricted
          </h2>
          <p style={{ font: 'var(--md-sys-typescale-body-medium-font)', color: 'var(--md-sys-color-on-surface-variant)', lineHeight: '1.5' }}>
            Welcome to the Library System. Please sign in to manage your books and profile.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
            <md-filled-button href="/login">Login</md-filled-button>
            <md-text-button href="/register">Create Account</md-text-button>
          </div>
        </MdCard>
      </div>
    );
  }

  const role = user?.role || getUserRole();

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ font: 'var(--md-sys-typescale-headline-medium-font)', margin: '0' }}>
        Dashboard
      </h2>

      <MdCard variant="outlined">
        <h3 style={{ font: 'var(--md-sys-typescale-title-medium-font)', margin: '0 0 8px 0' }}>
          User Information
        </h3>
        <md-list style={{ background: 'transparent', padding: 0 }}>
          <md-list-item>
            <div slot="headline">Username</div>
            <div slot="supporting-text">{user?.username || 'Unknown'}</div>
          </md-list-item>
          <md-divider></md-divider>
          <md-list-item>
            <div slot="headline">Email</div>
            <div slot="supporting-text">{user?.email || 'N/A'}</div>
          </md-list-item>
          <md-divider></md-divider>
          <md-list-item>
            <div slot="headline">Role</div>
            <div slot="supporting-text" style={{ textTransform: 'capitalize' }}>{role}</div>
          </md-list-item>
          <md-divider></md-divider>
          <md-list-item>
            <div slot="headline">Status</div>
            <div slot="supporting-text">
              {user?.is_active ? '✅ Active' : '⚠️ Inactive'}
            </div>
          </md-list-item>
        </md-list>
      </MdCard>

      <MdCard variant="filled">
        <h3 style={{ font: 'var(--md-sys-typescale-title-medium-font)', margin: '0 0 8px 0' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <md-filled-button href="/books">
            <md-icon slot="icon">menu_book</md-icon>
            Browse Books
          </md-filled-button>

          <md-outlined-button href="/borrow">
            <md-icon slot="icon">history</md-icon>
            History
          </md-outlined-button>

          {(role === 'librarian' || role === 'admin') && (
            <>
              <md-outlined-button href="/users">
                <md-icon slot="icon">group</md-icon>
                Manage Users
              </md-outlined-button>
              <md-outlined-button href="/borrow">
                <md-icon slot="icon">pending_actions</md-icon>
                Process Requests
              </md-outlined-button>
            </>
          )}

          {role === 'admin' && (
            <md-text-button href="/admin/logs">
              <md-icon slot="icon">settings_ethernet</md-icon>
              System Logs
            </md-text-button>
          )}
        </div>
        <div>
          <h2 style={{ font: 'var(--md-sys-typescale-headline-medium-font)', margin: 0 }}>
            Welcome back, {user?.username}!
          </h2>
          <p style={{ font: 'var(--md-sys-typescale-body-small-font)', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
            Here is what's happening with your library account today.
          </p>
        </div>
      </MdCard>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px'
      }}>

        {/* 用户概览卡片 */}
        <MdCard variant="outlined" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ font: 'var(--md-sys-typescale-title-medium-font)', margin: 0 }}>Profile Overview</h3>
            <md-icon style={{ color: 'var(--md-sys-color-outline)' }}>account_circle</md-icon>
          </div>

          <md-list style={{ background: 'transparent', padding: 0 }}>
            <md-list-item>
              <div slot="headline">Email Address</div>
              <div slot="supporting-text">{user?.email}</div>
              <md-icon slot="start">mail</md-icon>
            </md-list-item>

            <md-list-item>
              <div slot="headline">Account Role</div>
              <div slot="supporting-text" style={{ marginTop: '8px' }}>
                <md-assist-chip label={user?.role?.toUpperCase() || 'USER'}>
                  <md-icon slot="icon">verified_user</md-icon>
                </md-assist-chip>
              </div>
              <md-icon slot="start">admin_panel_settings</md-icon>
            </md-list-item>

            <md-list-item>
              <div slot="headline">Account Status</div>
              <div slot="supporting-text" style={{ marginTop: '8px' }}>
                <md-assist-chip
                  label={user?.is_active ? 'Active' : 'Inactive'}
                  style={{
                    '--md-assist-chip-label-text-color': user?.is_active ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'
                  }}
                >
                  <md-icon slot="icon">{user?.is_active ? 'check_circle' : 'cancel'}</md-icon>
                </md-assist-chip>
              </div>
              <md-icon slot="start">info</md-icon>
            </md-list-item>
          </md-list>
        </MdCard>

        {/* 快速操作卡片 */}
        <MdCard variant="filled" style={{ gap: '20px', backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
          <h3 style={{ font: 'var(--md-sys-typescale-title-medium-font)', margin: 0 }}>Quick Actions</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <md-filled-button href="/books" style={{ width: '100%' }}>
              <md-icon slot="icon">search</md-icon>
              Explore Catalog
            </md-filled-button>

            <md-outlined-button href="/borrow" style={{ width: '100%' }}>
              <md-icon slot="icon">auto_stories</md-icon>
              My Borrowing History
            </md-outlined-button>

            {/* 管理员专用区域 */}
            {(user?.role === 'librarian' || user?.role === 'admin') && (
              <>
                <div style={{
                  height: '1px',
                  backgroundColor: 'var(--md-sys-color-outline-variant)',
                  margin: '8px 0'
                }}></div>
                <p style={{ font: 'var(--md-sys-typescale-label-small-font)', color: 'var(--md-sys-color-outline)', margin: '0 4px' }}>
                  ADMINISTRATION
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <md-outlined-button href="/users" style={{ flex: 1 }}>
                    <md-icon slot="icon">people_outline</md-icon>
                    Users
                  </md-outlined-button>
                  <md-outlined-button href="/borrow" style={{ flex: 1 }}>
                    <md-icon slot="icon">rebase_edit</md-icon>
                    Requests
                  </md-outlined-button>
                </div>
              </>
            )}

            {user?.role === 'admin' && (
              <md-text-button href="/admin/logs" style={{ alignSelf: 'flex-start' }}>
                <md-icon slot="icon">analytics</md-icon>
                View System Logs
              </md-text-button>
            )}
          </div>
        </MdCard>

      </div>
    </div>
  );
};

export default Dashboard;