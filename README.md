# n8n-nodes-ad-admin

<div align="center">

![Active Directory Admin Logo](icons/activeDirectoryAdmin.svg)

**A community node for n8n that provides administrative operations on Active Directory via LDAP/LDAPS**

[![npm version](https://badge.fury.io/js/n8n-nodes-ad-admin.svg)](https://badge.fury.io/js/n8n-nodes-ad-admin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

## Features

- 🔐 **Secure LDAPS Connection** - Full support for LDAPS (port 636) with certificate validation
- 👥 **User Management** - Create, enable, disable users with advanced options
- 🔑 **Password Management** - Set passwords and force password changes at next logon
- 🔍 **User Search** - Find users by sAMAccountName
- 👤 **Get User Details** - Retrieve complete user information with all properties
- 📋 **List Users** - Advanced user listing with filters (starts with, contains, ends with)
- 🎯 **Advanced Filtering** - Search by multiple fields (sAMAccountName, displayName, email, etc.)
- ⚙️ **Attribute Management** - Set any AD attributes (add, replace, delete operations)
- 👬 **Group Management** - Add/remove users from groups
- 🚀 **Production Ready** - Error handling, reconnection logic, and comprehensive validation

## Installation

Install the package in your n8n instance:

```bash
npm install -g n8n-nodes-ad-admin
```

Or install via the n8n Community Nodes interface:
1. Go to Settings → Community Nodes
2. Install package: `n8n-nodes-ad-admin`

## Prerequisites

### Active Directory Setup
- Windows Server with Active Directory Domain Services
- LDAPS configured (recommended) or LDAP for testing
- Service account with appropriate permissions

### LDAPS Configuration (Recommended)
For production use, configure LDAPS on your domain controller:

1. **Install certificate** on your domain controller
2. **Configure LDAPS** to listen on port 636
3. **Export Root CA certificate** and import it into your n8n container if using self-signed certificates

### Permissions Required
The service account needs the following permissions:
- Create user objects
- Reset user passwords
- Modify user account properties
- Modify group membership

## Configuration

### Credentials
Create an "Active Directory API" credential with:

- **Host**: Your domain controller hostname/IP
- **Port**: 636 (LDAPS) or 389 (LDAP)
- **Connection Type**: LDAPS (recommended) or LDAP
- **Bind DN**: Service account DN (e.g., `CN=n8nservice,CN=Users,DC=domain,DC=local`)
- **Password**: Service account password
- **Base DN**: Your domain base (e.g., `DC=domain,DC=local`)
- **Reject Unauthorized**: Enable for certificate validation (LDAPS only)
- **Timeout**: Connection timeout in milliseconds (default: 10000)

## Operations

### User Operations

#### Create User
Creates a new Active Directory user with the following options:
- **User CN**: Full name (automatically escaped)
- **Parent OU DN**: Where to create the user
- **sAMAccountName**: Login name (max 20 chars, validated)
- **User Principal Name**: UPN format (user@domain.tld)
- **Initial Password**: Must meet AD password policy
- **Must Change Password at Next Logon**: Force password change
- **Enable Account Immediately**: Activate the account after creation

#### Enable/Disable User
Enable or disable user accounts by DN.

#### Reset Password
Reset user passwords with option to force change at next logon.

#### Find by sAMAccountName
Search for users and return their DN.

#### Set Attributes
Modify any AD attributes with add/replace/delete operations.

### Group Operations

#### Add Member
Add users to security groups with option to skip if already member.

#### Remove Member
Remove users from groups with option to skip if not member.

## Usage Examples

### Basic User Creation
```json
{
  "resource": "user",
  "operation": "create",
  "cn": "John Doe",
  "parentOuDn": "CN=Users,DC=example,DC=local",
  "samAccountName": "jdoe",
  "upn": "john.doe@example.local",
  "initialPassword": "TempPass123!",
  "pwdMustChange": true,
  "enableImmediately": true
}
```

### Password Reset
```json
{
  "resource": "user",
  "operation": "resetPassword",
  "dn": "CN=John Doe,CN=Users,DC=example,DC=local",
  "newPassword": "NewPass123!",
  "forceChange": true
}
```

### Get User Details
```json
{
  "resource": "user",
  "operation": "getUser",
  "getUserSAM": "jdoe",
  "includeAllProperties": false
}
```

### List Users with Filtering
```json
{
  "resource": "user",
  "operation": "listUsers",
  "filterType": "startswith",
  "searchValue": "john",
  "searchField": "displayName",
  "listIncludeAllProperties": false,
  "maxResults": 50
}
```

### Advanced User Search
```json
{
  "resource": "user",
  "operation": "listUsers",
  "filterType": "contains",
  "searchValue": "@example.com",
  "searchField": "mail",
  "listIncludeAllProperties": true,
  "maxResults": 0
}
```

### Add to Group
```json
{
  "resource": "group",
  "operation": "addMember",
  "userDn": "CN=John Doe,CN=Users,DC=example,DC=local",
  "groupDn": "CN=IT Staff,OU=Groups,DC=example,DC=local",
  "skipIfMember": true
}
```

## Error Handling

The node includes comprehensive error handling:
- **Connection errors**: Automatic reconnection attempts
- **Validation errors**: Input validation with clear error messages
- **AD errors**: Proper error propagation with context
- **Continue on Fail**: Option to continue processing other items on errors

## Security Considerations

- **Always use LDAPS** in production environments
- **Validate certificates** by enabling "Reject Unauthorized"
- **Use service accounts** with minimal required permissions
- **Store passwords securely** using n8n's credential system
- **Monitor AD logs** for security events

## Troubleshooting

### Common Issues

**LDAPS Connection Fails**
- Verify certificate is properly installed on DC
- Check if Root CA is trusted in n8n container
- Test with `openssl s_client -connect dc.domain.local:636`

**Password Operations Fail**
- Ensure LDAPS is used (required for password operations)
- Verify password meets AD complexity requirements
- Check service account has "Reset Password" permissions

**User Creation Fails**
- Validate sAMAccountName format (max 20 chars, no spaces/special chars)
- Verify UPN format (user@domain.tld)
- Check parent OU DN exists and is writable

### Testing Connection
Use the "Find by sAMAccountName" operation to test basic connectivity.

## Recent Updates

### 🎉 Version 0.1.12 - USER SEARCH & LISTING (Latest)
- **🆕 NEW**: Get User operation - Retrieve complete user details with all AD properties
- **🆕 NEW**: List Users operation - Advanced user listing with powerful filtering
- **🔍 NEW**: Advanced search filters: Exact match, Starts with, Contains, Ends with
- **🎯 NEW**: Search by multiple fields: sAMAccountName, displayName, UPN, email, etc.
- **⚙️ NEW**: Choose between basic or all properties for better performance
- **📊 NEW**: Configurable result limits to control output size

### Previous Major Updates
- **0.1.11** - Added custom SVG logo and enhanced documentation
- **0.1.10** - FIXED `change.write is not a function` error completely
- **0.1.9** - Added comprehensive README documentation

### Previous Versions
- **0.1.9** - Added comprehensive README documentation
- **0.1.8** - Attempted fix for change.write error (incomplete)
- **0.1.7** - Previous fixes and improvements
- **0.1.2** - Added DNS resolution and certificate handling
- **0.1.1** - Added LDAP + LDAPS support
- **0.1.0** - Initial release with LDAPS support

## 🚀 Quick Start

### Installation
```bash
# Option 1: Via n8n Community Nodes (Recommended)
# Go to Settings → Community Nodes → Install: n8n-nodes-ad-admin

# Option 2: Via npm
npm install -g n8n-nodes-ad-admin@latest
```

### Basic Setup
1. **Install the node** using one of the methods above
2. **Configure credentials** in n8n:
   - Host: `DC-01.yourdomain.com`
   - Port: `636` (LDAPS) or `389` (LDAP)
   - Connection Type: `LDAPS` (recommended)
   - Bind DN: `CN=serviceaccount,CN=Users,DC=yourdomain,DC=com`
   - Password: `your-service-account-password`
   - Base DN: `DC=yourdomain,DC=com`

3. **Create your first user**:
   - Resource: `User`
   - Operation: `Create`
   - User CN: `John Doe`
   - Parent OU DN: `CN=Users,DC=yourdomain,DC=com`
   - sAMAccountName: `jdoe`
   - User Principal Name: `john.doe@yourdomain.com`
   - Initial Password: `TempPassword123!`
   - ✅ Must Change Password at Next Logon: `true`
   - ✅ Enable Account Immediately: `true`

### Expected Result
```json
{
  "success": true,
  "operation": "create",
  "dn": "CN=John Doe,CN=Users,DC=yourdomain,DC=com",
  "sAMAccountName": "jdoe",
  "userPrincipalName": "john.doe@yourdomain.com",
  "enabled": true,
  "mustChangePassword": true
}
```

The user will be:
- ✅ Created in Active Directory
- ✅ Password set correctly
- ✅ Account enabled (`Enabled: True`)
- ✅ Required to change password at next logon (`pwdLastSet: 0`)

## Support

For issues and feature requests, please visit:
- [GitHub Issues](https://github.com/n8n-community/n8n-nodes-ad-admin/issues)
- [n8n Community Forum](https://community.n8n.io)

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions welcome! Please read the contributing guidelines and submit pull requests.