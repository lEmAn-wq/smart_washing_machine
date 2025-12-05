// Test script - kiểm tra MongoDB và Email
require('dotenv').config();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

async function testMongoDB() {
  console.log('🔄 Testing MongoDB connection...');
  console.log('URI:', process.env.MONGODB_URI?.substring(0, 50) + '...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully!');
    
    // Test write
    const testCollection = mongoose.connection.db.collection('test_connection');
    await testCollection.insertOne({ test: true, timestamp: new Date() });
    console.log('✅ Write test passed!');
    
    // Clean up
    await testCollection.deleteMany({ test: true });
    console.log('✅ Cleanup done!');
    
    await mongoose.disconnect();
    return true;
  } catch (error) {
    console.error('❌ MongoDB Error:', error.message);
    return false;
  }
}

async function testEmail() {
  console.log('\n🔄 Testing Email service...');
  console.log('SMTP Host:', process.env.SMTP_HOST);
  console.log('SMTP User:', process.env.SMTP_USER);
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection verified!');
    
    // Send test email
    const info = await transporter.sendMail({
      from: `"Smart Laundry Test" <${process.env.SMTP_USER}>`,
      to: 'leman2772020@gmail.com',
      subject: '🧪 Test Email - Smart Laundry System',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
          <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px;">
            <h1 style="color: #3b82f6; text-align: center;">🧺 Smart Laundry</h1>
            <hr style="border: none; border-top: 2px solid #e5e7eb; margin: 20px 0;">
            <p>Xin chào!</p>
            <p>Đây là email test từ hệ thống <strong>Smart Laundry</strong>.</p>
            <p>Nếu bạn nhận được email này, nghĩa là cấu hình email đã hoạt động tốt! ✅</p>
            <hr style="border: none; border-top: 2px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px; text-align: center;">
              Gửi lúc: ${new Date().toLocaleString('vi-VN')}
            </p>
          </div>
        </div>
      `
    });
    
    console.log('✅ Email sent successfully!');
    console.log('   Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Email Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('🧪 SMART LAUNDRY - CONNECTION TEST');
  console.log('='.repeat(50));
  
  const mongoOk = await testMongoDB();
  const emailOk = await testEmail();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESULTS:');
  console.log('   MongoDB:', mongoOk ? '✅ OK' : '❌ FAILED');
  console.log('   Email:  ', emailOk ? '✅ OK' : '❌ FAILED');
  console.log('='.repeat(50));
  
  process.exit(mongoOk && emailOk ? 0 : 1);
}

main();
