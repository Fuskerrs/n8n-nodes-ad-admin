import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { Attribute, Change } from 'ldapts';
import { AdClient, escapeDN, validateSAMAccountName, validateUPN } from '../../helpers/ldap';

export class ActiveDirectoryAdmin implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Active Directory Admin',
    name: 'activeDirectoryAdmin',
    icon: 'fa:server',
    group: ['transform'],
    version: 1,
    description: 'Perform administrative operations on Active Directory via LDAP/LDAPS',
    defaults: { name: 'Active Directory Admin' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'activeDirectoryApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'User', value: 'user' },
          { name: 'Group', value: 'group' },
        ],
        default: 'user',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['user'],
          },
        },
        options: [
          { name: 'Create', value: 'create', description: 'Create a user' },
          { name: 'Enable', value: 'enable', description: 'Enable a user' },
          { name: 'Disable', value: 'disable', description: 'Disable a user' },
          { name: 'Reset Password', value: 'resetPassword', description: 'Reset user password' },
          { name: 'Set Attributes', value: 'setAttributes', description: 'Set user attributes' },
          { name: 'Find by sAMAccountName', value: 'findBySAM', description: 'Search by sAMAccountName' },
          { name: 'Get User', value: 'getUser', description: 'Get user with all properties' },
          { name: 'List Users', value: 'listUsers', description: 'List users with filters' },
          { name: 'Get User Groups', value: 'getUserGroups', description: 'Get all user groups' },
          { name: 'Get User Activity', value: 'getUserActivity', description: 'Last login and password information' },
          { name: 'Unlock Account', value: 'unlockAccount', description: 'Unlock a user account' },
          { name: 'Check Password Expiry', value: 'checkPasswordExpiry', description: 'Check password expiration' },
        ],
        default: 'create',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['group'],
          },
        },
        options: [
          { name: 'Add Member', value: 'addMember', description: 'Add a member to group' },
          { name: 'Remove Member', value: 'removeMember', description: 'Remove a member from group' },
        ],
        default: 'addMember',
      },
      {
        displayName: 'Continue on Error',
        name: 'continueOnFail',
        type: 'boolean',
        default: false,
        description: 'Continue processing even if an item fails',
      },
      {
        displayName: 'Distinguished Name',
        name: 'dn',
        type: 'string',
        default: '',
        placeholder: 'CN=John Doe,OU=Users,DC=example,DC=local',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['enable', 'disable', 'resetPassword', 'setAttributes'],
          },
        },
        required: true,
        description: 'Full distinguished name of the user',
      },
      {
        displayName: 'User CN (Common Name)',
        name: 'cn',
        type: 'string',
        default: '',
        placeholder: 'John Doe',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['create'],
          },
        },
        required: true,
        description: 'Full name of the user (will be escaped automatically)',
      },
      {
        displayName: 'Parent OU DN',
        name: 'parentOuDn',
        type: 'string',
        default: '',
        placeholder: 'OU=Users,DC=example,DC=local',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['create'],
          },
        },
        required: true,
        description: 'DN of the parent OU where the user will be created',
      },
      {
        displayName: 'sAMAccountName',
        name: 'samAccountName',
        type: 'string',
        default: '',
        placeholder: 'jdoe',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['create'],
          },
        },
        required: true,
        description: 'Login name (max 20 characters, no spaces)',
      },
      {
        displayName: 'User Principal Name (UPN)',
        name: 'upn',
        type: 'string',
        default: '',
        placeholder: 'john.doe@example.local',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['create'],
          },
        },
        required: true,
        description: 'UPN au format user@domain.tld',
      },
      {
        displayName: 'Initial Password',
        name: 'initialPassword',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['create'],
          },
        },
        required: true,
        description: 'Mot de passe initial (doit respecter la politique AD)',
      },
      {
        displayName: 'Must Change Password at Next Logon',
        name: 'pwdMustChange',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['create'],
          },
        },
        description: 'Force password change at next logon',
      },
      {
        displayName: 'Enable Account Immediately',
        name: 'enableImmediately',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['create'],
          },
        },
        description: 'Enable account immediately after creation',
      },
      {
        displayName: 'New Password',
        name: 'newPassword',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['resetPassword'],
          },
        },
        required: true,
        description: 'Nouveau mot de passe',
      },
      {
        displayName: 'Force Change at Next Logon',
        name: 'forceChange',
        type: 'boolean',
        default: false,
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['resetPassword'],
          },
        },
        description: 'Force password change at next logon',
      },
      {
        displayName: 'sAMAccountName',
        name: 'searchSAM',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['findBySAM'],
          },
        },
        required: true,
        description: 'sAMAccountName to search for',
      },
      {
        displayName: 'sAMAccountName',
        name: 'getUserSAM',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['getUser'],
          },
        },
        required: true,
        description: 'sAMAccountName of the user to retrieve',
      },
      {
        displayName: 'Include All Properties',
        name: 'includeAllProperties',
        type: 'boolean',
        default: false,
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['getUser'],
          },
        },
        description: 'Include all AD properties or only basic properties',
      },
      {
        displayName: 'Search Filter Type',
        name: 'filterType',
        type: 'options',
        options: [
          { name: 'Exact Match', value: 'exact', description: 'Correspondance exacte' },
          { name: 'Starts With', value: 'startswith', description: 'Commence par' },
          { name: 'Contains', value: 'contains', description: 'Contient' },
          { name: 'Ends With', value: 'endswith', description: 'Finit par' },
        ],
        default: 'exact',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['listUsers'],
          },
        },
        description: 'Type de filtre pour la recherche',
      },
      {
        displayName: 'Search Value',
        name: 'searchValue',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['listUsers'],
          },
        },
        description: 'Value to search for (empty = all users)',
      },
      {
        displayName: 'Search Field',
        name: 'searchField',
        type: 'options',
        options: [
          { name: 'sAMAccountName', value: 'sAMAccountName', description: 'Login name' },
          { name: 'displayName', value: 'displayName', description: 'Display name' },
          { name: 'userPrincipalName', value: 'userPrincipalName', description: 'UPN' },
          { name: 'givenName', value: 'givenName', description: 'First Name' },
          { name: 'sn', value: 'sn', description: 'Last Name' },
          { name: 'mail', value: 'mail', description: 'Email' },
        ],
        default: 'sAMAccountName',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['listUsers'],
          },
        },
        description: 'Champ AD sur lequel effectuer la recherche',
      },
      {
        displayName: 'Include All Properties',
        name: 'listIncludeAllProperties',
        type: 'boolean',
        default: false,
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['listUsers'],
          },
        },
        description: 'Include all AD properties or only basic properties',
      },
      {
        displayName: 'Max Results',
        name: 'maxResults',
        type: 'number',
        default: 100,
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['listUsers'],
          },
        },
        description: 'Maximum number of results to return (0 = unlimited)',
      },
      {
        displayName: 'sAMAccountName',
        name: 'activityUserSAM',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['getUserGroups', 'getUserActivity', 'unlockAccount', 'checkPasswordExpiry'],
          },
        },
        required: true,
        description: 'sAMAccountName of the user',
      },
      {
        displayName: 'Include Nested Groups',
        name: 'includeNestedGroups',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['getUserGroups'],
          },
        },
        description: 'Include nested groups (indirect membership)',
      },
      {
        displayName: 'Group Details',
        name: 'groupDetails',
        type: 'options',
        options: [
          { name: 'Group Names Only', value: 'names', description: 'Group names only' },
          { name: 'Full Group Info', value: 'full', description: 'Complete group information' },
        ],
        default: 'names',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['getUserGroups'],
          },
        },
        description: 'Level of detail for group information',
      },
      {
        displayName: 'Activity Info Type',
        name: 'activityType',
        type: 'options',
        options: [
          { name: 'All Activity', value: 'all', description: 'All activity information' },
          { name: 'Login Only', value: 'login', description: 'Login information only' },
          { name: 'Password Only', value: 'password', description: 'Password information only' },
        ],
        default: 'all',
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['getUserActivity'],
          },
        },
        description: 'Type of activity information to retrieve',
      },
      {
        displayName: 'User DN',
        name: 'userDn',
        type: 'string',
        default: '',
        placeholder: 'CN=John Doe,OU=Users,DC=example,DC=local',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['addMember', 'removeMember'],
          },
        },
        required: true,
        description: 'Full distinguished name of the user',
      },
      {
        displayName: 'Group DN',
        name: 'groupDn',
        type: 'string',
        default: '',
        placeholder: 'CN=IT Staff,OU=Groups,DC=example,DC=local',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['addMember', 'removeMember'],
          },
        },
        required: true,
        description: 'DN complet du groupe',
      },
      {
        displayName: 'Skip if Already Member',
        name: 'skipIfMember',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['addMember'],
          },
        },
        description: 'Do not fail if user is already a member',
      },
      {
        displayName: 'Skip if Not Member',
        name: 'skipIfNotMember',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['removeMember'],
          },
        },
        description: 'Do not fail if user is not a member',
      },
      {
        displayName: 'Attributes',
        name: 'attributes',
        placeholder: 'Ajouter un attribut',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        default: {},
        displayOptions: {
          show: {
            resource: ['user'],
            operation: ['setAttributes'],
          },
        },
        options: [
          {
            name: 'attribute',
            displayName: 'Attribute',
            values: [
              {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                default: '',
                placeholder: 'telephoneNumber',
                description: 'Nom de l\'attribut AD',
              },
              {
                displayName: 'Values',
                name: 'values',
                type: 'string',
                typeOptions: { multipleValues: true },
                default: [],
                description: 'Valeur(s) de l\'attribut',
              },
              {
                displayName: 'Operation',
                name: 'op',
                type: 'options',
                default: 'replace',
                options: [
                  { name: 'Add', value: 'add', description: 'Ajouter une valeur' },
                  { name: 'Delete', value: 'delete', description: 'Supprimer une valeur' },
                  { name: 'Replace', value: 'replace', description: 'Remplacer toutes les valeurs' },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = await this.getCredentials('activeDirectoryApi');
    const continueOnFail = this.getNodeParameter('continueOnFail', 0, false) as boolean;

    const connectionType = credentials.connectionType as string || 'ldaps';
    const protocol = connectionType === 'ldaps' ? 'ldaps' : 'ldap';
    const url = `${protocol}://${credentials.host}:${credentials.port}`;

    // Configuration TLS avancée
    let tlsOptions: any = undefined;
    if (connectionType === 'ldaps') {
      const tlsValidation = credentials.tlsValidation as string || 'system';

      if (tlsValidation === 'skip') {
        tlsOptions = { rejectUnauthorized: false };
      } else if (tlsValidation === 'custom' && credentials.customCertificate) {
        tlsOptions = {
          rejectUnauthorized: true,
          ca: credentials.customCertificate as string
        };
      } else {
        tlsOptions = { rejectUnauthorized: true };
      }
    }

    const client = new AdClient(
      {
        url,
        bindDn: credentials.bindDn as string,
        password: credentials.password as string,
        tlsOptions,
        timeout: (credentials.timeout as number) ?? 10000,
        isSecure: connectionType === 'ldaps',
        hostType: credentials.hostType as string || 'dns',
      },
      credentials.baseDn as string
    );

    try {
      await client.bind(credentials.bindDn as string, credentials.password as string);

      for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        try {
          const resource = this.getNodeParameter('resource', itemIndex) as string;
          const operation = this.getNodeParameter('operation', itemIndex) as string;

          let result: INodeExecutionData;

          if (resource === 'user' && operation === 'create') {
            result = await createUser.call(this, client, itemIndex);
          } else if (resource === 'user' && operation === 'enable') {
            result = await enableUser.call(this, client, itemIndex);
          } else if (resource === 'user' && operation === 'disable') {
            result = await disableUser.call(this, client, itemIndex);
          } else if (resource === 'user' && operation === 'resetPassword') {
            result = await resetPassword.call(this, client, itemIndex);
          } else if (resource === 'user' && operation === 'findBySAM') {
            result = await findUserBySAM.call(this, client, itemIndex);
          } else if (resource === 'user' && operation === 'getUser') {
            result = await getUser.call(this, client, itemIndex);
          } else if (resource === 'user' && operation === 'listUsers') {
            result = await listUsers.call(this, client, itemIndex);
          } else if (resource === 'user' && operation === 'getUserGroups') {
            result = await getUserGroups.call(this, client, itemIndex);
          } else if (resource === 'user' && operation === 'getUserActivity') {
            result = await getUserActivity.call(this, client, itemIndex);
          } else if (resource === 'user' && operation === 'unlockAccount') {
            result = await unlockAccount.call(this, client, itemIndex);
          } else if (resource === 'user' && operation === 'checkPasswordExpiry') {
            result = await checkPasswordExpiry.call(this, client, itemIndex);
          } else if (resource === 'user' && operation === 'setAttributes') {
            result = await setAttributes.call(this, client, itemIndex);
          } else if (resource === 'group' && operation === 'addMember') {
            result = await addGroupMember.call(this, client, itemIndex);
          } else if (resource === 'group' && operation === 'removeMember') {
            result = await removeGroupMember.call(this, client, itemIndex);
          } else {
            throw new NodeOperationError(
              this.getNode(),
              `Opération non supportée: ${resource}.${operation}`,
              { itemIndex }
            );
          }

          returnData.push(result);
        } catch (error: any) {
          if (!continueOnFail) {
            await client.unbind();
            throw error;
          }

          returnData.push({
            json: {
              success: false,
              error: error.message || 'Unknown error',
              itemIndex,
            },
            pairedItem: { item: itemIndex },
          });
        }
      }

      return [returnData];
    } finally {
      await client.unbind();
    }
  }
}

async function createUser(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const cn = this.getNodeParameter('cn', itemIndex) as string;
  const parentOuDn = this.getNodeParameter('parentOuDn', itemIndex) as string;
  const sam = this.getNodeParameter('samAccountName', itemIndex) as string;
  const upn = this.getNodeParameter('upn', itemIndex) as string;
  const initialPassword = this.getNodeParameter('initialPassword', itemIndex) as string;
  const pwdMustChange = this.getNodeParameter('pwdMustChange', itemIndex, true) as boolean;
  const enableImmediately = this.getNodeParameter('enableImmediately', itemIndex, true) as boolean;

  const samValidation = validateSAMAccountName(sam);
  if (!samValidation.valid) {
    throw new NodeOperationError(this.getNode(), samValidation.error!, { itemIndex });
  }

  const upnValidation = validateUPN(upn);
  if (!upnValidation.valid) {
    throw new NodeOperationError(this.getNode(), upnValidation.error!, { itemIndex });
  }

  const dn = `CN=${escapeDN(cn)},${parentOuDn}`;
  const userAccountControl = 514;

  const nameParts = cn.trim().split(/\s+/);
  const givenName = nameParts[0] || cn;
  const sn = nameParts.length > 1 ? nameParts[nameParts.length - 1] : cn;

  await client.add(dn, {
    objectClass: ['top', 'person', 'organizationalPerson', 'user'],
    cn,
    sAMAccountName: sam,
    userPrincipalName: upn,
    sn,
    givenName,
    displayName: cn,
    userAccountControl: String(userAccountControl),
  });

  await client.setPassword(dn, initialPassword);

  if (pwdMustChange) {
    await client.modify(dn, new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'pwdLastSet',
        values: ['0'],
      }),
    }));
  }

  if (enableImmediately) {
    await client.enableUser(dn);
  }

  return {
    json: {
      success: true,
      operation: 'create',
      dn,
      sAMAccountName: sam,
      userPrincipalName: upn,
      enabled: enableImmediately,
      mustChangePassword: pwdMustChange,
    },
    pairedItem: { item: itemIndex },
  };
}

