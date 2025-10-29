# n8n-nodes-ad-admin

<div align="center">

![Active Directory Admin Logo](icons/activeDirectoryAdmin.svg)

**The most complete Active Directory automation node for n8n**

Manage Users, Groups, and Organizational Units with full LDAPS support and dynamic dropdowns

[![npm version](https://badge.fury.io/js/n8n-nodes-ad-admin.svg)](https://badge.fury.io/js/n8n-nodes-ad-admin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dt/n8n-nodes-ad-admin.svg)](https://www.npmjs.com/package/n8n-nodes-ad-admin)

### ☕ Support this project

<a href="https://buymeacoffee.com/freelancerc5" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

*If you find this node useful, consider buying me a coffee! Your support helps maintain and improve this package.* 🚀

</div>

---

## ✨ Features

### 👥 User Management
- ✅ **Create** users with complete configuration
- ✅ **Enable/Disable** user accounts
- ✅ **Reset Password** with LDAPS security
- ✅ **Set Attributes** with dynamic dropdown selection
- ✅ **Get User** with all properties and account flags
- ✅ **List Users** with advanced filtering
- ✅ **Find by sAMAccountName** for quick searches
- ✅ **Get User Groups** with nested group detection
- ✅ **Get User Activity** (last login, password info)
- ✅ **Unlock Account** for locked users
- ✅ **Check Password Expiry** with policy detection

### 👬 Group Management
- ✅ **Create** security or distribution groups
- ✅ **Get** group details with member list
- ✅ **List** groups with type and scope filters
- ✅ **Modify** group attributes
- ✅ **Delete** groups
- ✅ **Add Member** to groups
- ✅ **Remove Member** from groups
- 🎯 **Group Types**: Security / Distribution
- 🎯 **Group Scopes**: Global / Domain Local / Universal

### 🗂️ Organizational Unit Management
- ✅ **Create** new OUs
- ✅ **Get** OU details
- ✅ **List** OUs with search filters
- ✅ **Modify** OU attributes
- ✅ **Delete** OUs

### 🎯 Advanced Features
- 🔐 **Full LDAPS Support** with custom certificates
- 🔍 **Dynamic Dropdowns** for groups, OUs, and attributes
- ⚡ **Smart Attribute Selection** - No more manual typing!
- 📊 **Detailed Activity Tracking** - Login times, password changes
- 🔒 **Certificate Validation** - System CA, skip, or custom certificate
- 🌐 **DNS & IP Support** - Flexible connection options
- ⚙️ **Comprehensive Error Handling** - Clear messages and reconnection logic

---

## 📦 Installation

### Method 1: Via n8n Community Nodes (Recommended)

1. Open your n8n instance
2. Go to **Settings** → **Community Nodes**
3. Click **Install**
4. Enter package name: `n8n-nodes-ad-admin`
5. Click **Install**

![Installation Step 1](docs/screenshots/install-step1.png)
*Coming soon: Screenshot showing Settings → Community Nodes*

![Installation Step 2](docs/screenshots/install-step2.png)
*Coming soon: Screenshot showing package installation*

### Method 2: Via npm

```bash
# For n8n installed globally
npm install -g n8n-nodes-ad-admin

# For n8n in a specific directory
cd /path/to/n8n
npm install n8n-nodes-ad-admin

# Restart n8n after installation
```

### Method 3: Docker

```dockerfile
# Add to your n8n Dockerfile
FROM n8nio/n8n
RUN npm install -g n8n-nodes-ad-admin
```

Or using docker-compose:

```yaml
version: '3'
services:
  n8n:
    image: n8nio/n8n
    environment:
      - N8N_COMMUNITY_PACKAGES=n8n-nodes-ad-admin
    # ... rest of your config
```

---

## ⚙️ Configuration

### Prerequisites

- **Active Directory Domain Controller** with LDAP/LDAPS enabled
- **Service Account** with appropriate permissions:
  - Create/modify/delete users
  - Create/modify/delete groups
  - Create/modify/delete OUs
  - Reset passwords
  - Manage group membership

### Creating Credentials

1. In n8n, go to **Credentials** → **New** → **Active Directory API**
2. Configure the following:

| Field | Example | Description |
|-------|---------|-------------|
| **Connection Type** | LDAPS (Secure - Port 636) | Always use LDAPS in production |
| **Host Type** | DNS Name | Choose DNS or IP |
| **Host** | DC-01.example.com | Your domain controller |
| **Port** | 636 | 636 for LDAPS, 389 for LDAP |
| **Base DN** | DC=example,DC=com | Your domain base |
| **Bind DN** | CN=n8n-service,CN=Users,DC=example,DC=com | Service account DN |
| **Password** | ••••••••• | Service account password |
| **TLS Certificate Validation** | System CA Bundle | Certificate validation method |
| **Connect Timeout** | 10000 | Timeout in milliseconds |

### TLS Certificate Options

- **System CA Bundle**: Use system-trusted certificates (default, recommended)
- **Skip Validation**: ⚠️ Ignore certificate errors (self-signed only, NOT for production)
- **Custom Certificate**: Provide your own Root CA certificate in PEM format

Example custom certificate:
```
-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIQPTxrAJiCX4pIRFX3zmhqoDANBgkqhkiG...
-----END CERTIFICATE-----
```

---

## 📚 Operations Guide

### User Operations

<details>
<summary><b>Create User</b></summary>

Create a new Active Directory user with full configuration.

**Parameters:**
- User CN: Full name (e.g., "John Doe")
- Parent OU DN: Where to create the user
- sAMAccountName: Login name (max 20 chars)
- User Principal Name: email-like format (user@domain.com)
- Initial Password: Must meet AD policy
- Must Change Password: Force change at next logon
- Enable Account Immediately: Activate after creation

**Example:**
```json
{
  "resource": "user",
  "operation": "create",
  "cn": "John Doe",
  "parentOuDn": "OU=Users,DC=example,DC=com",
  "samAccountName": "jdoe",
  "upn": "john.doe@example.com",
  "initialPassword": "TempPass123!",
  "pwdMustChange": true,
  "enableImmediately": true
}
```

**Result:**
```json
{
  "success": true,
  "dn": "CN=John Doe,OU=Users,DC=example,DC=com",
  "sAMAccountName": "jdoe",
  "enabled": true,
  "mustChangePassword": true
}
```
</details>

<details>
<summary><b>Get User</b></summary>

Retrieve complete user information including account flags and properties.

**Example:**
```json
{
  "resource": "user",
  "operation": "getUser",
  "getUserSAM": "jdoe",
  "includeAllProperties": true
}
```

**Result includes:**
- Basic info (name, email, phone)
- Account status (enabled, locked, expired)
- Account flags (passwordNeverExpires, cannotChangePassword, etc.)
- Group memberships
- Timestamps (created, modified, last logon)
</details>

<details>
<summary><b>List Users</b></summary>

Search and list users with advanced filtering.

**Filter Types:**
- Exact Match
- Starts With
- Contains
- Ends With

**Search Fields:**
- sAMAccountName (login name)
- displayName (full name)
- userPrincipalName (UPN)
- givenName (first name)
- sn (last name)
- mail (email)

**Example:**
```json
{
  "resource": "user",
  "operation": "listUsers",
  "filterType": "contains",
  "searchValue": "john",
  "searchField": "displayName",
  "maxResults": 50
}
```
</details>

<details>
<summary><b>Get User Groups</b></summary>

Get all groups a user belongs to, including nested groups.

**Example:**
```json
{
  "resource": "user",
  "operation": "getUserGroups",
  "getUserGroupsSAM": "jdoe",
  "includeNested": true,
  "groupDetails": "full"
}
```

**Result:**
```json
{
  "groups": [
    {
      "name": "IT Staff",
      "distinguishedName": "CN=IT Staff,OU=Groups,DC=example,DC=com",
      "description": "IT Department",
      "inherited": false
    },
    {
      "name": "Domain Users",
      "distinguishedName": "CN=Domain Users,CN=Users,DC=example,DC=com",
      "inherited": true
    }
  ]
}
```
</details>

<details>
<summary><b>Get User Activity</b></summary>

Retrieve user activity information including login times and password details.

**Activity Types:**
- All Activity
- Login Only
- Password Only

**Example:**
```json
{
  "resource": "user",
  "operation": "getUserActivity",
  "getUserActivitySAM": "jdoe",
  "activityType": "all"
}
```

**Result:**
```json
{
  "loginInfo": {
    "lastLogon": "2025-01-28T14:30:00.000Z",
    "lastLogonTimestamp": "2025-01-28T14:30:00.000Z",
    "logonCount": 42,
    "badPasswordCount": 0,
    "isLockedOut": false
  },
  "passwordInfo": {
    "passwordLastSet": "2025-01-15T09:00:00.000Z",
    "mustChangePassword": false,
    "passwordNeverExpires": false
  },
  "accountInfo": {
    "whenCreated": "2024-12-01T10:00:00.000Z",
    "whenChanged": "2025-01-28T14:30:00.000Z",
    "isEnabled": true
  }
}
```
</details>

<details>
<summary><b>Unlock Account</b></summary>

Unlock a locked user account.

**Example:**
```json
{
  "resource": "user",
  "operation": "unlockAccount",
  "unlockAccountSAM": "jdoe"
}
```

**Result:**
```json
{
  "wasLocked": true,
  "unlocked": true,
  "message": "Account unlocked successfully"
}
```
</details>

<details>
<summary><b>Check Password Expiry</b></summary>

Check when a user's password will expire.

**Example:**
```json
{
  "resource": "user",
  "operation": "checkPasswordExpiry",
  "checkPasswordExpirySAM": "jdoe"
}
```

**Result:**
```json
{
  "passwordNeverExpires": false,
  "mustChangePassword": false,
  "expired": false,
  "daysUntilExpiry": 45,
  "expiryDate": "2025-03-15T09:00:00.000Z",
  "message": "Password expires in 45 day(s)"
}
```
</details>

<details>
<summary><b>Set Attributes</b></summary>

Modify user attributes with dynamic dropdown selection.

**Supported Attributes (dropdown):**
- Display Name
- First Name (Given Name)
- Last Name (Surname)
- Email
- Telephone Number
- Mobile
- Title
- Department
- Company
- Manager
- Description
- Office
- Street Address
- City
- State/Province
- Postal Code
- Country

**Example:**
```json
{
  "resource": "user",
  "operation": "setAttributes",
  "dn": "CN=John Doe,OU=Users,DC=example,DC=com",
  "attributes": [
    {
      "name": "title",
      "values": ["Senior Developer"],
      "op": "replace"
    },
    {
      "name": "department",
      "values": ["IT"],
      "op": "replace"
    }
  ]
}
```
</details>

### Group Operations

<details>
<summary><b>Create Group</b></summary>

Create a new security or distribution group.

**Group Types:**
- **Security**: Can be used for permissions
- **Distribution**: Email distribution only

**Group Scopes:**
- **Global**: Can be used across domains
- **Domain Local**: Local to current domain
- **Universal**: Can be used across forests

**Example:**
```json
{
  "resource": "group",
  "operation": "create",
  "groupName": "IT Staff",
  "groupParentDn": "OU=Groups,DC=example,DC=com",
  "groupType": "security",
  "groupScope": "global",
  "groupDescription": "IT Department Staff",
  "groupSamAccountName": "IT-Staff"
}
```

**Result:**
```json
{
  "success": true,
  "dn": "CN=IT Staff,OU=Groups,DC=example,DC=com",
  "name": "IT Staff",
  "samAccountName": "IT-Staff",
  "groupType": "security",
  "scope": "global"
}
```
</details>

<details>
<summary><b>Get Group</b></summary>

Retrieve complete group information including members.

**Example:**
```json
{
  "resource": "group",
  "operation": "get",
  "groupDn": "CN=IT Staff,OU=Groups,DC=example,DC=com"
}
```

**Result:**
```json
{
  "distinguishedName": "CN=IT Staff,OU=Groups,DC=example,DC=com",
  "name": "IT Staff",
  "samAccountName": "IT-Staff",
  "description": "IT Department Staff",
  "groupType": "security",
  "scope": "global",
  "memberCount": 5,
  "members": [
    "CN=John Doe,OU=Users,DC=example,DC=com",
    "CN=Jane Smith,OU=Users,DC=example,DC=com"
  ]
}
```
</details>

<details>
<summary><b>List Groups</b></summary>

List groups with advanced filtering.

**Filters:**
- Search by name
- Filter by type (Security/Distribution/All)
- Filter by scope (Global/Domain Local/Universal/All)
- Limit results

**Example:**
```json
{
  "resource": "group",
  "operation": "list",
  "groupSearchFilter": "IT",
  "groupFilterType": "security",
  "groupFilterScope": "global",
  "groupMaxResults": 50
}
```
</details>

<details>
<summary><b>Modify Group</b></summary>

Update group attributes using dynamic dropdown.

**Supported Attributes:**
- Description
- Display Name
- Info
- Mail
- Managed By

**Example:**
```json
{
  "resource": "group",
  "operation": "modify",
  "groupDn": "CN=IT Staff,OU=Groups,DC=example,DC=com",
  "groupAttributes": [
    {
      "name": "description",
      "value": "Updated IT Department description"
    }
  ]
}
```
</details>

<details>
<summary><b>Add/Remove Member</b></summary>

Manage group membership.

**Add Member Example:**
```json
{
  "resource": "group",
  "operation": "addMember",
  "userDn": "CN=John Doe,OU=Users,DC=example,DC=com",
  "groupDn": "CN=IT Staff,OU=Groups,DC=example,DC=com",
  "skipIfMember": true
}
```

**Remove Member Example:**
```json
{
  "resource": "group",
  "operation": "removeMember",
  "userDn": "CN=John Doe,OU=Users,DC=example,DC=com",
  "groupDn": "CN=IT Staff,OU=Groups,DC=example,DC=com",
  "skipIfNotMember": true
}
```
</details>

### Organizational Unit Operations

<details>
<summary><b>Create OU</b></summary>

Create a new Organizational Unit.

**Example:**
```json
{
  "resource": "ou",
  "operation": "create",
  "ouName": "IT Department",
  "ouParentDn": "DC=example,DC=com",
  "ouDescription": "Information Technology"
}
```

**Result:**
```json
{
  "success": true,
  "dn": "OU=IT Department,DC=example,DC=com",
  "name": "IT Department"
}
```
</details>

<details>
<summary><b>Get OU</b></summary>

Retrieve OU details.

**Example:**
```json
{
  "resource": "ou",
  "operation": "get",
  "ouDn": "OU=IT Department,DC=example,DC=com"
}
```
</details>

<details>
<summary><b>List OUs</b></summary>

List Organizational Units with optional search filter.

**Example:**
```json
{
  "resource": "ou",
  "operation": "list",
  "ouParentDnList": "DC=example,DC=com",
  "ouSearchFilter": "IT"
}
```
</details>

<details>
<summary><b>Modify OU</b></summary>

Update OU attributes.

**Example:**
```json
{
  "resource": "ou",
  "operation": "modify",
  "ouDn": "OU=IT Department,DC=example,DC=com",
  "ouAttributes": [
    {
      "name": "description",
      "value": "Updated IT Department"
    }
  ]
}
```
</details>

<details>
<summary><b>Delete OU</b></summary>

Delete an Organizational Unit (must be empty).

**Example:**
```json
{
  "resource": "ou",
  "operation": "delete",
  "ouDn": "OU=Old Department,DC=example,DC=com"
}
```
</details>

---

## 🎯 Use Cases

### 1. Automated User Onboarding

Create a workflow that:
1. Receives webhook with new employee data
2. Creates AD user account
3. Adds to appropriate groups
4. Sends welcome email with temp password
5. Creates calendar event for IT setup

### 2. Password Expiry Notifications

Create a scheduled workflow that:
1. Lists all users
2. Checks password expiry for each
3. Sends notification email 7 days before expiry
4. Generates report for IT team

### 3. Group Membership Audit

Create a workflow that:
1. Gets all security groups
2. For each group, gets members
3. Exports to Excel/CSV
4. Emails to security team monthly

### 4. Account Unlock Helpdesk

Create a webhook workflow that:
1. Receives unlock request from helpdesk
2. Verifies user identity
3. Unlocks account
4. Sends confirmation to user and helpdesk

### 5. Organizational Restructuring

Create a workflow to:
1. Create new OU structure
2. Create security groups
3. Move users to new OUs
4. Update group memberships
5. Generate migration report

---

## 🔒 Security Best Practices

### 1. Always Use LDAPS
- ✅ **DO**: Use LDAPS (port 636) in production
- ❌ **DON'T**: Use unsecured LDAP (port 389) for production

### 2. Certificate Validation
- ✅ **DO**: Use proper SSL/TLS certificates
- ✅ **DO**: Validate certificates in production
- ❌ **DON'T**: Skip certificate validation in production

### 3. Service Account Permissions
- ✅ **DO**: Use dedicated service account with minimal permissions
- ✅ **DO**: Enable account auditing
- ❌ **DON'T**: Use Domain Admin account

### 4. Password Security
- ✅ **DO**: Enforce strong password policies
- ✅ **DO**: Use n8n's credential system for passwords
- ✅ **DO**: Force password change at first logon
- ❌ **DON'T**: Store passwords in workflow data

### 5. Monitoring & Auditing
- ✅ **DO**: Monitor AD logs for suspicious activity
- ✅ **DO**: Enable n8n execution logging
- ✅ **DO**: Review failed operations regularly

---

## 🐛 Troubleshooting

### Connection Issues

**Problem**: Cannot connect to domain controller

**Solutions:**
1. Verify DC hostname/IP is correct
2. Check firewall allows port 636 (LDAPS) or 389 (LDAP)
3. Test connectivity: `telnet dc.example.com 636`
4. Verify service account credentials

### Certificate Issues

**Problem**: SSL certificate validation fails

**Solutions:**
1. Verify certificate is properly installed on DC
2. Check certificate chain is complete
3. Import Root CA certificate if self-signed
4. Use "Skip Validation" for testing only

### Password Operations Fail

**Problem**: Cannot set or reset passwords

**Solutions:**
1. **Use LDAPS**: Password operations require encrypted connection
2. Verify password meets AD complexity requirements
3. Check service account has "Reset Password" permission
4. Ensure user account is not protected from password changes

### Permission Denied

**Problem**: Operations fail with "Insufficient Access Rights"

**Solutions:**
1. Verify service account has required permissions
2. Check OU/object permissions
3. Review delegation of control settings
4. Ensure service account is not locked

### Timeout Errors

**Problem**: Operations timeout

**Solutions:**
1. Increase connection timeout in credentials
2. Check network latency to DC
3. Verify DC is not overloaded
4. Test with smaller batch operations

---

## 📊 Version History

### v0.2.0 (2025-01-29) - MAJOR UPDATE 🎉

**NEW RESOURCES:**
- ➕ Organizational Units (OU) - Full CRUD operations
- ➕ Enhanced Group Management - Full CRUD + advanced features

**NEW OPERATIONS:**
- ✨ **OU**: Create, Get, List, Modify, Delete
- ✨ **Groups**: Create (with type/scope), Get, List (with filters), Modify, Delete
- ✨ **Users**: Get User Groups, Get User Activity, Unlock Account, Check Password Expiry

**IMPROVEMENTS:**
- 🎯 Dynamic Dropdowns for Groups, OUs, and Attributes
- 🔍 Advanced Filtering for Groups (type, scope, search)
- 📊 Detailed User Activity Tracking
- 🔐 Group Type & Scope Management (Security/Distribution, Global/Domain Local/Universal)
- ✅ All text translated to English
- 🐛 Fixed checkPasswordExpiry timeout issue

### v0.1.15 (2025-01-29) - SECURITY FIX

**CRITICAL:**
- 🔒 Removed test files containing credentials
- 🔒 Added .npmignore for security
- 🗑️ Unpublished vulnerable versions (0.1.0-0.1.14)

**IMPROVEMENTS:**
- 🌍 All French text translated to English
- 📝 Improved error messages
- 🐛 Bug fixes and stability improvements

### Previous Versions

- **0.1.14** - Enhanced features (deprecated for security)
- **0.1.12** - Added Get User and List Users operations
- **0.1.11** - Custom SVG logo
- **0.1.10** - Fixed `change.write is not a function` error
- **0.1.0** - Initial release

---

## 💬 Support & Community

### Get Help

- 📖 **Documentation**: You're reading it!
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Fuskerrs/n8n-nodes-ad-admin/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Fuskerrs/n8n-nodes-ad-admin/discussions)
- 🌐 **n8n Community**: [community.n8n.io](https://community.n8n.io)

### Show Your Support

If you find this node useful:

<a href="https://buymeacoffee.com/freelancerc5" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217">
</a>

**Other ways to support:**
- ⭐ Star the project on [GitHub](https://github.com/Fuskerrs/n8n-nodes-ad-admin)
- 🐦 Share on social media
- 📝 Write a blog post about your use case
- 🤝 Contribute code or documentation

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Report Bugs
Open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- n8n version and node version

### Suggest Features
Open a discussion with:
- Description of the feature
- Use case and benefits
- Proposed implementation (if technical)

### Submit Pull Requests
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit PR with clear description

### Improve Documentation
- Fix typos or unclear sections
- Add examples or use cases
- Translate to other languages
- Create video tutorials

---

## 📄 License

MIT License - Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.

See [LICENSE](LICENSE) file for full details.

---

## 🙏 Acknowledgments

- **n8n Team** - For creating an amazing automation platform
- **ldapts** - Excellent LDAP client library
- **Community Contributors** - Thank you for your feedback and support!
- **You** - For using this node! ❤️

---

## 🔗 Links

- **npm**: [npmjs.com/package/n8n-nodes-ad-admin](https://www.npmjs.com/package/n8n-nodes-ad-admin)
- **GitHub**: [github.com/Fuskerrs/n8n-nodes-ad-admin](https://github.com/Fuskerrs/n8n-nodes-ad-admin)
- **n8n**: [n8n.io](https://n8n.io)
- **Support**: [buymeacoffee.com/freelancerc5](https://buymeacoffee.com/freelancerc5)

---

<div align="center">

**Made with ❤️ for the n8n community**

*Active Directory automation made simple*

</div>
