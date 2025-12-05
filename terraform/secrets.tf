# Secrets Manager for database credentials and app secrets

# Database credentials secret
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "genealogy/db-credentials"
  description             = "PostgreSQL database credentials for genealogy app"
  recovery_window_in_days = 7

  tags = {
    Name    = "genealogy-db-credentials"
    Type    = "secrets"
    Purpose = "database"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = aws_db_instance.main.username
    password = random_password.db_password.result
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    database = aws_db_instance.main.db_name
    url      = "postgresql://${aws_db_instance.main.username}:${random_password.db_password.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}?sslmode=no-verify"
  })
}

# NextAuth secret
resource "random_password" "nextauth_secret" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "genealogy/app-secrets"
  description             = "Application secrets for genealogy app"
  recovery_window_in_days = 7

  tags = {
    Name    = "genealogy-app-secrets"
    Type    = "secrets"
    Purpose = "authentication"
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    NEXTAUTH_SECRET = random_password.nextauth_secret.result
    NEXTAUTH_URL    = "https://family.milanese.life"
    # Google OAuth credentials to be added manually after setup
    GOOGLE_CLIENT_ID     = "TO_BE_CONFIGURED"
    GOOGLE_CLIENT_SECRET = "TO_BE_CONFIGURED"
  })
}

