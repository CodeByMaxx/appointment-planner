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

for command in aws ssh rsync curl; do
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
done < "$CUSTOMER_FILE"

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
  echo "Set DEPLOY_CONFIRM=yes to create the EC2 instance."
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

cleanup() {
  if [[ "$DEPLOY_SUCCESS" != "yes" && "$DEPLOY_MODE" == "create" && -n "${INSTANCE_ID:-}" ]]; then
    echo
    echo "Deployment failed. Terminating created EC2 instance..."
    aws ec2 terminate-instances \
      --region "$AWS_REGION" \
      --instance-ids "$INSTANCE_ID" \
      >/dev/null
    echo "Instance terminated: $INSTANCE_ID"
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
# 3. Get public IP
# ------------------------------------------------------------

PUBLIC_IP="$(aws ec2 describe-instances \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)"

if [[ -z "$PUBLIC_IP" || "$PUBLIC_IP" == "None" ]]; then
  echo "Could not determine public IP."
  exit 1
fi

echo "Public IP: $PUBLIC_IP"

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
API_BASE_URL=http://${PUBLIC_IP}:${API_PORT}

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
# 12. Start Docker stack
# ------------------------------------------------------------

echo
echo "==> Building and starting Docker stack..."

ssh_cmd \
  "cd '$REMOTE_PROJECT' && sudo docker compose up -d --build"

echo "Docker stack started."

# ------------------------------------------------------------
# 13. Run Prisma migrations
# ------------------------------------------------------------

echo
echo "==> Running Prisma migrations..."

ssh_cmd \
  "cd '$REMOTE_PROJECT' && sudo docker compose exec -T api npx prisma migrate deploy"

echo "Migrations completed."

# ------------------------------------------------------------
# 14. Seed database
# ------------------------------------------------------------

echo
echo "==> Seeding database..."

ssh_cmd \
  "cd '$REMOTE_PROJECT' && sudo docker compose exec -T api npx tsx prisma/seed.ts"

echo "Database seeded."

# ------------------------------------------------------------
# 15. Verify company
# ------------------------------------------------------------

echo
echo "==> Verifying company..."

COMPANY_CHECK="$(ssh_cmd \
  "cd '$REMOTE_PROJECT' && sudo docker compose exec -T api npx tsx -e 'import { PrismaClient } from \"@prisma/client\"; (async()=>{const p=new PrismaClient(); const c=await p.company.findUnique({where:{id:\"${COMPANY_ID}\"}}); console.log(c ? c.id : \"NOT_FOUND\"); await p.\$disconnect();})()'" \
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
echo "Frontend:"
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

