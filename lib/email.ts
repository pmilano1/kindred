import { SESClient, SendEmailCommand, VerifyEmailIdentityCommand, GetIdentityVerificationAttributesCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Configurable app name and URLs - set via environment variables
const APP_NAME = process.env.APP_NAME || 'Kindred';
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const EMAIL_FROM = process.env.EMAIL_FROM || `${APP_NAME} <noreply@example.com>`;

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
  const subject = `${inviterName} invited you to Milanese Family Genealogy`;
  
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
      <h1>🌳 Milanese Family</h1>
      <p>Genealogy Database</p>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p><strong>${inviterName}</strong> has invited you to join the Milanese Family Genealogy database as a <strong>${role}</strong>.</p>
      <p>Click the button below to accept your invitation and create your account:</p>
      <p style="text-align: center;">
        <a href="${inviteUrl}" class="button">Accept Invitation</a>
      </p>
      <p style="font-size: 12px; color: #6b7280;">Or copy this link: ${inviteUrl}</p>
      <p>This invitation will expire in 7 days.</p>
      <p>Best regards,<br>${inviterName}</p>
    </div>
    <div class="footer">
      <p>Milanese Family Genealogy • <a href="https://family.milanese.life">family.milanese.life</a></p>
    </div>
  </div>
</body>
</html>`;

  const textBody = `
${inviterName} invited you to Milanese Family Genealogy

You've been invited to join as a ${role}.

Accept your invitation: ${inviteUrl}

This invitation will expire in 7 days.

Best regards,
${inviterName}
`;

  try {
    await ses.send(new SendEmailCommand({
      Source: `Milanese Family <noreply@milanese.life>`,
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
    return true;
  } catch (error) {
    console.error('[Email] Failed to send invite:', error);
    return false;
  }
}

