import { useState } from 'react'

function App() {
  const [orderCode, setOrderCode] = useState('')
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleTrack = async (e) => {
    e.preventDefault()
    if (!orderCode.trim()) {
      setError('Vui lòng nhập mã đơn hàng')
      return
    }

    setLoading(true)
    setError('')
    setOrder(null)

    try {
      const response = await fetch(`/api/orders/${orderCode.trim()}?track=true`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Không tìm thấy đơn hàng')
      }

      setOrder(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'washing': return 'bg-indigo-100 text-indigo-800'
      case 'drying': return 'bg-purple-100 text-purple-800'
      case 'ready': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Chờ xử lý'
      case 'processing': return 'Đang xử lý'
      case 'washing': return 'Đang giặt'
      case 'drying': return 'Đang sấy'
      case 'ready': return 'Sẵn sàng lấy'
      case 'completed': return 'Hoàn thành'
      case 'cancelled': return 'Đã hủy'
      default: return status
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('vi-VN')
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount)
  }

  // Progress steps
  const steps = ['pending', 'processing', 'washing', 'drying', 'ready', 'completed']
  const currentStepIndex = order ? steps.indexOf(order.status) : -1

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center">
            <span className="text-3xl mr-3">🧺</span>
            <h1 className="text-2xl font-bold text-gray-800">Smart Laundry</h1>
          </div>
          <p className="text-center text-gray-600 mt-1">Theo dõi đơn hàng của bạn</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <form onSubmit={handleTrack} className="flex gap-4">
            <input
              type="text"
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value)}
              placeholder="Nhập mã đơn hàng (VD: ORD-ABC123)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang tìm...
                </span>
              ) : 'Tra cứu'}
            </button>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-8">
            <div className="flex items-center">
              <span className="text-2xl mr-3">❌</span>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Order Details */}
        {order && (
          <div className="space-y-6">
            {/* Order Header */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{order.orderCode}</h2>
                  <p className="text-gray-500">Tạo lúc: {formatDate(order.createdAt)}</p>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                  {getStatusText(order.status)}
                </span>
              </div>

              {/* Progress Bar */}
              {order.status !== 'cancelled' && (
                <div className="mt-8">
                  <div className="flex justify-between mb-2">
                    {steps.map((step, index) => (
                      <div key={step} className="flex flex-col items-center flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          index <= currentStepIndex 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {index < currentStepIndex ? '✓' : index + 1}
                        </div>
                        <span className={`text-xs mt-1 text-center ${
                          index <= currentStepIndex ? 'text-blue-600 font-medium' : 'text-gray-400'
                        }`}>
                          {getStatusText(step)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full mt-4">
                    <div 
                      className="h-2 bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Customer Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">👤 Thông tin khách hàng</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-sm">Họ tên</p>
                  <p className="font-medium">{order.customerName}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Số điện thoại</p>
                  <p className="font-medium">{order.customerPhone}</p>
                </div>
                {order.customerEmail && (
                  <div className="md:col-span-2">
                    <p className="text-gray-500 text-sm">Email</p>
                    <p className="font-medium">{order.customerEmail}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Details */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Chi tiết đơn hàng</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-500 text-sm">Khối lượng</p>
                  <p className="text-2xl font-bold text-gray-800">{order.weight} kg</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-500 text-sm">Loại giặt</p>
                  <p className="text-2xl font-bold text-gray-800 capitalize">{order.washType}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-blue-600 text-sm">Tổng tiền</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(order.totalPrice)}</p>
                </div>
              </div>
              {order.notes && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <p className="text-yellow-800 text-sm font-medium">📝 Ghi chú:</p>
                  <p className="text-yellow-700">{order.notes}</p>
                </div>
              )}
            </div>

            {/* Machine Info */}
            {order.machineId && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🔧 Máy giặt được gán</h3>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-2xl">🧺</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">
                      {order.machineId.name || `Máy ${order.machineId.machineNumber}`}
                    </p>
                    <p className="text-gray-500 text-sm">Máy số {order.machineId.machineNumber}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            {order.statusHistory && order.statusHistory.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 Lịch sử trạng thái</h3>
                <div className="space-y-4">
                  {order.statusHistory.slice().reverse().map((history, index) => (
                    <div key={index} className="flex items-start">
                      <div className="w-3 h-3 bg-blue-600 rounded-full mt-1.5 mr-4"></div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(history.status)}`}>
                            {getStatusText(history.status)}
                          </span>
                          <span className="text-gray-400 text-sm">{formatDate(history.timestamp)}</span>
                        </div>
                        {history.note && (
                          <p className="text-gray-600 text-sm mt-1">{history.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!order && !error && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <span className="text-6xl mb-4 block">🔍</span>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Tra cứu đơn hàng</h2>
            <p className="text-gray-600 mb-6">
              Nhập mã đơn hàng để theo dõi tiến độ giặt của bạn
            </p>
            <div className="bg-gray-50 rounded-lg p-4 inline-block">
              <p className="text-gray-500 text-sm">Mã đơn hàng có dạng:</p>
              <p className="font-mono text-lg font-medium text-gray-800">ORD-XXXXXX</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-gray-500">
          <p>© 2024 Smart Laundry. Liên hệ hỗ trợ: 1900-xxxx</p>
        </div>
      </footer>
    </div>
  )
}

export default App