async function enableUser(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const dn = this.getNodeParameter('dn', itemIndex) as string;
  await client.enableUser(dn);

  return {
    json: {
      success: true,
      operation: 'enable',
      dn,
      enabled: true,
    },
    pairedItem: { item: itemIndex },
  };
}

async function disableUser(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const dn = this.getNodeParameter('dn', itemIndex) as string;
  await client.disableUser(dn);

  return {
    json: {
      success: true,
      operation: 'disable',
      dn,
      disabled: true,
    },
    pairedItem: { item: itemIndex },
  };
}

async function resetPassword(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const dn = this.getNodeParameter('dn', itemIndex) as string;
  const newPassword = this.getNodeParameter('newPassword', itemIndex) as string;
  const forceChange = this.getNodeParameter('forceChange', itemIndex, false) as boolean;

  await client.setPassword(dn, newPassword);

  if (forceChange) {
    await client.modify(dn, new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'pwdLastSet',
        values: ['0'],
      }),
    }));
  }

  return {
    json: {
      success: true,
      operation: 'resetPassword',
      dn,
      passwordReset: true,
      mustChangePassword: forceChange,
    },
    pairedItem: { item: itemIndex },
  };
}

async function findUserBySAM(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const sam = this.getNodeParameter('searchSAM', itemIndex) as string;
  const dn = await client.findUserBySAM(sam);

  if (!dn) {
    throw new NodeOperationError(
      this.getNode(),
      `Utilisateur non trouvé: ${sam}`,
      { itemIndex }
    );
  }

  return {
    json: {
      success: true,
      operation: 'findBySAM',
      sAMAccountName: sam,
      dn,
    },
    pairedItem: { item: itemIndex },
  };
}

