import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { isAuthenticated, getUserRole, hasPermission } from '../utils/auth';
import MdCard from '../components/MdCard';
import { ROLES } from '../utils/constants';
import { borrowService } from '../services/borrowService';
import { bookService } from '../services/bookService';
import { userService } from '../services/userService';
import { formatDate, getStatusText } from '../utils/helpers';

// MWC Component Imports
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/icon/icon.js';

const Dashboard = () => {
  const { user } = useSelector(state => state.auth);
  const authenticated = isAuthenticated();
  const [overview, setOverview] = useState({
    totalBooks: 0,
    availableCopies: 0,
    pendingRequests: 0,
    myBorrowed: 0,
    myReturnPending: 0,
    activeUsers: 0,
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const role = user?.role || getUserRole();
  const isLibrarianOrAdmin = hasPermission(ROLES.LIBRARIAN);
  const isAdmin = role === ROLES.ADMIN;

  const loadDashboardData = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const requests = [bookService.getBooks({ limit: 300 }), borrowService.getBorrowHistory()];
      if (isLibrarianOrAdmin) {
        requests.push(borrowService.getPendingRequests());
        requests.push(userService.getUsers({ limit: 300 }));
      }

      const responses = await Promise.all(requests);
      const books = responses[0].data || [];
      const myHistory = responses[1].data || [];
      const pending = isLibrarianOrAdmin ? (responses[2].data || []) : [];
      const users = isLibrarianOrAdmin ? (responses[3].data || []) : [];

      setOverview({
        totalBooks: books.length,
        availableCopies: books.reduce((sum, item) => sum + (item.available_copies || 0), 0),
        pendingRequests: pending.length,
        myBorrowed: myHistory.filter((item) => item.status === 'approved').length,
        myReturnPending: myHistory.filter((item) => item.status === 'return_pending').length,
        activeUsers: users.filter((item) => item.is_active).length,
      });
      setRecentRequests(pending.slice(0, 5));
    } catch (err) {
      // 仪表盘允许降级展示，不阻断页面
      console.error('Dashboard data load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [authenticated, isLibrarianOrAdmin]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const summaryCards = useMemo(() => {
    const cards = [
      { label: 'Total Titles', value: overview.totalBooks, icon: 'menu_book' },
      { label: 'Available Copies', value: overview.availableCopies, icon: 'inventory_2' },
      { label: 'My Active Loans', value: overview.myBorrowed, icon: 'bookmarks' },
    ];

    if (isLibrarianOrAdmin) {
      cards.push({ label: 'Pending Requests', value: overview.pendingRequests, icon: 'pending_actions' });
      cards.push({ label: 'Active Users', value: overview.activeUsers, icon: 'groups' });
    } else {
      cards.push({ label: 'Returns Awaiting Approval', value: overview.myReturnPending, icon: 'assignment_turned_in' });
    }
    return cards;
  }, [overview, isLibrarianOrAdmin]);

  if (!authenticated) {
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
            <md-outlined-button href="/register">Create Account</md-outlined-button>
          </div>
        </MdCard>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
        <div>
        <h2 style={{ font: 'var(--md-sys-typescale-headline-medium-font)', margin: '0 0 8px 0' }}>
            Library Dashboard
        </h2>
        <p style={{ font: 'var(--md-sys-typescale-body-medium-font)', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
            Welcome back, {user?.username}. Here is your operational and borrowing overview.
        </p>
          </div>
        <md-outlined-button onClick={loadDashboardData} disabled={loading}>
          <md-icon slot="icon">refresh</md-icon>
          {loading ? 'Refreshing...' : 'Refresh'}
        </md-outlined-button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {summaryCards.map((card) => (
          <MdCard key={card.label} variant="outlined" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.9rem', color: 'var(--md-sys-color-on-surface-variant)' }}>{card.label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '600', marginTop: '6px' }}>{card.value}</div>
              </div>
              <md-icon style={{ color: 'var(--md-sys-color-primary)' }}>{card.icon}</md-icon>
            </div>
          </MdCard>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        <MdCard variant="filled" style={{ padding: '20px', backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, font: 'var(--md-sys-typescale-title-medium-font)' }}>Quick Actions</h3>
            <md-icon style={{ color: 'var(--md-sys-color-primary)' }}>bolt</md-icon>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <md-filled-button href="/books">
              <md-icon slot="icon">search</md-icon>
              Browse Catalog
            </md-filled-button>
            <md-outlined-button href="/borrow">
              <md-icon slot="icon">auto_stories</md-icon>
              My Borrowing History
            </md-outlined-button>
            {isLibrarianOrAdmin && (
              <md-outlined-button href="/admin/requests">
                <md-icon slot="icon">rule</md-icon>
                Review Requests
              </md-outlined-button>
            )}
            {isLibrarianOrAdmin && (
              <md-outlined-button href="/users">
                <md-icon slot="icon">people</md-icon>
                Manage Users
              </md-outlined-button>
            )}
            {isAdmin && (
              <md-outlined-button href="/admin/logs">
                <md-icon slot="icon">analytics</md-icon>
                System Logs
              </md-outlined-button>
            )}
          </div>
        </MdCard>

        <MdCard variant="outlined" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', font: 'var(--md-sys-typescale-title-medium-font)' }}>
            {isLibrarianOrAdmin ? 'Pending Requests (Latest 5)' : 'Borrowing Reminders'}
          </h3>
          {isLibrarianOrAdmin ? (
            recentRequests.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentRequests.map((item) => (
                  <div key={item.id} style={{ padding: '10px', borderRadius: '10px', background: 'var(--md-sys-color-surface-container-low)' }}>
                    <div style={{ fontWeight: '500' }}>
                      {item.book?.title || `书籍 #${item.book_id}`}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      User: {item.user?.username || `#${item.user_id}`} | Type: {getStatusText(item.status)} | Date: {formatDate(item.request_date)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: 'var(--md-sys-color-on-surface-variant)' }}>No pending requests right now.</p>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <InfoItem text={`You currently have ${overview.myBorrowed} active loan(s).`} />
              <InfoItem text={`${overview.myReturnPending} return request(s) are awaiting librarian approval.`} />
            </div>
          )}
        </MdCard>
      </div>
    </div>
  );
};

const InfoItem = ({ text, danger = false }) => (
  <div style={{
    padding: '10px',
    borderRadius: '10px',
    background: danger ? 'rgba(179, 38, 30, 0.08)' : 'var(--md-sys-color-surface-container-low)',
    color: danger ? 'var(--md-sys-color-error)' : 'inherit',
  }}>
    {text}
  </div>
);

export default Dashboard;