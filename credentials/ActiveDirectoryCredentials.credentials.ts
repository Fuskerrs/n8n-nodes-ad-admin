import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class ActiveDirectoryCredentials implements ICredentialType {
  name = 'activeDirectoryApi';
  displayName = 'Active Directory (LDAP/LDAPS)';
  properties: INodeProperties[] = [
    {
      displayName: 'Connection Type',
      name: 'connectionType',
      type: 'options',
      options: [
        {
          name: 'LDAPS (Secure - Port 636)',
          value: 'ldaps',
          description: 'Secure SSL/TLS connection (recommended)',
        },
        {
          name: 'LDAP (Non-secure - Port 389)',
          value: 'ldap',
          description: 'Unencrypted connection (⚠️ passwords in clear text)',
        },
      ],
      default: 'ldaps',
      description: 'Connection type to Active Directory server',
    },
    {
      displayName: 'Host Type',
      name: 'hostType',
      type: 'options',
      options: [
        {
          name: 'DNS Name',
          value: 'dns',
          description: 'Use a domain name (e.g., DC-01.domain.local)',
        },
        {
          name: 'IP Address',
          value: 'ip',
          description: 'Use an IP address (e.g., 192.168.1.10)',
        },
      ],
      default: 'dns',
      description: 'Address type for connection',
    },
    {
      displayName: 'Host',
      name: 'host',
      type: 'string',
      default: '',
      placeholder: 'DC-01.domain.local',
      displayOptions: {
        show: {
          hostType: ['dns'],
        },
      },
      description: 'DNS name of the domain controller',
      required: true,
    },
    {
      displayName: 'IP Address',
      name: 'host',
      type: 'string',
      default: '',
      placeholder: '192.168.1.10',
      displayOptions: {
        show: {
          hostType: ['ip'],
        },
      },
      description: 'IP address of the domain controller',
      required: true,
    },
    {
      displayName: 'Port',
      name: 'port',
      type: 'number',
      default: 636,
      description: 'Port LDAPS (636) ou LDAP (389)',
      required: true,
      hint: 'LDAPS: 636, LDAP: 389',
    },
    {
      displayName: 'Base DN',
      name: 'baseDn',
      type: 'string',
      default: '',
      placeholder: 'DC=example,DC=local',
      description: 'Base DN for directory searches',
      required: true,
    },
    {
      displayName: 'Bind DN',
      name: 'bindDn',
      type: 'string',
      default: '',
      placeholder: 'CN=Administrator,CN=Users,DC=example,DC=local',
      description: 'Full DN of service account with administrative rights',
      required: true,
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Service account password',
    },
    {
      displayName: 'TLS Certificate Validation',
      name: 'tlsValidation',
      type: 'options',
      displayOptions: {
        show: {
          connectionType: ['ldaps'],
        },
      },
      options: [
        {
          name: 'System CA Bundle',
          value: 'system',
          description: 'Use system CA bundle (default)',
        },
        {
          name: 'Skip Validation',
          value: 'skip',
          description: '⚠️ Skip validation (self-signed certificates only)',
        },
        {
          name: 'Custom Certificate',
          value: 'custom',
          description: 'Provide custom CA certificate',
        },
      ],
      default: 'system',
      description: 'TLS certificate validation mode',
    },
    {
      displayName: 'Root CA Certificate',
      name: 'customCertificate',
      type: 'string',
      typeOptions: {
        password: false,
        rows: 10,
      },
      displayOptions: {
        show: {
          connectionType: ['ldaps'],
          tlsValidation: ['custom'],
        },
      },
      default: '',
      placeholder: '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIQPTxrAJiCX4pIRFX3zmhqoDANBgkqhkiG...\n-----END CERTIFICATE-----',
      description: 'Root CA certificate in PEM format (paste complete content)',
    },
    {
      displayName: 'Connect Timeout (ms)',
      name: 'timeout',
      type: 'number',
      default: 10000,
      description: 'Connection timeout in milliseconds',
    },
    {
      displayName: 'Warning',
      name: 'warningNotice',
      type: 'notice',
      displayOptions: {
        show: {
          connectionType: ['ldap'],
        },
      },
      default: '',
      description: '⚠️ WARNING: Unsecured LDAP transmits passwords in clear text. Use LDAPS in production!',
    },
    {
      displayName: 'Password Operations Notice',
      name: 'passwordNotice',
      type: 'notice',
      displayOptions: {
        show: {
          connectionType: ['ldap'],
        },
      },
      default: '',
      description: '🔒 Password operations (Create, Reset Password) require LDAPS and will fail with LDAP.',
    },
  ];
}
