require('dotenv').config();
const path = require("path");
const express = require("express");
const paypal = require("./services/paypal");
const db = require("./services/db");
const license = require("./services/license");
const mailer = require("./services/mailer");
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------ View Engine Setup ------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ------------------------ Middlewares ------------------------
app.use(express.static(path.join(__dirname, "public")));
// app.use(express.json());
app.use((req, res, next) => {
  if (req.path === "/api/paypal/webhook") return next();  // Webhook sẽ parse raw riêng để phục vụ verify signature.
  return express.json()(req, res, next);
});

// ------------------------ Serve html (static files) from /views ------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/products/cananalyzer", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "products", "cananalyzer.html"));
});

app.get("/products/cbcmsimulator", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "products", "cbcmsimulator.html"));
});

// ------------------------ PayPal routes ------------------------
app.get("/paypal/approve", async (req, res) => {
  try {
    const { token: orderId } = req.query;
    if (!orderId) {
      return res.render("approve", { status: "FAILED", message: "Không tìm thấy mã đơn hàng.", orderId: null });
    }

    // 1. Capture the payment
    const captureData = await paypal.capturePayment(orderId);

    // 2. Check payment status
    let status = "FAILED";
    let message = "Thanh toán thất bại. Vui lòng thử lại.";

    if (captureData) {
      if (captureData.status === "COMPLETED") {
        status = "COMPLETED";
        message = "Thanh toán thành công! Giấy phép sẽ được gửi đến email của bạn.";
        
        // Extract payer info from capture data
        const payer = captureData.payer;
        const payerInfo = {
          payerId: payer.payer_id,
          payerEmail: payer.email_address,
          payerGivenName: payer.name.given_name,
          payerSurname: payer.name.surname,
          payerCountryCode: payer.address.country_code
        };

        try {
          await db.query(
            `UPDATE orders SET 
              status = $1, 
              payerId = $2, 
              payerEmail = $3, 
              payerGivenName = $4, 
              payerSurname = $5, 
              payerCountryCode = $6 
            WHERE orderId = $7`,
            ["COMPLETED", payerInfo.payerId, payerInfo.payerEmail, payerInfo.payerGivenName, payerInfo.payerSurname, payerInfo.payerCountryCode, orderId]
          );
        } catch (err) {
          console.error(`Error updating payer info for order ${orderId}:`, err);
        }
        
        // Trigger license creation only if not already created
        const { rows } = await db.query("SELECT email, licenseStatus FROM orders WHERE orderId = $1", [orderId]);
        const row = rows[0];
        if (row && row.licensestatus === 'NOT_CREATED') {
          // POST API to create License here (include: email, orderId, etc)
          await db.query("UPDATE orders SET licenseStatus = $1 WHERE orderId = $2", ["REQUEST_CREATED", orderId]);
          
          license.createLicense(orderId).then(async licenseResult => {
            if (licenseResult) {
              console.log(`Successfully requested license creation for order ${orderId}`);
            } else {
              console.error(`Failed to request license creation for order ${orderId}`);
              // Optionally, revert licenseStatus or add a retry mechanism
              await db.query("UPDATE orders SET licenseStatus = $1 WHERE orderId = $2", ["CREATION_FAILED", orderId]);
            }
          });
        }

      } else if (captureData.status === "PAYER_ACTION_REQUIRED" || captureData.status === "PENDING") {
        status = "PENDING";
        message = "Thanh toán của bạn đang chờ xử lý. Chúng tôi sẽ thông báo cho bạn khi hoàn tất.";
        await db.query("UPDATE orders SET status = $1 WHERE orderId = $2", ["PENDING", orderId]);
      }
    }

    if (status === "FAILED") {
        await db.query("UPDATE orders SET status = $1 WHERE orderId = $2", ["FAILED", orderId]);
    }

    // 3. Render the approval page with the status and orderId
    res.render("approve", { status, message, orderId });

  } catch (error) {
    console.error("Error in approve route:", error);
    res.render("approve", { status: "FAILED", message: "Đã có lỗi xảy ra trong quá trình xử lý thanh toán.", orderId: req.query.token });
  }
});

app.get("/api/paypal/cancel-order", async (req, res) => {
  const { token: orderId } = req.query;
  if (orderId) {
    try {
      const { rows } = await db.query("SELECT status FROM orders WHERE orderId = $1", [orderId]);
      const row = rows[0];

      // Only delete the order if it was just created and not yet processed
      if (row && row.status === 'CREATED') {
        await db.query("DELETE FROM orders WHERE orderId = $1", [orderId]);
        console.log(`Order ${orderId} with status CREATED was canceled and deleted from DB.`);
      } else if (row) {
        console.log(`Order ${orderId} with status ${row.status} was canceled but not deleted.`);
        // Optionally update status to CANCELED if needed
        // await db.query("UPDATE orders SET status = $1 WHERE orderId = $2", ["CANCELED", orderId]);
      }
    } catch (err) {
      console.error(`Error processing canceled order ${orderId}:`, err);
    }
  }
  res.redirect("/");
});

