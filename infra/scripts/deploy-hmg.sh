#!/usr/bin/env bash
# Deploy do ambiente hmg: manda um script para a EC2 do app via SSM Run Command.
# A EC2 faz login no ECR, puxa as imagens, le a senha do RDS e os JWT, e sobe os containers.
# O ambiente precisa estar ligado (aws lambda invoke --function-name wise-warrior-schedule-start-all).
#
# Uso: infra/scripts/deploy-hmg.sh [tag-da-imagem]   (padrao: hmg)
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
TAG="${1:-hmg}"
COMPUTE_STACK="${COMPUTE_STACK:-wise-warrior-compute}"
DATA_STACK="${DATA_STACK:-wise-warrior-data}"
FRONTEND_URL="${FRONTEND_URL:-https://wise.guilhermeluan.dev}"

stack_output() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}

INSTANCE_ID="$(stack_output "$COMPUTE_STACK" AppInstanceId)"
DB_HOST="$(stack_output "$DATA_STACK" DbEndpoint)"
DB_SECRET_ARN="$(stack_output "$DATA_STACK" DbSecretArn)"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

STATE="$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].State.Name' --output text)"
PING="$(aws ssm describe-instance-information --region "$REGION" \
  --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
  --query 'InstanceInformationList[0].PingStatus' --output text)"
if [ "$STATE" != "running" ] || [ "$PING" != "Online" ]; then
  echo "A EC2 $INSTANCE_ID nao esta pronta (estado: $STATE, SSM: $PING)." >&2
  echo "Ligue o ambiente: aws lambda invoke --function-name wise-warrior-schedule-start-all --region $REGION /dev/stdout" >&2
  exit 1
fi

# Script que roda na EC2 (como root). Os segredos sao lidos la e nunca saem dela.
REMOTE_SCRIPT="$(cat <<REMOTE
set -euo pipefail
REGION='${REGION}'
REGISTRY='${REGISTRY}'
TAG='${TAG}'
DB_HOST='${DB_HOST}'
DB_SECRET_ARN='${DB_SECRET_ARN}'
FRONTEND_URL='${FRONTEND_URL}'
REMOTE
cat <<'REMOTE'

install -d -m 700 /opt/wise

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null

DB_PASSWORD="$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$DB_SECRET_ARN" \
  --query SecretString --output text | python3 -c 'import json,sys; print(json.load(sys.stdin)["password"])')"
JWT_ACCESS_SECRET="$(aws ssm get-parameter --region "$REGION" --with-decryption \
  --name /wise-warrior/hmg/JWT_ACCESS_SECRET --query Parameter.Value --output text)"
JWT_REFRESH_SECRET="$(aws ssm get-parameter --region "$REGION" --with-decryption \
  --name /wise-warrior/hmg/JWT_REFRESH_SECRET --query Parameter.Value --output text)"

umask 077
cat > /opt/wise/backend.env <<ENV
NODE_ENV=production
PORT=3000
DB_HOST=$DB_HOST
DB_PORT=3306
DB_USERNAME=wise
DB_PASSWORD=$DB_PASSWORD
DB_DATABASE=wise
JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_REFRESH_TTL_DAYS=30
MAX_SESSIONS_PER_USER=5
CORS_ORIGIN=$FRONTEND_URL
TRUST_PROXY=1
ENV
chmod 600 /opt/wise/backend.env

docker pull "$REGISTRY/wise-warrior/backend:$TAG" >/dev/null
docker pull "$REGISTRY/wise-warrior/frontend:$TAG" >/dev/null

docker rm -f backend frontend >/dev/null 2>&1 || true
docker run -d --name backend --restart unless-stopped -p 3000:3000 \
  --env-file /opt/wise/backend.env "$REGISTRY/wise-warrior/backend:$TAG" >/dev/null
docker run -d --name frontend --restart unless-stopped -p 80:80 \
  "$REGISTRY/wise-warrior/frontend:$TAG" >/dev/null

# O backend roda as migrations no boot, entao pode demorar um pouco.
for _ in $(seq 1 40); do
  if curl -fs http://localhost:3000/api/v1/health >/dev/null; then
    echo "backend: saudavel"
    break
  fi
  sleep 3
done
curl -fs http://localhost/health >/dev/null && echo "frontend: saudavel"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
REMOTE
)"

ENCODED="$(printf '%s' "$REMOTE_SCRIPT" | base64 | tr -d '\n')"

COMMAND_ID="$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript --comment "deploy hmg $TAG" \
  --parameters "commands=[\"echo $ENCODED | base64 -d | bash\"]" \
  --query Command.CommandId --output text)"
echo "Comando SSM: $COMMAND_ID (instancia $INSTANCE_ID, tag $TAG)"

while :; do
  STATUS="$(aws ssm get-command-invocation --region "$REGION" --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" --query Status --output text 2>/dev/null || echo Pending)"
  case "$STATUS" in
    Pending|InProgress|Delayed) sleep 5 ;;
    *) break ;;
  esac
done

aws ssm get-command-invocation --region "$REGION" --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
  --query '[StandardOutputContent,StandardErrorContent]' --output text
echo "Status: $STATUS"
[ "$STATUS" = "Success" ]
