const axios = require("axios");

exports.getLicenseEmailTemplate = function(licenseKey) {
    return `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CAN Analyzer License Key</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
                .header { font-size: 24px; font-weight: bold; color: #003087; }
                .license-key { background-color: #f5f5f5; padding: 10px; border: 1px dashed #ccc; font-family: monospace; font-size: 16px; margin: 20px 0; }
                .footer { margin-top: 20px; font-size: 12px; color: #777; }
            </style>
        </head>
        <body>
            <div class="container">
                <p class="header">Cảm ơn bạn đã mua CAN Analyzer!</p>
                <p>Chúng tôi đã nhận được thanh toán của bạn. Dưới đây là license key của bạn:</p>
                <div class="license-key">${licenseKey}</div>
                <p>Vui lòng giữ key này ở nơi an toàn. Bạn sẽ cần nó để kích hoạt phần mềm.</p>
                <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi.</p>
                <p class="footer">Trân trọng,<br>Đội ngũ CAN Analyzer</p>
            </div>
        </body>
        </html>
    `;
}

exports.sendEmail = async function(to, subject, htmlContent) {
    const response = await axios({
        method: 'post',
        url: 'https://api.brevo.com/v3/smtp/email',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json'
        },
        data: {
            sender: { 
                name: 'CAN Analyzer',
                email: '' + process.env.SENDER_EMAIL 
            },
            to: [{ email: to }],
            subject: subject,
            htmlContent: htmlContent
        }
    });

    console.log("Email sent response:");
    console.log(response.data);
}