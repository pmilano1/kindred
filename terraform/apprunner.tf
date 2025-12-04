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

# IAM role for App Runner instance
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

# App Runner Service (created after first Docker push)
# This is commented out initially - will be created after first image push
# resource "aws_apprunner_service" "main" {
#   service_name = "genealogy-frontend"
#   
#   source_configuration {
#     authentication_configuration {
#       access_role_arn = aws_iam_role.apprunner_ecr.arn
#     }
#     image_repository {
#       image_identifier      = "${aws_ecr_repository.main.repository_url}:latest"
#       image_repository_type = "ECR"
#       image_configuration {
#         port = "3000"
#         runtime_environment_variables = {
#           DATABASE_URL         = "postgresql://..."
#           NEXTAUTH_URL         = "https://family.milanese.life"
#           NEXTAUTH_SECRET      = "..."
#           GOOGLE_CLIENT_ID     = "..."
#           GOOGLE_CLIENT_SECRET = "..."
#         }
#       }
#     }
#   }
#   
#   instance_configuration {
#     cpu    = "1024"
#     memory = "2048"
#     instance_role_arn = aws_iam_role.apprunner_instance.arn
#   }
#   
#   network_configuration {
#     egress_configuration {
#       egress_type       = "VPC"
#       vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
#     }
#   }
# }

