require('dotenv').config();
const path = require("path");
const express = require("express");
const paypal = require("./services/paypal");
const db = require("./services/db");
const license = require("./services/license");
const mailer = require("./services/mailer");
const auth = require("./services/auth");
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

app.get("/feedback", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "feedback.html"));
});

app.get("/my-licenses", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "my-licenses.html"));
});

app.get("/verify-email", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "verify-email.html"));
});

app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "reset-password.html"));
});

// ------------------------ Authentication routes ------------------------
// Register - initiate with email verification
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }

    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: "Username must be between 3 and 50 characters" });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: "Username can only contain letters, numbers, and underscores" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const result = await auth.registerUser(username, email, password);
    res.json(result);
  } catch (error) {
    console.error("Registration error:", error.message);
    if (error.message === "Username already exists" || error.message === "Email already exists") {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// Verify email and complete registration
app.post("/api/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    const result = await auth.completeRegistration(token);
    res.json(result);
  } catch (error) {
    console.error("Email verification error:", error.message);
    res.status(400).json({ error: error.message });
  }
});

// Login (by username or email)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username/email and password are required" });
    }

    const result = await auth.loginUser(username, password);
    res.json(result);
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(401).json({ error: error.message });
  }
});

// Forgot password
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const result = await auth.requestPasswordReset(email);
    res.json(result);
  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// Reset password (from email link)
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const result = await auth.completePasswordReset(token, newPassword);
    res.json(result);
  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(400).json({ error: error.message });
  }
});

// Change password (when logged in)
app.post("/api/auth/change-password", auth.authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const result = await auth.changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  } catch (error) {
    console.error("Change password error:", error.message);
    res.status(400).json({ error: error.message });
  }
});

