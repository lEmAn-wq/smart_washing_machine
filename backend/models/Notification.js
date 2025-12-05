const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['ERROR', 'WARNING', 'INFO', 'SUCCESS'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  // Liên kết với máy/đơn (nếu có)
  machineId: String,
  orderCode: String,
  // Dữ liệu thêm
  data: {
    errorType: String,
    errorMessage: String
  },
  // Trạng thái đã đọc
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date
}, {
  timestamps: true
});

// Index để query nhanh
notificationSchema.index({ read: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
