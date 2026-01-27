require('dotenv').config();
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 5000;

// static files: /public
app.use(express.static(path.join(__dirname, "public")));

// serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});