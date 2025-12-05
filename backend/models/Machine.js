const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true // MACHINE_01, MACHINE_02, etc.
  },
  name: {
    type: String,
    default: function() {
      return 'Máy ' + this._id.replace('MACHINE_', '#');
    }
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'RUNNING', 'ERROR', 'MAINTENANCE', 'OFFLINE'],
    default: 'OFFLINE'
  },
  currentOrderCode: {
    type: String,
    default: null
  },
  
  // Realtime data from ESP32
  realtime: {
    state: { type: String, default: 'POWER_OFF' },
    progress: { type: Number, default: 0 },
    waterLevel: { type: Number, default: 0 },
    mode: { type: String, default: 'NORMAL' },
    doorOpen: { type: Boolean, default: false },
    errorCode: { type: String, default: null },
    lastUpdate: { type: Date, default: Date.now }
  },
  
  // Statistics
  stats: {
    totalCycles: { type: Number, default: 0 },
    todayCycles: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Kiểm tra và reset todayCycles nếu qua ngày mới
machineSchema.methods.checkDailyReset = function() {
  const today = new Date().toDateString();
  const lastReset = new Date(this.stats.lastResetDate).toDateString();
  
  if (today !== lastReset) {
    this.stats.todayCycles = 0;
    this.stats.lastResetDate = new Date();
  }
};

module.exports = mongoose.model('Machine', machineSchema);
