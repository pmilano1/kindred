import {
  GetIdentityVerificationAttributesCommand,
  SESClient,
  SendEmailCommand,
  VerifyEmailIdentityCommand,
} from '@aws-sdk/client-ses';
import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';
import { pool } from './pool';

// Configurable app name and URLs - set via environment variables
const APP_NAME = process.env.APP_NAME || 'Kindred';
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Email transport configuration
type EmailTransportType = 'ses' | 'smtp' | 'none';

interface EmailConfig {
  type: EmailTransportType;
  configured: boolean;
  details?: string;
  from?: string;
  sesRegion?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
}

// Cache email config for 5 minutes (same as settings cache)
let emailConfigCache: { config: EmailConfig; timestamp: number } | null = null;
const EMAIL_CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear email config cache (called when settings are updated)
 */
export function clearEmailConfigCache() {
  emailConfigCache = null;
  // Also clear SES and SMTP clients to pick up new config
  sesClient = null;
  smtpTransporter = null;
}

/**
 * Get email configuration from database settings
 * Falls back to environment variables for backward compatibility
 */
async function getEmailConfigFromDatabase(): Promise<EmailConfig> {
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM settings WHERE key LIKE 'email_%'`,
    );

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    const provider = settings.email_provider || 'none';

    // If provider is explicitly set in database, use database config
    if (provider === 'ses') {
      const from = settings.email_from;
      if (!from) {
        return {
          type: 'ses',
          configured: false,
          details: 'SES selected but email_from not configured',
        };
      }
      return {
        type: 'ses',
        configured: true,
        details: `AWS SES (from: ${from})`,
        from,
        sesRegion: settings.email_ses_region || 'us-east-1',
      };
    }

    if (provider === 'smtp') {
      const host = settings.email_smtp_host;
      const port = parseInt(settings.email_smtp_port || '587', 10);
      const from = settings.email_from;

      if (!host || !from) {
        return {
          type: 'smtp',
          configured: false,
          details: 'SMTP selected but host or from address not configured',
        };
      }

      return {
        type: 'smtp',
        configured: true,
        details: `SMTP (${host}:${port})`,
        from,
        smtpHost: host,
        smtpPort: port,
        smtpSecure: settings.email_smtp_secure === 'true',
        smtpUser: settings.email_smtp_user || undefined,
        smtpPassword: settings.email_smtp_password || undefined,
      };
    }

    // If provider is 'none' or not set, fall back to environment variables
    return getEmailConfigFromEnv();
  } catch (_error) {
    // Database not available or settings table doesn't exist - fall back to env
    return getEmailConfigFromEnv();
  }
}

/**
 * Get email configuration from environment variables (backward compatibility)
 */
function getEmailConfigFromEnv(): EmailConfig {
  const EMAIL_FROM =
    process.env.EMAIL_FROM || `${APP_NAME} <noreply@example.com>`;

  // Check for AWS SES configuration
  if (
    process.env.EMAIL_FROM &&
    !process.env.EMAIL_FROM.includes('noreply@example.com')
  ) {
    return {
      type: 'ses',
      configured: true,
      details: `AWS SES (from: ${process.env.EMAIL_FROM})`,
      from: process.env.EMAIL_FROM,
      sesRegion: process.env.AWS_REGION || 'us-east-1',
    };
  }

  // Check for SMTP configuration
  if (process.env.SMTP_HOST) {
    const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_PORT);
    return {
      type: 'smtp',
      configured: smtpConfigured,
      details: smtpConfigured
        ? `SMTP (${process.env.SMTP_HOST}:${process.env.SMTP_PORT})`
        : 'SMTP host configured but missing port',
      from: EMAIL_FROM,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
      smtpSecure: process.env.SMTP_SECURE === 'true',
      smtpUser: process.env.SMTP_USER,
      smtpPassword: process.env.SMTP_PASSWORD,
    };
  }

  return {
    type: 'none',
    configured: false,
    details:
      'No email transport configured. Configure in admin settings or set EMAIL_FROM for AWS SES or SMTP_HOST for SMTP.',
  };
}

/**
 * Determine which email transport is configured
 * Priority: Database settings > Environment variables
 */
export async function getEmailConfig(): Promise<EmailConfig> {
  // Return cached if valid
  if (
    emailConfigCache &&
    Date.now() - emailConfigCache.timestamp < EMAIL_CONFIG_CACHE_TTL
  ) {
    return emailConfigCache.config;
  }

  const config = await getEmailConfigFromDatabase();
  emailConfigCache = { config, timestamp: Date.now() };
  return config;
}

/**
 * Check if email is properly configured
 */
export async function isEmailConfigured(): Promise<boolean> {
  const config = await getEmailConfig();
  return config.configured;
}

// Initialize SES client (lazy, only if needed)
let sesClient: SESClient | null = null;
function getSESClient(config: EmailConfig): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: config.sesRegion || 'us-east-1',
    });
  }
  return sesClient;
}

// Initialize SMTP transporter (lazy, only if needed)
let smtpTransporter: Transporter | null = null;
function getSMTPTransporter(config: EmailConfig): Transporter {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.smtpSecure || false,
      auth: config.smtpUser
        ? {
            user: config.smtpUser,
            pass: config.smtpPassword || '',
          }
        : undefined,
    });
  }
  return smtpTransporter;
}

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/**
 * Send an email using the configured transport (SES or SMTP)
 */
async function sendEmail(message: EmailMessage): Promise<boolean> {
  const config = await getEmailConfig();

  if (!config.configured) {
    console.error('[Email] No email transport configured');
    return false;
  }

  const fromAddress = config.from || `${APP_NAME} <noreply@example.com>`;

  try {
    if (config.type === 'ses') {
      const ses = getSESClient(config);
      await ses.send(
        new SendEmailCommand({
          Source: fromAddress,
          ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
          Destination: { ToAddresses: [message.to] },
          Message: {
            Subject: { Data: message.subject },
            Body: {
              Html: { Data: message.html },
              Text: { Data: message.text },
            },
          },
        }),
      );
      console.log(`[Email] Sent via SES to ${message.to}`);
      return true;
    } else if (config.type === 'smtp') {
      const transporter = getSMTPTransporter(config);
      await transporter.sendMail({
        from: fromAddress,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      console.log(`[Email] Sent via SMTP to ${message.to}`);
      return true;
    }
  } catch (error) {
    console.error(`[Email] Failed to send via ${config.type}:`, error);
    throw error;
  }

  return false;
}

// Email types for logging
export type EmailType =
  | 'invite'
  | 'welcome'
  | 'password_reset'
  | 'verification'
  | 'notification'
  | 'test';

/**
 * Log an email send attempt to the database
 */
async function logEmail(
  emailType: EmailType,
  recipient: string,
  subject: string,
  success: boolean,
  errorMessage?: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO email_log (email_type, recipient, subject, success, error_message, sent_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [emailType, recipient, subject, success, errorMessage || null],
    );
  } catch (error) {
    console.error('[Email] Failed to log email:', error);
  }
}

/**
 * Verify an email address in SES (for sandbox mode).
 * This sends a verification email to the recipient.
 * Only works when using SES transport.
 */
export async function verifyEmailForSandbox(email: string): Promise<boolean> {
  const config = await getEmailConfig();
  if (config.type !== 'ses') {
    console.log(
      `[Email] Skipping SES verification - using ${config.type} transport`,
    );
    return true; // No verification needed for SMTP
  }

  try {
    const ses = getSESClient(config);
    // Check if already verified
    const checkResponse = await ses.send(
      new GetIdentityVerificationAttributesCommand({
        Identities: [email],
      }),
    );

    const status =
      checkResponse.VerificationAttributes?.[email]?.VerificationStatus;
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

export async function sendInviteEmail({
  to,
  inviteUrl,
  role,
  inviterName,
  inviterEmail,
}: SendInviteEmailParams): Promise<boolean> {
  const subject = `${inviterName} invited you to ${APP_NAME}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #1f2937; color: #ffffff; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 600; }
    .header p { margin: 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 32px 24px; background: #ffffff; }
    .content p { margin: 0 0 16px 0; color: #374151; }
    .button { display: inline-block; background: #059669; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; }
    .button:hover { background: #047857; }
    .link-fallback { font-size: 12px; color: #6b7280; word-break: break-all; margin-top: 16px; }
    .note { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #92400e; }
    .footer { text-align: center; padding: 20px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
    .footer p { margin: 0; color: #6b7280; font-size: 12px; }
    .footer a { color: #6b7280; }
    .powered-by { font-size: 11px; color: #9ca3af; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌳 ${APP_NAME}</h1>
      <p>Family Tree</p>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p><strong>${inviterName}</strong> has invited you to join the <strong>${APP_NAME}</strong> family tree as a <strong>${role}</strong>.</p>
      <p>Click the button below to accept your invitation and create your account:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${inviteUrl}" class="button">Accept Invitation</a>
      </p>
      <p class="link-fallback">Or copy this link: ${inviteUrl}</p>
      <p>This invitation will expire in 7 days.</p>
      <div class="note">
        <strong>📬 Can't find this email?</strong> Please check your spam or junk folder and mark this message as "not spam" to ensure you receive future updates.
      </div>
      <p>Best regards,<br><strong>${inviterName}</strong></p>
    </div>
    <div class="footer">
      <p><a href="${APP_URL}">${APP_URL.replace('https://', '')}</a></p>
      <p class="powered-by">Powered by Kindred</p>
    </div>
  </div>
</body>
</html>`;

  const textBody = `
${inviterName} invited you to ${APP_NAME}

You've been invited to join the ${APP_NAME} family tree as a ${role}.

Accept your invitation: ${inviteUrl}

This invitation will expire in 7 days.

Can't find this email? Please check your spam or junk folder and mark this message as "not spam" to ensure you receive future updates.

Best regards,
${inviterName}

---
Powered by Kindred
`;

  try {
    await sendEmail({
      to,
      subject,
      html: htmlBody,
      text: textBody,
      replyTo: inviterEmail,
    });
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

export async function sendWelcomeEmail({
  to,
  userName,
}: SendWelcomeEmailParams): Promise<boolean> {
  const subject = `Welcome to ${APP_NAME}!`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #1f2937; color: #ffffff; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 32px 24px; background: #ffffff; }
    .content p { margin: 0 0 16px 0; color: #374151; }
    .content h3 { margin: 24px 0 16px 0; color: #1f2937; font-size: 18px; }
    .button { display: inline-block; background: #059669; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; }
    .feature { margin: 12px 0; padding-left: 28px; position: relative; color: #374151; }
    .feature::before { content: "✓"; position: absolute; left: 0; color: #059669; font-weight: bold; font-size: 16px; }
    .footer { text-align: center; padding: 20px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
    .footer p { margin: 0; color: #6b7280; font-size: 12px; }
    .footer a { color: #6b7280; }
    .powered-by { font-size: 11px; color: #9ca3af; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌳 Welcome to ${APP_NAME}!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Your account has been created successfully. You now have access to explore and contribute to the family tree.</p>
      <h3>Getting Started</h3>
      <div class="feature">Browse the family tree and discover your ancestors</div>
      <div class="feature">View detailed person profiles with sources and media</div>
      <div class="feature">Search for specific family members</div>
      <div class="feature">Explore coats of arms and family crests</div>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}" class="button">Start Exploring</a>
      </p>
      <p>If you have any questions, please reach out to the site administrator.</p>
    </div>
    <div class="footer">
      <p><a href="${APP_URL}">${APP_URL.replace('https://', '')}</a></p>
      <p class="powered-by">Powered by Kindred</p>
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
    await sendEmail({
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });
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
export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  const subject = `Reset your ${APP_NAME} password`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #1f2937; color: #ffffff; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 600; }
    .header p { margin: 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 32px 24px; background: #ffffff; }
    .content p { margin: 0 0 16px 0; color: #374151; }
    .button { display: inline-block; background: #059669; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; }
    .link-fallback { font-size: 12px; color: #6b7280; word-break: break-all; margin-top: 16px; }
    .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #92400e; }
    .footer { text-align: center; padding: 20px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
    .footer p { margin: 0; color: #6b7280; font-size: 12px; }
    .footer a { color: #6b7280; }
    .powered-by { font-size: 11px; color: #9ca3af; margin-top: 8px; }
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
      <p>We received a request to reset your password for your <strong>${APP_NAME}</strong> account.</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      <p class="link-fallback">Or copy this link: ${resetUrl}</p>
      <div class="warning">
        <strong>⚠️ Security Notice:</strong> This link expires in 1 hour. If you didn't request this reset, please ignore this email.
      </div>
    </div>
    <div class="footer">
      <p><a href="${APP_URL}">${APP_URL.replace('https://', '')}</a></p>
      <p class="powered-by">Powered by Kindred</p>
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
    await sendEmail({
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });
    return true;
  } catch (error) {
    console.error('[Email] Failed to send password reset:', error);
    return false;
  }
}

/**
 * Send a test email to verify email configuration
 */
export async function sendTestEmail(to: string): Promise<boolean> {
  const config = await getEmailConfig();
  const subject = `Test Email from ${APP_NAME}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .success { background: #d1fae5; border: 1px solid #6ee7b7; padding: 16px; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌳 ${APP_NAME}</h1>
      <p>Email Configuration Test</p>
    </div>
    <div class="content">
      <div class="success">
        <strong>✅ Success!</strong> Your email configuration is working correctly.
      </div>
      <p>This is a test email to verify your email settings.</p>
      <p><strong>Configuration Details:</strong></p>
      <ul>
        <li>Provider: ${config.type.toUpperCase()}</li>
        <li>From: ${config.from}</li>
        <li>Details: ${config.details}</li>
      </ul>
      <p>If you received this email, your email configuration is working properly!</p>
    </div>
    <div class="footer">
      <p><a href="${APP_URL}">${APP_URL.replace('https://', '')}</a></p>
      <p>Powered by Kindred</p>
    </div>
  </div>
</body>
</html>`;

  const textBody = `
Test Email from ${APP_NAME}

✅ Success! Your email configuration is working correctly.

This is a test email to verify your email settings.

Configuration Details:
- Provider: ${config.type.toUpperCase()}
- From: ${config.from}
- Details: ${config.details}

If you received this email, your email configuration is working properly!

---
Powered by Kindred
${APP_URL}
`;

  try {
    await sendEmail({
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });
    await logEmail('test', to, subject, true);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send test email:', error);
    await logEmail('test', to, subject, false, (error as Error).message);
    return false;
  }
}
