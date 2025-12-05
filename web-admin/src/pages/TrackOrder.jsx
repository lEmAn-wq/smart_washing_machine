import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  CheckCircle, Clock, Loader2, AlertCircle, 
  ArrowLeft, Package, Droplets, Wind, Sparkles 
} from 'lucide-react';

const API_URL = '/api';

const phaseIcons = {
  FILLING: Droplets,
  MIXING: Sparkles,
  SENSING: Sparkles,
  WASHING: Sparkles,
  DRAINING: Droplets,
  SPINNING: Wind
};

const phaseLabels = {
  POWER_OFF: 'Chờ khởi động',
  READY: 'Sẵn sàng',
  CHECK_SYSTEM: 'Kiểm tra hệ thống',
  FILLING: 'Đang cấp nước',
  MIXING: 'Trộn đều quần áo',
  SENSING: 'AI phân tích độ bẩn',
  WASHING: 'Đang giặt',
  DRAINING: 'Xả nước',
  SPINNING: 'Vắt khô',
  PAUSED: 'Tạm dừng',
  ERROR_DOOR: 'Lỗi: Cửa mở',
  ERROR_WATER: 'Lỗi: Cấp nước',
  DONE: 'Hoàn thành'
};

const statusConfig = {
  PENDING: { color: 'yellow', icon: Clock, label: 'Đang chờ xử lý' },
  WASHING: { color: 'blue', icon: Loader2, label: 'Đang giặt' },
  DONE: { color: 'green', icon: CheckCircle, label: 'Hoàn thành' },
  PICKED_UP: { color: 'gray', icon: Package, label: 'Đã lấy đồ' },
  CANCELLED: { color: 'red', icon: AlertCircle, label: 'Đã hủy' }
};

export default function TrackOrder() {
  const { orderCode } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrder();
    // Polling for updates when washing
    const interval = setInterval(() => {
      if (order?.status === 'WASHING') {
        fetchOrder();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [orderCode, order?.status]);

  const fetchOrder = async () => {
    try {
      const res = await axios.get(`${API_URL}/orders/${orderCode}`);
      setOrder(res.data);
      setError('');
    } catch (err) {
      setError('Không tìm thấy đơn hàng với mã này');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Không tìm thấy đơn hàng</h2>
          <p className="text-gray-600 mb-6">Mã đơn <span className="font-mono font-bold">{orderCode}</span> không tồn tại</p>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const config = statusConfig[order.status];
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">🧺 Smart Laundry</h1>
          <p className="text-gray-600">Theo dõi đơn giặt của bạn</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Status Header */}
          <div className={`bg-${config.color}-500 p-6 text-white text-center`}
               style={{ 
                 backgroundColor: config.color === 'yellow' ? '#eab308' : 
                                  config.color === 'blue' ? '#3b82f6' :
                                  config.color === 'green' ? '#22c55e' :
                                  config.color === 'red' ? '#ef4444' : '#6b7280'
               }}>
            <StatusIcon className={`w-16 h-16 mx-auto mb-3 ${order.status === 'WASHING' ? 'animate-spin' : ''}`} />
            <h2 className="text-xl font-bold">{config.label}</h2>
            {order.currentPhase && (
              <p className="text-white/80 mt-1">{phaseLabels[order.currentPhase] || order.currentPhase}</p>
            )}
          </div>

          {/* Order Info */}
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-gray-600">Mã đơn</span>
              <span className="font-mono font-bold text-xl text-blue-600">{order.orderCode}</span>
            </div>

            {order.customerName && (
              <div className="flex justify-between">
                <span className="text-gray-600">Khách hàng</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
            )}

            {order.machineId && (
              <div className="flex justify-between">
                <span className="text-gray-600">Máy giặt</span>
                <span className="font-mono">{order.machineId}</span>
              </div>
            )}

            {order.mode && order.status === 'WASHING' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Chế độ giặt</span>
                <span className={`font-medium ${order.mode === 'HEAVY' ? 'text-red-600' : 'text-green-600'}`}>
                  {order.mode === 'HEAVY' ? '🔴 Giặt kỹ' : '🟢 Thường'}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-gray-600">Giá tiền</span>
              <span className="font-bold text-green-600">{order.price?.toLocaleString('vi-VN')}đ</span>
            </div>

            {/* Progress Bar */}
            {order.status === 'WASHING' && (
              <div className="pt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Tiến độ</span>
                  <span className="font-bold text-blue-600">{order.progress || 0}%</span>
                </div>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500 rounded-full"
                    style={{ width: `${order.progress || 0}%` }}
                  />
                </div>
                <p className="text-center text-sm text-gray-500 mt-2">
                  {phaseLabels[order.currentPhase] || 'Đang xử lý...'}
                </p>
              </div>
            )}

            {/* Timestamps */}
            <div className="pt-4 border-t space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Tạo đơn</span>
                <span>{new Date(order.createdAt).toLocaleString('vi-VN')}</span>
              </div>
              {order.startedAt && (
                <div className="flex justify-between text-gray-500">
                  <span>Bắt đầu giặt</span>
                  <span>{new Date(order.startedAt).toLocaleString('vi-VN')}</span>
                </div>
              )}
              {order.completedAt && (
                <div className="flex justify-between text-green-600">
                  <span>Hoàn thành</span>
                  <span>{new Date(order.completedAt).toLocaleString('vi-VN')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Message */}
          {order.status === 'DONE' && (
            <div className="bg-green-50 p-4 text-center border-t">
              <p className="text-green-800 font-medium">
                ✅ Đồ của bạn đã giặt xong!
              </p>
              <p className="text-green-600 text-sm mt-1">
                Vui lòng đến lấy tại cửa hàng
              </p>
            </div>
          )}

          {order.status === 'WASHING' && (
            <div className="bg-blue-50 p-4 text-center border-t">
              <p className="text-blue-800 text-sm">
                🔄 Trang sẽ tự động cập nhật khi có thay đổi
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Cần hỗ trợ? Liên hệ: 0123 456 789</p>
        </div>
      </div>
    </div>
  );
}
