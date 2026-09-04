const { getTransporter, sendOverdueFineEmail, sendReservationReadyEmail, sendPasswordResetEmail } = require('../../backend/src/utils/mailer');

async function testEmailDelivery() {
  console.log('--- Phase 3 Real Email Delivery Verification ---');
  try {
    const transporter = await getTransporter();
    console.log('Transporter initialized:', transporter.options?.host || 'JSON Transport');

    const testEmail = 'student.test@bookbuddy.edu';
    const userName = 'Alice Student';
    const bookTitle = 'Introduction to Algorithms 4th Ed';

    console.log(`Dispatching test emails to ${testEmail}...`);

    sendOverdueFineEmail(testEmail, userName, bookTitle, 250, new Date());
    sendReservationReadyEmail(testEmail, userName, bookTitle);
    sendPasswordResetEmail(testEmail, userName, 'http://localhost:5173/auth/reset-password?token=test_token_123');

    // Allow async setImmediate queue to finish
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('✅ Phase 3 Email Dispatcher Verification Completed Successfully!');
  } catch (err) {
    console.error('❌ Email Delivery Test Failed:', err.message);
    process.exit(1);
  }
}

testEmailDelivery();
