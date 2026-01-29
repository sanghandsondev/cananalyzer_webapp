require('dotenv').config();
const path = require("path");
const express = require("express");
const paypal = require("./services/paypal");
const db = require("./services/db");

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------ View Engine Setup ------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ------------------------ Middlewares ------------------------
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());   // Use express.json() to parse JSON bodies from webhooks

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
        db.run("UPDATE orders SET status = ? WHERE orderId = ?", ["COMPLETED", orderId]);
        
        // Trigger license creation only if not already created
        db.get("SELECT email, licenseStatus FROM orders WHERE orderId = ?", [orderId], (err, row) => {
          if (row && row.licenseStatus === 'NOT_CREATED') {
            console.log(`TODO: Create license for ${row.email} for order ${orderId}`);
            // Update license status after creation
            db.run("UPDATE orders SET licenseStatus = ? WHERE orderId = ?", ["REQUEST_CREATED", orderId]);
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

app.get("/paypal/cancel-order", (req, res) => {
  const { token: orderId } = req.query;
  if (orderId) {
    db.run("DELETE FROM orders WHERE orderId = ?", [orderId], (err) => {
      if (err) {
        console.error(`Error deleting canceled order ${orderId}:`, err);
      } else {
        console.log(`Order ${orderId} canceled and deleted from DB.`);
      }
    });
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

app.post("/api/paypal/webhook", (req, res) => {
  const webhookEvent = req.body;

  // Store webhook data for auditing
  const orderId = webhookEvent.resource?.id;
  if (orderId) {
    db.run("UPDATE orders SET webhookData = ? WHERE orderId = ?", [JSON.stringify(webhookEvent), orderId]);
  }

  // We are only interested in completed checkouts
  if (webhookEvent.event_type === "CHECKOUT.ORDER.COMPLETED") {
    console.log(`Webhook received: Order ${orderId} completed.`);

    // Check if license has already been created before processing
    db.get("SELECT licenseStatus FROM orders WHERE orderId = ?", [orderId], (err, row) => {
      if (err) {
        console.error(`Webhook: DB error checking license status for order ${orderId}`, err);
        return;
      }

      if (row && row.licenseStatus === 'NOT_CREATED') {
        // Update order status in DB
        db.run("UPDATE orders SET status = ? WHERE orderId = ?", ["COMPLETED", orderId], function(err) {
          if (err) {
            console.error(`Webhook: Error updating status for order ${orderId}`, err);
            return;
          }
          // Get user email and create license
          db.get("SELECT email FROM orders WHERE orderId = ?", [orderId], (err, row) => {
            if (row) {
              console.log(`TODO from Webhook: Create license for ${row.email} for order ${orderId}`);
              // TODO: POST API to create License here
              // Update license status after creation
              db.run("UPDATE orders SET licenseStatus = ? WHERE orderId = ?", ["REQUEST_CREATED", orderId]);
            } else {
              console.error(`Webhook: Could not find order ${orderId} to create license.`);
            }
          });
        });
      } else if (row) {
        console.log(`Webhook: License for order ${orderId} already created. Ignoring webhook.`);
      } else {
        console.warn(`Webhook: Order ${orderId} not found.`);
      }
    });
  }

  res.sendStatus(200); // Respond to PayPal to acknowledge receipt
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

app.get("/api/paypal/orders", (req, res) => {
  db.all("SELECT * FROM orders", [], (err, rows) => {
    if (err) {
      console.error("Error fetching orders from DB:", err);
      return res.status(500).json({ error: "Failed to fetch orders." });
    }
    res.json(rows);
  });
});

// ------------------------ Start the server ------------------------
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});