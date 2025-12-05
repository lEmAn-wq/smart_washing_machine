const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  // Thông tin khách hàng
  customerEmail: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    default: ''
  },
  customerPhone: {
    type: String,
    default: ''
  },
  
  // Thông tin đơn hàng
  package: {
    type: String,
    enum: ['BASIC', 'STANDARD', 'PREMIUM'],
    default: 'STANDARD'
  },
  price: {
    type: Number,
    default: 30000
  },
  machineId: {
    type: String,
    default: null
  },
  
  // Trạng thái
  status: {
    type: String,
    enum: ['PENDING', 'WASHING', 'DONE', 'PICKED_UP', 'CANCELLED'],
    default: 'PENDING'
  },
  progress: {
    type: Number,
    default: 0
  },
  currentPhase: {
    type: String,
    default: 'PENDING'
  },
  mode: {
    type: String,
    default: 'NORMAL'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  pickedUpAt: {
    type: Date,
    default: null
  },
  
  // Email tracking
  emailSent: {
    created: { type: Boolean, default: false },
    completed: { type: Boolean, default: false }
  }
});

// Tạo mã đơn ngẫu nhiên
orderSchema.statics.generateOrderCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

module.exports = mongoose.model('Order', orderSchema);
