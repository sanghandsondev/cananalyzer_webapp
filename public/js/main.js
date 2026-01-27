console.log("main.js loaded");

const buyNowBtn = document.getElementById("buyNowBtn");
const paymentModal = document.getElementById("paymentModal");

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

paymentModal?.addEventListener("click", (e) => {
  const target = e.target;
  if (target?.dataset?.close === "true") closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});