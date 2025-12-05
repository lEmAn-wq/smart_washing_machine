const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Middleware xác thực JWT
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const admin = await Admin.findById(decoded.id).select('-password');
      if (!admin || !admin.isActive) {
        return res.status(401).json({ error: 'Token không hợp lệ' });
      }
      
      req.admin = admin;
      next();
    } catch (jwtError) {
      return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Lỗi xác thực' });
  }
};

// Middleware kiểm tra role admin
const adminOnly = (req, res, next) => {
  if (req.admin?.role !== 'admin') {
    return res.status(403).json({ error: 'Không có quyền truy cập' });
  }
  next();
};

module.exports = { authMiddleware, adminOnly };
