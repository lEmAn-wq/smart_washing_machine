import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Notifications from './pages/Notifications';
import Login from './pages/Login';
import Layout from './components/Layout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API_URL);

// Set axios defaults
axios.defaults.baseURL = API_URL;

function App() {
  const [machines, setMachines] = useState([]);
  const [connected, setConnected] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [admin, setAdmin] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Check existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedAdmin = localStorage.getItem('admin');
    
    if (token && savedAdmin) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Verify token
      axios.get('/api/auth/verify')
        .then(res => {
          setAdmin(JSON.parse(savedAdmin));
        })
        .catch(() => {
          // Token invalid, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('admin');
          delete axios.defaults.headers.common['Authorization'];
        })
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  // Socket events
  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Socket disconnected');
    });

    socket.on('machineUpdated', (machine) => {
      setMachines(prev => {
        const index = prev.findIndex(m => m._id === machine._id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = machine;
          return updated;
        }
        return [...prev, machine];
      });
    });

    socket.on('machineError', (data) => {
      console.log(`⚠️ Máy ${data.machineId} báo lỗi: ${data.errorType}`);
    });

    socket.on('newNotification', () => {
      setUnreadNotifications(prev => prev + 1);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('machineUpdated');
      socket.off('machineError');
      socket.off('newNotification');
    };
  }, []);

  const handleLogin = (adminData) => {
    setAdmin(adminData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    delete axios.defaults.headers.common['Authorization'];
    setAdmin(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-4xl mb-4">🧺</div>
          <p className="text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Login route */}
        <Route 
          path="/login" 
          element={admin ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} 
        />
        
        {/* Admin routes - Protected */}
        <Route 
          path="/" 
          element={
            admin ? (
              <Layout 
                connected={connected} 
                unreadNotifications={unreadNotifications}
                admin={admin}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        >
          <Route index element={
            <Dashboard 
              socket={socket}
              machines={machines} 
              setMachines={setMachines}
              connected={connected}
            />
          } />
          <Route path="orders" element={<Orders />} />
          <Route path="notifications" element={
            <Notifications 
              socket={socket}
              onRead={() => setUnreadNotifications(0)}
            />
          } />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to={admin ? "/" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
