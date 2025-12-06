import { SESClient, SendEmailCommand, VerifyEmailIdentityCommand, GetIdentityVerificationAttributesCommand } from '@aws-sdk/client-ses';
import { pool } from './pool';

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Configurable app name and URLs - set via environment variables
const APP_NAME = process.env.APP_NAME || 'Kindred';
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const EMAIL_FROM = process.env.EMAIL_FROM || `${APP_NAME} <noreply@example.com>`;

// Email types for logging
export type EmailType = 'invite' | 'welcome' | 'password_reset' | 'verification' | 'notification';

/**
 * Log an email send attempt to the database
 */
async function logEmail(
  emailType: EmailType,
  recipient: string,
  subject: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO email_log (email_type, recipient, subject, success, error_message, sent_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [emailType, recipient, subject, success, errorMessage || null]
    );
  } catch (error) {
    console.error('[Email] Failed to log email:', error);
  }
}

/**
 * Verify an email address in SES (for sandbox mode).
 * This sends a verification email to the recipient.
 */
export async function verifyEmailForSandbox(email: string): Promise<boolean> {
  try {
    // Check if already verified
    const checkResponse = await ses.send(new GetIdentityVerificationAttributesCommand({
      Identities: [email]
    }));

    const status = checkResponse.VerificationAttributes?.[email]?.VerificationStatus;
    if (status === 'Success') {
      console.log(`[Email] ${email} already verified in SES`);
      return true;
    }

    // Send verification email
    await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: email }));
    console.log(`[Email] Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to verify email:', error);
    return false;
  }
}

interface SendInviteEmailParams {
  to: string;
  inviteUrl: string;
  role: string;
  inviterName: string;
  inviterEmail: string;
}

export async function sendInviteEmail({ to, inviteUrl, role, inviterName, inviterEmail }: SendInviteEmailParams): Promise<boolean> {
  const subject = `${inviterName} invited you to ${APP_NAME}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3d22 0%, #0f1f11 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #2c5530; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌳 ${APP_NAME}</h1>
      <p>Genealogy Database</p>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p><strong>${inviterName}</strong> has invited you to join the ${APP_NAME} genealogy database as a <strong>${role}</strong>.</p>
      <p>Click the button below to accept your invitation and create your account:</p>
      <p style="text-align: center;">
        <a href="${inviteUrl}" class="button">Accept Invitation</a>
      </p>
      <p style="font-size: 12px; color: #6b7280;">Or copy this link: ${inviteUrl}</p>
      <p>This invitation will expire in 7 days.</p>
      <p>Best regards,<br>${inviterName}</p>
    </div>
    <div class="footer">
      <p>${APP_NAME} • <a href="${APP_URL}">${APP_URL.replace('https://', '')}</a></p>
    </div>
  </div>
</body>
</html>`;

  const textBody = `
${inviterName} invited you to ${APP_NAME}

You've been invited to join as a ${role}.

Accept your invitation: ${inviteUrl}

This invitation will expire in 7 days.

Best regards,
${inviterName}
`;

  try {
    await ses.send(new SendEmailCommand({
      Source: EMAIL_FROM,
      ReplyToAddresses: [inviterEmail],
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: htmlBody },
          Text: { Data: textBody }
        }
      }
    }));
    console.log(`[Email] Invite sent to ${to} from ${inviterEmail}`);
    await logEmail('invite', to, subject, true);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send invite:', error);
    await logEmail('invite', to, subject, false, (error as Error).message);
    return false;
  }
}

/**
 * Send a welcome email to a new user after they accept an invitation
 */
interface SendWelcomeEmailParams {
  to: string;
  userName: string;
}

export async function sendWelcomeEmail({ to, userName }: SendWelcomeEmailParams): Promise<boolean> {
  const subject = `Welcome to ${APP_NAME}!`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3d22 0%, #0f1f11 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #2c5530; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .feature { margin: 15px 0; padding-left: 25px; position: relative; }
    .feature::before { content: "✓"; position: absolute; left: 0; color: #2c5530; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌳 Welcome to ${APP_NAME}!</h1>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>
      <p>Your account has been created successfully. You now have access to explore and contribute to the family tree.</p>
      <h3>Getting Started</h3>
      <div class="feature">Browse the family tree and discover your ancestors</div>
      <div class="feature">View detailed person profiles with sources and media</div>
      <div class="feature">Search for specific family members</div>
      <div class="feature">Explore coats of arms and family crests</div>
      <p style="text-align: center;">
        <a href="${APP_URL}" class="button">Start Exploring</a>
      </p>
      <p>If you have any questions, please reach out to the site administrator.</p>
    </div>
    <div class="footer">
      <p>${APP_NAME} • <a href="${APP_URL}">${APP_URL.replace('https://', '')}</a></p>
    </div>
  </div>
</body>
</html>`;

  const textBody = `
Welcome to ${APP_NAME}!

Hi ${userName},

Your account has been created successfully. You now have access to explore and contribute to the family tree.

Getting Started:
- Browse the family tree and discover your ancestors
- View detailed person profiles with sources and media
- Search for specific family members
- Explore coats of arms and family crests

Visit: ${APP_URL}

If you have any questions, please reach out to the site administrator.
`;

  try {
    await ses.send(new SendEmailCommand({
      Source: EMAIL_FROM,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: htmlBody },
          Text: { Data: textBody }
        }
      }
    }));
    console.log(`[Email] Welcome email sent to ${to}`);
    await logEmail('welcome', to, subject, true);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send welcome email:', error);
    await logEmail('welcome', to, subject, false, (error as Error).message);
    return false;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  const subject = `Reset your ${APP_NAME} password`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3d22 0%, #0f1f11 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #2c5530; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌳 ${APP_NAME}</h1>
      <p>Password Reset</p>
    </div>
    <div class="content">
      <p>Hi,</p>
      <p>We received a request to reset your password for your ${APP_NAME} account.</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      <p style="font-size: 12px; color: #6b7280;">Or copy this link: ${resetUrl}</p>
      <div class="warning">
        <strong>⚠️ Security Notice:</strong> This link expires in 1 hour. If you didn't request this reset, please ignore this email.
      </div>
    </div>
    <div class="footer">
      <p>${APP_NAME} • <a href="${APP_URL}">${APP_URL.replace('https://', '')}</a></p>
    </div>
  </div>
</body>
</html>`;

  const textBody = `
Reset your ${APP_NAME} password

We received a request to reset your password.

Reset your password: ${resetUrl}

This link expires in 1 hour.

If you didn't request this reset, please ignore this email.
`;

  try {
    await ses.send(new SendEmailCommand({
      Source: EMAIL_FROM,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: htmlBody },
          Text: { Data: textBody }
        }
      }
    }));
    console.log(`[Email] Password reset email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send password reset:', error);
    return false;
  }
}