async function setAttributes(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const dn = this.getNodeParameter('dn', itemIndex) as string;
  const attributes = this.getNodeParameter('attributes.attribute', itemIndex, []) as Array<{
    name: string;
    values: string[];
    op: 'add' | 'delete' | 'replace';
  }>;

  if (!attributes || attributes.length === 0) {
    throw new NodeOperationError(
      this.getNode(),
      'Au moins un attribut doit être spécifié',
      { itemIndex }
    );
  }

  const changes = attributes.map((attr) => new Change({
    operation: attr.op,
    modification: new Attribute({
      type: attr.name,
      values: attr.values,
    }),
  }));

  // Appliquer tous les changements
  for (const change of changes) {
    await client.modify(dn, change);
  }

  return {
    json: {
      success: true,
      operation: 'setAttributes',
      dn,
      modified: attributes.length,
      attributes: attributes.map((a) => ({ name: a.name, op: a.op })),
    },
    pairedItem: { item: itemIndex },
  };
}

async function addGroupMember(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const userDn = this.getNodeParameter('userDn', itemIndex) as string;
  const groupDn = this.getNodeParameter('groupDn', itemIndex) as string;
  const skipIfMember = this.getNodeParameter('skipIfMember', itemIndex, true) as boolean;

  const isMember = await client.isGroupMember(userDn, groupDn);

  if (isMember && skipIfMember) {
    return {
      json: {
        success: true,
        operation: 'addGroupMember',
        userDn,
        groupDn,
        alreadyMember: true,
        skipped: true,
      },
      pairedItem: { item: itemIndex },
    };
  }

  if (isMember && !skipIfMember) {
    throw new NodeOperationError(
      this.getNode(),
      `L'utilisateur est déjà membre du groupe`,
      { itemIndex }
    );
  }

  await client.modify(groupDn, new Change({
    operation: 'add',
    modification: new Attribute({
      type: 'member',
      values: [userDn],
    }),
  }));

  return {
    json: {
      success: true,
      operation: 'addGroupMember',
      userDn,
      groupDn,
      added: true,
    },
    pairedItem: { item: itemIndex },
  };
}

