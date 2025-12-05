import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Filter, RefreshCw, Check, X, Clock, Loader2 } from 'lucide-react';

const API_URL = '/api';

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  WASHING: 'bg-blue-100 text-blue-800',
  DONE: 'bg-green-100 text-green-800',
  PICKED_UP: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800'
};

const statusLabels = {
  PENDING: 'Chờ xử lý',
  WASHING: 'Đang giặt',
  DONE: 'Hoàn thành',
  PICKED_UP: 'Đã lấy',
  CANCELLED: 'Đã hủy'
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, dateFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/orders?`;
      if (statusFilter) url += `status=${statusFilter}&`;
      if (dateFilter) url += `date=${dateFilter}&`;
      
      const res = await axios.get(url);
      setOrders(res.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickup = async (orderCode) => {
    try {
      await axios.post(`${API_URL}/orders/${orderCode}/pickup`);
      fetchOrders();
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCancel = async (orderCode) => {
    if (!confirm('Bạn có chắc muốn hủy đơn này?')) return;
    try {
      await axios.delete(`${API_URL}/orders/${orderCode}`);
      fetchOrders();
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.error || error.message));
    }
  };

  const filteredOrders = orders.filter(order => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.orderCode.toLowerCase().includes(search) ||
      order.customerName?.toLowerCase().includes(search) ||
      order.customerPhone?.includes(search) ||
      order.customerEmail?.toLowerCase().includes(search)
    );
  });

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý đơn hàng</h1>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm mã đơn, tên, SĐT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">Chờ xử lý</option>
          <option value="WASHING">Đang giặt</option>
          <option value="DONE">Hoàn thành</option>
          <option value="PICKED_UP">Đã lấy</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Không có đơn hàng nào
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Mã đơn</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Khách hàng</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Máy</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Trạng thái</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tiến độ</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Giá</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Ngày tạo</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map(order => (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-blue-600">{order.orderCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{order.customerName}</div>
                      <div className="text-sm text-gray-500">{order.customerPhone}</div>
                      <div className="text-xs text-gray-400">{order.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      {order.machineId ? (
                        <span className="font-mono text-sm">{order.machineId}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.status === 'WASHING' ? (
                        <div className="w-24">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{order.progress}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-500"
                              style={{ width: `${order.progress}%` }}
                            />
                          </div>
                        </div>
                      ) : order.status === 'DONE' || order.status === 'PICKED_UP' ? (
                        <span className="text-green-600">100%</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {order.price?.toLocaleString('vi-VN')}đ
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {order.status === 'DONE' && (
                          <button
                            onClick={() => handlePickup(order.orderCode)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Đánh dấu đã lấy"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                        )}
                        {order.status === 'PENDING' && (
                          <button
                            onClick={() => handleCancel(order.orderCode)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Hủy đơn"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-500">
        Hiển thị {filteredOrders.length} / {orders.length} đơn hàng
      </div>
    </div>
  );
}
