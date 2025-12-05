import { useState, useEffect } from 'react';
import axios from 'axios';
import MachineCard from '../components/MachineCard';
import CreateOrderModal from '../components/CreateOrderModal';
import AssignMachineModal from '../components/AssignMachineModal';
import { Plus, RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react';

const API_URL = '/api';

export default function Dashboard({ socket, machines, setMachines, connected }) {
  const [stats, setStats] = useState({
    todayOrders: 0,
    pendingOrders: 0,
    washingOrders: 0,
    todayRevenue: 0
  });
  const [pendingOrders, setPendingOrders] = useState([]);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showAssignMachine, setShowAssignMachine] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [machinesRes, statsRes, ordersRes] = await Promise.all([
        axios.get(`${API_URL}/machines`),
        axios.get(`${API_URL}/orders/stats/summary`),
        axios.get(`${API_URL}/orders?status=PENDING`)
      ]);
      setMachines(machinesRes.data);
      setStats(statsRes.data);
      setPendingOrders(ordersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle machine commands via socket
  const handleCommand = (machineId, command) => {
    socket.emit('sendCommand', { machineId, command });
  };

  // Handle assign order to machine
  const handleAssignOrder = (order) => {
    setSelectedOrder(order);
    setShowAssignMachine(true);
  };

  const handleStartWash = async (machineId) => {
    if (!selectedOrder) return;
    try {
      await axios.post(`${API_URL}/orders/${selectedOrder.orderCode}/start`, { machineId });
      setShowAssignMachine(false);
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCreateOrder = async (orderData) => {
    try {
      await axios.post(`${API_URL}/orders`, orderData);
      setShowCreateOrder(false);
      fetchData();
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            {connected ? (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <Wifi className="w-4 h-4" /> Đã kết nối server
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-600 text-sm">
                <WifiOff className="w-4 h-4" /> Mất kết nối
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowCreateOrder(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Tạo đơn mới
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">Đơn hôm nay</p>
          <p className="text-2xl font-bold text-gray-800">{stats.todayOrders}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">Đang chờ</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">Đang giặt</p>
          <p className="text-2xl font-bold text-blue-600">{stats.washingOrders}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">Doanh thu hôm nay</p>
          <p className="text-2xl font-bold text-green-600">
            {stats.todayRevenue?.toLocaleString('vi-VN')}đ
          </p>
        </div>
      </div>

      {/* Machines Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Trạng thái máy giặt</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {machines.map(machine => (
            <MachineCard
              key={machine._id}
              machine={machine}
              onCommand={handleCommand}
            />
          ))}
        </div>
      </div>

      {/* Pending Orders */}
      {pendingOrders.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            Đơn chờ xử lý ({pendingOrders.length})
          </h2>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Mã đơn</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Khách hàng</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Gói</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Giá</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingOrders.map(order => (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{order.orderCode}</td>
                    <td className="px-4 py-3">
                      <div>{order.customerName}</div>
                      <div className="text-sm text-gray-500">{order.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3">{order.package}</td>
                    <td className="px-4 py-3">{order.price?.toLocaleString('vi-VN')}đ</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleAssignOrder(order)}
                        className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600"
                      >
                        Gán máy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateOrder && (
        <CreateOrderModal
          onClose={() => setShowCreateOrder(false)}
          onSubmit={handleCreateOrder}
        />
      )}

      {showAssignMachine && (
        <AssignMachineModal
          order={selectedOrder}
          machines={machines.filter(m => m.status === 'AVAILABLE')}
          onClose={() => {
            setShowAssignMachine(false);
            setSelectedOrder(null);
          }}
          onStart={handleStartWash}
        />
      )}
    </div>
  );
}
