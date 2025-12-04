#!/bin/bash
aws apprunner update-service \
  --service-arn "arn:aws:apprunner:us-east-1:789702809484:service/genealogy-frontend/4931a1702d2249f2b94b27a43b6ebec4" \
  --network-configuration '{
    "EgressConfiguration": {
      "EgressType": "VPC",
      "VpcConnectorArn": "arn:aws:apprunner:us-east-1:789702809484:vpcconnector/genealogy-vpc-connector/1/9f813987e8c948b7b7b73b78ba460534"
    }
  }' \
  --no-cli-pager

