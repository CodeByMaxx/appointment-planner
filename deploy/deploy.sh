#!/usr/bin/env bash

set -euo pipefail

# ============================================================
# Appointment Planner - Customer Deployment
#
# Usage:
#   ./deploy/deploy.sh kunde-a
#
# Dry run:
#   ./deploy/deploy.sh kunde-a
#
# Real deployment:
#   DEPLOY_CONFIRM=yes ./deploy/deploy.sh kunde-a
# ============================================================

CUSTOMER="${1:-}"

if [[ -z "$CUSTOMER" ]]; then
    echo "Usage: $0 <customer>"
    exit 1
fi

# ------------------------------------------------------------
# Paths
# ------------------------------------------------------------

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CUSTOMER_FILE="$PROJECT_ROOT/deploy/customers/${CUSTOMER}.txt"

# ------------------------------------------------------------
# AWS configuration
# ------------------------------------------------------------

AWS_REGION="eu-central-1"

INSTANCE_NAME="appointment-planner-${CUSTOMER}"
INSTANCE_TYPE="t3.micro"

SUBNET_ID="subnet-09e82dab87f69ff9a"
SECURITY_GROUP_ID="sg-0ed0542c65f213af4"
KEY_NAME="appointment-planner-key"
IAM_INSTANCE_PROFILE="appointment-planner-ec2-role"

SSH_KEY="$HOME/.ssh/appointment-planner-key.pem"
SSH_USER="ec2-user"

REMOTE_PROJECT="/home/ec2-user/appointment-planner"

# ------------------------------------------------------------
# Deployment configuration
# ------------------------------------------------------------

API_PORT="3001"

COMPANY_ID=""

POSTGRES_DB="appointment_planner"
POSTGRES_USER="appointment"
POSTGRES_PASSWORD="appointment_dev"

AWS_REGION="$AWS_REGION"

# ------------------------------------------------------------
# Validation
# ------------------------------------------------------------

if [[ ! -f "$CUSTOMER_FILE" ]]; then
    echo "Customer file not found:"
    echo "  $CUSTOMER_FILE"
    exit 1
fi

if [[ ! -f "$SSH_KEY" ]]; then
    echo "SSH key not found:"
    echo "  $SSH_KEY"
    exit 1
fi

chmod 600 "$SSH_KEY"

for command in aws ssh rsync curl python3 jq; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "Required command not found: $command"
        exit 1
    fi
done

# ------------------------------------------------------------
# Load customer configuration
# ------------------------------------------------------------

NAME=""
ADMIN_PASSWORD=""
COMPANY_NAME=""
COMPANY_EMAIL=""
COMPANY_TIMEZONE=""
SENDER_EMAIL=""

while IFS='=' read -r key value; do
    case "$key" in
    NAME)
        NAME="$value"
        ;;
    COMPANY_ID) COMPANY_ID="$value" ;;
    COMPANY_NAME) COMPANY_NAME="$value" ;;
    COMPANY_EMAIL) COMPANY_EMAIL="$value" ;;
    COMPANY_TIMEZONE) COMPANY_TIMEZONE="$value" ;;
    ADMIN_PASSWORD)
        ADMIN_PASSWORD="$value"
        ;;
    SENDER_EMAIL)
        SENDER_EMAIL="$value"
        ;;
    esac
done <"$CUSTOMER_FILE"

: "${COMPANY_NAME:?COMPANY_NAME is missing in $CUSTOMER_FILE}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD is missing in $CUSTOMER_FILE}"
: "${COMPANY_ID:?COMPANY_ID is missing in $CUSTOMER_FILE}"
: "${COMPANY_EMAIL:?COMPANY_EMAIL is missing in $CUSTOMER_FILE}"
: "${COMPANY_TIMEZONE:?COMPANY_TIMEZONE is missing in $CUSTOMER_FILE}"
: "${SENDER_EMAIL:?SENDER_EMAIL is missing in $CUSTOMER_FILE}"

# ------------------------------------------------------------
# Detect existing customer instance
# ------------------------------------------------------------

EXISTING_INSTANCE_ID="$(aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --filters \
    "Name=tag:Name,Values=$INSTANCE_NAME" \
    "Name=instance-state-name,Values=pending,running,stopping,stopped" \
    --query 'Reservations[].Instances[].InstanceId' \
    --output text)"

DEPLOY_MODE="create"

