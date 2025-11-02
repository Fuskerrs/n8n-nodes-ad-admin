# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2025-02-01

### Added
- 🐳 **Official Docker Collector support** - New deployment mode using REST API gateway
- 📖 **Complete Collector documentation** - New COLLECTOR.md file with comprehensive setup guide
- 🌐 **Ecosystem section** - Documentation of the complete AD automation solution
- 🔗 **Docker Hub integration** - Links and badges for fuskerrs97/ad-collector-n8n image
- 📦 **Connection Modes comparison** - Direct Mode vs Collector Mode comparison table
- 🚀 **Quick start guide** - Docker one-liner installation for Collector Mode
- 🔐 **JWT authentication documentation** - Guide for Collector Mode authentication
- 📡 **API endpoints reference** - Complete list of 26 REST API endpoints

### Changed
- 📝 **Enhanced README** - Added Docker Collector badges and references
- 📄 **Updated package.json** - Added keywords: docker, collector, rest-api, automation
- 🔗 **Improved Links section** - Added Docker Hub and Collector GitHub links

### Documentation
- ✨ **COLLECTOR.md** - Complete guide covering:
  - What is the AD Collector
  - Why use Collector Mode
  - Installation (Docker Run + Docker Compose)
  - Configuration (environment variables)
  - Connecting to n8n
  - API endpoints reference
  - Troubleshooting guide
  - Security best practices

---

## [0.2.2] - 2025-01-29

### Fixed
- 🐛 Minor bug fixes and stability improvements
- 📝 Documentation updates

---

## [0.2.0] - 2025-01-29

### Added - MAJOR UPDATE 🎉

#### New Resources
- ➕ **Organizational Units (OU)** - Full CRUD operations
- ➕ **Enhanced Group Management** - Full CRUD + advanced features

#### New Operations
- ✨ **OU Operations**: Create, Get, List, Modify, Delete
- ✨ **Group Operations**: Create (with type/scope), Get, List (with filters), Modify, Delete
- ✨ **User Operations**: Get User Groups, Get User Activity, Unlock Account, Check Password Expiry

#### Improvements
- 🎯 **Dynamic Dropdowns** - For Groups, OUs, and Attributes
- 🔍 **Advanced Filtering** - For Groups (type, scope, search)
- 📊 **Detailed User Activity Tracking** - Login times, password info
- 🔐 **Group Type & Scope Management** - Security/Distribution, Global/Domain Local/Universal
- ✅ **All text translated to English** - Previously had French text
- 🐛 **Fixed checkPasswordExpiry timeout issue**

---

## [0.1.15] - 2025-01-29

### Security - CRITICAL FIX 🔒

- 🔒 **Removed test files containing credentials** - Critical security fix
- 🔒 **Added .npmignore** - Prevent sensitive files from being published
- 🗑️ **Unpublished vulnerable versions** - Versions 0.1.0-0.1.14 removed from npm

### Changed
- 🌍 **All French text translated to English** - Improved internationalization
- 📝 **Improved error messages** - Better debugging experience
- 🐛 **Bug fixes and stability improvements**

---

## [0.1.14] - 2025-01-28

### Added
- ✨ **Enhanced features and functionality**
- 📝 **Documentation improvements**

**⚠️ This version was deprecated and unpublished due to security concerns**

---

## [0.1.12] - 2025-01-27

### Added
- ✨ **Get User operation** - Retrieve complete user information
- ✨ **List Users operation** - Search and list users with filters
- 🔍 **Advanced filtering** - Multiple filter types and search fields

---

## [0.1.11] - 2025-01-26

### Changed
- 🎨 **Custom SVG logo** - Updated to custom Active Directory icon
- 📝 **Visual improvements** - Better branding

---

## [0.1.10] - 2025-01-25

### Fixed
- 🐛 **Fixed `change.write is not a function` error** - Critical bug fix
- ✅ **Improved stability** - Better error handling

---

## [0.1.0] - 2025-01-24

### Added - Initial Release 🎉

- ✨ **User Management** - Create, Enable/Disable, Reset Password, Set Attributes
- ✨ **Basic Group Operations** - Add/Remove members
- 🔐 **LDAPS Support** - Secure connection to Active Directory
- 🔒 **Certificate Validation** - System CA, Skip, or Custom certificate
- 🌐 **DNS & IP Support** - Flexible connection options
- ⚙️ **Comprehensive Error Handling** - Clear messages and reconnection logic

---

## Links

- **npm Package**: [npmjs.com/package/n8n-nodes-ad-admin](https://www.npmjs.com/package/n8n-nodes-ad-admin)
- **GitHub**: [github.com/Fuskerrs/n8n-nodes-ad-admin](https://github.com/Fuskerrs/n8n-nodes-ad-admin)
- **Docker Collector**: [hub.docker.com/r/fuskerrs97/ad-collector-n8n](https://hub.docker.com/r/fuskerrs97/ad-collector-n8n)
- **Collector Source**: [github.com/Fuskerrs/docker-ad-collector-n8n](https://github.com/Fuskerrs/docker-ad-collector-n8n)

---

## Support

If you find this package useful, consider supporting the development:

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/freelancerc5)

---

**Made with ❤️ for the n8n community**
