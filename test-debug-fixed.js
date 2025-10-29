const { Client, Attribute } = require('/usr/local/lib/node_modules/n8n-nodes-ad-admin/node_modules/ldapts');

async function testUserCreationFixed() {
    console.log('🔍 Testing FIXED LDAPS connection and user creation...\n');

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
            cn: 'Test Debug Fixed',
            samAccountName: 'testfixed',
            userPrincipalName: 'testfixed@yaz.lab',
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
            sn: 'Fixed',
            givenName: 'Test Debug',
            displayName: testUser.cn,
            userAccountControl: '514'
        });
        console.log('✅ User created successfully!\n');

        // Set password - FIXED VERSION
        console.log('3️⃣ Setting password (FIXED)...');
        const password = 'TempPass123!';
        const quoted = `"${password}"`;
        const pwdBuffer = Buffer.from(quoted, 'utf16le');

        // ✅ CORRECT: Pass changes as an array, not individual objects
        await client.modify(dn, [{
            operation: 'replace',
            modification: new Attribute({
                type: 'unicodePwd',
                values: [pwdBuffer]
            })
        }]);
        console.log('✅ Password set successfully!\n');

        // Force password change - FIXED VERSION
        console.log('4️⃣ Setting pwdLastSet to 0 (FIXED)...');
        // ✅ CORRECT: Pass changes as an array
        await client.modify(dn, [{
            operation: 'replace',
            modification: new Attribute({
                type: 'pwdLastSet',
                values: ['0']
            })
        }]);
        console.log('✅ pwdLastSet set successfully!\n');

        // Enable user - FIXED VERSION
        console.log('5️⃣ Enabling user account (FIXED)...');
        // ✅ CORRECT: Pass changes as an array
        await client.modify(dn, [{
            operation: 'replace',
            modification: new Attribute({
                type: 'userAccountControl',
                values: ['512']
            })
        }]);
        console.log('✅ User enabled successfully!\n');

        console.log('🎉 All tests passed! User creation completed successfully with FIXES!');

    } catch (error) {
        console.error('❌ Error occurred:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        try {
            await client.unbind();
            console.log('\n🔐 Connection closed.');
        } catch (e) {
            // Ignore unbind errors
        }
    }
}

testUserCreationFixed();