import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { registerStart, registerSuccess, registerFailure } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';
import MdCard from '../../components/MdCard';

// Import Material Web Components
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/button/filled-button.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/icon/icon.js';

const Register = () => {
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (userData.password !== userData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    setError(null);
    dispatch(registerStart());

    try {
      const response = await authService.register({
        username: userData.username,
        email: userData.email,
        password: userData.password,
      });
      dispatch(registerSuccess(response.data));
      navigate('/login');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Registration failed';
      setError(errorMsg);
      dispatch(registerFailure(errorMsg));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setUserData({
      ...userData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div style={{
      display: 'grid',
      placeItems: 'center',
      minHeight: '90vh',
      padding: '24px'
    }}>
      <MdCard variant="outlined" style={{ width: '100%', maxWidth: '450px', padding: '32px' }}>
        {/* Loading Indicator */}
        {loading && <md-linear-progress indeterminate style={{ marginBottom: '16px' }}></md-linear-progress>}

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <md-icon style={{ color: 'var(--md-sys-color-primary)', fontSize: '27px' }}>person_add</md-icon>
          <h2 style={{
            margin: '8px 0 0 0',
            font: 'var(--md-sys-typescale-headline-small-font)',
            color: 'var(--md-sys-color-on-surface)'
          }}>
            Create account
          </h2>
          <p style={{
            font: 'var(--md-sys-typescale-body-medium-font)',
            color: 'var(--md-sys-color-on-surface-variant)'
          }}>
            Join the Library Management System
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <md-outlined-text-field
            label="Username"
            name="username"
            value={userData.username}
            onInput={handleChange}
            required
          >
            <md-icon slot="leading-icon">badge</md-icon>
          </md-outlined-text-field>

          <md-outlined-text-field
            label="Email"
            type="email"
            name="email"
            value={userData.email}
            onInput={handleChange}
            required
          >
            <md-icon slot="leading-icon">mail</md-icon>
          </md-outlined-text-field>

          <div style={{ display: 'flex', gap: '12px' }}>
            <md-outlined-text-field
              label="Password"
              type="password"
              name="password"
              value={userData.password}
              onInput={handleChange}
              required
              style={{ flex: 1 }}
            >
              <md-icon slot="leading-icon">lock</md-icon>
            </md-outlined-text-field>

            <md-outlined-text-field
              label="Confirm"
              type="password"
              name="confirmPassword"
              value={userData.confirmPassword}
              onInput={handleChange}
              required
              style={{ flex: 1 }}
            >
              <md-icon slot="leading-icon">check_circle</md-icon>
            </md-outlined-text-field>
          </div>

          {error && (
            <div style={{
              color: 'var(--md-sys-color-error)',
              font: 'var(--md-sys-typescale-body-small-font)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 4px'
            }}>
              <md-icon style={{ fontSize: '18px' }}>error</md-icon>
              {error}
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px'
          }}>
            <Link to="/login" style={{
              textDecoration: 'none',
              color: 'var(--md-sys-color-primary)',
              font: 'var(--md-sys-typescale-label-large-font)'
            }}>
              Sign in instead
            </Link>

            <md-filled-button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Register'}
            </md-filled-button>
          </div>
        </form>
      </MdCard>
    </div>
  );
};

export default Register;