if [[ -n "$EXISTING_INSTANCE_ID" && "$EXISTING_INSTANCE_ID" != "None" ]]; then
    DEPLOY_MODE="update"
    INSTANCE_ID="$EXISTING_INSTANCE_ID"

    echo "Existing instance found for customer '$CUSTOMER':"
    echo "  Instance ID: $INSTANCE_ID"
    echo "  Name:        $INSTANCE_NAME"
    echo "  Mode:        UPDATE"
else
    echo "No existing instance found for customer '$CUSTOMER'."
    echo "  Mode:        CREATE"
fi

# ------------------------------------------------------------
# Determine latest Amazon Linux 2023 AMI
# ------------------------------------------------------------

echo
echo "==> Finding latest Amazon Linux 2023 AMI..."

AMI_ID="$(aws ec2 describe-images \
    --region "$AWS_REGION" \
    --owners amazon \
    --filters \
    "Name=name,Values=al2023-ami-2023.*-x86_64" \
    "Name=state,Values=available" \
    --query 'sort_by(Images,&CreationDate)[-1].ImageId' \
    --output text)"

if [[ -z "$AMI_ID" || "$AMI_ID" == "None" ]]; then
    echo "Could not determine Amazon Linux 2023 AMI."
    exit 1
fi

# ------------------------------------------------------------
# Display deployment plan
# ------------------------------------------------------------

echo
echo "============================================================"
echo " Appointment Planner Deployment"
echo "============================================================"
echo
echo "Customer:        $COMPANY_NAME"
echo "Customer ID:     $CUSTOMER"
echo "Company ID:      $COMPANY_ID"
echo "Sender:          $SENDER_EMAIL"
echo
echo "AWS Region:      $AWS_REGION"
echo "AMI:             $AMI_ID"
echo "Instance:        $INSTANCE_NAME"
echo "Type:            $INSTANCE_TYPE"
echo "Subnet:          $SUBNET_ID"
echo "Security Group:  $SECURITY_GROUP_ID"
echo "Key Pair:        $KEY_NAME"
echo "IAM Profile:     $IAM_INSTANCE_PROFILE"
echo
echo "============================================================"

if [[ "${DEPLOY_CONFIRM:-no}" != "yes" ]]; then
    echo
    echo "Dry run only."
    if [[ "$DEPLOY_MODE" == "create" ]]; then
        echo "Set DEPLOY_CONFIRM=yes to create the EC2 instance."
    else
        echo "Set DEPLOY_CONFIRM=yes to update the existing EC2 instance."
    fi
    exit 0
fi

# ------------------------------------------------------------
# Helper: SSH command
# ------------------------------------------------------------

ssh_cmd() {
    ssh \
        -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        "${SSH_USER}@${PUBLIC_IP}" \
        "$@"
}

# ------------------------------------------------------------
# 1. Create or reuse EC2 instance
# ------------------------------------------------------------

if [[ "$DEPLOY_MODE" == "create" ]]; then
    echo
    echo "==> Creating EC2 instance..."

    INSTANCE_ID="$(aws ec2 run-instances \
        --region "$AWS_REGION" \
        --image-id "$AMI_ID" \
        --instance-type "$INSTANCE_TYPE" \
        --subnet-id "$SUBNET_ID" \
        --security-group-ids "$SECURITY_GROUP_ID" \
        --key-name "$KEY_NAME" \
        --iam-instance-profile Name="$IAM_INSTANCE_PROFILE" \
        --tag-specifications \
        "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME},{Key=Project,Value=appointment-planner},{Key=Customer,Value=$CUSTOMER},{Key=Environment,Value=production}]" \
        --query 'Instances[0].InstanceId' \
        --output text)"

    echo "Instance ID: $INSTANCE_ID"
else
    echo
    echo "==> Updating existing EC2 instance..."
    echo "Instance ID: $INSTANCE_ID"
fi

DEPLOY_SUCCESS="no"
ELASTIC_IP_ALLOCATION_ID=""
ELASTIC_IP_ASSOCIATION_ID=""
PUBLIC_IP=""
ELASTIC_IP_NEWLY_ALLOCATED="no"

