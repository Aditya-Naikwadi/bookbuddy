#!/usr/bin/env bash
# ==============================================================================
# BookBuddy GCP Compute Engine VM Provisioning & Environment Bootstrap Script
# Target OS: Ubuntu 22.04 / 24.04 LTS
# ==============================================================================

set -euo pipefail

echo ">>> [1/7] Updating apt repositories and base packages..."
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl wget git build-essential ufw nginx redis-server certbot python3-certbot-nginx

echo ">>> [2/7] Installing Node.js 22 LTS..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1) != "v22" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "Installed Node.js: $(node -v) (npm: $(npm -v))"

echo ">>> [3/7] Installing PM2 and PM2 log rotation..."
sudo npm install -g pm2
sudo pm2 install pm2-logrotate
sudo pm2 set pm2-logrotate:max_size 10M
sudo pm2 set pm2-logrotate:retain 7
sudo pm2 set pm2-logrotate:compress true

echo ">>> [4/7] Hardening Redis configuration..."
# Bind Redis to localhost only with protected-mode enabled
sudo sed -i 's/^bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf
sudo sed -i 's/^protected-mode .*/protected-mode yes/' /etc/redis/redis.conf
sudo systemctl restart redis-server
sudo systemctl enable redis-server

echo ">>> [5/7] Configuring UFW Firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
# Never expose backend port 5000 or Redis port 6379 externally
sudo ufw --force enable

echo ">>> [6/7] Creating application directory tree..."
sudo mkdir -p /var/www/bookbuddy/frontend/dist
sudo mkdir -p /var/www/bookbuddy/backend
sudo mkdir -p /var/www/bookbuddy/shared
sudo mkdir -p /var/www/certbot
sudo chown -R "$USER":"$USER" /var/www/bookbuddy

echo ">>> [7/7] Installing BookBuddy Nginx configuration..."
sudo cp deployment/nginx-bookbuddy.conf /etc/nginx/sites-available/bookbuddy.conf
sudo ln -sf /etc/nginx/sites-available/bookbuddy.conf /etc/nginx/sites-enabled/bookbuddy.conf
# Remove default nginx welcome site if present
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx

echo "=============================================================================="
echo "✅ BookBuddy GCP Compute Engine VM Bootstrap Complete!"
echo "Next step: Deploy code, configure /var/www/bookbuddy/backend/.env, and run PM2."
echo "=============================================================================="
