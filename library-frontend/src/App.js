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

function App() {
  return (
    <div className="app">
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
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