console.log("main.js loaded");

const buyNowBtn = document.getElementById("buyNowBtn");
const paymentModal = document.getElementById("paymentModal");
const paypalBtn = document.getElementById("paypalBtn");

function openModal() {
  if (!paymentModal) return;
  paymentModal.classList.add("is-open");
  paymentModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  if (!paymentModal) return;
  paymentModal.classList.remove("is-open");
  paymentModal.setAttribute("aria-hidden", "true");
}

buyNowBtn?.addEventListener("click", openModal);

paypalBtn?.addEventListener("click", function() {
          window.location.href = "/pay";
});

// Sửa lại dùng axios để gọi API PayPal chứ k phải xài window.location.href = "/pay";
// Để xử lý response các kiểu 200, 4xx, 5xx từ server.js

paymentModal?.addEventListener("click", (e) => {
  const target = e.target;
  if (target?.dataset?.close === "true") closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

