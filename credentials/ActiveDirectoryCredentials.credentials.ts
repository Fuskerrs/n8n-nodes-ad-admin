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
          description: 'Connexion sécurisée SSL/TLS (recommandé)',
        },
        {
          name: 'LDAP (Non-secure - Port 389)',
          value: 'ldap',
          description: 'Connexion non chiffrée (⚠️ mot de passe en clair)',
        },
      ],
      default: 'ldaps',
      description: 'Type de connexion au serveur Active Directory',
    },
    {
      displayName: 'Host Type',
      name: 'hostType',
      type: 'options',
      options: [
        {
          name: 'DNS Name',
          value: 'dns',
          description: 'Utiliser un nom de domaine (ex: DC-01.domain.local)',
        },
        {
          name: 'IP Address',
          value: 'ip',
          description: 'Utiliser une adresse IP (ex: 192.168.1.10)',
        },
      ],
      default: 'dns',
      description: 'Type d\'adresse pour la connexion',
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
      description: 'Nom DNS du contrôleur de domaine',
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
      description: 'Adresse IP du contrôleur de domaine',
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
      description: 'DN de base pour les recherches dans l\'annuaire',
      required: true,
    },
    {
      displayName: 'Bind DN',
      name: 'bindDn',
      type: 'string',
      default: '',
      placeholder: 'CN=Administrator,CN=Users,DC=example,DC=local',
      description: 'DN complet du compte de service avec droits d\'administration',
      required: true,
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Mot de passe du compte de service',
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
          description: 'Utiliser les certificats CA du système (défaut)',
        },
        {
          name: 'Skip Validation',
          value: 'skip',
          description: '⚠️ Ignorer la validation (certificats auto-signés uniquement)',
        },
        {
          name: 'Custom Certificate',
          value: 'custom',
          description: 'Fournir un certificat CA personnalisé',
        },
      ],
      default: 'system',
      description: 'Mode de validation du certificat TLS',
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
      description: 'Certificat CA racine au format PEM (coller le contenu complet)',
    },
    {
      displayName: 'Connect Timeout (ms)',
      name: 'timeout',
      type: 'number',
      default: 10000,
      description: 'Délai d\'attente de connexion en millisecondes',
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
      description: '⚠️ ATTENTION: LDAP non-sécurisé transmet les mots de passe en clair. Utilisez LDAPS en production !',
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
      description: '🔒 Les opérations de mot de passe (Create, Reset Password) nécessitent LDAPS et échoueront en LDAP.',
    },
  ];
}
