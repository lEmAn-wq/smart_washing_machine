const mqtt = require('mqtt');
const Order = require('../models/Order');
const Machine = require('../models/Machine');
const Notification = require('../models/Notification');
const emailService = require('./emailService');

class MqttService {
  constructor(io) {
    this.io = io;
    this.client = null;
  }

  connect() {
    this.client = mqtt.connect(process.env.MQTT_BROKER);

    this.client.on('connect', () => {
      console.log('✅ MQTT Connected to broker');
      
      // Subscribe to all machine topics
      this.client.subscribe('laundry/+/status');
      this.client.subscribe('laundry/errors');
      this.client.subscribe('laundry/events');
    });

    this.client.on('message', async (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (topic.includes('/status')) {
          await this.handleMachineStatus(data);
        } else if (topic === 'laundry/errors') {
          await this.handleError(data);
        } else if (topic === 'laundry/events') {
          await this.handleEvent(data);
        }
      } catch (error) {
        console.error('MQTT message error:', error);
      }
    });

    this.client.on('error', (error) => {
      console.error('MQTT Error:', error);
    });
  }

  // Xử lý status update từ máy giặt
  async handleMachineStatus(data) {
    const { machineId, state, progress, waterLevel, mode, orderCode, doorOpen, errorCode } = data;
    
    // Cập nhật machine trong DB
    let machine = await Machine.findById(machineId);
    
    if (!machine) {
      // Tạo mới nếu chưa có
      machine = new Machine({
        _id: machineId,
        name: `Máy #${machineId.replace('MACHINE_', '')}`
      });
    }
    
    // Xác định status dựa trên state
    let status = 'AVAILABLE';
    if (state === 'POWER_OFF') status = 'OFFLINE';
    else if (state === 'READY') status = 'AVAILABLE';
    else if (state === 'ERROR_DOOR' || state === 'ERROR_WATER') status = 'ERROR';
    else if (state !== 'DONE') status = 'RUNNING';
    
    machine.status = status;
    machine.currentOrderCode = orderCode || null;
    machine.realtime = {
      state,
      progress,
      waterLevel,
      mode,
      doorOpen,
      errorCode: errorCode || null,
      lastUpdate: new Date()
    };
    
    await machine.save();
    
    // Cập nhật order nếu có
    if (orderCode) {
      await Order.findOneAndUpdate(
        { orderCode },
        {
          status: state === 'DONE' ? 'DONE' : 'WASHING',
          progress,
          currentPhase: state,
          mode,
          machineId
        }
      );
    }
    
    // Emit to frontend via Socket.io
    this.io.emit('machineUpdate', {
      machineId,
      status,
      realtime: machine.realtime,
      orderCode
    });
    
    // Emit order update
    if (orderCode) {
      this.io.emit('orderUpdate', {
        orderCode,
        progress,
        state,
        mode
      });
    }
  }

  // Xử lý error từ máy giặt
  async handleError(data) {
    const { machineId, errorType, errorMessage, orderCode } = data;
    
    console.log(`⚠️ Error from ${machineId}: ${errorType}`);
    
    // Tạo thông báo lỗi trong DB
    const notification = await Notification.create({
      type: 'ERROR',
      title: `Lỗi ${machineId}`,
      message: errorMessage || `Máy ${machineId} gặp lỗi: ${errorType}`,
      machineId,
      orderCode,
      data: {
        errorType,
        errorMessage
      }
    });
    
    // Emit to admin frontend (realtime)
    this.io.emit('newNotification', notification);
    this.io.emit('machineError', {
      machineId,
      errorType,
      errorMessage,
      orderCode,
      timestamp: new Date()
    });
  }

  // Xử lý events (DONE, ONLINE, etc.)
  async handleEvent(data) {
    const { machineId, event, orderCode, mode } = data;
    
    console.log(`📢 Event from ${machineId}: ${event}`);
    
    if (event === 'DONE' && orderCode) {
      // Cập nhật order
      const order = await Order.findOneAndUpdate(
        { orderCode },
        {
          status: 'DONE',
          progress: 100,
          currentPhase: 'DONE',
          completedAt: new Date(),
          mode
        },
        { new: true }
      );
      
      if (order && !order.emailSent.completed) {
        // Gửi email thông báo cho khách
        await emailService.sendOrderCompleted(order);
        order.emailSent.completed = true;
        await order.save();
      }
      
      // Cập nhật machine stats
      await Machine.findByIdAndUpdate(machineId, {
        $inc: { 'stats.totalCycles': 1, 'stats.todayCycles': 1 },
        status: 'AVAILABLE',
        currentOrderCode: null
      });
      
      // Emit to frontend
      this.io.emit('orderCompleted', { orderCode, machineId });
    }
    
    if (event === 'ONLINE') {
      await Machine.findByIdAndUpdate(machineId, {
        status: 'AVAILABLE',
        'realtime.lastUpdate': new Date()
      }, { upsert: true });
      
      this.io.emit('machineOnline', { machineId });
    }
  }

  // Gửi lệnh đến máy giặt
  sendCommand(machineId, command, data = {}) {
    const topic = `laundry/${machineId}/command`;
    const message = JSON.stringify({ command, ...data });
    
    this.client.publish(topic, message);
    console.log(`📤 Command sent to ${machineId}: ${command}`);
  }

  // Kiểm tra kết nối MQTT
  isConnected() {
    return this.client && this.client.connected;
  }
}

module.exports = MqttService;
