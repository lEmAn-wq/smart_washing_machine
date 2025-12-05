import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Bell, Wifi, WifiOff, LogOut, User } from 'lucide-react';

function Layout({ connected, unreadNotifications = 0, admin, onLogout }) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/orders', label: 'Đơn hàng', icon: ClipboardList },
    { path: '/notifications', label: 'Thông báo', icon: Bell, badge: unreadNotifications },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧺</span>
            <h1 className="text-xl font-bold text-gray-800">Smart Laundry Admin</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {connected ? (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <Wifi size={16} />
                Đã kết nối
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-500 text-sm">
                <WifiOff size={16} />
                Mất kết nối
              </span>
            )}
            
            {/* Admin info */}
            <div className="flex items-center gap-3 pl-4 border-l">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User size={16} />
                <span>{admin?.name || admin?.username}</span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
              >
                <LogOut size={16} />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-4">
            {navItems.map(({ path, label, icon: Icon, badge }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors relative ${
                  location.pathname === path
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {label}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