async function removeGroupMember(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const userDn = this.getNodeParameter('userDn', itemIndex) as string;
  const groupDn = this.getNodeParameter('groupDn', itemIndex) as string;
  const skipIfNotMember = this.getNodeParameter('skipIfNotMember', itemIndex, true) as boolean;

  const isMember = await client.isGroupMember(userDn, groupDn);

  if (!isMember && skipIfNotMember) {
    return {
      json: {
        success: true,
        operation: 'removeGroupMember',
        userDn,
        groupDn,
        notMember: true,
        skipped: true,
      },
      pairedItem: { item: itemIndex },
    };
  }

  if (!isMember && !skipIfNotMember) {
    throw new NodeOperationError(
      this.getNode(),
      `L'utilisateur n'est pas membre du groupe`,
      { itemIndex }
    );
  }

  await client.modify(groupDn, new Change({
    operation: 'delete',
    modification: new Attribute({
      type: 'member',
      values: [userDn],
    }),
  }));

  return {
    json: {
      success: true,
      operation: 'removeGroupMember',
      userDn,
      groupDn,
      removed: true,
    },
    pairedItem: { item: itemIndex },
  };
}

async function getUser(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const sam = this.getNodeParameter('getUserSAM', itemIndex) as string;
  const includeAll = this.getNodeParameter('includeAllProperties', itemIndex, false) as boolean;

  const user = await client.getUserBySAM(sam, includeAll);

  if (!user) {
    throw new NodeOperationError(
      this.getNode(),
      `Utilisateur non trouvé: ${sam}`,
      { itemIndex }
    );
  }

  return {
    json: {
      success: true,
      operation: 'getUser',
      sAMAccountName: sam,
      user,
    },
    pairedItem: { item: itemIndex },
  };
}