cleanup() {
    if [[ "$DEPLOY_SUCCESS" != "yes" && "$DEPLOY_MODE" == "create" ]]; then
        echo

        if [[ -n "${INSTANCE_ID:-}" ]]; then
            echo "Deployment failed. Terminating created EC2 instance..."
            aws ec2 terminate-instances \
                --region "$AWS_REGION" \
                --instance-ids "$INSTANCE_ID" \
                >/dev/null
            echo "Instance terminated: $INSTANCE_ID"
        fi

        if [[ "$ELASTIC_IP_NEWLY_ALLOCATED" == "yes" && -n "${ELASTIC_IP_ALLOCATION_ID:-}" ]]; then
            echo "Releasing newly allocated Elastic IP..."
            aws ec2 release-address \
                --region "$AWS_REGION" \
                --allocation-id "$ELASTIC_IP_ALLOCATION_ID" \
                >/dev/null
            echo "Elastic IP released: $PUBLIC_IP"
        fi
    fi
}

trap cleanup EXIT

# ------------------------------------------------------------
# 2. Ensure EC2 instance is running
# ------------------------------------------------------------

echo
echo "==> Checking EC2 instance state..."

INSTANCE_STATE="$(aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text)"

echo "Current instance state: $INSTANCE_STATE"

if [[ "$INSTANCE_STATE" == "stopped" ]]; then
    echo "Starting stopped instance..."

    aws ec2 start-instances \
        --region "$AWS_REGION" \
        --instance-ids "$INSTANCE_ID" \
        >/dev/null
fi

echo
echo "==> Waiting for EC2 instance to become running..."

aws ec2 wait instance-running \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID"

echo "Instance is running."

# ------------------------------------------------------------
# 3. Ensure Elastic IP
# ------------------------------------------------------------

echo
echo "==> Checking Elastic IP..."

EXISTING_EIP="$(aws ec2 describe-addresses \
    --region "$AWS_REGION" \
    --filters "Name=tag:Customer,Values=$CUSTOMER" \
    --query 'Addresses[0].{PublicIp:PublicIp,AllocationId:AllocationId,AssociationId:AssociationId,InstanceId:InstanceId}' \
    --output json)"

if [[ "$EXISTING_EIP" != "null" && "$EXISTING_EIP" != "{}" ]]; then
    ELASTIC_IP_ALLOCATION_ID="$(echo "$EXISTING_EIP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("AllocationId",""))')"
    ELASTIC_IP_ASSOCIATION_ID="$(echo "$EXISTING_EIP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("AssociationId",""))')"
    PUBLIC_IP="$(echo "$EXISTING_EIP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("PublicIp",""))')"
    EIP_INSTANCE_ID="$(echo "$EXISTING_EIP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("InstanceId",""))')"

    echo "Existing Elastic IP found: $PUBLIC_IP"

    if [[ -n "$EIP_INSTANCE_ID" && "$EIP_INSTANCE_ID" != "$INSTANCE_ID" ]]; then
        echo "Elastic IP is attached to another instance: $EIP_INSTANCE_ID"
        echo "Re-associating Elastic IP with current instance: $INSTANCE_ID"

        ELASTIC_IP_ASSOCIATION_ID="$(aws ec2 associate-address \
            --region "$AWS_REGION" \
            --instance-id "$INSTANCE_ID" \
            --allocation-id "$ELASTIC_IP_ALLOCATION_ID" \
            --query 'AssociationId' \
            --output text)"

        echo "Elastic IP re-associated: $PUBLIC_IP"
    elif [[ -z "$ELASTIC_IP_ASSOCIATION_ID" ]]; then
        echo "Associating existing Elastic IP with current instance..."

        ELASTIC_IP_ASSOCIATION_ID="$(aws ec2 associate-address \
            --region "$AWS_REGION" \
            --instance-id "$INSTANCE_ID" \
            --allocation-id "$ELASTIC_IP_ALLOCATION_ID" \
            --query 'AssociationId' \
            --output text)"

        echo "Elastic IP associated: $PUBLIC_IP"
    fi