// Get current user
app.get("/api/auth/me", auth.authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Get user licenses
app.get("/api/user/licenses", auth.authenticateToken, async (req, res) => {
  try {
    const licenses = await auth.getUserLicenses(req.user.id);
    res.json({ licenses });
  } catch (error) {
    console.error("Error fetching licenses:", error.message);
    res.status(500).json({ error: "Failed to fetch licenses" });
  }
});

// ------------------------ Comments routes ------------------------
app.get("/api/comments", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = page * limit;

    // Get total count
    const countResult = await db.query("SELECT COUNT(*) FROM comments");
    const total = parseInt(countResult.rows[0].count);

    // Get comments with user info, newest first
    const { rows: comments } = await db.query(
      `SELECT c.id, c.user_id, c.content, c.created_at, c.updated_at, u.username 
       FROM comments c 
       JOIN users u ON c.user_id = u.id 
       ORDER BY c.created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const hasMore = offset + comments.length < total;

    res.json({ comments, total, hasMore });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

app.post("/api/comments", auth.authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: "Comment is too long (max 500 characters)" });
    }

    const { rows } = await db.query(
      `INSERT INTO comments (user_id, content) VALUES ($1, $2) 
       RETURNING id, content, created_at`,
      [userId, content.trim()]
    );

    const comment = rows[0];
    comment.username = req.user.username;

    res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// Edit comment - only owner can edit their own comment
app.put("/api/comments/:id", auth.authenticateToken, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: "Comment is too long (max 500 characters)" });
    }

    // Check if comment belongs to user
    const { rows: existingRows } = await db.query(
      "SELECT user_id FROM comments WHERE id = $1",
      [commentId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (existingRows[0].user_id !== userId) {
      return res.status(403).json({ error: "You can only edit your own comments" });
    }

    // Update comment
    const { rows } = await db.query(
      `UPDATE comments 
       SET content = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, content, created_at, updated_at`,
      [content.trim(), commentId]
    );

    const comment = rows[0];
    comment.username = req.user.username;

    res.json(comment);
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ error: "Failed to update comment" });
  }
});

// Delete comment - admin can delete any, users cannot delete
app.delete("/api/comments/:id", auth.authenticateToken, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const isAdmin = req.user.username.toLowerCase() === 'admin';

    if (!isAdmin) {
      return res.status(403).json({ error: "Only admin can delete comments" });
    }

    const result = await db.query(
      "DELETE FROM comments WHERE id = $1 RETURNING id",
      [commentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// ------------------------ Payment routes ------------------------
// Helper middleware to optionally authenticate
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

app.post("/api/pay", auth.authenticateToken, async (req, res) => {
  try {
    const { productName, productPrice, paymentMethod, currency } = req.body;
    const user = req.user;

    // Validation
    if (!productName || !productPrice || !paymentMethod) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: productName, productPrice, paymentMethod" 
      });
    }

    // User must be authenticated
    if (!user || !user.email) {
      return res.status(401).json({ 
        success: false, 
        error: "Authentication required. Please login to continue." 
      });
    }

    const email = user.email;

    // Price validation
    const price = parseFloat(productPrice);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid product price" 
      });
    }

    // Route to appropriate payment provider
    if (paymentMethod === "paypal") {
      const orderDetails = await paypal.createOrder(email, productName, price, currency || 'USD');

      if (orderDetails && orderDetails.approveUrl) {
        try {
          await db.query(
            "INSERT INTO orders (order_id, email, product_name, product_price, currency, status, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [orderDetails.orderId, email, productName, price, currency || 'USD', "CREATED", user.id]
          );
          
          return res.json({ 
            success: true, 
            approveUrl: orderDetails.approveUrl,
            orderId: orderDetails.orderId
          });
        } catch (err) {
          console.error("Error saving order to DB:", err);
          return res.status(500).json({ 
            success: false, 
            error: "Failed to save order information" 
          });
        }
      } else {
        return res.status(500).json({ 
          success: false, 
          error: "Failed to create PayPal order" 
        });
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        error: "Unsupported payment method" 
      });
    }
  } catch (error) {
    console.error("Error in /api/pay:", error);
    return res.status(500).json({ 
      success: false, 
      error: "An error occurred while processing your payment" 
    });
  }
});

// ------------------------ PayPal routes ------------------------
app.get("/paypal/approve", async (req, res) => {
  try {
    const { token: orderId } = req.query;
    if (!orderId) {
      return res.render("approve", { 
        status: "FAILED", 
        message: "Order ID not found.", 
        orderId: null,
        email: null
      });
    }

    // Get the email from database first (the one user entered in form)
    const { rows: orderRows } = await db.query("SELECT email FROM orders WHERE order_id = $1", [orderId]);
    const userEmail = orderRows[0]?.email || null;

    // 1. Capture the payment
    const captureData = await paypal.capturePayment(orderId);

    // 2. Check payment status
    let status = "FAILED";
    let message = "Payment failed. Please try again.";

    if (captureData) {
      if (captureData.status === "COMPLETED") {
        status = "COMPLETED";
        message = "Payment successful! Your license will be sent to your email.";
        
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
              payer_id = $2, 
              payer_email = $3, 
              payer_given_name = $4, 
              payer_surname = $5, 
              payer_country_code = $6 
            WHERE order_id = $7`,
            ["COMPLETED", payerInfo.payerId, payerInfo.payerEmail, payerInfo.payerGivenName, payerInfo.payerSurname, payerInfo.payerCountryCode, orderId]
          );
        } catch (err) {
          console.error(`Error updating payer info for order ${orderId}:`, err);
        }
        
        // Trigger license creation only if not already created
        const { rows } = await db.query("SELECT email, license_status FROM orders WHERE order_id = $1", [orderId]);
        const row = rows[0];
        if (row && row.license_status === 'NOT_CREATED') {
          await db.query("UPDATE orders SET license_status = $1 WHERE order_id = $2", ["REQUEST_CREATED", orderId]);
          
          license.createLicense(orderId).then(async licenseResult => {
            if (licenseResult) {
              console.log(`Successfully requested license creation for order ${orderId}`);
            } else {
              console.error(`Failed to request license creation for order ${orderId}`);
              await db.query("UPDATE orders SET license_status = $1 WHERE order_id = $2", ["CREATION_FAILED", orderId]);
            }
          });
        }

      } else if (captureData.status === "PAYER_ACTION_REQUIRED" || captureData.status === "PENDING") {
        status = "PENDING";
        message = "Your payment is pending. We will notify you when it is completed.";
        await db.query("UPDATE orders SET status = $1 WHERE order_id = $2", ["PENDING", orderId]);
      }
    }

    if (status === "FAILED") {
        await db.query("UPDATE orders SET status = $1 WHERE order_id = $2", ["FAILED", orderId]);
    }

    // 3. Render the approval page with the status, orderId, and email (from form input)
    res.render("approve", { status, message, orderId, email: userEmail });

  } catch (error) {
    console.error("Error in approve route:", error);
    res.render("approve", { 
      status: "FAILED", 
      message: "An error occurred while processing the payment.", 
      orderId: req.query.token,
      email: null
    });
  }
});

