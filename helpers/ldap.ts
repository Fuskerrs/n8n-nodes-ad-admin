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
}