else
    echo "No Elastic IP found for customer '$CUSTOMER'. Allocating one..."

    EIP_DATA="$(aws ec2 allocate-address \
        --region "$AWS_REGION" \
        --domain vpc \
        --query '{PublicIp:PublicIp,AllocationId:AllocationId}' \
        --output json)"

    ELASTIC_IP_ALLOCATION_ID="$(echo "$EIP_DATA" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["AllocationId"])')"
    PUBLIC_IP="$(echo "$EIP_DATA" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["PublicIp"])')"

    echo "Elastic IP allocated: $PUBLIC_IP"
    ELASTIC_IP_NEWLY_ALLOCATED="yes"

    aws ec2 create-tags \
        --region "$AWS_REGION" \
        --resources "$ELASTIC_IP_ALLOCATION_ID" \
        --tags \
        "Key=Customer,Value=$CUSTOMER" \
        "Key=Project,Value=appointment-planner" \
        "Key=Environment,Value=production"

    echo "Elastic IP tagged for customer: $CUSTOMER"

    ELASTIC_IP_ASSOCIATION_ID="$(aws ec2 associate-address \
        --region "$AWS_REGION" \
        --instance-id "$INSTANCE_ID" \
        --allocation-id "$ELASTIC_IP_ALLOCATION_ID" \
        --query 'AssociationId' \
        --output text)"

    echo "Elastic IP associated: $PUBLIC_IP"
fi

if [[ -z "$PUBLIC_IP" ]]; then
    echo "Could not determine Elastic IP."
    exit 1
fi

echo "Elastic IP: $PUBLIC_IP"

# ------------------------------------------------------------
# 4. Wait for SSH
# ------------------------------------------------------------

echo
echo "==> Waiting for SSH..."

SSH_READY="no"

for attempt in $(seq 1 30); do
    if ssh \
        -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=5 \
        "${SSH_USER}@${PUBLIC_IP}" \
        "echo SSH_READY" >/dev/null 2>&1; then

        SSH_READY="yes"
        break
    fi

    echo "  SSH not ready yet ($attempt/30)..."
    sleep 5
done

if [[ "$SSH_READY" != "yes" ]]; then
    echo "SSH did not become available."
    exit 1
fi

echo "SSH is ready."

# ------------------------------------------------------------
# 5. Install Docker
# ------------------------------------------------------------

echo
echo "==> Installing Docker..."

ssh_cmd \
    'sudo dnf install -y docker && sudo systemctl enable --now docker && sudo usermod -aG docker ec2-user'

echo "Docker installed."

# ------------------------------------------------------------
# 6. Install Docker Compose
# ------------------------------------------------------------

echo
echo "==> Installing Docker Compose..."

ssh_cmd \
    'sudo mkdir -p /usr/local/lib/docker/cli-plugins && sudo curl -fsSL https://github.com/docker/compose/releases/download/v5.5.1/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose && sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose'

echo "Docker Compose installed."

# ------------------------------------------------------------
# 7. Install Docker Buildx
# ------------------------------------------------------------

echo
echo "==> Installing Docker Buildx..."

ssh_cmd \
    'sudo curl -fsSL https://github.com/docker/buildx/releases/download/v0.29.1/buildx-v0.29.1.linux-amd64 -o /usr/local/lib/docker/cli-plugins/docker-buildx && sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx'

echo "Docker Buildx installed."

# ------------------------------------------------------------
# 8. Verify Docker tooling
# ------------------------------------------------------------

echo
echo "==> Verifying Docker tooling..."

ssh_cmd \
    'sudo docker --version && sudo docker compose version && sudo docker buildx version'

# ------------------------------------------------------------
# 9. Prepare remote directory
# ------------------------------------------------------------

echo
echo "==> Preparing remote project directory..."

ssh_cmd \
    "mkdir -p '$REMOTE_PROJECT'"

# ------------------------------------------------------------
# 10. Transfer project
# ------------------------------------------------------------

echo
echo "==> Transferring project..."

cd "$PROJECT_ROOT"

rsync -av \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='dist' \
    --exclude='deploy/customers' \
    ./ \
    "${SSH_USER}@${PUBLIC_IP}:${REMOTE_PROJECT}/"

echo "Project transferred."

# ------------------------------------------------------------
# 11. Create customer environment
# ------------------------------------------------------------

echo
echo "==> Creating remote environment..."

ssh_cmd \
    "umask 077 && cat > '$REMOTE_PROJECT/.env' <<EOF
API_BASE_URL=/api

POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

AWS_REGION=${AWS_REGION}
SES_FROM_EMAIL=${SENDER_EMAIL}

VITE_ADMIN_PASSWORD=${ADMIN_PASSWORD}
COMPANY_ID=${COMPANY_ID}
COMPANY_NAME=${COMPANY_NAME}
COMPANY_EMAIL=${COMPANY_EMAIL}
COMPANY_TIMEZONE=${COMPANY_TIMEZONE}
VITE_COMPANY_ID=${COMPANY_ID}
EOF
chmod 600 '$REMOTE_PROJECT/.env'"

