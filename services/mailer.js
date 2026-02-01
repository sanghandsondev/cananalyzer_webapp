const axios = require("axios");

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