# 🐳 AD Collector for n8n - Complete Guide

<div align="center">

![Active Directory Admin Logo](icons/activeDirectoryAdmin.svg)

**Official Docker Collector for n8n-nodes-ad-admin**

REST API Gateway for Active Directory automation

[![Docker Image](https://img.shields.io/docker/v/fuskerrs97/ad-collector-n8n?label=Docker%20Version&logo=docker)](https://hub.docker.com/r/fuskerrs97/ad-collector-n8n)
[![Docker Pulls](https://img.shields.io/docker/pulls/fuskerrs97/ad-collector-n8n)](https://hub.docker.com/r/fuskerrs97/ad-collector-n8n)
[![Image Size](https://img.shields.io/docker/image-size/fuskerrs97/ad-collector-n8n/latest)](https://hub.docker.com/r/fuskerrs97/ad-collector-n8n)

</div>

---

## 📖 Table of Contents

- [What is the AD Collector?](#-what-is-the-ad-collector)
- [Why Use Collector Mode?](#-why-use-collector-mode)
- [Installation](#-installation)
  - [Docker Run](#method-1-docker-run)
  - [Docker Compose](#method-2-docker-compose-recommended)
- [Configuration](#-configuration)
- [Connecting to n8n](#-connecting-to-n8n)
- [API Endpoints](#-api-endpoints)
- [Troubleshooting](#-troubleshooting)
- [Security Best Practices](#-security-best-practices)
- [Links](#-links)

---

## 🎯 What is the AD Collector?

The **AD Collector** is an official Docker container that acts as a REST API gateway between n8n and your Active Directory server. Instead of connecting directly via LDAP/LDAPS, n8n communicates with the collector over HTTP/HTTPS, and the collector handles all LDAP operations.

### Key Features

- 🔐 **26 REST API Endpoints** - Full coverage of AD operations
- 🔒 **JWT Authentication** - Secure token-based access control
- 📦 **Lightweight** - Only 138 MB (Alpine Linux base)
- ⚡ **Connection Pooling** - Optimized LDAP connection management
- 🌐 **LDAPS Support** - Encrypted communication with domain controllers
- 🔧 **Easy Configuration** - Environment variables only
- 🚀 **Ready to Deploy** - Pre-built image on Docker Hub

### Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   n8n       │ ──────> │  AD Collector    │ ──────> │ Active Directory│
│  Workflows  │  HTTP   │  Docker (8443)   │  LDAPS  │    Server       │
│             │  JWT    │  Node.js 18      │  Port   │  Domain         │
│             │  Token  │  26 Endpoints    │  636    │  Controller     │
└─────────────┘         └──────────────────┘         └─────────────────┘
```

---

## 💡 Why Use Collector Mode?

### ✅ When to Use Collector Mode

**Perfect for:**
- ☁️ **Cloud-hosted n8n** (n8n Cloud, AWS, Azure, GCP)
- 🏢 **Enterprise environments** with strict network segmentation
- 🔐 **Security-conscious deployments** requiring API gateways
- 🌍 **Multi-tenant setups** with centralized AD access
- 🔄 **Multiple n8n instances** sharing one AD connection
- 🚀 **Kubernetes/Docker deployments** requiring containerized solutions

**Advantages:**
- ✅ Only requires HTTP/HTTPS (port 8443) - easier firewall rules
- ✅ Centralized certificate management (configure once)
- ✅ Connection pooling for better performance
- ✅ JWT token authentication (no passwords in n8n credentials)
- ✅ Can run closer to domain controller for better latency
- ✅ Easier to monitor and audit API calls
- ✅ No LDAP client libraries needed in n8n

### ❌ When NOT to Use Collector Mode

**Stick with Direct Mode if:**
- 🏠 n8n runs on-premises with direct DC access
- 🔧 You prefer simpler architecture (fewer moving parts)
- 📊 Very small deployments (< 10 workflows)
- 🛠️ You have full control over network and certificates

---

## 📦 Installation

### Prerequisites

- Docker installed and running
- Active Directory Domain Controller accessible
- Service account with AD permissions (same as Direct Mode)
- Network access from collector to DC (LDAPS port 636)

### Method 1: Docker Run

**Basic setup with self-signed certificates:**

```bash
docker run -d \
  --name ad-collector \
  -e LDAP_URL=ldaps://dc.example.com:636 \
  -e LDAP_BASE_DN=DC=example,DC=com \
  -e LDAP_BIND_DN=CN=n8n-service,CN=Users,DC=example,DC=com \
  -e LDAP_BIND_PASSWORD=YourSecurePassword \
  -e LDAP_TLS_VERIFY=false \
  -p 8443:8443 \
  --restart unless-stopped \
  fuskerrs97/ad-collector-n8n:latest
```

**Production setup with certificate validation:**

```bash
docker run -d \
  --name ad-collector \
  -e LDAP_URL=ldaps://dc.example.com:636 \
  -e LDAP_BASE_DN=DC=example,DC=com \
  -e LDAP_BIND_DN=CN=n8n-service,CN=Users,DC=example,DC=com \
  -e LDAP_BIND_PASSWORD=YourSecurePassword \
  -e LDAP_TLS_VERIFY=true \
  -v /path/to/ca-cert.pem:/app/certs/ca-cert.pem:ro \
  -e LDAP_CA_CERT=/app/certs/ca-cert.pem \
  -p 8443:8443 \
  --restart unless-stopped \
  fuskerrs97/ad-collector-n8n:latest
```

### Method 2: Docker Compose (Recommended)

**1. Create a `.env` file:**

```bash
# Active Directory Configuration
LDAP_URL=ldaps://dc.example.com:636
LDAP_BASE_DN=DC=example,DC=com
LDAP_BIND_DN=CN=n8n-service,CN=Users,DC=example,DC=com
LDAP_BIND_PASSWORD=YourSecurePassword

# TLS Configuration
LDAP_TLS_VERIFY=false
# LDAP_CA_CERT=/app/certs/ca-cert.pem  # Uncomment for production

# API Configuration (Optional)
# API_PORT=8443
# LOG_LEVEL=info
```

**2. Create `docker-compose.yml`:**

```yaml
version: '3.8'

services:
  ad-collector:
    image: fuskerrs97/ad-collector-n8n:latest
    container_name: ad-collector
    restart: unless-stopped
    ports:
      - "8443:8443"
    env_file:
      - .env
    # Uncomment for production with custom CA certificate
    # volumes:
    #   - ./certs/ca-cert.pem:/app/certs/ca-cert.pem:ro
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8443/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

**3. Start the collector:**

```bash
docker-compose up -d
```

**4. Get your API token:**

```bash
docker logs ad-collector | grep "API Token"
```

You should see output like:
```
🔑 API Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Save this token - you'll need it for n8n configuration!**

---

## ⚙️ Configuration

### Environment Variables

#### Required Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `LDAP_URL` | `ldaps://dc.example.com:636` | LDAP/LDAPS URL to domain controller |
| `LDAP_BASE_DN` | `DC=example,DC=com` | Base Distinguished Name for searches |
| `LDAP_BIND_DN` | `CN=n8n-service,CN=Users,DC=example,DC=com` | Service account DN |
| `LDAP_BIND_PASSWORD` | `SecurePassword123!` | Service account password |

#### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LDAP_TLS_VERIFY` | `true` | Verify TLS certificates (set to `false` for self-signed) |
| `LDAP_CA_CERT` | - | Path to custom CA certificate (PEM format) |
| `API_PORT` | `8443` | Port for the REST API |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `JWT_SECRET` | auto-generated | Custom JWT secret (auto-generated if not set) |
| `API_TIMEOUT` | `30000` | API request timeout in milliseconds |

#### Service Account Permissions

The service account (`LDAP_BIND_DN`) must have the following Active Directory permissions:

- ✅ Create, modify, and delete users
- ✅ Create, modify, and delete groups
- ✅ Create, modify, and delete OUs
- ✅ Reset user passwords
- ✅ Manage group memberships
- ✅ Read all user/group attributes

**⚠️ Do NOT use a Domain Admin account!** Create a dedicated service account with only the required permissions.

---

## 🔌 Connecting to n8n

### Step-by-Step Configuration

**1. Get your collector URL and token:**

```bash
# If collector is on the same Docker network as n8n:
Collector URL: http://ad-collector:8443

# If collector is on a different server:
Collector URL: http://your-server-ip:8443
# or
Collector URL: https://collector.yourdomain.com  # with reverse proxy
```

```bash
# Get the JWT token:
docker logs ad-collector | grep "API Token"
```

**2. Configure n8n credentials:**

*Note: Currently, n8n-nodes-ad-admin v0.2.2 only supports Direct Mode in the UI. Collector Mode support in credentials will be added in a future version. For now, you can use the collector by configuring the node to make HTTP calls to the collector's API endpoints directly.*

**Temporary workaround using HTTP Request node:**

You can use n8n's built-in HTTP Request node to call the collector:

```json
{
  "method": "POST",
  "url": "http://ad-collector:8443/api/users/create",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "headers": {
    "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
  },
  "body": {
    "cn": "John Doe",
    "sAMAccountName": "jdoe",
    "userPrincipalName": "john.doe@example.com",
    "parentOuDn": "OU=Users,DC=example,DC=com",
    "password": "TempPass123!",
    "enabled": true
  }
}
```

**3. Test the connection:**

Use the collector's health endpoint:

```bash
curl http://your-collector-url:8443/health
```

Expected response:
```json
{
  "status": "ok",
  "ldap": "connected",
  "timestamp": "2025-02-01T12:00:00.000Z"
}
```

**4. Test authentication:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://your-collector-url:8443/api/users/list
```

---

## 📡 API Endpoints

The collector provides 26 REST API endpoints matching all operations of the n8n-nodes-ad-admin node.

### User Operations (11 endpoints)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/create` | POST | Create a new user |
| `/api/users/get` | POST | Get user details by sAMAccountName |
| `/api/users/list` | POST | List users with filters |
| `/api/users/find` | POST | Find user by sAMAccountName |
| `/api/users/enable` | POST | Enable a user account |
| `/api/users/disable` | POST | Disable a user account |
| `/api/users/reset-password` | POST | Reset user password |
| `/api/users/set-attributes` | POST | Modify user attributes |
| `/api/users/groups` | POST | Get user's group memberships |
| `/api/users/activity` | POST | Get user login and password activity |
| `/api/users/unlock` | POST | Unlock a locked account |
| `/api/users/password-expiry` | POST | Check password expiration |

### Group Operations (7 endpoints)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/groups/create` | POST | Create a new group |
| `/api/groups/get` | POST | Get group details |
| `/api/groups/list` | POST | List groups with filters |
| `/api/groups/modify` | POST | Modify group attributes |
| `/api/groups/delete` | POST | Delete a group |
| `/api/groups/add-member` | POST | Add member to group |
| `/api/groups/remove-member` | POST | Remove member from group |

### OU Operations (5 endpoints)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ous/create` | POST | Create a new OU |
| `/api/ous/get` | POST | Get OU details |
| `/api/ous/list` | POST | List OUs |
| `/api/ous/modify` | POST | Modify OU attributes |
| `/api/ous/delete` | POST | Delete an OU |

### System Endpoints (3 endpoints)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check (no auth required) |
| `/api/test-connection` | GET | Test LDAP connection (requires auth) |
| `/api/endpoints` | GET | List all available endpoints (requires auth) |

### Authentication

All API endpoints (except `/health`) require JWT Bearer token authentication:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🔍 Troubleshooting

### Getting Logs

```bash
# View logs in real-time
docker logs -f ad-collector

# View last 100 lines
docker logs --tail 100 ad-collector

# View logs with timestamps
docker logs -t ad-collector
```

### Common Issues

#### 1. Collector won't start

**Symptoms:** Container exits immediately

**Solutions:**
```bash
# Check logs for errors
docker logs ad-collector

# Common causes:
# - Missing required environment variables
# - Invalid LDAP_URL format
# - Password contains special characters not properly escaped
```

**Fix for special characters in password:**
```bash
# Use single quotes in .env file:
LDAP_BIND_PASSWORD='P@ssw0rd!$pecial'
```

#### 2. Cannot connect to Active Directory

**Symptoms:** `LDAP connection failed` in logs

**Solutions:**
```bash
# Test network connectivity from container
docker exec ad-collector ping dc.example.com

# Test LDAPS port
docker exec ad-collector nc -zv dc.example.com 636

# Check DNS resolution
docker exec ad-collector nslookup dc.example.com

# Verify credentials by testing bind
docker exec ad-collector curl -v ldaps://dc.example.com:636
```

**Common causes:**
- ❌ Firewall blocking port 636
- ❌ Wrong DC hostname/IP
- ❌ DC not configured for LDAPS
- ❌ Network routing issues

#### 3. TLS Certificate Errors

**Symptoms:** `certificate verify failed` or `self signed certificate`

**Solutions:**

**For self-signed certificates (testing only):**
```bash
# Disable TLS verification
-e LDAP_TLS_VERIFY=false
```

**For production with custom CA:**
```bash
# Mount CA certificate
-v /path/to/ca-cert.pem:/app/certs/ca-cert.pem:ro \
-e LDAP_CA_CERT=/app/certs/ca-cert.pem \
-e LDAP_TLS_VERIFY=true
```

#### 4. Authentication Failures

**Symptoms:** `Invalid credentials` or `Bind failed`

**Solutions:**
```bash
# Verify DN format (must be full DN, not just username)
LDAP_BIND_DN=CN=n8n-service,CN=Users,DC=example,DC=com

# Test credentials manually using ldapsearch
ldapsearch -H ldaps://dc.example.com:636 \
  -D "CN=n8n-service,CN=Users,DC=example,DC=com" \
  -w "password" \
  -b "DC=example,DC=com" \
  "(objectClass=user)"
```

#### 5. API Returns 401 Unauthorized

**Symptoms:** API calls fail with 401 status

**Solutions:**
```bash
# Verify you're using the correct token
docker logs ad-collector | grep "API Token"

# Test with curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8443/api/test-connection

# Token should be in format: Bearer eyJhbG...
```

#### 6. Permission Denied Errors

**Symptoms:** `Insufficient rights` or `Access denied`

**Solutions:**
- ✅ Verify service account has required AD permissions
- ✅ Check delegation of control in AD
- ✅ Ensure account is not expired or locked
- ✅ Try operation with Domain Admin account to isolate permission issue

#### 7. Port Already in Use

**Symptoms:** `port is already allocated`

**Solutions:**
```bash
# Use a different port
docker run -p 8444:8443 ...

# Or stop conflicting service
docker ps | grep 8443
docker stop <container-id>
```

### Health Check

```bash
# Quick health check
curl http://localhost:8443/health

# Expected response:
{
  "status": "ok",
  "ldap": "connected",
  "timestamp": "2025-02-01T12:00:00.000Z"
}
```

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
docker run -e LOG_LEVEL=debug ...
```

---

## 🔒 Security Best Practices

### 1. Network Security

**✅ DO:**
- Run collector in a private network (Docker network, VPC)
- Use firewall rules to restrict access to port 8443
- Place collector close to domain controller (same VLAN/subnet)
- Use reverse proxy with SSL/TLS for external access

**❌ DON'T:**
- Expose port 8443 directly to the internet
- Run collector on public networks without encryption

**Example with Traefik reverse proxy:**
```yaml
version: '3.8'
services:
  ad-collector:
    image: fuskerrs97/ad-collector-n8n:latest
    networks:
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.ad-collector.rule=Host(`collector.yourdomain.com`)"
      - "traefik.http.routers.ad-collector.tls=true"
      - "traefik.http.routers.ad-collector.tls.certresolver=letsencrypt"
```

### 2. Credential Management

**✅ DO:**
- Use Docker secrets for sensitive data
- Store `.env` file with restricted permissions (600)
- Rotate service account password regularly
- Use dedicated service account (not Domain Admin)

**❌ DON'T:**
- Commit `.env` to version control
- Use Domain Admin credentials
- Share JWT tokens across environments

**Example with Docker Secrets:**
```yaml
version: '3.8'
services:
  ad-collector:
    image: fuskerrs97/ad-collector-n8n:latest
    environment:
      - LDAP_BIND_PASSWORD_FILE=/run/secrets/ad_password
    secrets:
      - ad_password

secrets:
  ad_password:
    file: ./ad_password.txt
```

### 3. TLS/SSL Configuration

**✅ DO:**
- Always use LDAPS (port 636) in production
- Validate TLS certificates (`LDAP_TLS_VERIFY=true`)
- Use proper CA certificates

**❌ DON'T:**
- Use `LDAP_TLS_VERIFY=false` in production
- Use plain LDAP (port 389) for production

### 4. JWT Token Security

**✅ DO:**
- Store JWT token in n8n credentials (encrypted)
- Use custom `JWT_SECRET` for production
- Rotate JWT_SECRET periodically
- Monitor for unauthorized token usage

**❌ DON'T:**
- Hard-code tokens in workflows
- Share tokens in plain text
- Use default auto-generated JWT_SECRET in production

**Set custom JWT secret:**
```bash
# Generate a strong random secret
openssl rand -base64 32

# Use it in docker-compose
JWT_SECRET=your-random-secret-here
```

### 5. Monitoring & Auditing

**✅ DO:**
- Monitor collector logs for suspicious activity
- Set up alerts for authentication failures
- Enable audit logging in Active Directory
- Track API usage and rate limit if needed

**Example log monitoring:**
```bash
# Monitor authentication failures
docker logs -f ad-collector | grep "Authentication failed"

# Monitor API errors
docker logs -f ad-collector | grep "ERROR"
```

### 6. Container Security

**✅ DO:**
- Keep Docker image updated (`docker pull fuskerrs97/ad-collector-n8n:latest`)
- Run container with minimal privileges
- Use read-only root filesystem where possible
- Implement container resource limits

**Example with security hardening:**
```yaml
version: '3.8'
services:
  ad-collector:
    image: fuskerrs97/ad-collector-n8n:latest
    read_only: true
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          memory: 256M
```

### 7. Service Account Best Practices

**✅ Create dedicated service account:**
```powershell
# In Active Directory
New-ADUser -Name "n8n-service" `
  -SamAccountName "n8n-service" `
  -UserPrincipalName "n8n-service@example.com" `
  -AccountPassword (ConvertTo-SecureString "SecureP@ssw0rd!" -AsPlainText -Force) `
  -Enabled $true `
  -PasswordNeverExpires $true `
  -CannotChangePassword $true

# Delegate minimal permissions (use AD Delegation Wizard)
# Grant only required permissions on specific OUs
```

---

## 🔗 Links

### Documentation
- **Main README**: [n8n-nodes-ad-admin](../README.md)
- **npm Package**: [npmjs.com/package/n8n-nodes-ad-admin](https://www.npmjs.com/package/n8n-nodes-ad-admin)
- **Node Source**: [github.com/Fuskerrs/n8n-nodes-ad-admin](https://github.com/Fuskerrs/n8n-nodes-ad-admin)

### Docker Collector
- **Docker Hub**: [hub.docker.com/r/fuskerrs97/ad-collector-n8n](https://hub.docker.com/r/fuskerrs97/ad-collector-n8n)
- **Collector Source**: [github.com/Fuskerrs/docker-ad-collector-n8n](https://github.com/Fuskerrs/docker-ad-collector-n8n)
- **Image Tags**: `latest`, `1.0`, `1.0.0`

### Support
- **Buy Me a Coffee**: [buymeacoffee.com/freelancerc5](https://buymeacoffee.com/freelancerc5)
- **Issues**: [GitHub Issues](https://github.com/Fuskerrs/n8n-nodes-ad-admin/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Fuskerrs/n8n-nodes-ad-admin/discussions)

---

<div align="center">

**Made with ❤️ for the n8n community**

*Simplifying Active Directory automation in the cloud*

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/freelancerc5)

</div>
