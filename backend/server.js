require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const MqttService = require('./services/mqttService');
const authRouter = require('./routes/auth');
const ordersRouter = require('./routes/orders');
const machinesRouter = require('./routes/machines');
const notificationsRouter = require('./routes/notifications');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',  // Admin
  'http://localhost:3001',  // Customer
  process.env.FRONTEND_URL
].filter(Boolean);

// Socket.io với CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: allowedOrigins
}));
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Kết nối Database
connectDB();

// Khởi tạo MQTT Service
const mqttService = new MqttService(io);
mqttService.connect();

// Public routes
app.use('/api/auth', authRouter);

// Route công khai cho customer tracking (không cần auth)
app.get('/api/orders/:orderCode', async (req, res, next) => {
  // Cho phép truy cập công khai nếu là tracking
  if (req.query.track === 'true') {
    const Order = require('./models/Order');
    try {
      const order = await Order.findOne({ orderCode: req.params.orderCode.toUpperCase() });
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      return res.json(order);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
  next();
});

// Protected routes (cần đăng nhập)
app.use('/api/orders', authMiddleware, ordersRouter(mqttService));
app.use('/api/machines', authMiddleware, machinesRouter(mqttService, io));
app.use('/api/notifications', authMiddleware, notificationsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    mqtt: mqttService.isConnected() ? 'connected' : 'disconnected'
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
  
  // Admin gửi lệnh qua socket
  socket.on('sendCommand', async (data) => {
    const { machineId, command, payload } = data;
    console.log(`[Socket.io] Command from admin: ${command} to ${machineId}`);
    mqttService.sendCommand(machineId, command, payload);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('========================================');
  console.log('🧺 Smart Laundry Backend Server');
  console.log('========================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 MQTT Broker: ${process.env.MQTT_BROKER || 'broker.hivemq.com'}`);
  console.log(`🗄️  MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Using default'}`);
  console.log('========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});
