#!/usr/bin/env bash
set -euo pipefail
# 이 스크립트는 마을 EC2 안에서만 실행한다. 회사 PC에서는 실행하지 않는다.
expected=i-0ceabbb81f8eba6da
test "$(id -u)" = 0
token=$(curl -fsS --max-time 2 -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)
actual=$(curl -fsS --max-time 2 -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/instance-id)
test "$actual" = "$expected"
test -f /opt/free-village/server-lifecycle.js
gate=${1:?Lambda 진입점 주소가 필요합니다}
secret=${2:?접속 키가 필요합니다}
[[ "$gate" =~ ^https://[a-z0-9]+\.lambda-url\.ap-southeast-2\.on\.aws/?$ ]]
[[ "$secret" =~ ^[a-zA-Z0-9_-]{32,128}$ ]]
mkdir -p /etc/systemd/system/village.service.d
cat > /etc/systemd/system/village.service.d/on-demand.conf <<EOF
[Service]
Environment=VILLAGE_EC2_STOP=1
Environment=VILLAGE_EXPECTED_INSTANCE=i-0ceabbb81f8eba6da
Environment=VILLAGE_GATE_URL=$gate
Environment=VILLAGE_GATE_KEY=$secret
TimeoutStopSec=180
EOF
chmod 600 /etc/systemd/system/village.service.d/on-demand.conf
systemctl daemon-reload
systemctl restart village.service
echo '접속 종료 후 전체 저장과 EC2 자동 중지를 설정했습니다.'
