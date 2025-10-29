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
 * Échappe les caractères spéciaux dans un DN LDAP
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
 * Valide un sAMAccountName (max 20 chars, pas d'espaces ni caractères spéciaux)
 */
export function validateSAMAccountName(sam: string): { valid: boolean; error?: string } {
  if (!sam || sam.length === 0) {
    return { valid: false, error: 'sAMAccountName ne peut pas être vide' };
  }
  if (sam.length > 20) {
    return { valid: false, error: 'sAMAccountName ne peut pas dépasser 20 caractères' };
  }
  if (/[\s"\/\\\[\]:;|=,+*?<>]/.test(sam)) {
    return { valid: false, error: 'sAMAccountName contient des caractères invalides' };
  }
  return { valid: true };
}

/**
 * Valide un UPN
 */
export function validateUPN(upn: string): { valid: boolean; error?: string } {
  if (!upn || !upn.includes('@')) {
    return { valid: false, error: 'UPN doit être au format user@domain.tld' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(upn)) {
    return { valid: false, error: 'Format UPN invalide' };
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
   * Reconnecte le client en cas d'erreur
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
   * Définit le mot de passe AD (unicodePwd) - NÉCESSITE LDAPS
   */
  async setPassword(dn: string, newPassword: string): Promise<void> {
    // Vérifier que la connexion est sécurisée
    if (this.config.isSecure === false) {
      throw new Error(
        'Les opérations de mot de passe nécessitent LDAPS (port 636). ' +
        'LDAP non-sécurisé (port 389) n\'est pas supporté par Active Directory pour les mots de passe.'
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
   * Active un utilisateur (retire le flag ACCOUNTDISABLE)
   */
  async enableUser(dn: string): Promise<void> {
    const { searchEntries } = await this.search(dn, {
      scope: 'base',
      attributes: ['userAccountControl']
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`Utilisateur non trouvé: ${dn}`);
    }

    const currentUAC = parseInt(searchEntries[0].userAccountControl as string, 10) || 512;
    const newUAC = currentUAC & ~0x0002; // Retire le flag ACCOUNTDISABLE

    await this.modify(dn, new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'userAccountControl',
        values: [String(newUAC)]
      })
    }));
  }

  /**
   * Désactive un utilisateur (ajoute le flag ACCOUNTDISABLE)
   */
  async disableUser(dn: string): Promise<void> {
    const { searchEntries } = await this.search(dn, {
      scope: 'base',
      attributes: ['userAccountControl']
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`Utilisateur non trouvé: ${dn}`);
    }

    const currentUAC = parseInt(searchEntries[0].userAccountControl as string, 10) || 512;
    const newUAC = currentUAC | 0x0002; // Ajoute le flag ACCOUNTDISABLE

    await this.modify(dn, new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'userAccountControl',
        values: [String(newUAC)]
      })
    }));
  }

  /**
   * Vérifie si un utilisateur est membre d'un groupe
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
   * Recherche un utilisateur par sAMAccountName
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
   * Récupère un utilisateur avec toutes ses propriétés
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

    // Convertir les propriétés LDAP en format JSON lisible
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

    // Convertir userAccountControl en informations lisibles
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
   * Liste les utilisateurs avec filtres avancés
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

    // Construire le filtre LDAP
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

      // Convertir les propriétés LDAP
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

      // Ajouter les informations d'état du compte
      if (result.userAccountControl) {
        const uac = parseInt(result.userAccountControl, 10);
        result.accountEnabled = !(uac & 0x0002);
      }

      return result;
    });
  }

  /**
   * Récupère tous les groupes d'un utilisateur
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
      throw new Error(`Utilisateur non trouvé: ${samAccountName}`);
    }

    const memberOf = searchEntries[0].memberOf;
    if (!memberOf) return [];

    const groupDNs = Array.isArray(memberOf) ? memberOf.map(g => g.toString()) : [memberOf.toString()];
    const groups: any[] = [];

    // Récupérer les détails de chaque groupe
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

          // Si includeNested, récupérer les groupes parents
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
                  // Ignorer les erreurs de groupes inaccessibles
                }
              }
            }
          }
        }
      } catch (e) {
        // Ignorer les erreurs de groupes inaccessibles
      }
    }

    return groups;
  }

  /**
   * Récupère les informations d'activité d'un utilisateur
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
      throw new Error(`Utilisateur non trouvé: ${samAccountName}`);
    }

    const user = searchEntries[0];
    const result: any = {};

    // Conversion des timestamps Active Directory
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
   * Déverrouille un compte utilisateur
   */
  async unlockUserAccount(samAccountName: string): Promise<any> {
    const dn = await this.findUserBySAM(samAccountName);
    if (!dn) {
      throw new Error(`Utilisateur non trouvé: ${samAccountName}`);
    }

    // Vérifier si le compte est verrouillé
    const { searchEntries } = await this.search(dn, {
      scope: 'base',
      attributes: ['lockoutTime', 'userAccountControl']
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`Impossible de récupérer les informations de verrouillage`);
    }

    const lockoutTime = searchEntries[0].lockoutTime?.toString();
    const isLocked = lockoutTime && lockoutTime !== '0';

    if (!isLocked) {
      return {
        wasLocked: false,
        message: 'Le compte n\'était pas verrouillé',
      };
    }

    // Déverrouiller en mettant lockoutTime à 0
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
      message: 'Compte déverrouillé avec succès',
    };
  }

  /**
   * Vérifie l'expiration du mot de passe
   */
  async checkPasswordExpiry(samAccountName: string): Promise<any> {
    const { searchEntries } = await this.search(this.baseDn, {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${samAccountName}))`,
      attributes: ['pwdLastSet', 'userAccountControl', 'maxPwdAge']
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error(`Utilisateur non trouvé: ${samAccountName}`);
    }

    const user = searchEntries[0];
    const pwdLastSet = user.pwdLastSet?.toString();
    const userAccountControl = parseInt(user.userAccountControl?.toString() || '0', 10);

    // Vérifier si le mot de passe n'expire jamais
    const passwordNeverExpires = !!(userAccountControl & 0x10000);

    if (passwordNeverExpires) {
      return {
        passwordNeverExpires: true,
        mustChangePassword: pwdLastSet === '0',
        message: 'Le mot de passe est configuré pour ne jamais expirer',
      };
    }

    if (pwdLastSet === '0') {
      return {
        passwordNeverExpires: false,
        mustChangePassword: true,
        expired: false,
        message: 'L\'utilisateur doit changer son mot de passe à la prochaine connexion',
      };
    }

    // Récupérer la politique de mot de passe du domaine
    try {
      const { searchEntries: domainEntries } = await this.search(this.baseDn, {
        scope: 'base',
        attributes: ['maxPwdAge']
      });

      let maxPwdAge = '0';
      if (domainEntries && domainEntries.length > 0) {
        maxPwdAge = domainEntries[0].maxPwdAge?.toString() || '0';
      }

      if (maxPwdAge === '0') {
        return {
          passwordNeverExpires: false,
          mustChangePassword: false,
          expired: false,
          message: 'Aucune politique d\'expiration configurée',
        };
      }

      // Calculer la date d'expiration
      const pwdLastSetTime = parseInt(pwdLastSet || '0', 10);
      const maxAge = Math.abs(parseInt(maxPwdAge, 10));
      const expiryTime = pwdLastSetTime + maxAge;
      const now = Date.now() * 10000 + 116444736000000000; // Convertir en timestamp AD

      const daysUntilExpiry = Math.floor((expiryTime - now) / (10000 * 1000 * 60 * 60 * 24));
      const expired = now > expiryTime;

      return {
        passwordNeverExpires: false,
        mustChangePassword: false,
        expired,
        daysUntilExpiry: expired ? 0 : daysUntilExpiry,
        expiryDate: new Date((expiryTime / 10000) - 11644473600000).toISOString(),
        message: expired
          ? 'Le mot de passe a expiré'
          : `Le mot de passe expire dans ${daysUntilExpiry} jour(s)`,
      };

    } catch (e) {
      return {
        passwordNeverExpires: false,
        mustChangePassword: false,
        expired: false,
        error: 'Impossible de récupérer la politique de mot de passe',
      };
    }
  }
}
