import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Nodemailer Transporter Configuration
 * Uses environment variables for security.
 */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
  secure: false, // true for port 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email with subject and HTML content.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML message body
 */
export const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Investment Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log('✅ Email sent:', info.messageId);
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
  }
};

/**
 * Send deposit notification to user and admin.
 * @param {Object} user - user info
 * @param {number} amount - deposited amount
 * @param {string} status - status ("approved", "rejected", etc.)
 */
export const sendDepositNotification = async (user, amount, status) => {
  const subject = `Deposit ${status === 'approved' ? 'Approved' : 'Rejected'}`;
  const html = `
    <h2>Hello ${user.name || 'User'},</h2>
    <p>Your deposit of <strong>UGX ${amount.toLocaleString()}</strong> has been <strong>${status}</strong>.</p>
    <p>Thank you for using our platform!</p>
  `;

  await sendEmail(user.email, subject, html);

  // Notify admin
  await sendEmail(
    process.env.ADMIN_EMAIL,
    `Deposit ${status} for ${user.email}`,
    `<p>User ${user.email} made a deposit of UGX ${amount.toLocaleString()} — now marked as <strong>${status}</strong>.</p>`
  );
};

/**
 * Send withdrawal notification to user and admin.
 * @param {Object} user - user info
 * @param {number} amount - withdrawn amount
 * @param {string} status - status ("approved" or "rejected")
 * @param {string} [reason] - reason for rejection (optional)
 */
export const sendWithdrawalNotification = async (user, amount, status, reason) => {
  const subject = `Withdrawal ${status === 'approved' ? 'Approved' : 'Rejected'}`;
  const html = `
    <h2>Hello ${user.name || 'User'},</h2>
    <p>Your withdrawal request of <strong>UGX ${amount.toLocaleString()}</strong> has been <strong>${status}</strong>.</p>
    ${
      status === 'rejected' && reason
        ? `<p><strong>Reason:</strong> ${reason}</p>`
        : ''
    }
    <p>Thank you for using our platform!</p>
  `;

  await sendEmail(user.email, subject, html);

  // Notify admin
  await sendEmail(
    process.env.ADMIN_EMAIL,
    `Withdrawal ${status} for ${user.email}`,
    `<p>User ${user.email} withdrawal of UGX ${amount.toLocaleString()} was <strong>${status}</strong>${
      reason ? ` (Reason: ${reason})` : ''
    }.</p>`
  );
};
