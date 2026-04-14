import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import BookList from './pages/Books/BookList';
import BookDetail from './pages/Books/BookDetail';
import BookForm from './pages/Books/BookForm';
import UserList from './pages/Users/UserList';
import BorrowHistory from './pages/Borrow/BorrowHistory';
import Logs from './pages/Admin/Logs';
import RequestApproval from './pages/Admin/RequestApproval';
import NotFound from './pages/NotFound';
import './styles/App.css';
import './styles/css/light.css';

function App() {
  const [isSidebarOpen, setSidebarOpen] = React.useState(true);
  const { isAuthenticated } = useSelector(state => state.auth);

  return (
    <div className="light" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header onMenuClick={() => setSidebarOpen(!isSidebarOpen)} />
      <div className="app-body" style={{ display: 'flex', flex: 1 }}>
        <Sidebar isOpen={isSidebarOpen} />
        <main className="main-content" style={{
          flex: 1,
          padding: '24px',
          backgroundColor: 'var(--md-sys-color-surface)',
          minWidth: 0 // 防止内容溢出
        }}>
          <Routes>
            <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/books" element={<ProtectedRoute><BookList /></ProtectedRoute>} />
            <Route path="/books/new" element={<ProtectedRoute requiredRole="librarian"><BookForm /></ProtectedRoute>} />
            <Route path="/books/:id/edit" element={<ProtectedRoute requiredRole="librarian"><BookForm /></ProtectedRoute>} />
            <Route path="/books/:id" element={<ProtectedRoute><BookDetail /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredRole="librarian"><UserList /></ProtectedRoute>} />
            <Route path="/borrow" element={<ProtectedRoute><BorrowHistory /></ProtectedRoute>} />
            <Route path="/admin/logs" element={<ProtectedRoute requiredRole="admin"><Logs /></ProtectedRoute>} />
            <Route path="/admin/requests" element={<ProtectedRoute requiredRole="librarian"><RequestApproval /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;