console.log("testing paypal service");

const axios = require("axios");

async function generateAccessToken() {
    const response = await axios({
        url: process.env.PAYPAL_BASE_URL + "/v1/oauth2/token",
        method: "post",
        data: "grant_type=client_credentials",
        auth: {
            username: process.env.PAYPAL_CLIENT_ID,
            password: process.env.PAYPAL_SECRET,
        }
    });

    return response.data.access_token;
}

exports.createOrder = async function(email) {
    const accessToken = await generateAccessToken();

    const orderData = {
        intent: "CAPTURE",
        purchase_units: [
            {
                items: [
                    {
                        name: "Can Analyzer License",
                        description: "1 Year Subscription For Can Analyzer License",
                        quantity: "1",
                        unit_amount: {
                            currency_code: "USD",
                            value: "100.00"
                        }
                    },
                ],

                amount: {
                    currency_code: "USD",
                    value: "100.00",
                    breakdown: {
                        item_total: {
                            currency_code: "USD",
                            value: "100.00"
                        }
                    }
                }
            }
        ],
        application_context: {
            return_url: process.env.BASE_URL + "/approve",
            cancel_url: process.env.BASE_URL + "/cancel-order",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            brand_name: "CAN Analyzer Home Page"
        }
    };

    // if (email) {
    //     orderData.payer = {
    //         email_address: email
    //     };
    // }

    try {
        const response = await axios({
            url: process.env.PAYPAL_BASE_URL + "/v2/checkout/orders",
            method: "post",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
            },
            data: JSON.stringify(orderData)
        });

        // console.log("Create Order Response:");
        console.log(response.data);

        return {
            approveUrl: response.data.links.find(link => link.rel === "approve").href,
            orderId: response.data.id
        };
    } catch (error) {
        console.error("Error creating order:", error.response ? error.response.data : error.message);
        return null;
    }
}

exports.capturePayment = async function(orderId) {
    const accessToken = await generateAccessToken();

    try {
        const response = await axios({
            url: process.env.PAYPAL_BASE_URL + `/v2/checkout/orders/${orderId}/capture`,
            method: "post",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
            }
        });

        console.log("Capture Payment Response:");
        console.log(response.data);

        return response.data;
    } catch (error) {
        console.error("Error capturing payment:", error.response ? error.response.data : error.message);
        // Trả về null nếu có lỗi, ví dụ: thanh toán bị từ chối
        return null;
    }
}