echo "Environment created."

# ------------------------------------------------------------
# 12. Build images and start database
# ------------------------------------------------------------

echo
echo "==> Building application images..."

ssh_cmd \
    "cd '$REMOTE_PROJECT' && sudo docker compose build"

echo "Images built."

echo
echo "==> Starting database..."

ssh_cmd \
    "cd '$REMOTE_PROJECT' && sudo docker compose up -d postgres"

echo "Database container started."

# Wait until PostgreSQL accepts connections.
echo
echo "==> Waiting for PostgreSQL..."

DB_READY="no"

for attempt in $(seq 1 30); do
    if ssh_cmd \
        "cd '$REMOTE_PROJECT' && sudo docker compose exec -T postgres pg_isready -U '$POSTGRES_USER' -d '$POSTGRES_DB'" \
        >/dev/null 2>&1; then
        DB_READY="yes"
        break
    fi

    echo "  PostgreSQL not ready yet ($attempt/30)..."
    sleep 2
done

if [[ "$DB_READY" != "yes" ]]; then
    echo "ERROR: PostgreSQL did not become ready. Aborting deployment."
    exit 1
fi

echo "PostgreSQL is ready."

# ------------------------------------------------------------
# 13. Run Prisma migrations before starting APIs
# ------------------------------------------------------------

echo
echo "==> Running Prisma migrations before API startup..."

if ! ssh_cmd \
    "cd '$REMOTE_PROJECT' && sudo docker compose run --rm --no-deps api1 npx prisma migrate deploy"; then
    echo "ERROR: Prisma migrations failed. Aborting deployment."
    exit 1
fi

echo "Prisma migrations completed."

# ------------------------------------------------------------
# 14. Start the application stack
# ------------------------------------------------------------

echo
echo "==> Starting Docker stack..."

ssh_cmd \
    "cd '$REMOTE_PROJECT' && sudo docker compose up -d"

echo "Docker stack started."

# ------------------------------------------------------------
# 15. Verify company
# ------------------------------------------------------------

echo
echo "==> Verifying company..."

COMPANY_CHECK="$(
    ssh_cmd \
        "cd '$REMOTE_PROJECT' && sudo docker compose exec -T api npx tsx -e 'import { PrismaClient } from \"@prisma/client\"; (async()=>{const p=new PrismaClient(); const c=await p.company.findUnique({where:{id:\"${COMPANY_ID}\"}}); console.log(c ? c.id : \"NOT_FOUND\"); await p.\$disconnect();})()'"
)"

if [[ "$COMPANY_CHECK" != *"$COMPANY_ID"* ]]; then
    echo "Company verification failed."
    echo "Expected: $COMPANY_ID"
    echo "Received:"
    echo "$COMPANY_CHECK"
    exit 1
fi

echo "Company verified: $COMPANY_ID"

# ------------------------------------------------------------
# 16. Wait for HTTP service
# ------------------------------------------------------------

echo
echo "==> Waiting for HTTP service..."

HTTP_READY="no"

for attempt in $(seq 1 30); do
    if curl \
        --silent \
        --show-error \
        --fail \
        --max-time 5 \
        "http://${PUBLIC_IP}:${API_PORT}/services?companyId=${COMPANY_ID}" \
        >/dev/null 2>&1; then

        HTTP_READY="yes"
        break
    fi

    echo "  API not ready yet ($attempt/30)..."
    sleep 5
done

if [[ "$HTTP_READY" != "yes" ]]; then
    echo "API healthcheck failed."

    echo
    echo "Docker status:"
    ssh_cmd \
        "cd '$REMOTE_PROJECT' && sudo docker compose ps"

    echo
    echo "API logs:"
    ssh_cmd \
        "cd '$REMOTE_PROJECT' && sudo docker compose logs --tail=50 api"

    exit 1
fi

echo "API is ready."

# ------------------------------------------------------------
# 16.5. Create or reuse CloudFront distribution
# ------------------------------------------------------------

echo
echo "==> Configuring CloudFront..."

CF_COMMENT="appointment-planner-${CUSTOMER}"
CF_ORIGIN_ID="appointment-planner-origin-${CUSTOMER}"

# AWS managed policies
CF_CACHE_POLICY_ID="4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
CF_ORIGIN_REQUEST_POLICY_ID="b689b0a8-53d0-40ab-baf2-68738e2966ac"

