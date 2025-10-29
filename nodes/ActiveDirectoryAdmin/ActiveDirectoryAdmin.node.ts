import type {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
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
    icon: 'file:activeDirectoryAdmin.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Perform administrative operations on Active Directory via LDAP/LDAPS',
    defaults: { name: 'Active Directory Admin' },
    inputs: ['main'],
    outputs: ['main'],
    documentationUrl: 'https://github.com/Fuskerrs/n8n-nodes-ad-admin',
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
          { name: 'Organizational Unit', value: 'ou' },
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
          { name: 'Create', value: 'create', description: 'Create a group' },
          { name: 'Get', value: 'get', description: 'Get group details' },
          { name: 'List', value: 'list', description: 'List groups with filters' },
          { name: 'Modify', value: 'modify', description: 'Modify group attributes' },
          { name: 'Delete', value: 'delete', description: 'Delete a group' },
          { name: 'Add Member', value: 'addMember', description: 'Add a member to group' },
          { name: 'Remove Member', value: 'removeMember', description: 'Remove a member from group' },
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
            resource: ['ou'],
          },
        },
        options: [
          { name: 'Create', value: 'create', description: 'Create an Organizational Unit' },
          { name: 'Get', value: 'get', description: 'Get OU details' },
          { name: 'List', value: 'list', description: 'List Organizational Units' },
          { name: 'Modify', value: 'modify', description: 'Modify OU attributes' },
          { name: 'Delete', value: 'delete', description: 'Delete an Organizational Unit' },
        ],
        default: 'create',
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
        placeholder: 'Add an attribute',
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
                type: 'options',
                typeOptions: {
                  loadOptionsMethod: 'getUserAttributes',
                },
                default: 'displayName',
                description: 'AD attribute name',
              },
              {
                displayName: 'Values',
                name: 'values',
                type: 'string',
                typeOptions: { multipleValues: true },
                default: [],
                description: 'Attribute value(s)',
              },
              {
                displayName: 'Operation',
                name: 'op',
                type: 'options',
                default: 'replace',
                options: [
                  { name: 'Add', value: 'add', description: 'Add a value' },
                  { name: 'Delete', value: 'delete', description: 'Delete a value' },
                  { name: 'Replace', value: 'replace', description: 'Replace all values' },
                ],
              },
            ],
          },
        ],
      },
      // ============================
      // GROUP FIELDS
      // ============================
      {
        displayName: 'Group Name',
        name: 'groupName',
        type: 'string',
        default: '',
        placeholder: 'Sales Team',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['create'],
          },
        },
        required: true,
        description: 'Name of the group',
      },
      {
        displayName: 'Parent DN',
        name: 'groupParentDn',
        type: 'string',
        default: '',
        placeholder: 'OU=Groups,DC=example,DC=local',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['create'],
          },
        },
        required: true,
        description: 'DN of the parent OU where the group will be created',
      },
      {
        displayName: 'Group Type',
        name: 'groupType',
        type: 'options',
        options: [
          { name: 'Security', value: 'security', description: 'Security group (can be used for permissions)' },
          { name: 'Distribution', value: 'distribution', description: 'Distribution group (email only)' },
        ],
        default: 'security',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['create'],
          },
        },
        description: 'Type of group to create',
      },
      {
        displayName: 'Group Scope',
        name: 'groupScope',
        type: 'options',
        options: [
          { name: 'Global', value: 'global', description: 'Global scope (default)' },
          { name: 'Domain Local', value: 'domainLocal', description: 'Domain local scope' },
          { name: 'Universal', value: 'universal', description: 'Universal scope' },
        ],
        default: 'global',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['create'],
          },
        },
        description: 'Scope of the group',
      },
      {
        displayName: 'Description',
        name: 'groupDescription',
        type: 'string',
        default: '',
        placeholder: 'Sales department security group',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['create', 'modify'],
          },
        },
        description: 'Description of the group',
      },
      {
        displayName: 'sAMAccountName',
        name: 'groupSamAccountName',
        type: 'string',
        default: '',
        placeholder: 'SalesTeam',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['create'],
          },
        },
        description: 'sAMAccountName for the group (defaults to group name)',
      },
      {
        displayName: 'Group DN',
        name: 'groupDn',
        type: 'string',
        default: '',
        placeholder: 'CN=Sales Team,OU=Groups,DC=example,DC=local',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['get', 'modify', 'delete'],
          },
        },
        required: true,
        description: 'Distinguished Name of the group',
      },
      {
        displayName: 'Search Filter',
        name: 'groupSearchFilter',
        type: 'string',
        default: '',
        placeholder: 'Sales',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['list'],
          },
        },
        description: 'Search term to filter groups (searches in name and sAMAccountName)',
      },
      {
        displayName: 'Filter by Type',
        name: 'groupFilterType',
        type: 'options',
        options: [
          { name: 'All', value: 'all' },
          { name: 'Security', value: 'security' },
          { name: 'Distribution', value: 'distribution' },
        ],
        default: 'all',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['list'],
          },
        },
        description: 'Filter groups by type',
      },
      {
        displayName: 'Filter by Scope',
        name: 'groupFilterScope',
        type: 'options',
        options: [
          { name: 'All', value: 'all' },
          { name: 'Global', value: 'global' },
          { name: 'Domain Local', value: 'domainLocal' },
          { name: 'Universal', value: 'universal' },
        ],
        default: 'all',
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['list'],
          },
        },
        description: 'Filter groups by scope',
      },
      {
        displayName: 'Max Results',
        name: 'groupMaxResults',
        type: 'number',
        default: 100,
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['list'],
          },
        },
        description: 'Maximum number of results to return',
      },
      {
        displayName: 'Attributes',
        name: 'groupAttributes',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        default: {},
        displayOptions: {
          show: {
            resource: ['group'],
            operation: ['modify'],
          },
        },
        description: 'Attributes to modify',
        options: [
          {
            name: 'attribute',
            displayName: 'Attribute',
            values: [
              {
                displayName: 'Name',
                name: 'name',
                type: 'options',
                typeOptions: {
                  loadOptionsMethod: 'getGroupAttributes',
                },
                default: 'description',
                description: 'Attribute name',
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
                description: 'Attribute value',
              },
            ],
          },
        ],
      },
      // ============================
      // OU FIELDS
      // ============================
      {
        displayName: 'OU Name',
        name: 'ouName',
        type: 'string',
        default: '',
        placeholder: 'Sales',
        displayOptions: {
          show: {
            resource: ['ou'],
            operation: ['create'],
          },
        },
        required: true,
        description: 'Name of the Organizational Unit',
      },
      {
        displayName: 'Parent DN',
        name: 'ouParentDn',
        type: 'string',
        default: '',
        placeholder: 'DC=example,DC=local',
        displayOptions: {
          show: {
            resource: ['ou'],
            operation: ['create'],
          },
        },
        required: true,
        description: 'DN of the parent where the OU will be created',
      },
      {
        displayName: 'Description',
        name: 'ouDescription',
        type: 'string',
        default: '',
        placeholder: 'Sales department',
        displayOptions: {
          show: {
            resource: ['ou'],
            operation: ['create', 'modify'],
          },
        },
        description: 'Description of the OU',
      },
      {
        displayName: 'OU DN',
        name: 'ouDn',
        type: 'string',
        default: '',
        placeholder: 'OU=Sales,DC=example,DC=local',
        displayOptions: {
          show: {
            resource: ['ou'],
            operation: ['get', 'modify', 'delete'],
          },
        },
        required: true,
        description: 'Distinguished Name of the OU',
      },
      {
        displayName: 'Parent DN',
        name: 'ouParentDnList',
        type: 'string',
        default: '',
        placeholder: 'DC=example,DC=local (empty = base DN)',
        displayOptions: {
          show: {
            resource: ['ou'],
            operation: ['list'],
          },
        },
        description: 'Parent DN to search in (leave empty for base DN)',
      },
      {
        displayName: 'Search Filter',
        name: 'ouSearchFilter',
        type: 'string',
        default: '',
        placeholder: 'Sales',
        displayOptions: {
          show: {
            resource: ['ou'],
            operation: ['list'],
          },
        },
        description: 'Search term to filter OUs by name',
      },
      {
        displayName: 'Attributes',
        name: 'ouAttributes',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        default: {},
        displayOptions: {
          show: {
            resource: ['ou'],
            operation: ['modify'],
          },
        },
        description: 'Attributes to modify',
        options: [
          {
            name: 'attribute',
            displayName: 'Attribute',
            values: [
              {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                default: 'description',
                placeholder: 'description',
                description: 'Attribute name',
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
                description: 'Attribute value',
              },
            ],
          },
        ],
      },
    ],
  };

  methods = {
    loadOptions: {
      // Load groups dynamically for dropdown
      async getGroupsList(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('activeDirectoryApi');
        const { AdClient } = await import('../../helpers/ldap');

        const host = credentials.host as string;
        const port = credentials.port as number;
        const baseDn = credentials.baseDn as string;
        const bindDn = credentials.bindDn as string;
        const password = credentials.password as string;
        const connectionType = credentials.connectionType as string;
        const isSecure = connectionType === 'ldaps';

        let tlsOptions: any = undefined;
        if (isSecure) {
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

        const config = {
          url: `${connectionType}://${host}:${port}`,
          bindDn,
          password,
          timeout: credentials.timeout as number || 10000,
          tlsOptions,
          isSecure,
        };

        const client = new AdClient(config, baseDn);

        try {
          await client.bind(bindDn, password);
          const groups = await client.searchGroups('', 100);
          await client.unbind();

          return groups.map(g => ({
            name: `${g.name}${g.description ? ' - ' + g.description : ''}`,
            value: g.value,
          }));
        } catch (error: any) {
          await client.unbind();
          throw new Error(`Failed to load groups: ${error.message}`);
        }
      },

      // Load OUs dynamically for dropdown
      async getOUsList(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('activeDirectoryApi');
        const { AdClient } = await import('../../helpers/ldap');

        const host = credentials.host as string;
        const port = credentials.port as number;
        const baseDn = credentials.baseDn as string;
        const bindDn = credentials.bindDn as string;
        const password = credentials.password as string;
        const connectionType = credentials.connectionType as string;
        const isSecure = connectionType === 'ldaps';

        let tlsOptions: any = undefined;
        if (isSecure) {
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

        const config = {
          url: `${connectionType}://${host}:${port}`,
          bindDn,
          password,
          timeout: credentials.timeout as number || 10000,
          tlsOptions,
          isSecure,
        };

        const client = new AdClient(config, baseDn);

        try {
          await client.bind(bindDn, password);
          const ous = await client.searchOUs('', 100);
          await client.unbind();

          return ous.map(o => ({
            name: `${o.name}${o.description ? ' - ' + o.description : ''}`,
            value: o.value,
          }));
        } catch (error: any) {
          await client.unbind();
          throw new Error(`Failed to load OUs: ${error.message}`);
        }
      },

      // Load common group attributes for dropdown
      async getGroupAttributes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        return [
          { name: 'Description', value: 'description' },
          { name: 'Display Name', value: 'displayName' },
          { name: 'Info', value: 'info' },
          { name: 'Mail', value: 'mail' },
          { name: 'Managed By', value: 'managedBy' },
        ];
      },

      // Load common user attributes for dropdown
      async getUserAttributes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        return [
          { name: 'Display Name', value: 'displayName' },
          { name: 'First Name (Given Name)', value: 'givenName' },
          { name: 'Last Name (Surname)', value: 'sn' },
          { name: 'Email', value: 'mail' },
          { name: 'Telephone Number', value: 'telephoneNumber' },
          { name: 'Mobile', value: 'mobile' },
          { name: 'Title', value: 'title' },
          { name: 'Department', value: 'department' },
          { name: 'Company', value: 'company' },
          { name: 'Manager', value: 'manager' },
          { name: 'Description', value: 'description' },
          { name: 'Office', value: 'physicalDeliveryOfficeName' },
          { name: 'Street Address', value: 'streetAddress' },
          { name: 'City', value: 'l' },
          { name: 'State/Province', value: 'st' },
          { name: 'Postal Code', value: 'postalCode' },
          { name: 'Country', value: 'co' },
        ];
      },
    },
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
          } else if (resource === 'group' && operation === 'create') {
            const groupName = this.getNodeParameter('groupName', itemIndex) as string;
            const groupParentDn = this.getNodeParameter('groupParentDn', itemIndex) as string;
            const groupType = this.getNodeParameter('groupType', itemIndex) as 'security' | 'distribution';
            const groupScope = this.getNodeParameter('groupScope', itemIndex) as 'global' | 'domainLocal' | 'universal';
            const groupDescription = this.getNodeParameter('groupDescription', itemIndex, '') as string;
            const groupSamAccountName = this.getNodeParameter('groupSamAccountName', itemIndex, '') as string;

            const groupResult = await client.createGroup(groupName, groupParentDn, {
              groupType,
              scope: groupScope,
              description: groupDescription || undefined,
              samAccountName: groupSamAccountName || undefined,
            });

            result = { json: groupResult, pairedItem: { item: itemIndex } };
          } else if (resource === 'group' && operation === 'get') {
            const groupDn = this.getNodeParameter('groupDn', itemIndex) as string;
            const groupData = await client.getGroup(groupDn);
            result = { json: groupData, pairedItem: { item: itemIndex } };
          } else if (resource === 'group' && operation === 'list') {
            const groupSearchFilter = this.getNodeParameter('groupSearchFilter', itemIndex, '') as string;
            const groupFilterType = this.getNodeParameter('groupFilterType', itemIndex, 'all') as string;
            const groupFilterScope = this.getNodeParameter('groupFilterScope', itemIndex, 'all') as string;
            const groupMaxResults = this.getNodeParameter('groupMaxResults', itemIndex, 100) as number;

            const groups = await client.listGroups({
              searchFilter: groupSearchFilter || undefined,
              groupType: groupFilterType as any,
              scope: groupFilterScope as any,
              maxResults: groupMaxResults,
            });

            result = { json: { groups, count: groups.length }, pairedItem: { item: itemIndex } };
          } else if (resource === 'group' && operation === 'modify') {
            const groupDn = this.getNodeParameter('groupDn', itemIndex) as string;
            const groupAttributes = this.getNodeParameter('groupAttributes', itemIndex, {}) as any;

            const attributes: Record<string, string> = {};
            if (groupAttributes.attribute && Array.isArray(groupAttributes.attribute)) {
              for (const attr of groupAttributes.attribute) {
                attributes[attr.name] = attr.value;
              }
            }

            const modifyResult = await client.modifyGroup(groupDn, attributes);
            result = { json: modifyResult, pairedItem: { item: itemIndex } };
          } else if (resource === 'group' && operation === 'delete') {
            const groupDn = this.getNodeParameter('groupDn', itemIndex) as string;
            const deleteResult = await client.deleteGroup(groupDn);
            result = { json: deleteResult, pairedItem: { item: itemIndex } };
          } else if (resource === 'group' && operation === 'addMember') {
            result = await addGroupMember.call(this, client, itemIndex);
          } else if (resource === 'group' && operation === 'removeMember') {
            result = await removeGroupMember.call(this, client, itemIndex);
          } else if (resource === 'ou' && operation === 'create') {
            const ouName = this.getNodeParameter('ouName', itemIndex) as string;
            const ouParentDn = this.getNodeParameter('ouParentDn', itemIndex) as string;
            const ouDescription = this.getNodeParameter('ouDescription', itemIndex, '') as string;

            const ouResult = await client.createOU(ouName, ouParentDn, ouDescription || undefined);
            result = { json: ouResult, pairedItem: { item: itemIndex } };
          } else if (resource === 'ou' && operation === 'get') {
            const ouDn = this.getNodeParameter('ouDn', itemIndex) as string;
            const ouData = await client.getOU(ouDn);
            result = { json: ouData, pairedItem: { item: itemIndex } };
          } else if (resource === 'ou' && operation === 'list') {
            const ouParentDnList = this.getNodeParameter('ouParentDnList', itemIndex, '') as string;
            const ouSearchFilter = this.getNodeParameter('ouSearchFilter', itemIndex, '') as string;

            const ous = await client.listOUs(ouParentDnList || undefined, ouSearchFilter || undefined);
            result = { json: { ous, count: ous.length }, pairedItem: { item: itemIndex } };
          } else if (resource === 'ou' && operation === 'modify') {
            const ouDn = this.getNodeParameter('ouDn', itemIndex) as string;
            const ouAttributes = this.getNodeParameter('ouAttributes', itemIndex, {}) as any;

            const attributes: Record<string, string> = {};
            if (ouAttributes.attribute && Array.isArray(ouAttributes.attribute)) {
              for (const attr of ouAttributes.attribute) {
                attributes[attr.name] = attr.value;
              }
            }

            const modifyResult = await client.modifyOU(ouDn, attributes);
            result = { json: modifyResult, pairedItem: { item: itemIndex } };
          } else if (resource === 'ou' && operation === 'delete') {
            const ouDn = this.getNodeParameter('ouDn', itemIndex) as string;
            const deleteResult = await client.deleteOU(ouDn);
            result = { json: deleteResult, pairedItem: { item: itemIndex } };
          } else {
            throw new NodeOperationError(
              this.getNode(),
              `Unsupported operation: ${resource}.${operation}`,
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
