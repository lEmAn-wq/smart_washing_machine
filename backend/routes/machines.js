const express = require('express');
const router = express.Router();
const Machine = require('../models/Machine');

module.exports = (mqttService, io) => {
  
  // Lấy tất cả máy
  router.get('/', async (req, res) => {
    try {
      const machines = await Machine.find().sort({ _id: 1 });
      res.json(machines);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Lấy thông tin 1 máy
  router.get('/:machineId', async (req, res) => {
    try {
      const machine = await Machine.findById(req.params.machineId);
      if (!machine) {
        return res.status(404).json({ error: 'Machine not found' });
      }
      res.json(machine);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Gửi lệnh PAUSE
  router.post('/:machineId/pause', async (req, res) => {
    try {
      const machine = await Machine.findById(req.params.machineId);
      if (!machine) {
        return res.status(404).json({ error: 'Machine not found' });
      }
      
      if (machine.status !== 'RUNNING') {
        return res.status(400).json({ error: 'Machine is not running' });
      }
      
      mqttService.sendCommand(req.params.machineId, 'PAUSE');
      
      res.json({ message: 'Pause command sent' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Gửi lệnh RESUME
  router.post('/:machineId/resume', async (req, res) => {
    try {
      const machine = await Machine.findById(req.params.machineId);
      if (!machine) {
        return res.status(404).json({ error: 'Machine not found' });
      }
      
      mqttService.sendCommand(req.params.machineId, 'RESUME');
      
      res.json({ message: 'Resume command sent' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Gửi lệnh RESET (dừng hoàn toàn)
  router.post('/:machineId/reset', async (req, res) => {
    try {
      const machine = await Machine.findById(req.params.machineId);
      if (!machine) {
        return res.status(404).json({ error: 'Machine not found' });
      }
      
      mqttService.sendCommand(req.params.machineId, 'RESET');
      
      // Reset machine in DB
      machine.status = 'AVAILABLE';
      machine.currentOrderCode = null;
      await machine.save();
      
      // Emit to realtime clients
      if (io) {
        io.emit('machineUpdated', machine);
      }
      
      res.json({ message: 'Reset command sent', machine });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Đặt chế độ bảo trì
  router.post('/:machineId/maintenance', async (req, res) => {
    try {
      const { enable } = req.body;
      const machine = await Machine.findById(req.params.machineId);
      
      if (!machine) {
        return res.status(404).json({ error: 'Machine not found' });
      }
      
      if (enable && machine.status === 'RUNNING') {
        return res.status(400).json({ error: 'Cannot set maintenance while running' });
      }
      
      machine.status = enable ? 'MAINTENANCE' : 'AVAILABLE';
      await machine.save();
      
      if (io) {
        io.emit('machineUpdated', machine);
      }
      
      res.json({ message: enable ? 'Maintenance mode enabled' : 'Maintenance mode disabled', machine });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cập nhật tên máy
  router.patch('/:machineId', async (req, res) => {
    try {
      const { name } = req.body;
      const machine = await Machine.findByIdAndUpdate(
        req.params.machineId,
        { name },
        { new: true }
      );
      
      if (!machine) {
        return res.status(404).json({ error: 'Machine not found' });
      }
      
      res.json(machine);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Thống kê máy
  router.get('/:machineId/stats', async (req, res) => {
    try {
      const machine = await Machine.findById(req.params.machineId);
      if (!machine) {
        return res.status(404).json({ error: 'Machine not found' });
      }
      
      res.json({
        machineId: machine._id,
        name: machine.name,
        status: machine.status,
        totalCycles: machine.stats.totalCycles,
        todayCycles: machine.stats.todayCycles,
        lastCycleAt: machine.stats.lastCycleAt
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Khởi tạo 4 máy (chạy 1 lần)
  router.post('/init', async (req, res) => {
    try {
      const machines = [
        { _id: 'MACHINE_01', name: 'Máy giặt 1' },
        { _id: 'MACHINE_02', name: 'Máy giặt 2' },
        { _id: 'MACHINE_03', name: 'Máy giặt 3' },
        { _id: 'MACHINE_04', name: 'Máy giặt 4' }
      ];
      
      for (const m of machines) {
        await Machine.findOneAndUpdate(
          { _id: m._id },
          { $setOnInsert: m },
          { upsert: true, new: true }
        );
      }
      
      const allMachines = await Machine.find();
      res.json({ message: '4 machines initialized', machines: allMachines });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