app.get("/api/paypal/cancel-order", async (req, res) => {
  const { token: orderId } = req.query;
  if (orderId) {
    try {
      const { rows } = await db.query("SELECT status FROM orders WHERE order_id = $1", [orderId]);
      const row = rows[0];

      // Only delete the order if it was just created and not yet processed
      if (row && row.status === 'CREATED') {
        await db.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
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
      webhook_event_type = $1, 
      webhook_resource_type = $2, 
      webhook_resource_version = $3, 
      webhook_summary = $4 
    WHERE order_id = $5`, 
    [event_type, resource_type, resource_version, summary, orderId]
  );

  // 4. Business logic - process only PAYMENT.CAPTURE.COMPLETED
  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    console.log(`Webhook received: Order ${orderId} payment completed.`);

    try {
      const { rows } = await db.query("SELECT email, license_status, payer_id FROM orders WHERE order_id = $1", [orderId]);
      let row = rows[0];

      if (!row) {
        console.warn(`Webhook: Order ${orderId} not found in DB.`);
        return res.sendStatus(200); // Acknowledge and stop
      }

      // If payer info hasn't been saved yet (e.g., user didn't return to /approve), save it now.
      if (!row.payer_id && webhookEvent.resource?.payer) {
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
            payer_id = $1, payer_email = $2, payer_given_name = $3, payer_surname = $4, payer_country_code = $5
          WHERE order_id = $6`,
          [payerInfo.payerId, payerInfo.payerEmail, payerInfo.payerGivenName, payerInfo.payerSurname, payerInfo.payerCountryCode, orderId]
        );
      }

      if (row.license_status === 'NOT_CREATED') {
        await db.query("UPDATE orders SET status = $1 WHERE order_id = $2", ["COMPLETED", orderId]);

        if (row.email) {
          await db.query("UPDATE orders SET license_status = $1 WHERE order_id = $2", ["REQUEST_CREATED", orderId]);
          console.log(`TODO from Webhook: Create license for ${row.email} for order ${orderId}`);
          license.createLicense(orderId).then(async licenseResult => {
            if (licenseResult) {
              console.log(`Webhook: Successfully requested license creation for order ${orderId}`);
            } else {
              console.error(`Webhook: Failed to request license creation for order ${orderId}`);
              await db.query("UPDATE orders SET license_status = $1 WHERE order_id = $2", ["CREATION_FAILED", orderId]);
            }
          });
        } else {
          console.error(`Webhook: Could not find email for order ${orderId} to create license.`);
        }
      } else {
        console.log(`Webhook: License for order ${orderId} already requested or created (status: ${row.license_status}). Ignoring webhook.`);
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
    const updateResult = await db.query("UPDATE orders SET license_status = $1 WHERE order_id = $2", ["CREATED", orderId]);

    if (updateResult.rowCount === 0) {
      console.warn(`License notification: Order ${orderId} not found.`);
      return res.status(404).json({ error: "Order not found" });
    }

    // Send the license key to the user's email
    const { rows } = await db.query(
      `SELECT email, payer_given_name, payer_surname, product_name, product_price, currency, created_at, user_id 
       FROM orders WHERE order_id = $1`, 
      [orderId]
    );
    const row = rows[0];

    if (row) {
      // Save to licenses table if user is linked
      if (row.user_id) {
        try {
          await db.query(
            `INSERT INTO licenses (user_id, order_id, product_name, license_key, purchased_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [row.user_id, orderId, row.product_name, licenseKey, row.created_at]
          );
          console.log(`License saved to licenses for user ${row.user_id}`);
        } catch (licenseErr) {
          console.error(`Error saving license to licenses:`, licenseErr);
        }
      }

      // Use payerEmail from PayPal if available, otherwise fall back to form input email
      const recipientEmail = row.email;
      
      if (recipientEmail) {
        console.log(`Sending license ${licenseKey} to ${recipientEmail} for order ${orderId}`);
        
        const customerInfo = {
          givenName: row.payer_given_name || '',
          surname: row.payer_surname || ''
        };

        const productInfo = {
          productName: row.product_name || 'CAN Analyzer License',
          productPrice: parseFloat(row.product_price) || 0,
          currency: row.currency || 'USD'
        };
        
        const emailSubject = "Your CAN Analyzer License Key";
        const emailContent = mailer.getLicenseEmailTemplate(
          licenseKey, 
          orderId, 
          customerInfo,
          productInfo,
          row.created_at
        );
        
        mailer.sendEmail(recipientEmail, emailSubject, emailContent)
          .then(() => console.log(`Successfully sent license email to ${recipientEmail}`))
          .catch(emailErr => console.error(`Failed to send license email for order ${orderId}:`, emailErr));
      } else {
        console.error(`Could not find email for order ${orderId} to send license.`);
      }
    } else {
      console.error(`Could not find order ${orderId} in database.`);
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
    const { rows } = await db.query("SELECT * FROM orders ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching orders from DB:", err);
    return res.status(500).json({ error: "Failed to fetch orders." });
  }
});

app.get("/api/paypal/orders/:orderId/status", async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows } = await db.query("SELECT status, license_status FROM orders WHERE order_id = $1", [orderId]);
    const row = rows[0];
    if (row) {
      res.json({ status: row.status, licenseStatus: row.license_status });
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
    const { rows } = await db.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
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