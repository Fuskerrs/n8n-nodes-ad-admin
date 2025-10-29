const { Client, Attribute, Change } = require('/usr/local/lib/node_modules/n8n-nodes-ad-admin/node_modules/ldapts');

async function testFinalFix() {
    console.log('🎯 Testing FINAL FIX for change.write error...\n');

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
        console.log('1️⃣ Connecting to LDAPS...');
        await client.bind(config.bindDn, config.password);
        console.log('✅ Connected successfully!\n');

        // Test user creation
        const testUser = {
            cn: 'Test Final Fix',
            samAccountName: 'testfinal',
            userPrincipalName: 'testfinal@yaz.lab',
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
            sn: 'Fix',
            givenName: 'Test Final',
            displayName: testUser.cn,
            userAccountControl: '514'
        });
        console.log('✅ User created successfully!\n');

        // Set password using Change class
        console.log('3️⃣ Setting password with Change class...');
        const password = 'TempPass123!';
        const quoted = `"${password}"`;
        const pwdBuffer = Buffer.from(quoted, 'utf16le');

        await client.modify(dn, new Change({
            operation: 'replace',
            modification: new Attribute({
                type: 'unicodePwd',
                values: [pwdBuffer]
            })
        }));
        console.log('✅ Password set successfully!\n');

        // Force password change using Change class
        console.log('4️⃣ Setting pwdLastSet to 0 with Change class...');
        await client.modify(dn, new Change({
            operation: 'replace',
            modification: new Attribute({
                type: 'pwdLastSet',
                values: ['0']
            })
        }));
        console.log('✅ pwdLastSet set successfully!\n');

        // Enable user using Change class
        console.log('5️⃣ Enabling user with Change class...');
        await client.modify(dn, new Change({
            operation: 'replace',
            modification: new Attribute({
                type: 'userAccountControl',
                values: ['512']
            })
        }));
        console.log('✅ User enabled successfully!\n');

        console.log('🎉 ALL TESTS PASSED! The change.write error is FIXED!');
        console.log('🚀 User creation with Change class works perfectly!');

    } catch (error) {
        console.error('❌ Error occurred:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);

        if (error.message && error.message.includes('change.write')) {
            console.error('\n💥 The change.write error still exists!');
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

testFinalFix();