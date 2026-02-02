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
                            value: "1.00"
                        }
                    },
                ],

                amount: {
                    currency_code: "USD",
                    value: "1.00",
                    breakdown: {
                        item_total: {
                            currency_code: "USD",
                            value: "1.00"
                        }
                    }
                }
            }
        ],
        application_context: {
            return_url: process.env.BASE_URL + "paypal/approve",
            cancel_url: process.env.BASE_URL + "/api/paypal/cancel-order",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            brand_name: "CAN Analyzer Home Page"
        }
    };

    if (email) {
        orderData.payer = {
            email_address: email
        };
    }

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
        const errorData = error.response ? error.response.data : null;
        console.error("Error capturing payment:", errorData || error.message);
        
        // Handle cases where payer action is required (e.g. 3D Secure)
        if (errorData && errorData.name === 'UNPROCESSABLE_ENTITY' && errorData.details?.[0]?.issue === 'PAYER_ACTION_REQUIRED') {
            console.log("Payer action is required to complete the payment.");
            return { status: 'PAYER_ACTION_REQUIRED' };
        }
        
        // For other errors, return null
        return null;
    }
}

/**
 * Verify PayPal webhook signature.
 * @param {object} params
 * @param {object} params.headers - req.headers
 * @param {object} params.event - parsed JSON event object
 * @param {Buffer|string} params.rawBody - raw request body
 */
exports.verifyWebhookSignature = async function ({ headers, event, rawBody }) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error("Missing PAYPAL_WEBHOOK_ID");
  }

  const authAlgo = headers["paypal-auth-algo"];
  const certUrl = headers["paypal-cert-url"];
  const transmissionId = headers["paypal-transmission-id"];
  const transmissionSig = headers["paypal-transmission-sig"];
  const transmissionTime = headers["paypal-transmission-time"];

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return { verified: false, reason: "Missing PayPal signature headers" };
  }

  const accessToken = await generateAccessToken();

  const requestBody = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
    webhook_event: event,
  };

  const resp = await axios({
    url: process.env.PAYPAL_BASE_URL + "/v1/notifications/verify-webhook-signature",
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    data: requestBody,
  });

  const status = resp.data?.verification_status; // "VERIFIED" | "FAILED"
  return { verified: status === "VERIFIED", status };
};