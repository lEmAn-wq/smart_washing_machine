import { Play, Pause, RotateCcw, AlertTriangle, Wrench } from 'lucide-react';

const statusColors = {
  AVAILABLE: 'bg-green-100 text-green-800 border-green-200',
  RUNNING: 'bg-blue-100 text-blue-800 border-blue-200',
  ERROR: 'bg-red-100 text-red-800 border-red-200',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  OFFLINE: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusLabels = {
  AVAILABLE: 'Sẵn sàng',
  RUNNING: 'Đang giặt',
  ERROR: 'Lỗi',
  MAINTENANCE: 'Bảo trì',
  OFFLINE: 'Offline',
};

const phaseLabels = {
  IDLE: 'Chờ',
  FILL_WATER: 'Xả nước',
  WASH: 'Giặt',
  DRAIN: 'Xả nước',
  SPIN: 'Vắt',
  DRY: 'Sấy',
  DONE: 'Hoàn thành',
};

function MachineCard({ machine, onCommand }) {
  const { _id, name, status, currentOrderCode, currentState } = machine;
  const isPaused = currentState?.isPaused;
  const progress = currentState?.progress || 0;
  const phase = currentState?.phase || 'IDLE';
  const mode = currentState?.mode || 'STANDARD';
  const remainingTime = currentState?.remainingTime || 0;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all hover:shadow-md ${
      status === 'ERROR' ? 'border-red-300' : 'border-transparent'
    }`}>
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-gray-800">{name}</h3>
            <p className="text-xs text-gray-500">{_id}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[status]}`}>
            {statusLabels[status]}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {status === 'RUNNING' && (
          <>
            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{phaseLabels[phase]}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${isPaused ? 'bg-yellow-400' : 'progress-animated'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Đơn hàng</p>
                <p className="font-mono font-medium">{currentOrderCode || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Còn lại</p>
                <p className="font-mono font-medium">{formatTime(remainingTime)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Chế độ</p>
                <p className="font-medium">{mode}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Trạng thái</p>
                <p className="font-medium">{isPaused ? '⏸ Tạm dừng' : '▶ Đang chạy'}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {isPaused ? (
                <button
                  onClick={() => onCommand(_id, 'RESUME')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Play size={16} />
                  Tiếp tục
                </button>
              ) : (
                <button
                  onClick={() => onCommand(_id, 'PAUSE')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  <Pause size={16} />
                  Tạm dừng
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm('Bạn có chắc muốn dừng máy này?')) {
                    onCommand(_id, 'RESET');
                  }
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </>
        )}

        {status === 'AVAILABLE' && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">✨</div>
            <p className="text-gray-500">Máy sẵn sàng sử dụng</p>
          </div>
        )}

        {status === 'ERROR' && (
          <div className="text-center py-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 font-medium">Máy đang gặp sự cố</p>
            <button
              onClick={() => onCommand(_id, 'RESET')}
              className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Reset máy
            </button>
          </div>
        )}

        {status === 'MAINTENANCE' && (
          <div className="text-center py-4">
            <Wrench className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            <p className="text-yellow-700 font-medium">Đang bảo trì</p>
          </div>
        )}

        {status === 'OFFLINE' && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2 opacity-50">📴</div>
            <p className="text-gray-400">Mất kết nối</p>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 flex justify-between">
        <span>Hôm nay: {machine.stats?.todayCycles || 0} lượt</span>
        <span>Tổng: {machine.stats?.totalCycles || 0} lượt</span>
      </div>
    </div>
  );
}

export default MachineCard;
