require('dotenv').config();
const path = require("path");
const express = require("express");
const paypal = require("./services/paypal");
const db = require("./services/db");
const license = require("./services/license");
const mailer = require("./services/mailer");

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

        db.run(
          `UPDATE orders SET 
            status = ?, 
            payerId = ?, 
            payerEmail = ?, 
            payerGivenName = ?, 
            payerSurname = ?, 
            payerCountryCode = ? 
          WHERE orderId = ?`,
          ["COMPLETED", payerInfo.payerId, payerInfo.payerEmail, payerInfo.payerGivenName, payerInfo.payerSurname, payerInfo.payerCountryCode, orderId],
          (err) => {
            if (err) console.error(`Error updating payer info for order ${orderId}:`, err);
          }
        );
        
        // Trigger license creation only if not already created
        db.get("SELECT email, licenseStatus FROM orders WHERE orderId = ?", [orderId], (err, row) => {
          if (row && row.licenseStatus === 'NOT_CREATED') {
            // POST API to create License here (include: email, orderId, etc)
            db.run("UPDATE orders SET licenseStatus = ? WHERE orderId = ?", ["REQUEST_CREATED", orderId]);
            
            license.createLicense(orderId).then(licenseResult => {
              if (licenseResult) {
                console.log(`Successfully requested license creation for order ${orderId}`);
              } else {
                console.error(`Failed to request license creation for order ${orderId}`);
                // Optionally, revert licenseStatus or add a retry mechanism
                db.run("UPDATE orders SET licenseStatus = ? WHERE orderId = ?", ["CREATION_FAILED", orderId]);
              }
            });
          }
        });

      } else if (captureData.status === "PAYER_ACTION_REQUIRED" || captureData.status === "PENDING") {
        status = "PENDING";
        message = "Thanh toán của bạn đang chờ xử lý. Chúng tôi sẽ thông báo cho bạn khi hoàn tất.";
        db.run("UPDATE orders SET status = ? WHERE orderId = ?", ["PENDING", orderId]);
      }
    }

    if (status === "FAILED") {
        db.run("UPDATE orders SET status = ? WHERE orderId = ?", ["FAILED", orderId]);
    }

    // 3. Render the approval page with the status and orderId
    res.render("approve", { status, message, orderId });

  } catch (error) {
    console.error("Error in approve route:", error);
    res.render("approve", { status: "FAILED", message: "Đã có lỗi xảy ra trong quá trình xử lý thanh toán.", orderId: req.query.token });
  }
});

app.get("/api/paypal/cancel-order", (req, res) => {
  const { token: orderId } = req.query;
  if (orderId) {
    db.get("SELECT status FROM orders WHERE orderId = ?", [orderId], (err, row) => {
      if (err) {
        console.error(`Error fetching status for canceled order ${orderId}:`, err);
        return res.redirect("/");
      }

      // Only delete the order if it was just created and not yet processed
      if (row && row.status === 'CREATED') {
        db.run("DELETE FROM orders WHERE orderId = ?", [orderId], (deleteErr) => {
          if (deleteErr) {
            console.error(`Error deleting canceled order ${orderId}:`, deleteErr);
          } else {
            console.log(`Order ${orderId} with status CREATED was canceled and deleted from DB.`);
          }
        });
      } else if (row) {
        console.log(`Order ${orderId} with status ${row.status} was canceled but not deleted.`);
        // Optionally update status to CANCELED if needed
        // db.run("UPDATE orders SET status = ? WHERE orderId = ?", ["CANCELED", orderId]);
      }
      res.redirect("/");
    });
  } else {
    res.redirect("/");
  }
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
      db.run(
        "INSERT INTO orders (orderId, email, status) VALUES (?, ?, ?)",
        [orderDetails.orderId, email, "CREATED"],
        (err) => {
          if (err) {
            console.error("Error saving order to DB:", err);
            return res.status(500).send("An error occurred while processing your payment.");
          }
          res.redirect(orderDetails.approveUrl);
        }
      );
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
  db.run(
    `UPDATE orders SET 
      webhookEventType = ?, 
      webhookResourceType = ?, 
      webhookResourceVersion = ?, 
      webhookSummary = ? 
    WHERE orderId = ?`, 
    [event_type, resource_type, resource_version, summary, orderId]
  );

  // 4. Business logic - process only PAYMENT.CAPTURE.COMPLETED
  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    console.log(`Webhook received: Order ${orderId} payment completed.`);

    db.get("SELECT email, licenseStatus, payerId FROM orders WHERE orderId = ?", [orderId], (err, row) => {
      if (err) {
        console.error(`Webhook: DB error checking license status for order ${orderId}`, err);
        return;
      }

      if (!row) {
        console.warn(`Webhook: Order ${orderId} not found in DB.`);
        return;
      }

      // If payer info hasn't been saved yet (e.g., user didn't return to /approve), save it now.
      if (!row.payerId && webhookEvent.resource?.payer) {
        const payer = webhookEvent.resource.payer;
        const payerInfo = {
          payerId: payer.payer_id,
          payerEmail: payer.email_address,
          payerGivenName: payer.name?.given_name,
          payerSurname: payer.name?.surname,
          payerCountryCode: payer.address?.country_code
        };

        console.log(`Webhook: Saving payer info for order ${orderId}`);
        db.run(
          `UPDATE orders SET 
            payerId = ?, payerEmail = ?, payerGivenName = ?, payerSurname = ?, payerCountryCode = ?
          WHERE orderId = ?`,
          [payerInfo.payerId, payerInfo.payerEmail, payerInfo.payerGivenName, payerInfo.payerSurname, payerInfo.payerCountryCode, orderId],
          (err) => {
            if (err) console.error(`Webhook: Error updating payer info for order ${orderId}:`, err);
          }
        );
      }

      if (row.licenseStatus === 'NOT_CREATED') {
        db.run("UPDATE orders SET status = ? WHERE orderId = ?", ["COMPLETED", orderId], function(err) {
          if(err) {
            console.error(`Webhook: Error updating status for order ${orderId}`, err);
            return;
          }

          if (row.email) {
            db.run("UPDATE orders SET licenseStatus = ? WHERE orderId = ?", ["REQUEST_CREATED", orderId]);
            console.log(`TODO from Webhook: Create license for ${row.email} for order ${orderId}`);
            license.createLicense(orderId).then(licenseResult => {
              if (licenseResult) {
                console.log(`Webhook: Successfully requested license creation for order ${orderId}`);
              } else {
                console.error(`Webhook: Failed to request license creation for order ${orderId}`);
                db.run("UPDATE orders SET licenseStatus = ? WHERE orderId = ?", ["CREATION_FAILED", orderId]);
              }
            });
          } else {
            console.error(`Webhook: Could not find order ${orderId} to create license.`);
          }
        });
      } else {
        console.log(`Webhook: License for order ${orderId} already requested or created (status: ${row.licenseStatus}). Ignoring webhook.`);
      }
    });
  }
  res.sendStatus(200); // Respond to PayPal to acknowledge receipt
});

