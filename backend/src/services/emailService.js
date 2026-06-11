import nodemailer from 'nodemailer';

const createTransport = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Sends a password reset email to the user.
 * @param {string} toEmail - Recipient email address
 * @param {string} resetUrl - The full reset URL with token
 * @param {string} username - The user's display name
 */
export const sendPasswordResetEmail = async (toEmail, resetUrl, username = 'Operator') => {
  const transporter = createTransport();

  const clientName = process.env.CLIENT_NAME || 'Swarm Agentic Lab';
  const primaryColor = process.env.THEME_PRIMARY || '#3b82f6';

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; }
    .wrapper { max-width: 560px; margin: 40px auto; padding: 0 20px; }
    .card { background: #ffffff; border-radius: 20px; border: 1px solid rgba(0,0,0,0.06); overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, ${primaryColor}18 0%, ${primaryColor}08 100%); padding: 40px 40px 32px; text-align: center; border-bottom: 1px solid rgba(0,0,0,0.04); }
    .logo { width: 56px; height: 56px; background: ${primaryColor}18; border: 1.5px solid ${primaryColor}30; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 16px; }
    .brand { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; margin: 0; }
    .body { padding: 40px; }
    .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; }
    .text { font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 28px 0; }
    .btn-wrap { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background: ${primaryColor}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 16px 40px; border-radius: 12px; letter-spacing: 0.3px; }
    .divider { height: 1px; background: #f1f5f9; margin: 28px 0; }
    .url-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; font-size: 12px; color: #64748b; word-break: break-all; }
    .footer { padding: 20px 40px 32px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5; }
    .expire-badge { display: inline-block; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); color: #d97706; border-radius: 8px; padding: 6px 14px; font-size: 13px; font-weight: 700; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo">🤖</div>
        <p class="brand">${clientName}</p>
      </div>
      <div class="body">
        <p class="greeting">Password Reset Request</p>
        <p class="text">
          Hi <strong>${username}</strong>,<br /><br />
          We received a request to reset your password. Click the button below to choose a new one.
          If you didn't request this, you can safely ignore this email — your account remains secure.
        </p>

        <div class="expire-badge">⏱ This link expires in 1 hour</div>

        <div class="btn-wrap">
          <a href="${resetUrl}" class="btn">Reset My Password →</a>
        </div>

        <div class="divider"></div>

        <p class="text" style="font-size:13px; margin-bottom:8px;">Or paste this URL directly into your browser:</p>
        <div class="url-box">${resetUrl}</div>
      </div>
      <div class="footer">
        <p>This email was sent by ${clientName} on behalf of your account.<br />
        If you did not request a password reset, no action is needed.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `"${clientName}" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Reset your ${clientName} password`,
    html: htmlBody,
  });
};
