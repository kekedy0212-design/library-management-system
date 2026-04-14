import React from 'react';
import { useSelector } from 'react-redux';
import { isAuthenticated, getUserRole } from '../utils/auth';
import MdCard from '../components/MdCard';

// MWC Component Imports
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';
import '@material/web/divider/divider.js';
import '@material/web/chips/assist-chip.js';

const Dashboard = () => {
  const { user } = useSelector(state => state.auth);

  if (!isAuthenticated()) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', padding: '24px' }}>
        <MdCard variant="elevated" style={{ maxWidth: '440px', textAlign: 'center', padding: '40px' }}>
          <div style={{ color: 'var(--md-sys-color-primary)', marginBottom: '24px' }}>
            <md-icon style={{ fontSize: '48px', width: '48px', height: '48px' }}>lock</md-icon>
          </div>
          <h2 style={{ margin: '0 0 12px 0', font: 'var(--md-sys-typescale-headline-small-font)' }}>
            Access Restricted
          </h2>
          <p style={{ font: 'var(--md-sys-typescale-body-medium-font)', color: 'var(--md-sys-color-on-surface-variant)', lineHeight: '1.5' }}>
            Welcome to the Library System. Please sign in to manage your books and profile.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
            <md-filled-button href="/login">Login</md-filled-button>
            <md-text-button href="/register">Create Account</md-text-button>
          </div>
        </MdCard>
      </div>
    );
  }

  const role = user?.role || getUserRole();

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header Section */}
      <header>
        <h2 style={{ font: 'var(--md-sys-typescale-headline-medium-font)', margin: '0 0 8px 0' }}>
          Welcome back, {user?.username}!
        </h2>
        <p style={{ font: 'var(--md-sys-typescale-body-medium-font)', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
          Here is a summary of your library account and available actions.
        </p>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>

        {/* User Profile Overview */}
        <MdCard variant="outlined" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ font: 'var(--md-sys-typescale-title-medium-font)', margin: 0 }}>Profile Overview</h3>
            <md-icon style={{ color: 'var(--md-sys-color-primary)' }}>account_circle</md-icon>
          </div>

          <md-list style={{ background: 'transparent', padding: 0 }}>
            <md-list-item>
              <div slot="headline">Email Address</div>
              <div slot="supporting-text">{user?.email || 'No email provided'}</div>
              <md-icon slot="start">mail</md-icon>
            </md-list-item>

            <md-list-item>
              <div slot="headline">Account Role</div>
              <div slot="supporting-text" style={{ marginTop: '8px' }}>
                <md-assist-chip label={role?.toUpperCase()}>
                  <md-icon slot="icon">verified_user</md-icon>
                </md-assist-chip>
              </div>
              <md-icon slot="start">admin_panel_settings</md-icon>
            </md-list-item>

            <md-list-item>
              <div slot="headline">Status</div>
              <div slot="supporting-text" style={{ marginTop: '8px' }}>
                <md-assist-chip
                  label={user?.is_active ? 'Active Member' : 'Account Inactive'}
                  style={{
                    '--md-assist-chip-label-text-color': user?.is_active ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'
                  }}
                >
                  <md-icon slot="icon">{user?.is_active ? 'check_circle' : 'warning'}</md-icon>
                </md-assist-chip>
              </div>
              <md-icon slot="start">info</md-icon>
            </md-list-item>
          </md-list>
        </MdCard>

        {/* Action Center */}
        <MdCard variant="filled" style={{ padding: '24px', backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ font: 'var(--md-sys-typescale-title-medium-font)', margin: 0 }}>Action Center</h3>
            <md-icon style={{ color: 'var(--md-sys-color-primary)' }}>bolt</md-icon>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <md-filled-button href="/books">
              <md-icon slot="icon">search</md-icon>
              Explore Catalog
            </md-filled-button>

            <md-outlined-button href="/borrow">
              <md-icon slot="icon">auto_stories</md-icon>
              My Borrowing History
            </md-outlined-button>

            {/* Admin & Librarian Tools */}
            {(role === 'librarian' || role === 'admin') && (
              <>
                <div style={{
                  height: '1px',
                  backgroundColor: 'var(--md-sys-color-outline-variant)',
                  margin: '12px 0'
                }}></div>
                <p style={{ font: 'var(--md-sys-typescale-label-small-font)', color: 'var(--md-sys-color-outline)', margin: '0 4px 4px 4px' }}>
                  MANAGEMENT
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <md-outlined-button href="/users">
                    <md-icon slot="icon">people</md-icon>
                    Users
                  </md-outlined-button>
                  <md-outlined-button href="/borrow">
                    <md-icon slot="icon">rule</md-icon>
                    Requests
                  </md-outlined-button>
                </div>
              </>
            )}

            {role === 'admin' && (
              <md-text-button href="/admin/logs" style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
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