app.get("/api/paypal/pay", async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).send("Email is required.");
    }

    const orderDetails = await paypal.createOrder(email);

    if (orderDetails && orderDetails.approveUrl) {
      // Save order to DB
      try {
        await db.query(
          "INSERT INTO orders (orderId, email, status) VALUES ($1, $2, $3)",
          [orderDetails.orderId, email, "CREATED"]
        );
        res.redirect(orderDetails.approveUrl);
      } catch (err) {
        console.error("Error saving order to DB:", err);
        return res.status(500).send("An error occurred while processing your payment.");
      }
    } else {
      res.status(500).send("An error occurred while creating the PayPal order.");
    }
  } catch (error) {
    console.error("Error creating PayPal order:", error);
    res.status(500).send("An error occurred while processing your payment.");
  }
});

app.post("/api/paypal/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  let webhookEvent;

  try {
    webhookEvent = JSON.parse(req.body.toString("utf8"));
  } catch (error) {
    console.error("Webhook: Error parsing JSON body:", error);
    return res.sendStatus(400);
  }

  // 1. Verify signature
  try {
    const result = await paypal.verifyWebhookSignature({
      headers: req.headers,
      event: webhookEvent,
      rawBody: req.body
    });

    if (!result || !result.verified) {
      console.warn("Webhook signature NOT verified:", result);
      return res.sendStatus(401);
    }
  } catch(e) {
    console.error("Webhook: Error verifying signature:", e.message);
    return res.sendStatus(500);
  }
  
  // 2. Extract orderId correctly (VERY IMPORTANT)
  const eventType = webhookEvent.event_type;
  let orderId = null;

  if (eventType?.startsWith("CHECKOUT.ORDER.")) {
    orderId = webhookEvent.resource?.id || null;
  }

  if (eventType?.startsWith("PAYMENT.CAPTURE.")) {
    orderId = webhookEvent.resource?.supplementary_data?.related_ids?.order_id ||
              webhookEvent.resource?.supplementary_data?.related_ids?.orderId ||
              null;
  }

  console.log(`Verified webhook: ${eventType} for order ${orderId}`);

  if (!orderId) {
    console.warn("Webhook: orderId not found in event resource.");
    return res.sendStatus(400);
  }

  // 3. Store webhook data for auditing
  const { event_type, resource_type, resource_version, summary } = webhookEvent;
  await db.query(
    `UPDATE orders SET 
      webhookEventType = $1, 
      webhookResourceType = $2, 
      webhookResourceVersion = $3, 
      webhookSummary = $4 
    WHERE orderId = $5`, 
    [event_type, resource_type, resource_version, summary, orderId]
  );

  // 4. Business logic - process only PAYMENT.CAPTURE.COMPLETED
  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    console.log(`Webhook received: Order ${orderId} payment completed.`);

    try {
      const { rows } = await db.query("SELECT email, licenseStatus, payerId FROM orders WHERE orderId = $1", [orderId]);
      let row = rows[0];

      if (!row) {
        console.warn(`Webhook: Order ${orderId} not found in DB.`);
        return res.sendStatus(200); // Acknowledge and stop
      }

      // If payer info hasn't been saved yet (e.g., user didn't return to /approve), save it now.
      if (!row.payerid && webhookEvent.resource?.payer) {
        const payer = webhookEvent.resource.payer;
        const payerInfo = {
          payerId: payer.payer_id,
          payerEmail: payer.email_address,
          payerGivenName: payer.name?.given_name,
          payerSurname: payer.name?.surname,
          payerCountryCode: payer.address?.country_code
        };

        console.log(`Webhook: Saving payer info for order ${orderId}`);
        await db.query(
          `UPDATE orders SET 
            payerId = $1, payerEmail = $2, payerGivenName = $3, payerSurname = $4, payerCountryCode = $5
          WHERE orderId = $6`,
          [payerInfo.payerId, payerInfo.payerEmail, payerInfo.payerGivenName, payerInfo.payerSurname, payerInfo.payerCountryCode, orderId]
        );
      }

      if (row.licensestatus === 'NOT_CREATED') {
        await db.query("UPDATE orders SET status = $1 WHERE orderId = $2", ["COMPLETED", orderId]);

        if (row.email) {
          await db.query("UPDATE orders SET licenseStatus = $1 WHERE orderId = $2", ["REQUEST_CREATED", orderId]);
          console.log(`TODO from Webhook: Create license for ${row.email} for order ${orderId}`);
          license.createLicense(orderId).then(async licenseResult => {
            if (licenseResult) {
              console.log(`Webhook: Successfully requested license creation for order ${orderId}`);
            } else {
              console.error(`Webhook: Failed to request license creation for order ${orderId}`);
              await db.query("UPDATE orders SET licenseStatus = $1 WHERE orderId = $2", ["CREATION_FAILED", orderId]);
            }
          });
        } else {
          console.error(`Webhook: Could not find email for order ${orderId} to create license.`);
        }
      } else {
        console.log(`Webhook: License for order ${orderId} already requested or created (status: ${row.licensestatus}). Ignoring webhook.`);
      }
    } catch (err) {
      console.error(`Webhook: DB error processing order ${orderId}`, err);
    }
  }
  res.sendStatus(200); // Respond to PayPal to acknowledge receipt
});

