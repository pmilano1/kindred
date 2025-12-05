# AWS SES for sending invitation emails

# Domain identity verification
resource "aws_ses_domain_identity" "main" {
  domain = "milanese.life"
}

# Note: DNS TXT record for verification is managed in Cloudflare
# Record: _amazonses.milanese.life
# Value: ${aws_ses_domain_identity.main.verification_token}

# DKIM for email authentication (optional but recommended)
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# Note: DKIM DNS records should be added to Cloudflare:
# ${element(aws_ses_domain_dkim.main.dkim_tokens, 0)}._domainkey.milanese.life -> ${element(aws_ses_domain_dkim.main.dkim_tokens, 0)}.dkim.amazonses.com
# ${element(aws_ses_domain_dkim.main.dkim_tokens, 1)}._domainkey.milanese.life -> ${element(aws_ses_domain_dkim.main.dkim_tokens, 1)}.dkim.amazonses.com
# ${element(aws_ses_domain_dkim.main.dkim_tokens, 2)}._domainkey.milanese.life -> ${element(aws_ses_domain_dkim.main.dkim_tokens, 2)}.dkim.amazonses.com

# Mail FROM domain (optional - for better deliverability)
resource "aws_ses_domain_mail_from" "main" {
  domain           = aws_ses_domain_identity.main.domain
  mail_from_domain = "mail.${aws_ses_domain_identity.main.domain}"
}

# Note: Mail FROM requires MX and SPF records in Cloudflare:
# MX record: mail.milanese.life -> feedback-smtp.us-east-1.amazonses.com (priority 10)
# TXT record: mail.milanese.life -> "v=spf1 include:amazonses.com ~all"

