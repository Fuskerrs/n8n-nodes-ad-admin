const { Client, Attribute } = require('/usr/local/lib/node_modules/n8n-nodes-ad-admin/node_modules/ldapts');

async function testUserCreation() {
    console.log('🔍 Testing LDAPS connection and user creation...\n');

    const config = {
        url: 'ldaps://DC-01.yaz.lab:636',
        bindDn: 'CN=n8n,CN=Users,DC=yaz,DC=lab',
        password: '#12!!KW?tGc/',
        tlsOptions: {
            rejectUnauthorized: true
        },
        timeout: 10000,
        connectTimeout: 10000
    };

    const client = new Client(config);

    try {
        console.log('1️⃣ Testing connection...');
        await client.bind(config.bindDn, config.password);
        console.log('✅ Connection successful!\n');

        // Test user creation
        const testUser = {
            cn: 'Test Debug User',
            samAccountName: 'testdebug2',
            userPrincipalName: 'testdebug2@yaz.lab',
            parentOuDn: 'CN=Users,DC=yaz,DC=lab'
        };

        const dn = `CN=${testUser.cn},${testUser.parentOuDn}`;
        console.log(`2️⃣ Creating user: ${dn}`);

        // Create user
        await client.add(dn, {
            objectClass: ['top', 'person', 'organizationalPerson', 'user'],
            cn: testUser.cn,
            sAMAccountName: testUser.samAccountName,
            userPrincipalName: testUser.userPrincipalName,
            sn: 'User',
            givenName: 'Test Debug',
            displayName: testUser.cn,
            userAccountControl: '514'
        });
        console.log('✅ User created successfully!\n');

        // Set password
        console.log('3️⃣ Setting password...');
        const password = 'TempPass123!';
        const quoted = `"${password}"`;
        const pwdBuffer = Buffer.from(quoted, 'utf16le');

        await client.modify(dn, {
            operation: 'replace',
            modification: new Attribute({
                type: 'unicodePwd',
                values: [pwdBuffer]
            })
        });
        console.log('✅ Password set successfully!\n');

        // Force password change
        console.log('4️⃣ Setting pwdLastSet to 0 (force password change)...');
        await client.modify(dn, {
            operation: 'replace',
            modification: new Attribute({
                type: 'pwdLastSet',
                values: ['0']
            })
        });
        console.log('✅ pwdLastSet set successfully!\n');

        // Enable user
        console.log('5️⃣ Enabling user account...');
        await client.modify(dn, {
            operation: 'replace',
            modification: new Attribute({
                type: 'userAccountControl',
                values: ['512']
            })
        });
        console.log('✅ User enabled successfully!\n');

        console.log('🎉 All tests passed! User creation completed successfully.');

    } catch (error) {
        console.error('❌ Error occurred:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);

        if (error.message && error.message.includes('change.write')) {
            console.error('\n🔍 This is the "change.write is not a function" error!');
            console.error('The issue is in how we pass the change object to client.modify()');
        }
    } finally {
        try {
            await client.unbind();
            console.log('\n🔐 Connection closed.');
        } catch (e) {
            // Ignore unbind errors
        }
    }
}

testUserCreation();