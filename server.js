require('dotenv').config();
const path = require("path");
const express = require("express");
const paypal = require("./services/paypal");
const db = require("./services/db");

const app = express();
const PORT = process.env.PORT || 5000;

// static files: /public
app.use(express.static(path.join(__dirname, "public")));

// serve html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/approve-success", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "approve-success.html"));
});

app.get("/approve-fail", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "approve-fail.html"));
});

// ----------------------------------------------------

app.get("/approve", async (req, res) => {
  try {
    const { token: orderId, PayerID } = req.query;
    if (!orderId) {
      return res.redirect("/approve-fail");
    }

    // 1. Sau khi người dùng xác nhận thanh toán ở PayPal
    const captureData = await paypal.capturePayment(orderId);

    // 2. Kiểm tra kết quả thanh toán
    if (!captureData || captureData.status !== "COMPLETED") {
      // Update status in DB to FAILED
      db.run("UPDATE orders SET status = ? WHERE orderId = ?", ["FAILED", orderId]);
      return res.redirect("/approve-fail");
    }

    // Update status in DB to COMPLETED
    db.run("UPDATE orders SET status = ? WHERE orderId = ?", ["COMPLETED", orderId]);

    // 3. TODO POST API tạo License ở đây
    // Send cả email User nhập (lấy từ DB)
    db.get("SELECT email FROM orders WHERE orderId = ?", [orderId], (err, row) => {
      if (row) {
        console.log(`TODO: Create license for ${row.email} for order ${orderId}`);
      }
    });

    // 4. Redirect tới approve-success.html. Có button trở về Home Page
    res.redirect("/approve-success");

  } catch (error) {
    console.error("Error in approve route:", error);
    res.redirect("/approve-fail");
  }
});

// PayPal payment route
app.get("/paypal/pay", async (req, res) => {
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

app.get("/cancel-order", (req, res) => {
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

// API to get all orders
app.get("/api/orders", (req, res) => {
  db.all("SELECT * FROM orders", [], (err, rows) => {
    if (err) {
      console.error("Error fetching orders from DB:", err);
      return res.status(500).json({ error: "Failed to fetch orders." });
    }
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});