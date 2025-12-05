# AWS App Runner for Next.js hosting

# ECR Repository for Docker images
resource "aws_ecr_repository" "main" {
  name                 = "genealogy-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "genealogy-frontend"
    Type = "container-registry"
  }
}

# ECR Lifecycle Policy - keep last 5 images
resource "aws_ecr_lifecycle_policy" "main" {
  repository = aws_ecr_repository.main.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = {
        type = "expire"
      }
    }]
  })
}

# IAM role for App Runner to pull from ECR
resource "aws_iam_role" "apprunner_ecr" {
  name = "genealogy-apprunner-ecr-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "build.apprunner.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "genealogy-apprunner-ecr-role"
    Type = "iam"
  }
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner_ecr.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# IAM role for App Runner instance (includes SES permissions)
resource "aws_iam_role" "apprunner_instance" {
  name = "genealogy-apprunner-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "tasks.apprunner.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "genealogy-apprunner-instance-role"
    Type = "iam"
  }
}

# SES send email policy for App Runner instance
resource "aws_iam_role_policy" "apprunner_ses" {
  name = "ses-send-email"
  role = aws_iam_role.apprunner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ]
      Resource = "*"
    }]
  })
}

# VPC Connector for App Runner to reach RDS
resource "aws_apprunner_vpc_connector" "main" {
  vpc_connector_name = "genealogy-vpc-connector"
  subnets            = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  security_groups    = [aws_security_group.rds.id]

  tags = {
    Name = "genealogy-vpc-connector"
    Type = "networking"
  }
}

# App Runner Service
resource "aws_apprunner_service" "main" {
  service_name = "genealogy-frontend"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr.arn
    }
    image_repository {
      image_identifier      = "${aws_ecr_repository.main.repository_url}:latest"
      image_repository_type = "ECR"
      image_configuration {
        port = "3000"
        runtime_environment_variables = {
          DATABASE_URL         = "postgresql://${aws_db_instance.main.username}:${random_password.db_password.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}?sslmode=no-verify"
          NEXTAUTH_URL         = "https://family.milanese.life"
          NEXTAUTH_SECRET      = random_password.nextauth_secret.result
          AUTH_TRUST_HOST      = "true"
          GOOGLE_CLIENT_ID     = var.google_client_id
          GOOGLE_CLIENT_SECRET = var.google_client_secret
          AWS_REGION           = var.aws_region
        }
      }
    }
    auto_deployments_enabled = true
  }

  instance_configuration {
    cpu               = "1024"
    memory            = "2048"
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
    }
  }

  tags = {
    Name = "genealogy-frontend"
    Type = "compute"
  }
}

# Custom domain for App Runner
# Note: Managed outside Terraform - import failed due to API limitations
# Domain: family.milanese.life (active, validated via Cloudflare)
# resource "aws_apprunner_custom_domain_association" "main" {
#   domain_name          = "family.milanese.life"
#   service_arn          = aws_apprunner_service.main.arn
#   enable_www_subdomain = true
# }