# Get the public DNS name of the customer's EC2 instance
CF_ORIGIN_DOMAIN="$(aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicDnsName' \
    --output text)"

if [[ -z "$CF_ORIGIN_DOMAIN" || "$CF_ORIGIN_DOMAIN" == "None" ]]; then
    echo "ERROR: Could not determine EC2 public DNS name."
    exit 1
fi

echo "CloudFront origin: $CF_ORIGIN_DOMAIN"

# Find an existing distribution for this customer
CF_EXISTING="$(aws cloudfront list-distributions \
    --no-cli-pager \
    --output json |
    jq -r --arg comment "$CF_COMMENT" '
    .DistributionList.Items[]?
    | select(.Comment == $comment)
    | [.Id, .DomainName, .Status, (.Enabled | tostring)]
    | @tsv
  ' | head -n 1)"

if [[ -n "$CF_EXISTING" ]]; then
    IFS=$'\t' read -r \
        CF_DISTRIBUTION_ID \
        CF_DOMAIN \
        CF_STATUS \
        CF_ENABLED <<<"$CF_EXISTING"

    echo "Existing CloudFront distribution found."
    echo "Distribution ID: $CF_DISTRIBUTION_ID"
    echo "Status: $CF_STATUS"

    if [[ "$CF_ENABLED" != "true" ]]; then
        echo "ERROR: Existing CloudFront distribution is disabled."
        echo "Please review it in the AWS CloudFront console."
        exit 1
    fi
else
    echo "No existing distribution found. Creating one..."

    CF_CONFIG_FILE="$(mktemp)"

    jq -n \
        --arg caller "$(date +%s)-${CUSTOMER}" \
        --arg comment "$CF_COMMENT" \
        --arg origin "$CF_ORIGIN_DOMAIN" \
        --arg originId "$CF_ORIGIN_ID" \
        --arg customer "$CUSTOMER" \
        --arg cache "$CF_CACHE_POLICY_ID" \
        --arg originRequest "$CF_ORIGIN_REQUEST_POLICY_ID" \
        '{
      DistributionConfig: {
        CallerReference: $caller,
        Comment: $comment,
        Enabled: true,

        Origins: {
          Quantity: 1,
          Items: [{
            Id: $originId,
            DomainName: $origin,
            CustomOriginConfig: {
              HTTPPort: 80,
              HTTPSPort: 443,
              OriginProtocolPolicy: "http-only",
              OriginSslProtocols: {
                Quantity: 1,
                Items: ["TLSv1.2"]
              },
              OriginReadTimeout: 30,
              OriginKeepaliveTimeout: 5
            }
          }]
        },

        DefaultCacheBehavior: {
          TargetOriginId: $originId,
          ViewerProtocolPolicy: "redirect-to-https",
          AllowedMethods: {
            Quantity: 3,
            Items: ["GET", "HEAD", "OPTIONS"],
            CachedMethods: {
              Quantity: 2,
              Items: ["GET", "HEAD"]
            }
          },
          CachePolicyId: $cache,
          Compress: true
        },

        CacheBehaviors: {
          Quantity: 1,
          Items: [{
            PathPattern: "/api/*",
            TargetOriginId: $originId,
            ViewerProtocolPolicy: "redirect-to-https",
            AllowedMethods: {
              Quantity: 7,
              Items: [
                "GET", "HEAD", "OPTIONS",
                "PUT", "PATCH", "POST", "DELETE"
              ],
              CachedMethods: {
                Quantity: 2,
                Items: ["GET", "HEAD"]
              }
            },
            CachePolicyId: $cache,
            OriginRequestPolicyId: $originRequest,
            Compress: true
          }]
        },

        PriceClass: "PriceClass_100",
        ViewerCertificate: {
          CloudFrontDefaultCertificate: true
        },
        HttpVersion: "http2",
        IsIPV6Enabled: true
      },

      Tags: {
        Items: [
          {Key: "Customer", Value: $customer},
          {Key: "Project", Value: "appointment-planner"},
          {Key: "Environment", Value: "production"}
        ]
      }
    }' >"$CF_CONFIG_FILE"

    # Validate the generated JSON before making the AWS request
    jq -e . "$CF_CONFIG_FILE" >/dev/null

    if ! CF_CREATE_RESULT="$(aws cloudfront create-distribution-with-tags \
        --no-cli-pager \
        --distribution-config-with-tags "file://${CF_CONFIG_FILE}" \
        --output json)"; then
        rm -f "$CF_CONFIG_FILE"
        echo "ERROR: Could not create CloudFront distribution."
        exit 1
    fi

    rm -f "$CF_CONFIG_FILE"

    CF_DISTRIBUTION_ID="$(echo "$CF_CREATE_RESULT" | jq -r '.Distribution.Id')"
    CF_DOMAIN="$(echo "$CF_CREATE_RESULT" | jq -r '.Distribution.DomainName')"
    CF_STATUS="$(echo "$CF_CREATE_RESULT" | jq -r '.Distribution.Status')"

    echo "CloudFront distribution created."
    echo "Distribution ID: $CF_DISTRIBUTION_ID"
    echo "Status: $CF_STATUS"
