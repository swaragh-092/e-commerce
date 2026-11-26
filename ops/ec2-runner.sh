#!/usr/bin/env bash
set -euo pipefail
umask 077

fail() {
  echo "::error::$*" >&2
  exit 1
}

ssh_dir="$RUNNER_TEMP/ec2-ssh"
ssh_cmd=(ssh -F "$ssh_dir/config" ec2-deploy)
frontend="$RUNNER_TEMP/frontend.tar.gz"

case "${1:?}" in
  configure)
    for key in EC2_HOST EC2_USER APP_DIR DEPLOY_KEY EXPECTED_FINGERPRINT; do
      [[ -n "${!key:-}" ]] || fail "Missing $key in GitHub Environment $TARGET."
    done
    [[ "$EC2_USER" == ec2-user && "$EC2_HOST" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] ||
      fail "Invalid SSH user or host for $TARGET."
    [[ "$PM2_APP_NAME" == ecommerce-api && "$VITE_API_URL" == /api ]] ||
      fail "Expected PM2_APP_NAME=ecommerce-api and VITE_API_URL=/api in $TARGET."
    case "$TARGET" in
      staging)
        [[ "$APP_DIR" == /home/ec2-user/e-commerce &&
           "$WEB_ROOT" == "$APP_DIR/client/dist" &&
           "$SITE_URL" == https://eshopadmin.swaragh.org.in &&
           "$VITE_APP_URL" == "$SITE_URL" ]] || fail "Incorrect staging paths or URLs."
        ;;
      production)
        [[ "$EC2_HOST" == 65.0.174.174 &&
           "$APP_DIR" == /home/ec2-user/projects/e-commerce &&
           "$WEB_ROOT" == /var/www/orbis-admin &&
           "$SITE_URL" == https://ad.orbiseeds.com &&
           "$VITE_APP_URL" == https://orbiseeds.com ]] || fail "Incorrect production host, paths or URLs."
        ;;
      *) fail "Unknown deployment environment." ;;
    esac
    [[ "$DEPLOY_ENABLED" == true || "$DEPLOY_ENABLED" == false ]] ||
      fail "Set DEPLOY_ENABLED to true or false in $TARGET."
    [[ "$EXPECTED_FINGERPRINT" =~ ^SHA256:[A-Za-z0-9+/]{43}$ ]] ||
      fail "EC2_HOST_FINGERPRINT must contain just the SHA256: value of the EC2 ED25519 host key."
    mkdir -p "$ssh_dir"
    printf '%s\n' "$DEPLOY_KEY" | tr -d '\r' > "$ssh_dir/key"
    key_type=$(ssh-keygen -y -P '' -f "$ssh_dir/key" | cut -d ' ' -f 1) ||
      fail "EC2_SSH_KEY could not be loaded as an unencrypted OpenSSH private key."
    [[ "$key_type" == ssh-ed25519 ]] || fail "EC2_SSH_KEY must be an ED25519 deployment key."
    ssh-keyscan -T 10 -t ed25519 "$EC2_HOST" > "$ssh_dir/known_hosts" 2>/dev/null ||
      fail "Cannot read the ED25519 host key from port 22. Check runner connectivity and SSH ingress."
    actual=$(ssh-keygen -lf "$ssh_dir/known_hosts" -E sha256 | awk '{print $2}' | sort -u)
    [[ "$actual" == "$EXPECTED_FINGERPRINT" ]] ||
      fail "ED25519 host fingerprint mismatch for $TARGET. Verify the instance key through a trusted AWS or SSH session."
    cat > "$ssh_dir/config" <<EOF
Host ec2-deploy
  HostName $EC2_HOST
  User $EC2_USER
  IdentityFile $ssh_dir/key
  IdentitiesOnly yes
  BatchMode yes
  StrictHostKeyChecking yes
  UserKnownHostsFile $ssh_dir/known_hosts
  GlobalKnownHostsFile /dev/null
  HostKeyAlgorithms ssh-ed25519
  ConnectTimeout 15
  ServerAliveInterval 15
  ServerAliveCountMax 3
EOF
    ;;
  preflight)
    prefix=$("${ssh_cmd[@]}" bash -s -- check "$TARGET" "$GITHUB_REF_NAME" "$APP_DIR" "$WEB_ROOT" "$PM2_APP_NAME" "$GITHUB_SHA" < ops/deploy-ec2.sh)
    [[ "$prefix" =~ ^[A-Za-z0-9_-]+$ ]] || fail "Invalid admin API prefix returned by EC2."
    printf '%s\n' "$prefix" > "$ssh_dir/admin_prefix"
    echo "SSH, host, branch, application database login, Nginx and PM2 passed preflight."
    ;;
  transfer)
    [[ "$DEPLOY_ENABLED" == true ]] || fail "Deployment is disabled in $TARGET."
    remote_dir=$("${ssh_cmd[@]}" 'umask 077; mktemp -d "$HOME/.ec2-deploy.XXXXXXXX"')
    [[ "$remote_dir" =~ ^/home/ec2-user/\.ec2-deploy\.[A-Za-z0-9]+$ ]] ||
      fail "Unexpected remote artifact path."
    trap '"${ssh_cmd[@]}" "rm -rf -- '\''$remote_dir'\''" || echo "::warning::Could not clean up remote transfer directory."' EXIT
    "${ssh_cmd[@]}" "cat > '$remote_dir/frontend.tar.gz'" < "$frontend"
    digest=$(sha256sum "$frontend" | cut -d ' ' -f 1)
    "${ssh_cmd[@]}" bash -s -- deploy "$TARGET" "$GITHUB_REF_NAME" "$APP_DIR" "$WEB_ROOT" "$PM2_APP_NAME" "$GITHUB_SHA" "$remote_dir" "$digest" < ops/deploy-ec2.sh
    ;;
  cleanup)
    rm -rf -- "$ssh_dir"
    ;;
  *) fail "Unknown runner operation." ;;
esac
