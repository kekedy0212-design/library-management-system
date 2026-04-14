import React from 'react';
import { useSelector } from 'react-redux';
import { isAuthenticated, getUserRole } from '../utils/auth';
import MdCard from '../components/MdCard';

import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';
import '@material/web/divider/divider.js';

const Dashboard = () => {
  const { user } = useSelector(state => state.auth);

  if (!isAuthenticated()) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '80vh' }}>
        <MdCard variant="elevated" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <md-icon slot="start">lock</md-icon>
          <h2 style={{ margin: '0', font: 'var(--md-sys-typescale-headline-small-font)' }}>
            Welcome to Library System
          </h2>
          <p style={{ font: 'var(--md-sys-typescale-body-medium-font)', color: 'var(--md-sys-color-on-surface-variant)' }}>
            Please sign in or register to access your account.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
            <md-filled-button href="/login">Login</md-filled-button>
            <md-outlined-button href="/register">Register</md-outlined-button>
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
      </MdCard>
    </div>
  );
};

export default Dashboard;