# Raspberry Pi Setup Guide

Complete guide for deploying Astibot on a Raspberry Pi for 24/7 operation with network access.

## Prerequisites

- Raspberry Pi 3 or newer (Raspberry Pi 4 recommended)
- Raspberry Pi OS (64-bit recommended)
- Internet connection
- SSH access or direct access to the Pi

## Initial Setup

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js

Install Node.js 18.x or newer:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installation:

```bash
node --version
npm --version
```

### 3. Clone or Transfer Application

**Option A: Clone from Git**
```bash
cd ~
git clone <your-repository-url> astibot
cd astibot
```

**Option B: Transfer via SCP**
```bash
# On your local machine:
scp -r /path/to/VibedAstiBot pi@<raspberry-pi-ip>:~/astibot
```

## Deployment

### Automated Deployment (Recommended)

Run the deployment script:

```bash
cd ~/astibot
chmod +x deploy.sh
./deploy.sh
```

This script will:
- Install dependencies
- Build the frontend
- Install PM2 globally
- Configure and start the application
- Set up auto-start on boot

### Manual Deployment

If you prefer manual setup:

```bash
# Install dependencies
npm install

# Build frontend
npm run build

# Install PM2 globally
sudo npm install -g pm2

# Create environment file
cp .env.example .env
nano .env  # Edit with your settings

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup auto-start on boot
pm2 startup systemd
# Follow the command output instructions
```

## Configuration

### Environment Variables

Edit `.env` file:

```bash
nano .env
```

Configure:
- `PORT`: Server port (default: 3000)
- `COINBASE_API_KEY`: Your Coinbase API key
- `COINBASE_API_SECRET`: Your Coinbase API secret

### Firewall Configuration

Allow access to port 3000:

```bash
sudo ufw allow 3000/tcp
sudo ufw enable
```

## Network Access

### Find Your Raspberry Pi IP Address

```bash
hostname -I
```

The application will be accessible at:
- **Local (on Pi)**: `http://localhost:3000`
- **Network**: `http://<raspberry-pi-ip>:3000`

Example: `http://192.168.1.100:3000`

### Static IP (Recommended)

For consistent access, configure a static IP:

1. Edit dhcpcd.conf:
```bash
sudo nano /etc/dhcpcd.conf
```

2. Add at the end:
```
interface eth0  # or wlan0 for WiFi
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

3. Restart networking:
```bash
sudo systemctl restart dhcpcd
```

## PM2 Management

### Common Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs astibot

# Monitor resources
pm2 monit

# Restart application
pm2 restart astibot

# Stop application
pm2 stop astibot

# Start application
pm2 start astibot
```

### View Real-time Logs

```bash
pm2 logs astibot --lines 100
```

## Alternative: Systemd Service

If you prefer systemd over PM2:

```bash
# Copy service file
sudo cp astibot.service /etc/systemd/system/

# Edit paths if needed
sudo nano /etc/systemd/system/astibot.service

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable astibot
sudo systemctl start astibot

# Check status
sudo systemctl status astibot
```

## Troubleshooting

### Application Won't Start

1. Check logs:
```bash
pm2 logs astibot
```

2. Verify Node.js version:
```bash
node --version  # Should be 18.x or newer
```

3. Check if port is already in use:
```bash
sudo lsof -i :3000
```

### Can't Access from Network

1. Verify firewall:
```bash
sudo ufw status
```

2. Check if server is listening on all interfaces:
```bash
sudo netstat -tulpn | grep :3000
```

3. Verify IP address:
```bash
hostname -I
```

### High Memory Usage

The application is optimized for Raspberry Pi with:
- Memory limit: 500MB (auto-restart if exceeded)
- Chart data limited to 100 points
- WebSocket connection limit: 10 concurrent connections

Monitor with:
```bash
pm2 monit
```

### Application Crashes

PM2 will automatically restart the application. Check logs:
```bash
pm2 logs astibot --err
```

## Performance Optimization

### Disable Unnecessary Services

Free up resources:
```bash
sudo systemctl disable bluetooth
sudo systemctl disable cups
```

### Increase Swap (for Raspberry Pi with limited RAM)

```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Set CONF_SWAPSIZE=1024
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

## Maintenance

### Update Application

```bash
cd ~/astibot
git pull  # If using Git
npm install
npm run build
pm2 restart astibot
```

### Backup Configuration

```bash
cp .env .env.backup
pm2 save
```

### Monitor System Resources

```bash
# CPU and Memory
htop

# Disk usage
df -h

# Temperature (important for Raspberry Pi)
vcgencmd measure_temp
```

## Security Recommendations

1. **Change default Pi password**:
```bash
passwd
```

2. **Enable SSH key authentication** and disable password login

3. **Keep system updated**:
```bash
sudo apt update && sudo apt upgrade -y
```

4. **Use firewall**:
```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 3000/tcp
```

5. **Don't expose to public internet** without proper security (VPN recommended)

## Support

For issues or questions:
- Check PM2 logs: `pm2 logs astibot`
- Check system logs: `sudo journalctl -u astibot -f`
- Monitor resources: `pm2 monit`

## Quick Reference

```bash
# Start application
pm2 start astibot

# Stop application
pm2 stop astibot

# Restart application
pm2 restart astibot

# View logs
pm2 logs astibot

# Check status
pm2 status

# Access application
http://<raspberry-pi-ip>:3000
```
