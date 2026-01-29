document.addEventListener('DOMContentLoaded', () => {
  const resultContainer = document.getElementById('resultContainer');
  if (!resultContainer) return;

  const orderId = resultContainer.dataset.orderId;
  let currentStatus = resultContainer.dataset.status;

  if (!orderId || currentStatus !== 'PENDING') {
    // Don't poll if there's no orderId or the status is final (COMPLETED/FAILED)
    return;
  }

  const pollInterval = 3000; // Poll every 3 seconds
  const maxPollTime = 300000; // Stop polling after 5 minutes (300,000 ms)
  let elapsedTime = 0;

  const statusTitle = document.getElementById('statusTitle');
  const statusMessage = document.getElementById('statusMessage');

  const pollStatus = setInterval(async () => {
    elapsedTime += pollInterval;

    if (elapsedTime > maxPollTime) {
      clearInterval(pollStatus);
      console.log('Stopped polling due to timeout.');
      return;
    }

    try {
      const response = await fetch(`/api/paypal/orders/${orderId}/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();

      if (data.status && data.status !== currentStatus) {
        currentStatus = data.status; // Update current status

        // Update UI based on new status
        if (currentStatus === 'COMPLETED') {
          statusTitle.textContent = 'Thanh toán thành công!';
          statusTitle.className = 'result-title--success';
          statusMessage.textContent = 'Thanh toán thành công! Giấy phép sẽ được gửi đến email của bạn.';
          clearInterval(pollStatus); // Stop polling on success
        } else if (currentStatus === 'FAILED') {
          statusTitle.textContent = 'Thanh toán thất bại';
          statusTitle.className = 'result-title--fail';
          statusMessage.textContent = 'Thanh toán thất bại. Vui lòng thử lại.';
          clearInterval(pollStatus); // Stop polling on failure
        }
        // If status is still PENDING, do nothing and let it poll again.
      }
    } catch (error) {
      console.error('Error polling for status:', error);
      // Optional: Stop polling on error to avoid spamming the server
      // clearInterval(pollStatus);
    }
  }, pollInterval);
});
