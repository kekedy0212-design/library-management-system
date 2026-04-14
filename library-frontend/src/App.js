import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import BookList from './pages/Books/BookList';
import BookDetail from './pages/Books/BookDetail';
import UserList from './pages/Users/UserList';
import BorrowHistory from './pages/Borrow/BorrowHistory';
import Logs from './pages/Admin/Logs';
import NotFound from './pages/NotFound';
import './styles/App.css';
import './styles/css/light.css';

function App() {
  const [isSidebarOpen, setSidebarOpen] = React.useState(true);
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
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/books" element={<BookList />} />
            <Route path="/books/:id" element={<BookDetail />} />
            <Route path="/users" element={<UserList />} />
            <Route path="/borrow" element={<BorrowHistory />} />
            <Route path="/admin/logs" element={<Logs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;