// ------------------------ License Service routes ------------------------
app.post("/api/license/notify", (req, res) => {
  const { orderId, licenseKey } = req.body;

  if (!orderId || !licenseKey) {
    return res.status(400).json({ error: "Missing orderId or licenseKey" });
  }

  console.log(`Received license key for order ${orderId}`);

  // Update license status in DB
  db.run("UPDATE orders SET licenseStatus = ? WHERE orderId = ?", ["CREATED", orderId], function(err) {
    if (err) {
      console.error(`Error updating license status for order ${orderId}:`, err);
      return res.status(500).json({ error: "Database error" });
    }
    if (this.changes === 0) {
      console.warn(`License notification: Order ${orderId} not found.`);
      return res.status(404).json({ error: "Order not found" });
    }

    // Send the license key to the user's email
    db.get("SELECT email FROM orders WHERE orderId = ?", [orderId], (err, row) => {
      if (err) {
        console.error(`Error fetching email for order ${orderId}:`, err);
        return;
      }
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
    });

    res.status(200).json({ message: "License status updated successfully" });
  });
});

// ---- For Test ----
app.get("/api/paypal/orders", (req, res) => {
  db.all("SELECT * FROM orders", [], (err, rows) => {
    if (err) {
      console.error("Error fetching orders from DB:", err);
      return res.status(500).json({ error: "Failed to fetch orders." });
    }
    res.json(rows);
  });
});

app.get("/api/paypal/orders/:orderId/status", (req, res) => {
  const { orderId } = req.params;
  db.get("SELECT status, licenseStatus FROM orders WHERE orderId = ?", [orderId], (err, row) => {
    if (err) {
      console.error(`Error fetching status for order ${orderId}:`, err);
      return res.status(500).json({ error: "Failed to fetch order status." });
    }
    if (row) {
      res.json({ status: row.status, licenseStatus: row.licenseStatus });
    } else {
      res.status(404).json({ error: "Order not found." });
    }
  });
});

app.get("/api/paypal/orders/:orderId", (req, res) => {
  const { orderId } = req.params;
  db.get("SELECT * FROM orders WHERE orderId = ?", [orderId], (err, row) => {
    if (err) {
      console.error(`Error fetching order ${orderId} from DB:`, err);
      return res.status(500).json({ error: "Failed to fetch order." });
    }
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: "Order not found." });
    }
  });
});

app.get("/api/mailer/test", async (req, res) => {
  try {
    const emailContent = mailer.getLicenseEmailTemplate("CAN-abcc1234-xyz7890");
    await mailer.sendEmail("sanganhhungtuoitre123@gmail.com", "Test Email", emailContent);
    res.json({ message: "Test email sent successfully." });
    console.log("Test email sent successfully.");
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ error: "Failed to send test email." });
  }
});

// ------------------------ Start the server ------------------------
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});