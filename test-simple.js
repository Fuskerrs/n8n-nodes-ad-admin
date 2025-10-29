const { Client, Attribute, Change } = require('/usr/local/lib/node_modules/n8n-nodes-ad-admin/node_modules/ldapts');

async function testSimple() {
    console.log('🧪 Testing different approaches to modify...\n');

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
        console.log('🔗 Connecting...');
        await client.bind(config.bindDn, config.password);
        console.log('✅ Connected!\n');

        const dn = 'CN=Test Debug User,CN=Users,DC=yaz,DC=lab';

        console.log('📄 Available classes:');
        console.log('- Client:', typeof Client);
        console.log('- Attribute:', typeof Attribute);
        console.log('- Change:', typeof Change);

        if (Change) {
            console.log('\n🔧 Testing with Change class...');
            const change = new Change({
                operation: 'replace',
                modification: new Attribute({
                    type: 'pwdLastSet',
                    values: ['0']
                })
            });

            console.log('Change object:', change);
            console.log('Change methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(change)));

            await client.modify(dn, change);
            console.log('✅ Change class worked!');
        } else {
            console.log('\n❌ Change class not available');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        try {
            await client.unbind();
        } catch (e) {}
    }
}

testSimple();