// Script khởi tạo admin từ .env vào database
require('dotenv').config();
const mongoose = require('mongoose');

async function initAdmin() {
  console.log('🔄 Connecting to MongoDB...');
  
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected!');
  
  // Tạo Admin model trực tiếp (không cần hash vì đã hash sẵn)
  const adminSchema = new mongoose.Schema({
    username: String,
    password: String,
    name: String,
    role: String,
    isActive: Boolean
  }, { timestamps: true });
  
  const Admin = mongoose.model('Admin', adminSchema);
  
  // Kiểm tra đã có admin chưa
  const existingAdmin = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
  
  if (existingAdmin) {
    console.log('⚠️ Admin already exists:', existingAdmin.username);
    console.log('   Updating password...');
    existingAdmin.password = process.env.ADMIN_PASSWORD_HASH;
    await existingAdmin.save();
    console.log('✅ Password updated!');
  } else {
    // Tạo admin mới với password đã hash sẵn từ .env
    const admin = new Admin({
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD_HASH, // Đã hash sẵn: 123456
      name: 'Administrator',
      role: 'admin',
      isActive: true
    });
    
    await admin.save();
    console.log('✅ Admin created successfully!');
  }
  
  console.log('\n📋 Admin Info:');
  console.log('   Username:', process.env.ADMIN_USERNAME);
  console.log('   Password: 123456 (plaintext)');
  console.log('   Hash:', process.env.ADMIN_PASSWORD_HASH?.substring(0, 30) + '...');
  
  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

initAdmin().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
