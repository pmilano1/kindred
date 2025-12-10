'use client';

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const GET_EMAIL_SETTINGS = gql`
  query GetEmailSettings {
    settings {
      key
      value
    }
  }
`;

const UPDATE_SETTING = gql`
  mutation UpdateSetting($key: String!, $value: String!) {
    updateSetting(key: $key, value: $value) {
      key
      value
    }
  }
`;

const TEST_EMAIL = gql`
  mutation TestEmail($recipientEmail: String) {
    testEmail(recipientEmail: $recipientEmail) {
      success
      message
      recipient
    }
  }
`;

interface Setting {
  key: string;
  value: string;
}

interface EmailSettingsData {
  settings: Setting[];
}

interface TestEmailResult {
  testEmail: {
    success: boolean;
    message: string;
    recipient: string | null;
  };
}

export function EmailSettings() {
  const { data, loading, refetch } =
    useQuery<EmailSettingsData>(GET_EMAIL_SETTINGS);
  const [updateSetting] = useMutation(UPDATE_SETTING);
  const [testEmail] = useMutation<TestEmailResult>(TEST_EMAIL);

  const [provider, setProvider] = useState('none');
  const [emailFrom, setEmailFrom] = useState('');
  const [sesRegion, setSesRegion] = useState('us-east-1');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Load settings from query
  useEffect(() => {
    if (data?.settings) {
      const settings = data.settings.reduce(
        (acc: Record<string, string>, s: { key: string; value: string }) => {
          acc[s.key] = s.value;
          return acc;
        },
        {},
      );

      setProvider(settings.email_provider || 'none');
      setEmailFrom(settings.email_from || '');
      setSesRegion(settings.email_ses_region || 'us-east-1');
      setSmtpHost(settings.email_smtp_host || '');
      setSmtpPort(settings.email_smtp_port || '587');
      setSmtpSecure(settings.email_smtp_secure === 'true');
      setSmtpUser(settings.email_smtp_user || '');
      setSmtpPassword(settings.email_smtp_password || '');
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    setTestMessage(null);
    try {
      await updateSetting({
        variables: { key: 'email_provider', value: provider },
      });
      await updateSetting({
        variables: { key: 'email_from', value: emailFrom },
      });
      await updateSetting({
        variables: { key: 'email_ses_region', value: sesRegion },
      });
      await updateSetting({
        variables: { key: 'email_smtp_host', value: smtpHost },
      });
      await updateSetting({
        variables: { key: 'email_smtp_port', value: smtpPort },
      });
      await updateSetting({
        variables: { key: 'email_smtp_secure', value: smtpSecure.toString() },
      });
      await updateSetting({
        variables: { key: 'email_smtp_user', value: smtpUser },
      });
      await updateSetting({
        variables: { key: 'email_smtp_password', value: smtpPassword },
      });

      await refetch();
      alert('Email settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setTestMessage(null);
    try {
      const result = await testEmail();
      if (result.data?.testEmail.success) {
        setTestMessage({
          type: 'success',
          text: result.data.testEmail.message,
        });
      } else {
        setTestMessage({
          type: 'error',
          text: result.data?.testEmail.message || 'Failed to send test email',
        });
      }
    } catch (error) {
      console.error('Failed to send test email:', error);
      setTestMessage({
        type: 'error',
        text: `Error: ${(error as Error).message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Configuration</CardTitle>
        <CardDescription>
          Configure email settings for invitations, notifications, and password
          resets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test Message */}
        {testMessage && (
          <div
            className={`p-4 rounded-lg ${testMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}
          >
            {testMessage.text}
          </div>
        )}

        {/* Provider Selection */}
        <div className="space-y-2">
          <Label htmlFor="email-provider">Email Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger id="email-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Email disabled)</SelectItem>
              <SelectItem value="ses">
                AWS SES (Recommended for production)
              </SelectItem>
              <SelectItem value="smtp">
                SMTP (For self-hosting or custom providers)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {provider === 'none' &&
              'Email features will be disabled. Users cannot be invited or reset passwords.'}
            {provider === 'ses' &&
              'Uses AWS SES for reliable email delivery. Requires AWS credentials or IAM role.'}
            {provider === 'smtp' &&
              'Connect to any SMTP server (Gmail, SendGrid, Mailgun, etc.)'}
          </p>
        </div>

        {/* Common: From Address */}
        {provider !== 'none' && (
          <div className="space-y-2">
            <Label htmlFor="email-from">From Email Address</Label>
            <Input
              id="email-from"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="Kindred <noreply@family.example.com>"
            />
            <p className="text-sm text-muted-foreground">
              The email address that will appear in the "From" field
            </p>
          </div>
        )}

        {/* SES Configuration */}
        {provider === 'ses' && (
          <div className="space-y-2">
            <Label htmlFor="ses-region">AWS Region</Label>
            <Input
              id="ses-region"
              value={sesRegion}
              onChange={(e) => setSesRegion(e.target.value)}
              placeholder="us-east-1"
            />
            <p className="text-sm text-muted-foreground">
              AWS region where SES is configured. Uses IAM role for
              authentication.
            </p>
          </div>
        )}

        {/* SMTP Configuration */}
        {provider === 'smtp' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input
                id="smtp-port"
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
              />
              <p className="text-sm text-muted-foreground">
                Common ports: 587 (TLS), 465 (SSL), 25 (unencrypted)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="smtp-secure"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="smtp-secure">Use TLS/SSL</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-user">SMTP Username</Label>
              <Input
                id="smtp-user"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="your-email@gmail.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-password">SMTP Password</Label>
              <Input
                id="smtp-password"
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="App password or SMTP password"
              />
              <p className="text-sm text-muted-foreground">
                For Gmail, use an App Password instead of your account password
              </p>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          {provider !== 'none' && (
            <Button
              onClick={handleTestEmail}
              disabled={testing || !emailFrom}
              variant="outline"
            >
              {testing ? 'Sending...' : 'Send Test Email'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
