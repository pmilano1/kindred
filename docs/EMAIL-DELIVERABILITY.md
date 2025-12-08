# Email Deliverability Troubleshooting

This guide helps admins diagnose and resolve issues when invite/welcome emails land in spam or aren't received.

## Quick Checklist

When a user reports "I didn't get my invite":

1. ✅ **Check email_log table** - Was the email sent successfully?
2. ✅ **Ask user to check spam/junk folder** - Most common issue
3. ✅ **Verify the email address** - Typos happen
4. ✅ **Check SES bounce/complaint metrics** - Is the address valid?
5. ✅ **Resend the invite** - From Admin → Users → Pending Invites

## Current Email Configuration

Kindred uses **AWS SES** for sending emails from `noreply@milanese.life`.

### DNS Records (Cloudflare)

| Record Type | Name | Value | Purpose |
|-------------|------|-------|---------|
| TXT | `_amazonses.milanese.life` | `z0gAhlJV/+R1Gp6JANRpCNnyY/t1Mxw67N4GCKLAavY=` | SES domain verification |
| TXT | `milanese.life` | `v=spf1 include:amazonses.com include:_spf.google.com ~all` | SPF - authorizes SES to send |
| TXT | `_dmarc.milanese.life` | `v=DMARC1; p=none; rua=mailto:peterm@milanese.life` | DMARC policy |
| TXT | `mail.milanese.life` | `v=spf1 include:amazonses.com ~all` | SPF for Mail FROM domain |
| MX | `mail.milanese.life` | `10 feedback-smtp.us-east-1.amazonses.com` | Mail FROM bounce handling |
| CNAME | `{token}._domainkey.milanese.life` | `{token}.dkim.amazonses.com` | DKIM (3 records) |

### Verify DNS with CLI

```bash
# SPF
dig TXT milanese.life +short | grep spf

# DMARC
dig TXT _dmarc.milanese.life +short

# DKIM (get tokens from AWS first)
aws ses get-identity-dkim-attributes --identities milanese.life
dig CNAME {token}._domainkey.milanese.life +short

# SES verification
dig TXT _amazonses.milanese.life +short
```

## Checking SES Status

### Account Status
```bash
# Is sending enabled?
aws ses get-account-sending-enabled

# Send quota and usage
aws ses get-send-quota

# Domain verification status
aws ses get-identity-verification-attributes --identities milanese.life

# DKIM status
aws ses get-identity-dkim-attributes --identities milanese.life
```

### Expected Output
- `Enabled: true` - Sending is on
- `Max24HourSend: 50000` - Out of sandbox (sandbox = 200)
- `VerificationStatus: Success` - Domain verified
- `DkimVerificationStatus: Success` - DKIM working

## Checking Email Logs

Query the database to see if emails were sent:

```sql
-- Recent email attempts
SELECT email_type, recipient, subject, success, error_message, sent_at
FROM email_log
ORDER BY sent_at DESC
LIMIT 20;

-- Failed emails
SELECT * FROM email_log WHERE success = false ORDER BY sent_at DESC;

-- Emails to specific recipient
SELECT * FROM email_log WHERE recipient = 'user@example.com';
```

## Common Issues

### 1. Email Goes to Spam

**Symptoms:** Email delivered but lands in spam/junk folder.

**Causes:**
- Recipient's email provider has strict filters
- Low sender reputation (new domain, low volume)
- Email content triggers spam filters (too many links, missing text version)

**Solutions:**
- Ask user to mark email as "Not Spam" and add `noreply@milanese.life` to contacts
- The invite email now includes a note asking users to check spam
- Consider warming up the domain by sending regular emails

### 2. Email Not Delivered

**Symptoms:** Email not in inbox or spam, `email_log` shows `success: true`.

**Causes:**
- Recipient's server rejected silently
- Email address doesn't exist (hard bounce)
- Corporate firewall blocked

**Solutions:**
- Check SES bounce metrics in AWS Console
- Verify the email address with the user
- Try an alternative email address

### 3. SES Sending Disabled

**Symptoms:** `email_log` shows `success: false`, error mentions "disabled".

**Causes:**
- High bounce rate (>5%)
- High complaint rate (>0.1%)
- AWS disabled account

**Solutions:**
- Check SES reputation dashboard in AWS Console
- Review and clean email lists
- Contact AWS support if needed

### 4. DKIM/SPF Failures

**Symptoms:** Emails rejected or marked as spam, headers show authentication failures.

**Check email headers for:**
```
Authentication-Results: ...
  dkim=pass
  spf=pass
  dmarc=pass
```

If any show `fail`:
- Verify DNS records are correct
- Check SES identity status
- DNS propagation can take up to 48 hours

## Testing Deliverability

### Send Test Email
1. Go to Admin → Users → Invite User
2. Invite yourself at a test address (Gmail, Outlook, iCloud)
3. Check if it arrives and inspect headers

### Check Email Headers (Gmail)
1. Open the email
2. Click ⋮ → "Show original"
3. Look for:
   - `SPF: PASS`
   - `DKIM: PASS`
   - `DMARC: PASS`

### Online Tools
- [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) - DNS and email diagnostics
- [Mail Tester](https://www.mail-tester.com/) - Send test email for spam score
- [DMARC Analyzer](https://www.dmarcanalyzer.com/) - DMARC report analysis

## Improving Deliverability

### Short Term
- ✅ Added "check spam folder" note to invite emails
- Ask users to add `noreply@milanese.life` to their contacts
- Use the Resend Invite feature if first attempt fails

### Medium Term
- Consider changing DMARC from `p=none` to `p=quarantine` once confident
- Monitor DMARC reports sent to `peterm@milanese.life`
- Build sender reputation with consistent, low-volume sending

### Long Term
- Maintain bounce rate below 5%
- Maintain complaint rate below 0.1%
- Consider dedicated IP if volume increases significantly

## Environment Variables

Email configuration in production:

| Variable | Value | Description |
|----------|-------|-------------|
| `EMAIL_FROM` | `Kindred <noreply@milanese.life>` | From address |
| `AWS_REGION` | `us-east-1` | SES region |
| `APP_NAME` | `Kindred` | App name in emails |
| `NEXTAUTH_URL` | `https://family.milanese.life` | App URL for links |

## Related Resources

- [AWS SES Best Practices](https://docs.aws.amazon.com/ses/latest/dg/best-practices.html)
- [SES Reputation Dashboard](https://console.aws.amazon.com/ses/home?region=us-east-1#/reputation)
- [Cloudflare DNS](https://dash.cloudflare.com/) - Manage DNS records