async function listUsers(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const filterType = this.getNodeParameter('filterType', itemIndex, 'exact') as string;
  const searchValue = this.getNodeParameter('searchValue', itemIndex, '') as string;
  const searchField = this.getNodeParameter('searchField', itemIndex, 'sAMAccountName') as string;
  const includeAll = this.getNodeParameter('listIncludeAllProperties', itemIndex, false) as boolean;
  const maxResults = this.getNodeParameter('maxResults', itemIndex, 100) as number;

  const users = await client.listUsers({
    filterType,
    searchValue,
    searchField,
    includeAll,
    maxResults: maxResults || undefined
  });

  return {
    json: {
      success: true,
      operation: 'listUsers',
      count: users.length,
      filterType,
      searchField,
      searchValue,
      users,
    },
    pairedItem: { item: itemIndex },
  };
}

async function getUserGroups(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const sam = this.getNodeParameter('activityUserSAM', itemIndex) as string;
  const includeNested = this.getNodeParameter('includeNestedGroups', itemIndex, true) as boolean;
  const groupDetails = this.getNodeParameter('groupDetails', itemIndex, 'names') as string;

  const groups = await client.getUserGroups(sam, includeNested, groupDetails === 'full');

  return {
    json: {
      success: true,
      operation: 'getUserGroups',
      sAMAccountName: sam,
      includeNested,
      groupCount: groups.length,
      groups,
    },
    pairedItem: { item: itemIndex },
  };
}

async function getUserActivity(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const sam = this.getNodeParameter('activityUserSAM', itemIndex) as string;
  const activityType = this.getNodeParameter('activityType', itemIndex, 'all') as string;

  const activity = await client.getUserActivity(sam, activityType);

  return {
    json: {
      success: true,
      operation: 'getUserActivity',
      sAMAccountName: sam,
      activityType,
      ...activity,
    },
    pairedItem: { item: itemIndex },
  };
}

async function unlockAccount(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const sam = this.getNodeParameter('activityUserSAM', itemIndex) as string;

  const result = await client.unlockUserAccount(sam);

  return {
    json: {
      success: true,
      operation: 'unlockAccount',
      sAMAccountName: sam,
      ...result,
    },
    pairedItem: { item: itemIndex },
  };
}

async function checkPasswordExpiry(this: IExecuteFunctions, client: AdClient, itemIndex: number): Promise<INodeExecutionData> {
  const sam = this.getNodeParameter('activityUserSAM', itemIndex) as string;

  const expiry = await client.checkPasswordExpiry(sam);

  return {
    json: {
      success: true,
      operation: 'checkPasswordExpiry',
      sAMAccountName: sam,
      ...expiry,
    },
    pairedItem: { item: itemIndex },
  };
}
