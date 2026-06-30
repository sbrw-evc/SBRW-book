#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-runner.sh  —  Run this ONCE on 192.168.0.203 as root.
#
# Usage:
#   chmod +x setup-runner.sh
#   sudo ./setup-runner.sh <gitlab-url> <registration-token>
#
# Example:
#   sudo ./setup-runner.sh http://192.168.0.202 glrt-xxxxxxxxxxxx
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GITLAB_URL="${1:?Usage: $0 <gitlab-url> <registration-token>}"
REG_TOKEN="${2:?Usage: $0 <gitlab-url> <registration-token>}"
DEPLOY_DIR="/srv/sbrw-book"
RUNNER_NAME="sbrw-deploy-$(hostname)"

echo "══════════════════════════════════════════════════════"
echo "  SBRW-Book  |  GitLab Runner setup on $(hostname)"
echo "══════════════════════════════════════════════════════"

# ── 1. Install GitLab Runner ──────────────────────────────────────────────────
echo "[1/5] Installing gitlab-runner…"
if ! command -v gitlab-runner &>/dev/null; then
    curl -fsSL https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh | bash
    apt-get install -y gitlab-runner
else
    echo "      gitlab-runner already installed: $(gitlab-runner --version | head -1)"
fi

# ── 2. Add gitlab-runner to docker group ─────────────────────────────────────
echo "[2/5] Adding gitlab-runner to docker group…"
usermod -aG docker gitlab-runner
echo "      Done. Runner will have docker access after re-login."

# ── 3. Create persistent deploy directory with placeholder .env ───────────────
echo "[3/5] Creating $DEPLOY_DIR …"
mkdir -p "$DEPLOY_DIR"
chown gitlab-runner:gitlab-runner "$DEPLOY_DIR"

if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
    cat > "$DEPLOY_DIR/.env" <<'ENV'
# ── PostgreSQL ────────────────────────────────────────────────────────────────
POSTGRES_USER=bookuser
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=bookdb

# ── Django ────────────────────────────────────────────────────────────────────
# Generate with: python3 -c "import secrets; print(secrets.token_urlsafe(50))"
SECRET_KEY=CHANGE_ME_VERY_LONG_SECRET_KEY_AT_LEAST_50_CHARS

# ── Field-level encryption (Fernet key) ──────────────────────────────────────
# Generate with: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FIELD_ENCRYPTION_KEY=CHANGE_ME

# ── Ports (optional, defaults shown) ─────────────────────────────────────────
APP_PORT=80
ADMIN_PORT=8080

# ── Optional integrations ─────────────────────────────────────────────────────
GOOGLE_BOOKS_API_KEY=
ENV
    chmod 600 "$DEPLOY_DIR/.env"
    chown gitlab-runner:gitlab-runner "$DEPLOY_DIR/.env"
    echo "      Created $DEPLOY_DIR/.env — EDIT IT before first deploy!"
else
    echo "      $DEPLOY_DIR/.env already exists — skipping."
fi

# ── 4. Register the runner ────────────────────────────────────────────────────
echo "[4/5] Registering runner with GitLab at $GITLAB_URL …"
gitlab-runner register \
    --non-interactive \
    --url "$GITLAB_URL" \
    --registration-token "$REG_TOKEN" \
    --name "$RUNNER_NAME" \
    --executor shell \
    --tag-list sbrw-deploy \
    --run-untagged false \
    --locked true

# ── 5. Start & enable the service ─────────────────────────────────────────────
echo "[5/5] Starting gitlab-runner service…"
gitlab-runner start || systemctl start gitlab-runner
systemctl enable gitlab-runner 2>/dev/null || true

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Done! Next steps:"
echo ""
echo "  1. Edit /srv/sbrw-book/.env with real secrets"
echo "  2. In GitLab → Project → Settings → CI/CD → Runners"
echo "     confirm the runner '$RUNNER_NAME' appears as active"
echo "  3. Push to main — the pipeline will start automatically"
echo "══════════════════════════════════════════════════════"
