require('dotenv').config();
const path = require("path");
const express = require("express");
const paypal = require("./services/paypal");

const app = express();
const PORT = process.env.PORT || 5000;

// static files: /public
app.use(express.static(path.join(__dirname, "public")));

// serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/success", async (req, res) => {
  try {
    await paypal.capturePayment(req.query.token);
    // Lưu DB nếu status COMPLETED (Để xác nhận sau này có ai phàn nàn thì có thể kiểm tra)

    res.send("Payment successful! Thank you for your purchase.");
  } catch (error) {
    console.error("Error in success route:", error);


    res.status(500).send("An error occurred.");
  }
});

// PayPal payment route
app.get("/pay", async (req, res) => {
  try {
    const orderUrl = await paypal.createOrder();
    res.redirect(orderUrl);
  } catch (error) {
    console.error("Error creating PayPal order:", error);
    res.status(500).send("An error occurred while processing your payment.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});