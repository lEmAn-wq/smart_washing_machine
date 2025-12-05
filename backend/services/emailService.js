const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  // Gửi email khi tạo đơn (với link theo dõi)
  async sendOrderCreated(order) {
    const trackingUrl = `${process.env.FRONTEND_URL}/track/${order.orderCode}`;
    
    const mailOptions = {
      from: `"Tiệm Giặt ABC" <${process.env.EMAIL_USER}>`,
      to: order.customerEmail,
      subject: `🧺 Đơn giặt #${order.orderCode} đã được tạo`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
            .order-info { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .btn { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🧺 Tiệm Giặt ABC</h1>
              <p>Đơn giặt của bạn đã được tạo!</p>
            </div>
            <div class="content">
              <p>Xin chào${order.customerName ? ' ' + order.customerName : ''},</p>
              <p>Đơn giặt của bạn đã được tiếp nhận và đang chờ xử lý.</p>
              
              <div class="order-info">
                <h3>📋 Thông tin đơn hàng</h3>
                <p><strong>Mã đơn:</strong> ${order.orderCode}</p>
                <p><strong>Gói dịch vụ:</strong> ${order.package}</p>
                <p><strong>Giá:</strong> ${order.price.toLocaleString('vi-VN')}đ</p>
                <p><strong>Trạng thái:</strong> Đang chờ</p>
              </div>
              
              <p>Bạn có thể theo dõi trạng thái đơn giặt theo thời gian thực tại đây:</p>
              
              <center>
                <a href="${trackingUrl}" class="btn">📱 Theo dõi đơn hàng</a>
              </center>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                Hoặc truy cập: <a href="${trackingUrl}">${trackingUrl}</a>
              </p>
            </div>
            <div class="footer">
              <p>Tiệm Giặt ABC - 123 Nguyễn Văn A, Q.1, TP.HCM</p>
              <p>Hotline: 0901234567</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${order.customerEmail} - Order created`);
      return true;
    } catch (error) {
      console.error('❌ Email error:', error.message);
      return false;
    }
  }

  // Gửi email khi giặt xong
  async sendOrderCompleted(order) {
    const mailOptions = {
      from: `"Tiệm Giặt ABC" <${process.env.EMAIL_USER}>`,
      to: order.customerEmail,
      subject: `✅ Đơn giặt #${order.orderCode} đã hoàn thành!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
            .success-icon { font-size: 60px; }
            .order-info { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-icon">✅</div>
              <h1>Đồ của bạn đã giặt xong!</h1>
            </div>
            <div class="content">
              <p>Xin chào${order.customerName ? ' ' + order.customerName : ''},</p>
              <p>Đơn giặt <strong>#${order.orderCode}</strong> của bạn đã hoàn thành!</p>
              
              <div class="order-info">
                <h3>📋 Chi tiết</h3>
                <p><strong>Mã đơn:</strong> ${order.orderCode}</p>
                <p><strong>Máy giặt:</strong> ${order.machineId || 'N/A'}</p>
                <p><strong>Chế độ:</strong> ${order.mode}</p>
                <p><strong>Hoàn thành lúc:</strong> ${new Date().toLocaleString('vi-VN')}</p>
              </div>
              
              <p style="font-size: 18px; text-align: center; margin: 20px 0;">
                🏃 <strong>Vui lòng đến tiệm để nhận đồ!</strong>
              </p>
              
              <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B;">
                <p style="margin: 0;"><strong>📍 Địa chỉ:</strong> 123 Nguyễn Văn A, Q.1, TP.HCM</p>
                <p style="margin: 5px 0 0 0;"><strong>⏰ Giờ mở cửa:</strong> 7:00 - 22:00</p>
              </div>
            </div>
            <div class="footer">
              <p>Cảm ơn bạn đã sử dụng dịch vụ của Tiệm Giặt ABC!</p>
              <p>Hotline: 0901234567</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${order.customerEmail} - Order completed`);
      return true;
    } catch (error) {
      console.error('❌ Email error:', error.message);
      return false;
    }
  }

  // Gửi email thông báo lỗi cho Admin
  async sendErrorNotification(machineId, errorType, errorMessage, orderCode) {
    const mailOptions = {
      from: `"Hệ thống Tiệm Giặt" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `⚠️ [CẢNH BÁO] Máy ${machineId} gặp lỗi!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #FEE2E2; padding: 20px; border-radius: 0 0 10px 10px; }
            .error-info { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ CẢNH BÁO LỖI MÁY GIẶT</h1>
            </div>
            <div class="content">
              <div class="error-info">
                <p><strong>🖥️ Máy:</strong> ${machineId}</p>
                <p><strong>❌ Loại lỗi:</strong> ${errorType}</p>
                <p><strong>📝 Chi tiết:</strong> ${errorMessage}</p>
                <p><strong>📋 Đơn hàng:</strong> ${orderCode || 'Không có'}</p>
                <p><strong>⏰ Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
              </div>
              <p style="color: #991B1B;"><strong>Vui lòng kiểm tra máy ngay!</strong></p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Error notification sent to admin`);
      return true;
    } catch (error) {
      console.error('❌ Admin email error:', error.message);
      return false;
    }
  }
}

module.exports = new EmailService();
