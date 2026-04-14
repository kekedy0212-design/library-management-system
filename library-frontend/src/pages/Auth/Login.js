import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import MdCard from '../../components/MdCard';

// Import Material Web Components
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/button/filled-button.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/icon/icon.js';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(credentials);
      navigate('/');
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div style={{
      display: 'grid',
      placeItems: 'center',
      minHeight: '80vh',
      padding: '16px'
    }}>
      <MdCard variant="outlined" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
        {/* Progress Bar for Loading State */}
        {loading && <md-linear-progress indeterminate style={{ marginBottom: '16px' }}></md-linear-progress>}

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <md-icon style={{ color: 'var(--md-sys-color-primary)', fontSize: '28px', marginBottom: '8px' }}>
            account_circle
          </md-icon>
          <h2 style={{
            margin: '0',
            font: 'var(--md-sys-typescale-headline-small-font)',
            color: 'var(--md-sys-color-on-surface)'
          }}>
            Sign in
          </h2>
          <p style={{
            font: 'var(--md-sys-typescale-body-medium-font)',
            color: 'var(--md-sys-color-on-surface-variant)',
            marginTop: '8px'
          }}>
            Use your Library Account
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <md-outlined-text-field
            label="Username"
            name="username"
            value={credentials.username}
            onInput={handleChange}
            required
            autoComplete="username"
          >
            <md-icon slot="leading-icon">person</md-icon>
          </md-outlined-text-field>

          <md-outlined-text-field
            label="Password"
            type="password"
            name="password"
            value={credentials.password}
            onInput={handleChange}
            required
            autoComplete="current-password"
          >
            <md-icon slot="leading-icon">lock</md-icon>
          </md-outlined-text-field>

          {error && (
            <div style={{
              color: 'var(--md-sys-color-error)',
              font: 'var(--md-sys-typescale-body-small-font)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <md-icon style={{ fontSize: '18px' }}>error</md-icon>
              {error}
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '12px'
          }}>
            <Link to="/register" style={{
              textDecoration: 'none',
              color: 'var(--md-sys-color-primary)',
              font: 'var(--md-sys-typescale-label-large-font)'
            }}>
              Create account
            </Link>

            <md-filled-button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Next'}
            </md-filled-button>
          </div>
        </form>
      </MdCard>
    </div>
  );
};

export default Login;