import { useState } from 'react';
import { X } from 'lucide-react';

function AssignMachineModal({ onClose, order, machines, onStart }) {
  const [selectedMachine, setSelectedMachine] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMachine) return;

    setLoading(true);
    setError('');

    try {
      await onStart(selectedMachine);
    } catch (err) {
      setError(err?.message || 'Có lỗi xảy ra');
      setLoading(false);
    }
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Gán máy giặt</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {/* Order info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-500">Đơn hàng</p>
            <p className="font-mono font-bold text-lg">{order.orderCode}</p>
            <p className="text-sm">{order.customerName}</p>
            <p className="text-sm text-gray-500">{order.package} - {order.price?.toLocaleString()}đ</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {machines.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">😔</div>
              <p className="text-gray-500">Không có máy nào khả dụng</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn máy giặt
              </label>
              <div className="space-y-2 mb-4">
                {machines.map((machine) => (
                  <label
                    key={machine._id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedMachine === machine._id
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="machine"
                      value={machine._id}
                      checked={selectedMachine === machine._id}
                      onChange={(e) => setSelectedMachine(e.target.value)}
                      className="text-blue-500"
                    />
                    <div>
                      <p className="font-medium">{machine.name}</p>
                      <p className="text-xs text-gray-500">{machine._id}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!selectedMachine || loading}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? 'Đang xử lý...' : 'Bắt đầu giặt'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default AssignMachineModal;
