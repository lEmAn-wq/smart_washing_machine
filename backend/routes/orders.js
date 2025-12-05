const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Machine = require('../models/Machine');
const emailService = require('../services/emailService');

module.exports = (mqttService) => {
  
  // Lấy tất cả đơn hàng
  router.get('/', async (req, res) => {
    try {
      const { status, date } = req.query;
      let query = {};
      
      if (status) query.status = status;
      if (date) {
        const start = new Date(date);
        const end = new Date(date);
        end.setDate(end.getDate() + 1);
        query.createdAt = { $gte: start, $lt: end };
      }
      
      const orders = await Order.find(query).sort({ createdAt: -1 });
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Lấy đơn hàng theo mã (hỗ trợ cả tra cứu công khai)
  router.get('/:orderCode', async (req, res) => {
    try {
      const order = await Order.findOne({ orderCode: req.params.orderCode.toUpperCase() })
        .populate('machineId', 'name machineNumber');
      if (!order) {
        return res.status(404).json({ message: 'Không tìm thấy đơn hàng với mã này' });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Tạo đơn hàng mới
  router.post('/', async (req, res) => {
    try {
      const { customerEmail, customerName, customerPhone, package: pkg, price } = req.body;
      
      // Tạo mã đơn unique
      let orderCode;
      let isUnique = false;
      while (!isUnique) {
        orderCode = Order.generateOrderCode();
        const existing = await Order.findOne({ orderCode });
        if (!existing) isUnique = true;
      }
      
      const order = new Order({
        orderCode,
        customerEmail,
        customerName,
        customerPhone,
        package: pkg || 'STANDARD',
        price: price || 30000
      });
      
      await order.save();
      
      // Gửi email với link theo dõi
      const emailSent = await emailService.sendOrderCreated(order);
      if (emailSent) {
        order.emailSent.created = true;
        await order.save();
      }
      
      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Gán đơn vào máy và bắt đầu giặt
  router.post('/:orderCode/start', async (req, res) => {
    try {
      const { machineId } = req.body;
      const orderCode = req.params.orderCode.toUpperCase();
      
      // Kiểm tra máy có available không
      const machine = await Machine.findById(machineId);
      if (!machine || machine.status !== 'AVAILABLE') {
        return res.status(400).json({ error: 'Machine not available' });
      }
      
      // Cập nhật order
      const order = await Order.findOneAndUpdate(
        { orderCode },
        {
          machineId,
          status: 'WASHING',
          startedAt: new Date()
        },
        { new: true }
      );
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Cập nhật machine
      machine.status = 'RUNNING';
      machine.currentOrderCode = orderCode;
      await machine.save();
      
      // Gửi lệnh START đến ESP32
      mqttService.sendCommand(machineId, 'START', { orderCode });
      
      res.json({ message: 'Wash started', order });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Đánh dấu đã lấy đồ
  router.post('/:orderCode/pickup', async (req, res) => {
    try {
      const order = await Order.findOneAndUpdate(
        { orderCode: req.params.orderCode.toUpperCase() },
        {
          status: 'PICKED_UP',
          pickedUpAt: new Date()
        },
        { new: true }
      );
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Hủy đơn
  router.delete('/:orderCode', async (req, res) => {
    try {
      const order = await Order.findOneAndUpdate(
        { orderCode: req.params.orderCode.toUpperCase(), status: 'PENDING' },
        { status: 'CANCELLED' },
        { new: true }
      );
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found or cannot be cancelled' });
      }
      
      res.json({ message: 'Order cancelled', order });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Thống kê
  router.get('/stats/summary', async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const [todayOrders, totalOrders, pendingOrders, washingOrders] = await Promise.all([
        Order.countDocuments({ createdAt: { $gte: today } }),
        Order.countDocuments(),
        Order.countDocuments({ status: 'PENDING' }),
        Order.countDocuments({ status: 'WASHING' })
      ]);
      
      const todayRevenue = await Order.aggregate([
        { $match: { createdAt: { $gte: today }, status: { $in: ['DONE', 'PICKED_UP'] } } },
        { $group: { _id: null, total: { $sum: '$price' } } }
      ]);
      
      res.json({
        todayOrders,
        totalOrders,
        pendingOrders,
        washingOrders,
        todayRevenue: todayRevenue[0]?.total || 0
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
