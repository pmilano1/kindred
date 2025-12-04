#!/bin/bash
set -e

aws apprunner create-service \
  --service-name genealogy-frontend \
  --source-configuration '{
    "AuthenticationConfiguration": {
      "AccessRoleArn": "arn:aws:iam::789702809484:role/genealogy-apprunner-ecr-role"
    },
    "ImageRepository": {
      "ImageIdentifier": "789702809484.dkr.ecr.us-east-1.amazonaws.com/genealogy-frontend:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "DATABASE_URL": "postgresql://genealogy:1pHil7BQM:cfEE5Lo!:As2J(@genealogy-db.crcb246iwe3n.us-east-1.rds.amazonaws.com:5432/genealogy?sslmode=require",
          "NEXTAUTH_URL": "https://family.milanese.life",
          "NEXTAUTH_SECRET": "g3iwqSr3KtjGqY0xk17Y0uFKqoJlgvl1",
          "GOOGLE_CLIENT_ID": "373801077780-ltslu5m4o5glk2nadd2tiobneeict8l1.apps.googleusercontent.com",
          "GOOGLE_CLIENT_SECRET": "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",
          "AUTH_TRUST_HOST": "true"
        }
      }
    }
  }' \
  --instance-configuration '{
    "Cpu": "1024",
    "Memory": "2048",
    "InstanceRoleArn": "arn:aws:iam::789702809484:role/genealogy-apprunner-instance-role"
  }' \
  --health-check-configuration '{
    "Protocol": "HTTP",
    "Path": "/api/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }' \
  --no-cli-pager