// ------------------------ License Service routes ------------------------
app.post("/api/license/notify", async (req, res) => {
  const { orderId, licenseKey } = req.body;

  if (!orderId || !licenseKey) {
    return res.status(400).json({ error: "Missing orderId or licenseKey" });
  }

  console.log(`Received license key for order ${orderId}`);

  try {
    // Update license status in DB
    const updateResult = await db.query("UPDATE orders SET licenseStatus = $1 WHERE orderId = $2", ["CREATED", orderId]);

    if (updateResult.rowCount === 0) {
      console.warn(`License notification: Order ${orderId} not found.`);
      return res.status(404).json({ error: "Order not found" });
    }

    // Send the license key to the user's email
    const { rows } = await db.query("SELECT email FROM orders WHERE orderId = $1", [orderId]);
    const row = rows[0];

    if (row && row.email) {
      console.log(`Sending license ${licenseKey} to ${row.email} for order ${orderId}`);
      const emailSubject = "Your CAN Analyzer License Key";
      const emailContent = mailer.getLicenseEmailTemplate(licenseKey);
      mailer.sendEmail(row.email, emailSubject, emailContent)
        .then(() => console.log(`Successfully sent license email to ${row.email}`))
        .catch(emailErr => console.error(`Failed to send license email for order ${orderId}:`, emailErr));
    } else {
      console.error(`Could not find email for order ${orderId} to send license.`);
    }

    res.status(200).json({ message: "License status updated successfully" });
  } catch (err) {
    console.error(`Error processing license notification for order ${orderId}:`, err);
    return res.status(500).json({ error: "Database error" });
  }
});

// ------------------------ API routes for Audit Order Info ------------------------
app.get("/api/paypal/orders", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM orders ORDER BY createdAt DESC");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching orders from DB:", err);
    return res.status(500).json({ error: "Failed to fetch orders." });
  }
});

app.get("/api/paypal/orders/:orderId/status", async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows } = await db.query("SELECT status, licenseStatus FROM orders WHERE orderId = $1", [orderId]);
    const row = rows[0];
    if (row) {
      res.json({ status: row.status, licenseStatus: row.licensestatus });
    } else {
      res.status(404).json({ error: "Order not found." });
    }
  } catch (err) {
    console.error(`Error fetching status for order ${orderId}:`, err);
    return res.status(500).json({ error: "Failed to fetch order status." });
  }
});

app.get("/api/paypal/orders/:orderId", async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows } = await db.query("SELECT * FROM orders WHERE orderId = $1", [orderId]);
    const row = rows[0];
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: "Order not found." });
    }
  } catch (err) {
    console.error(`Error fetching order ${orderId} from DB:`, err);
    return res.status(500).json({ error: "Failed to fetch order." });
  }
});

// ------------------------ API routes for Mock ------------------------

app.post("/default/License_Generate_Func", async (req, res) => {
  const { orderId } = req.body;
  console.log(`Mock License Service: Received license creation request for order ${orderId}`);
  
  // Simulate license key generation
  const licenseKey = `CAN-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  // Simulate async operation
  setTimeout(() => {
    console.log(`Mock License Service: Created license ${licenseKey} for order ${orderId}`);
    axios.post(process.env.BASE_URL + '/api/license/notify', {
      orderId,
      licenseKey
    }).then(() => {
      console.log(`Mock License Service: Notified main server about license for order ${orderId}`);
    }).catch(err => {
      console.error(`Mock License Service: Failed to notify main server for order ${orderId}:`, err.message);
    });
  }, 1000);

  res.sendStatus(200);
});

// ------------------------ Start the server ------------------------
const startServer = async () => {
  await db.initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

startServer();