const axios = require("axios");

exports.getLicenseEmailTemplate = function(licenseKey, orderId, customerInfo, productInfo, createdAt) {
    const { givenName, surname } = customerInfo;
    const { productName, productPrice, currency } = productInfo;
    const fullName = `${givenName || ''} ${surname || ''}`.trim() || 'Valued Customer';
    const formattedDate = new Date(createdAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your CAN Analyzer License Key</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #f5f7fa;
                }
                .email-container {
                    max-width: 600px;
                    margin: 40px auto;
                    background-color: #ffffff;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                .header {
                    background: linear-gradient(135deg, #003087 0%, #0070ba 100%);
                    padding: 32px 24px;
                    text-align: center;
                }
                .header-title {
                    color: #ffffff;
                    font-size: 28px;
                    font-weight: 700;
                    margin: 0 0 8px 0;
                }
                .header-subtitle {
                    color: #e3f2fd;
                    font-size: 16px;
                    margin: 0;
                }
                .content {
                    padding: 32px 24px;
                }
                .greeting {
                    font-size: 18px;
                    color: #1a1a1a;
                    margin: 0 0 16px 0;
                }
                .message {
                    font-size: 15px;
                    color: #4a4a4a;
                    margin: 0 0 24px 0;
                }
                .license-section {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    padding: 24px;
                    margin: 24px 0;
                    text-align: center;
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                }
                .license-label {
                    color: #ffffff;
                    font-size: 14px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin: 0 0 12px 0;
                }
                .license-key {
                    background-color: #ffffff;
                    color: #1a1a1a;
                    padding: 20px;
                    border-radius: 8px;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 20px;
                    font-weight: 700;
                    letter-spacing: 2px;
                    word-break: break-all;
                    margin: 0 0 12px 0;
                    border: 3px solid #f0f0f0;
                }
                .license-hint {
                    color: #e3f2fd;
                    font-size: 13px;
                    margin: 0;
                }
                .order-details {
                    background-color: #f8f9fa;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 24px 0;
                }
                .order-details-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin: 0 0 16px 0;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #e0e0e0;
                }
                .details-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .detail-row {
                    border-bottom: 1px solid #e8e8e8;
                }
                .detail-row:last-child {
                    border-bottom: none;
                }
                .detail-label {
                    font-size: 14px;
                    color: #666;
                    font-weight: 500;
                    padding: 8px 8px 8px 0;
                    text-align: left;
                    width: 40%;
                }
                .detail-value {
                    font-size: 14px;
                    color: #1a1a1a;
                    font-weight: 600;
                    padding: 8px 0 8px 8px;
                    text-align: right;
                    width: 60%;
                }
                .important-note {
                    background-color: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 16px;
                    margin: 24px 0;
                    border-radius: 4px;
                }
                .important-note p {
                    margin: 0;
                    font-size: 14px;
                    color: #856404;
                }
                .support-section {
                    background-color: #f8f9fa;
                    border-radius: 8px;
                    padding: 24px;
                    margin: 24px 0;
                    text-align: center;
                }
                .support-text {
                    font-size: 15px;
                    color: #4a4a4a;
                    margin: 0 0 20px 0;
                }
                .support-button {
                    display: inline-block;
                    background: linear-gradient(135deg,rgb(44, 75, 134) 0%,rgb(18, 121, 190) 100%);
                    color: #ffffff !important;
                    text-decoration: none;
                    padding: 14px 32px;
                    border-radius: 6px;
                    font-size: 16px;
                    font-weight: 600;
                    transition: transform 0.2s;
                }
                .support-button:hover {
                    transform: translateY(-2px);
                }
                .footer {
                    background-color: #f8f9fa;
                    padding: 24px;
                    text-align: center;
                    border-top: 1px solid #e0e0e0;
                }
                .footer-text {
                    font-size: 13px;
                    color: #777;
                    margin: 0 0 8px 0;
                }
                .brand {
                    font-size: 14px;
                    color: #003087;
                    font-weight: 600;
                    margin: 0;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <h1 class="header-title">🎉 License Activated!</h1>
                    <p class="header-subtitle">Thank you for choosing CAN Analyzer</p>
                </div>
                
                <div class="content">
                    <p class="greeting">Hello ${fullName},</p>
                    <p class="message">
                        Your payment has been successfully processed. We're excited to have you on board! 
                    </p>
                    
                    <div class="license-section">
                        <p class="license-label">Your License Key</p>
                        <div class="license-key">${licenseKey}</div>
                        <p class="license-hint">💡 Select and copy this key to activate your tool</p>
                    </div>
                    
                    <div class="order-details">
                        <h3 class="order-details-title">Order Information</h3>
                        <table class="details-table">
                            <tr class="detail-row">
                                <td class="detail-label">Order ID:</td>
                                <td class="detail-value">${orderId}</td>
                            </tr>
                            <tr class="detail-row">
                                <td class="detail-label">Product:</td>
                                <td class="detail-value">${productName}</td>
                            </tr>
                            <tr class="detail-row">
                                <td class="detail-label">Price:</td>
                                <td class="detail-value">$${productPrice.toFixed(2)} ${currency}</td>
                            </tr>
                            <tr class="detail-row">
                                <td class="detail-label">Customer Name:</td>
                                <td class="detail-value">${fullName}</td>
                            </tr>
                            <tr class="detail-row">
                                <td class="detail-label">License Created:</td>
                                <td class="detail-value">${formattedDate}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div class="important-note">
                        <p>
                            <strong>⚠️ Important:</strong> Please keep this license key in a safe place. 
                            You will need it to activate your tool. Do not share this key with others.
                        </p>
                    </div>
                    
                    <div class="support-section">
                        <p class="support-text">
                            If you have any questions or need assistance, feel free to reply to this email 
                            or visit our support section for more help.
                        </p>
                        <a href="${process.env.BASE_URL}/#support" class="support-button">
                            Visit Support Center
                        </a>
                    </div>
                </div>
                
                <div class="footer">
                    <p class="footer-text">
                        Thank you for choosing CAN Analyzer for your development needs.
                    </p>
                    <p class="brand">CAN Analyzer Team</p>
                </div>
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