fi

CF_URL="https://${CF_DOMAIN}"
CF_API_URL="${CF_URL}/api/health"

echo
echo "CloudFront URL: $CF_URL"
echo "Distribution ID: $CF_DISTRIBUTION_ID"

# ------------------------------------------------------------
# Wait until CloudFront is fully deployed
# ------------------------------------------------------------

echo
echo "==> Waiting for CloudFront deployment..."
echo "This can take several minutes."

if ! aws cloudfront wait distribution-deployed \
    --id "$CF_DISTRIBUTION_ID" \
    --no-cli-pager; then
    echo "ERROR: CloudFront deployment did not complete successfully."
    echo "Distribution ID: $CF_DISTRIBUTION_ID"
    echo "Check the distribution in the AWS CloudFront console."
    exit 1
fi

CF_STATUS="$(aws cloudfront get-distribution \
    --id "$CF_DISTRIBUTION_ID" \
    --query 'Distribution.Status' \
    --output text)"

if [[ "$CF_STATUS" != "Deployed" ]]; then
    echo "ERROR: Unexpected CloudFront status: $CF_STATUS"
    exit 1
fi

echo "CloudFront status: $CF_STATUS"

# ------------------------------------------------------------
# Test frontend through CloudFront
# ------------------------------------------------------------

echo
echo "==> Testing frontend through CloudFront..."

if ! CF_FRONTEND_STATUS="$(curl \
    --silent \
    --show-error \
    --location \
    --connect-timeout 10 \
    --max-time 30 \
    --output /dev/null \
    --write-out '%{http_code}' \
    "$CF_URL/")"; then
    echo "ERROR: Frontend request through CloudFront failed."
    exit 1
fi

if [[ ! "$CF_FRONTEND_STATUS" =~ ^2[0-9][0-9]$ ]]; then
    echo "ERROR: Frontend returned HTTP $CF_FRONTEND_STATUS"
    exit 1
fi

echo "Frontend HTTP status: $CF_FRONTEND_STATUS"

# ------------------------------------------------------------
# Test API through CloudFront
# ------------------------------------------------------------

echo
echo "==> Testing API through CloudFront..."

if ! CF_API_RESPONSE="$(curl \
    --fail \
    --silent \
    --show-error \
    --location \
    --connect-timeout 10 \
    --max-time 30 \
    "$CF_API_URL")"; then
    echo "ERROR: API request through CloudFront failed."
    exit 1
fi

if ! echo "$CF_API_RESPONSE" | jq -e \
    '.status == "ok" and .service == "appointment-planner-api"' \
    >/dev/null; then
    echo "ERROR: API healthcheck returned an unexpected response:"
    echo "$CF_API_RESPONSE"
    exit 1
fi

echo "API healthcheck: OK"

# ------------------------------------------------------------
# CloudFront deployment summary
# ------------------------------------------------------------

echo
echo "CloudFront deployment and healthchecks successful."

# ------------------------------------------------------------
# 17. Final status
# ------------------------------------------------------------

echo
echo "============================================================"
echo " Deployment successful"
echo "============================================================"
echo
echo "Customer:        $COMPANY_NAME"
echo "Customer ID:     $CUSTOMER"
echo "Instance ID:     $INSTANCE_ID"
echo "Public IP:       $PUBLIC_IP"
echo
echo "Frontend (CloudFront / HTTPS):"
echo "  ${CF_URL}"
echo
echo "Frontend (direct EC2 access):"
echo "  http://${PUBLIC_IP}"
echo
echo "API:"
echo "  http://${PUBLIC_IP}:${API_PORT}"
echo
echo "Company ID:"
echo "  ${COMPANY_ID}"
echo
DEPLOY_SUCCESS="yes"

echo "============================================================"
