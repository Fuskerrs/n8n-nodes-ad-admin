import { Client, type ClientOptions, SearchOptions, Attribute, Change } from 'ldapts';

export interface LdapConfig {
  url: string;
  bindDn: string;
  password: string;
  timeout?: number;
  tlsOptions?: { rejectUnauthorized?: boolean; ca?: string };
  isSecure?: boolean; // true = LDAPS, false = LDAP
  hostType?: string; // 'dns' or 'ip'
}

/**
 * Escapes special characters in an LDAP DN
 */
export function escapeDN(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/\+/g, '\\+')
    .replace(/"/g, '\\"')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/;/g, '\\;')
    .replace(/=/g, '\\=')
    .replace(/^#/, '\\#')
    .replace(/^ /, '\\ ')
    .replace(/ $/, '\\ ');
}

/**
 * Validates a sAMAccountName (max 20 chars, no spaces or special characters)
 */
export function validateSAMAccountName(sam: string): { valid: boolean; error?: string } {
  if (!sam || sam.length === 0) {
    return { valid: false, error: 'sAMAccountName cannot be empty' };
  }
  if (sam.length > 20) {
    return { valid: false, error: 'sAMAccountName cannot exceed 20 characters' };
  }
  if (/[\s"\/\\\[\]:;|=,+*?<>]/.test(sam)) {
    return { valid: false, error: 'sAMAccountName contains invalid characters' };
  }
  return { valid: true };
}

/**
 * Validates a UPN (User Principal Name)
 */
export function validateUPN(upn: string): { valid: boolean; error?: string } {
  if (!upn || !upn.includes('@')) {
    return { valid: false, error: 'UPN must be in format user@domain.tld' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(upn)) {
    return { valid: false, error: 'Invalid UPN format' };
  }
  return { valid: true };
}

export class AdClient {
  private client: Client;
  private baseDn: string;
  private config: LdapConfig;

  constructor(config: LdapConfig, baseDn: string) {
    const opts: ClientOptions = {
      url: config.url,
      timeout: config.timeout ?? 10000,
      connectTimeout: config.timeout ?? 10000,
      tlsOptions: config.tlsOptions,
    };
    this.client = new Client(opts);
    this.baseDn = baseDn;
    this.config = config;
  }

  async bind(bindDn: string, password: string): Promise<void> {
    await this.client.bind(bindDn, password);
  }

  async unbind(): Promise<void> {
    try {
      await this.client.unbind();
    } catch (error) {
      // Ignore unbind errors
    }
  }

  /**
   * Reconnects the client in case of error
   */
  private async reconnect(): Promise<void> {
    try {
      await this.unbind();
    } catch {}
    
    const opts: ClientOptions = {
      url: this.config.url,
      timeout: this.config.timeout ?? 10000,
      connectTimeout: this.config.timeout ?? 10000,
      tlsOptions: this.config.tlsOptions,
    };
    this.client = new Client(opts);
    await this.client.bind(this.config.bindDn, this.config.password);
  }

  async add(dn: string, entry: Record<string, string | string[]>): Promise<void> {
    try {
      await this.client.add(dn, entry);
    } catch (error: any) {
      if (error.message?.includes('closed') || error.message?.includes('timeout')) {
        await this.reconnect();
        await this.client.add(dn, entry);
      } else {
        throw error;
      }
    }
  }

  async modify(dn: string, changes: any): Promise<void> {
    try {
      await this.client.modify(dn, changes);
    } catch (error: any) {
      if (error.message?.includes('closed') || error.message?.includes('timeout')) {
        await this.reconnect();
        await this.client.modify(dn, changes);
      } else {
        throw error;
      }
    }
  }

  async search(base: string, options: SearchOptions) {
    try {
      return await this.client.search(base, options);
    } catch (error: any) {
      if (error.message?.includes('closed') || error.message?.includes('timeout')) {
        await this.reconnect();
        return await this.client.search(base, options);
      } else {
        throw error;
      }
    }
  }

  /**
   * Sets AD password (unicodePwd) - REQUIRES LDAPS
   */
  async setPassword(dn: string, newPassword: string): Promise<void> {
    // Verify that the connection is secure
    if (this.config.isSecure === false) {
      throw new Error(
        'Password operations require LDAPS (port 636). ' +
        'Unsecured LDAP (port 389) is not supported by Active Directory for password operations.'
      );
    }

    const quoted = `"${newPassword}"`;
    const pwdBuffer = Buffer.from(quoted, 'utf16le');

    await this.modify(dn, new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'unicodePwd',
        values: [pwdBuffer]
      })
    }));
  }

  /**
   * Enables a user (removes the ACCOUNTDISABLE flag)
   */
  async enableUser(dn: string): Promise<void> {
    const { searchEntries } = await this.search(dn, {
      scope: 'base',
      attributes: ['userAccountControl']
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`User not found: ${dn}`);
    }

    const currentUAC = parseInt(searchEntries[0].userAccountControl as string, 10) || 512;
    const newUAC = currentUAC & ~0x0002; // Remove ACCOUNTDISABLE flag

    await this.modify(dn, new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'userAccountControl',
        values: [String(newUAC)]
      })
    }));
  }

  /**
   * Disables a user (adds the ACCOUNTDISABLE flag)
   */
  async disableUser(dn: string): Promise<void> {
    const { searchEntries } = await this.search(dn, {
      scope: 'base',
      attributes: ['userAccountControl']
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`User not found: ${dn}`);
    }

    const currentUAC = parseInt(searchEntries[0].userAccountControl as string, 10) || 512;
    const newUAC = currentUAC | 0x0002; // Add ACCOUNTDISABLE flag

    await this.modify(dn, new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'userAccountControl',
        values: [String(newUAC)]
      })
    }));
  }

  /**
   * Checks if a user is a member of a group
   */
  async isGroupMember(userDn: string, groupDn: string): Promise<boolean> {
    try {
      const { searchEntries } = await this.search(groupDn, {
        scope: 'base',
        attributes: ['member']
      });

      if (!searchEntries || searchEntries.length === 0) {
        return false;
      }

      const members = searchEntries[0].member;
      if (!members) return false;

      const memberArray = Array.isArray(members) ? members : [members];
      return memberArray.some(m => m.toString().toLowerCase() === userDn.toLowerCase());
    } catch {
      return false;
    }
  }

  /**
   * Searches for a user by sAMAccountName
   */
  async findUserBySAM(samAccountName: string): Promise<string | null> {
    const { searchEntries } = await this.search(this.baseDn, {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${samAccountName}))`,
      attributes: ['distinguishedName']
    });

    if (!searchEntries || searchEntries.length === 0) {
      return null;
    }

    return searchEntries[0].dn?.toString() || null;
  }

  /**
   * Retrieves a user with all properties
   */
  async getUserBySAM(samAccountName: string, includeAll: boolean = false): Promise<any | null> {
    const basicAttributes = [
      'distinguishedName', 'sAMAccountName', 'userPrincipalName', 'displayName',
      'givenName', 'sn', 'mail', 'userAccountControl', 'whenCreated', 'whenChanged',
      'lastLogon', 'pwdLastSet', 'accountExpires', 'memberOf'
    ];

    const allAttributes = includeAll ? ['*'] : basicAttributes;

    const { searchEntries } = await this.search(this.baseDn, {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${samAccountName}))`,
      attributes: allAttributes
    });

    if (!searchEntries || searchEntries.length === 0) {
      return null;
    }

    const user = searchEntries[0];
    const result: any = {};

    // Convert LDAP properties to readable JSON format
    Object.keys(user).forEach(key => {
      if (key === 'dn') {
        result.distinguishedName = user[key]?.toString();
      } else {
        const value = user[key];
        if (Array.isArray(value)) {
          result[key] = value.map(v => v.toString());
        } else {
          result[key] = value?.toString();
        }
      }
    });

    // Convert userAccountControl to readable information
    if (result.userAccountControl) {
      const uac = parseInt(result.userAccountControl, 10);
      result.accountEnabled = !(uac & 0x0002);
      result.passwordNeverExpires = !!(uac & 0x10000);
      result.cannotChangePassword = !!(uac & 0x0040);
      result.accountFlags = {
        disabled: !!(uac & 0x0002),
        lockedOut: !!(uac & 0x0010),
        passwordNotRequired: !!(uac & 0x0020),
        cannotChangePassword: !!(uac & 0x0040),
        encryptedTextPasswordAllowed: !!(uac & 0x0080),
        normalAccount: !!(uac & 0x0200),
        passwordNeverExpires: !!(uac & 0x10000),
        smartCardRequired: !!(uac & 0x40000),
      };
    }

    return result;
  }

  /**
   * Lists users with advanced filters
   */
  async listUsers(options: {
    filterType?: string;
    searchValue?: string;
    searchField?: string;
    includeAll?: boolean;
    maxResults?: number;
  } = {}): Promise<any[]> {
    const {
      filterType = 'exact',
      searchValue = '',
      searchField = 'sAMAccountName',
      includeAll = false,
      maxResults
    } = options;

    // Build LDAP filter
    let filter = '(&(objectClass=user)';

    if (searchValue) {
      switch (filterType) {
        case 'startswith':
          filter += `(${searchField}=${searchValue}*)`;
          break;
        case 'endswith':
          filter += `(${searchField}=*${searchValue})`;
          break;
        case 'contains':
          filter += `(${searchField}=*${searchValue}*)`;
          break;
        case 'exact':
        default:
          filter += `(${searchField}=${searchValue})`;
          break;
      }
    }

    filter += ')';

    const basicAttributes = [
      'distinguishedName', 'sAMAccountName', 'userPrincipalName', 'displayName',
      'givenName', 'sn', 'mail', 'userAccountControl', 'whenCreated', 'lastLogon'
    ];

    const attributes = includeAll ? ['*'] : basicAttributes;

    const searchOptions: any = {
      scope: 'sub',
      filter,
      attributes
    };

    if (maxResults) {
      searchOptions.sizeLimit = maxResults;
    }

    const { searchEntries } = await this.search(this.baseDn, searchOptions);

    if (!searchEntries || searchEntries.length === 0) {
      return [];
    }

    return searchEntries.map(user => {
      const result: any = {};

      // Convert LDAP properties
      Object.keys(user).forEach(key => {
        if (key === 'dn') {
          result.distinguishedName = user[key]?.toString();
        } else {
          const value = user[key];
          if (Array.isArray(value)) {
            result[key] = value.map(v => v.toString());
          } else {
            result[key] = value?.toString();
          }
        }
      });

      // Add account status information
      if (result.userAccountControl) {
        const uac = parseInt(result.userAccountControl, 10);
        result.accountEnabled = !(uac & 0x0002);
      }

      return result;
    });
  }

  /**
   * Retrieves all groups of a user
   */
  async getUserGroups(samAccountName: string, includeNested: boolean = true, fullDetails: boolean = false): Promise<any[]> {
    const attributes = fullDetails
      ? ['distinguishedName', 'cn', 'description', 'groupType', 'whenCreated', 'memberOf']
      : ['distinguishedName', 'cn'];

    const { searchEntries } = await this.search(this.baseDn, {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${samAccountName}))`,
      attributes: ['memberOf']
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`User not found: ${samAccountName}`);
    }

    const memberOf = searchEntries[0].memberOf;
    if (!memberOf) return [];

    const groupDNs = Array.isArray(memberOf) ? memberOf.map(g => g.toString()) : [memberOf.toString()];
    const groups: any[] = [];

    // Retrieve details for each group
    for (const groupDN of groupDNs) {
      try {
        const { searchEntries: groupEntries } = await this.search(groupDN, {
          scope: 'base',
          attributes
        });

        if (groupEntries && groupEntries.length > 0) {
          const group = groupEntries[0];
          const groupInfo: any = {
            distinguishedName: group.dn?.toString(),
            name: group.cn?.toString(),
          };

          if (fullDetails) {
            groupInfo.description = group.description?.toString() || '';
            groupInfo.groupType = group.groupType?.toString();
            groupInfo.whenCreated = group.whenCreated?.toString();
          }

          groups.push(groupInfo);

          // If includeNested, retrieve parent groups
          if (includeNested && group.memberOf) {
            const parentGroups = Array.isArray(group.memberOf)
              ? group.memberOf.map(g => g.toString())
              : [group.memberOf.toString()];

            for (const parentDN of parentGroups) {
              if (!groups.find(g => g.distinguishedName === parentDN)) {
                try {
                  const { searchEntries: parentEntries } = await this.search(parentDN, {
                    scope: 'base',
                    attributes
                  });

                  if (parentEntries && parentEntries.length > 0) {
                    const parent = parentEntries[0];
                    groups.push({
                      distinguishedName: parent.dn?.toString(),
                      name: parent.cn?.toString(),
                      inherited: true,
                      ...(fullDetails && {
                        description: parent.description?.toString() || '',
                        groupType: parent.groupType?.toString(),
                        whenCreated: parent.whenCreated?.toString(),
                      })
                    });
                  }
                } catch (e) {
                  // Ignore errors for inaccessible groups
                }
              }
            }
          }
        }
      } catch (e) {
        // Ignore errors for inaccessible groups
      }
    }

    return groups;
  }

  /**
   * Retrieves user activity information
   */
  async getUserActivity(samAccountName: string, activityType: string = 'all'): Promise<any> {
    const attributes = [
      'lastLogon', 'lastLogonTimestamp', 'logonCount', 'pwdLastSet',
      'accountExpires', 'userAccountControl', 'badPasswordTime', 'badPwdCount',
      'lockoutTime', 'whenCreated', 'whenChanged'
    ];

    const { searchEntries } = await this.search(this.baseDn, {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${samAccountName}))`,
      attributes
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`User not found: ${samAccountName}`);
    }

    const user = searchEntries[0];
    const result: any = {};

    // Convert Active Directory timestamps
    const convertADTimestamp = (timestamp: string | undefined): string | null => {
      if (!timestamp || timestamp === '0' || timestamp === '9223372036854775807') return null;
      const winTime = parseInt(timestamp, 10);
      const unixTime = (winTime / 10000) - 11644473600000;
      return new Date(unixTime).toISOString();
    };

    if (activityType === 'all' || activityType === 'login') {
      result.loginInfo = {
        lastLogon: convertADTimestamp(user.lastLogon?.toString()),
        lastLogonTimestamp: convertADTimestamp(user.lastLogonTimestamp?.toString()),
        logonCount: parseInt(user.logonCount?.toString() || '0', 10),
        badPasswordTime: convertADTimestamp(user.badPasswordTime?.toString()),
        badPasswordCount: parseInt(user.badPwdCount?.toString() || '0', 10),
        lockoutTime: convertADTimestamp(user.lockoutTime?.toString()),
        isLockedOut: user.lockoutTime && user.lockoutTime.toString() !== '0',
      };
    }

    if (activityType === 'all' || activityType === 'password') {
      const pwdLastSet = user.pwdLastSet?.toString();
      result.passwordInfo = {
        passwordLastSet: convertADTimestamp(pwdLastSet),
        mustChangePassword: pwdLastSet === '0',
        passwordNeverExpires: !!(parseInt(user.userAccountControl?.toString() || '0', 10) & 0x10000),
        accountExpires: convertADTimestamp(user.accountExpires?.toString()),
      };
    }

    if (activityType === 'all') {
      result.accountInfo = {
        whenCreated: convertADTimestamp(user.whenCreated?.toString()),
        whenChanged: convertADTimestamp(user.whenChanged?.toString()),
        userAccountControl: parseInt(user.userAccountControl?.toString() || '0', 10),
        isEnabled: !(parseInt(user.userAccountControl?.toString() || '0', 10) & 0x0002),
      };
    }

    return result;
  }

  /**
   * Unlocks a user account
   */
  async unlockUserAccount(samAccountName: string): Promise<any> {
    const dn = await this.findUserBySAM(samAccountName);
    if (!dn) {
      throw new Error(`User not found: ${samAccountName}`);
    }

    // Check if account is locked
    const { searchEntries } = await this.search(dn, {
      scope: 'base',
      attributes: ['lockoutTime', 'userAccountControl']
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`Unable to retrieve lockout information`);
    }

    const lockoutTime = searchEntries[0].lockoutTime?.toString();
    const isLocked = lockoutTime && lockoutTime !== '0';

    if (!isLocked) {
      return {
        wasLocked: false,
        message: 'Account was not locked',
      };
    }

    // Unlock by setting lockoutTime to 0
    await this.modify(dn, new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'lockoutTime',
        values: ['0']
      })
    }));

    return {
      wasLocked: true,
      unlocked: true,
      message: 'Account unlocked successfully',
    };
  }

  /**
   * Checks password expiration
   */
  async checkPasswordExpiry(samAccountName: string): Promise<any> {
    const { searchEntries } = await this.search(this.baseDn, {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${samAccountName}))`,
      attributes: ['pwdLastSet', 'userAccountControl', 'maxPwdAge']
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`User not found: ${samAccountName}`);
    }

    const user = searchEntries[0];
    const pwdLastSet = user.pwdLastSet?.toString();
    const userAccountControl = parseInt(user.userAccountControl?.toString() || '0', 10);

    // Check if password never expires
    const passwordNeverExpires = !!(userAccountControl & 0x10000);

    if (passwordNeverExpires) {
      return {
        passwordNeverExpires: true,
        mustChangePassword: pwdLastSet === '0',
        message: 'Password is configured to never expire',
      };
    }

    if (pwdLastSet === '0') {
      return {
        passwordNeverExpires: false,
        mustChangePassword: true,
        expired: false,
        message: 'User must change password at next logon',
      };
    }

    // Try to retrieve domain password policy with timeout
    try {
      // Extract domain from baseDn (e.g., DC=example,DC=com)
      const domainParts = this.baseDn.split(',').filter(part => part.trim().toUpperCase().startsWith('DC='));
      const domainDn = domainParts.join(',');

      const { searchEntries: domainEntries } = await this.search(domainDn, {
        scope: 'base',
        attributes: ['maxPwdAge']
      });

      let maxPwdAge = '0';
      if (domainEntries && domainEntries.length > 0) {
        maxPwdAge = domainEntries[0].maxPwdAge?.toString() || '0';
      }

      if (maxPwdAge === '0' || maxPwdAge === '9223372036854775807') {
        return {
          passwordNeverExpires: false,
          mustChangePassword: false,
          expired: false,
          message: 'No password expiration policy configured',
        };
      }

      // Calculate expiration date
      const pwdLastSetTime = parseInt(pwdLastSet || '0', 10);
      const maxAge = Math.abs(parseInt(maxPwdAge, 10));
      const expiryTime = pwdLastSetTime + maxAge;
      const now = Date.now() * 10000 + 116444736000000000; // Convert to AD timestamp

      const daysUntilExpiry = Math.floor((expiryTime - now) / (10000 * 1000 * 60 * 60 * 24));
      const expired = now > expiryTime;

      return {
        passwordNeverExpires: false,
        mustChangePassword: false,
        expired,
        daysUntilExpiry: expired ? 0 : daysUntilExpiry,
        expiryDate: new Date((expiryTime / 10000) - 11644473600000).toISOString(),
        message: expired
          ? 'Password has expired'
          : `Password expires in ${daysUntilExpiry} day(s)`,
      };

    } catch (e: any) {
      // Return basic info without domain policy if we can't retrieve it
      return {
        passwordNeverExpires: false,
        mustChangePassword: false,
        expired: false,
        error: 'Unable to retrieve domain password policy',
        errorDetails: e.message || 'Unknown error',
      };
    }
  }

  /**
   * Creates an Organizational Unit
   */
  async createOU(name: string, parentDn: string, description?: string): Promise<any> {
    const ouDn = `OU=${escapeDN(name)},${parentDn}`;

    const entry: any = {
      objectClass: ['top', 'organizationalUnit'],
      ou: name,
    };

    if (description) {
      entry.description = description;
    }

    await this.add(ouDn, entry);

    return {
      success: true,
      dn: ouDn,
      name,
      message: 'Organizational Unit created successfully',
    };
  }

  /**
   * Gets an Organizational Unit by DN
   */
  async getOU(dn: string): Promise<any> {
    const { searchEntries } = await this.search(dn, {
      scope: 'base',
      attributes: ['ou', 'description', 'distinguishedName', 'whenCreated', 'whenChanged', 'objectClass'],
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`Organizational Unit not found: ${dn}`);
    }

    const ou = searchEntries[0];
    return {
      distinguishedName: ou.dn?.toString(),
      name: ou.ou?.toString(),
      description: ou.description?.toString() || '',
      whenCreated: ou.whenCreated?.toString(),
      whenChanged: ou.whenChanged?.toString(),
      objectClass: Array.isArray(ou.objectClass) ? ou.objectClass.map(o => o.toString()) : [ou.objectClass?.toString()],
    };
  }

  /**
   * Modifies an Organizational Unit
   */
  async modifyOU(dn: string, attributes: Record<string, string>): Promise<any> {
    const changes: any[] = [];

    for (const [key, value] of Object.entries(attributes)) {
      changes.push(new Change({
        operation: 'replace',
        modification: new Attribute({
          type: key,
          values: [value],
        }),
      }));
    }

    await this.modify(dn, changes);

    return {
      success: true,
      dn,
      message: 'Organizational Unit modified successfully',
    };
  }

  /**
   * Deletes an Organizational Unit (must be empty)
   */
  async deleteOU(dn: string): Promise<any> {
    try {
      await this.client.del(dn);
      return {
        success: true,
        dn,
        message: 'Organizational Unit deleted successfully',
      };
    } catch (error: any) {
      if (error.message?.includes('closed') || error.message?.includes('timeout')) {
        await this.reconnect();
        await this.client.del(dn);
        return {
          success: true,
          dn,
          message: 'Organizational Unit deleted successfully',
        };
      } else {
        throw error;
      }
    }
  }

  /**
   * Lists Organizational Units
   */
  async listOUs(parentDn?: string, searchFilter?: string): Promise<any[]> {
    const baseDn = parentDn || this.baseDn;
    let filter = '(objectClass=organizationalUnit)';

    if (searchFilter) {
      filter = `(&(objectClass=organizationalUnit)(ou=*${searchFilter}*))`;
    }

    const { searchEntries } = await this.search(baseDn, {
      scope: 'sub',
      filter,
      attributes: ['ou', 'description', 'distinguishedName', 'whenCreated'],
    });

    if (!searchEntries || searchEntries.length === 0) {
      return [];
    }

    return searchEntries.map(ou => ({
      distinguishedName: ou.dn?.toString(),
      name: ou.ou?.toString(),
      description: ou.description?.toString() || '',
      whenCreated: ou.whenCreated?.toString(),
    }));
  }

  /**
   * Creates a Group (Security or Distribution)
   */
  async createGroup(
    name: string,
    parentDn: string,
    options: {
      groupType?: 'security' | 'distribution';
      scope?: 'global' | 'domainLocal' | 'universal';
      description?: string;
      samAccountName?: string;
    } = {}
  ): Promise<any> {
    const {
      groupType = 'security',
      scope = 'global',
      description,
      samAccountName = name,
    } = options;

    const groupDn = `CN=${escapeDN(name)},${parentDn}`;

    // Calculate groupType flag
    // Reference: https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-adts/11972272-09ec-4a42-bf5e-3e99b321cf55
    let groupTypeValue = 0;

    // Group scope
    if (scope === 'global') {
      groupTypeValue |= 0x00000002; // GROUP_TYPE_GLOBAL
    } else if (scope === 'domainLocal') {
      groupTypeValue |= 0x00000004; // GROUP_TYPE_DOMAIN_LOCAL
    } else if (scope === 'universal') {
      groupTypeValue |= 0x00000008; // GROUP_TYPE_UNIVERSAL
    }

    // Security flag
    if (groupType === 'security') {
      groupTypeValue |= 0x80000000; // GROUP_TYPE_SECURITY_ENABLED
    }

    const entry: any = {
      objectClass: ['top', 'group'],
      cn: name,
      sAMAccountName: samAccountName,
      groupType: String(groupTypeValue),
    };

    if (description) {
      entry.description = description;
    }

    await this.add(groupDn, entry);

    return {
      success: true,
      dn: groupDn,
      name,
      samAccountName,
      groupType,
      scope,
      message: 'Group created successfully',
    };
  }

  /**
   * Gets a Group by DN
   */
  async getGroup(dn: string): Promise<any> {
    const { searchEntries } = await this.search(dn, {
      scope: 'base',
      attributes: ['cn', 'sAMAccountName', 'description', 'member', 'groupType', 'distinguishedName', 'whenCreated', 'whenChanged'],
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`Group not found: ${dn}`);
    }

    const group = searchEntries[0];
    const groupTypeValue = parseInt(group.groupType?.toString() || '0', 10);

    // Decode groupType
    const isSecurity = !!(groupTypeValue & 0x80000000);
    let scope = 'unknown';
    if (groupTypeValue & 0x00000002) scope = 'global';
    else if (groupTypeValue & 0x00000004) scope = 'domainLocal';
    else if (groupTypeValue & 0x00000008) scope = 'universal';

    const members = group.member;
    const memberList = members
      ? (Array.isArray(members) ? members.map(m => m.toString()) : [members.toString()])
      : [];

    return {
      distinguishedName: group.dn?.toString(),
      name: group.cn?.toString(),
      samAccountName: group.sAMAccountName?.toString(),
      description: group.description?.toString() || '',
      groupType: isSecurity ? 'security' : 'distribution',
      scope,
      groupTypeValue,
      memberCount: memberList.length,
      members: memberList,
      whenCreated: group.whenCreated?.toString(),
      whenChanged: group.whenChanged?.toString(),
    };
  }

  /**
   * Modifies a Group
   */
  async modifyGroup(dn: string, attributes: Record<string, string>): Promise<any> {
    const changes: any[] = [];

    for (const [key, value] of Object.entries(attributes)) {
      changes.push(new Change({
        operation: 'replace',
        modification: new Attribute({
          type: key,
          values: [value],
        }),
      }));
    }

    await this.modify(dn, changes);

    return {
      success: true,
      dn,
      message: 'Group modified successfully',
    };
  }

  /**
   * Deletes a Group
   */
  async deleteGroup(dn: string): Promise<any> {
    try {
      await this.client.del(dn);
      return {
        success: true,
        dn,
        message: 'Group deleted successfully',
      };
    } catch (error: any) {
      if (error.message?.includes('closed') || error.message?.includes('timeout')) {
        await this.reconnect();
        await this.client.del(dn);
        return {
          success: true,
          dn,
          message: 'Group deleted successfully',
        };
      } else {
        throw error;
      }
    }
  }

  /**
   * Lists Groups with filters
   */
  async listGroups(options: {
    searchFilter?: string;
    groupType?: 'security' | 'distribution' | 'all';
    scope?: 'global' | 'domainLocal' | 'universal' | 'all';
    maxResults?: number;
  } = {}): Promise<any[]> {
    const { searchFilter, groupType = 'all', scope = 'all', maxResults } = options;

    let filter = '(objectClass=group)';

    // Add name filter if provided
    if (searchFilter) {
      filter = `(&(objectClass=group)(|(cn=*${searchFilter}*)(sAMAccountName=*${searchFilter}*)))`;
    }

    const searchOptions: any = {
      scope: 'sub',
      filter,
      attributes: ['cn', 'sAMAccountName', 'description', 'groupType', 'distinguishedName', 'whenCreated'],
    };

    if (maxResults) {
      searchOptions.sizeLimit = maxResults;
    }

    const { searchEntries } = await this.search(this.baseDn, searchOptions);

    if (!searchEntries || searchEntries.length === 0) {
      return [];
    }

    return searchEntries
      .map(group => {
        const groupTypeValue = parseInt(group.groupType?.toString() || '0', 10);
        const isSecurity = !!(groupTypeValue & 0x80000000);
        let groupScope = 'unknown';
        if (groupTypeValue & 0x00000002) groupScope = 'global';
        else if (groupTypeValue & 0x00000004) groupScope = 'domainLocal';
        else if (groupTypeValue & 0x00000008) groupScope = 'universal';

        return {
          distinguishedName: group.dn?.toString(),
          name: group.cn?.toString(),
          samAccountName: group.sAMAccountName?.toString(),
          description: group.description?.toString() || '',
          groupType: isSecurity ? 'security' : 'distribution',
          scope: groupScope,
          whenCreated: group.whenCreated?.toString(),
        };
      })
      .filter(group => {
        // Filter by groupType if specified
        if (groupType !== 'all' && group.groupType !== groupType) {
          return false;
        }
        // Filter by scope if specified
        if (scope !== 'all' && group.scope !== scope) {
          return false;
        }
        return true;
      });
  }

  /**
   * Searches groups by name (for autocomplete/dropdown)
   */
  async searchGroups(searchTerm: string, maxResults: number = 50): Promise<Array<{ name: string; value: string; description: string }>> {
    const filter = searchTerm
      ? `(&(objectClass=group)(|(cn=*${searchTerm}*)(sAMAccountName=*${searchTerm}*)))`
      : '(objectClass=group)';

    const { searchEntries } = await this.search(this.baseDn, {
      scope: 'sub',
      filter,
      attributes: ['cn', 'sAMAccountName', 'description', 'distinguishedName'],
      sizeLimit: maxResults,
    });

    if (!searchEntries || searchEntries.length === 0) {
      return [];
    }

    return searchEntries.map(group => ({
      name: group.cn?.toString() || '',
      value: group.dn?.toString() || '',
      description: group.description?.toString() || group.sAMAccountName?.toString() || '',
    }));
  }

  /**
   * Searches OUs by name (for autocomplete/dropdown)
   */
  async searchOUs(searchTerm: string, maxResults: number = 50): Promise<Array<{ name: string; value: string; description: string }>> {
    const filter = searchTerm
      ? `(&(objectClass=organizationalUnit)(ou=*${searchTerm}*))`
      : '(objectClass=organizationalUnit)';

    const { searchEntries } = await this.search(this.baseDn, {
      scope: 'sub',
      filter,
      attributes: ['ou', 'description', 'distinguishedName'],
      sizeLimit: maxResults,
    });

    if (!searchEntries || searchEntries.length === 0) {
      return [];
    }

    return searchEntries.map(ou => ({
      name: ou.ou?.toString() || '',
      value: ou.dn?.toString() || '',
      description: ou.description?.toString() || '',
    }));
  }
}
