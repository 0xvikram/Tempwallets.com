import WebSocket from 'ws';

const WS_URL = 'wss://clearnet-sandbox.yellow.com/ws';

console.log('Connecting to Yellow Network...');
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✓ Connected');

    // Send config request (unsigned - should work for public config)
    const request = {
        req: [1, 'get_config', {}, Date.now()],
        sig: []
    };

    ws.send(JSON.stringify(request));
});

let messageCount = 0;

ws.on('message', (data) => {
    try {
        messageCount++;
        const response = JSON.parse(data.toString());

        console.log(`\n=== RAW RESPONSE #${messageCount} ===`);
        console.log(`Response type: ${response.res ? response.res[1] : 'unknown'}`);
        console.log(JSON.stringify(response, null, 2));

        if (response.res && response.res[2]) {
            const config = response.res[2];

            console.log('\n=== YELLOW NETWORK CONFIG ===\n');

            if (config.networks) {
                console.log('NETWORKS:');
                config.networks.forEach(network => {
                    console.log(`\n  ${network.name || 'Unknown'} (chainId: ${network.chain_id})`);
                    console.log(`    Custody:     ${network.custody_address || 'N/A'}`);
                    console.log(`    Adjudicator: ${network.adjudicator_address || 'N/A'}`);
                    console.log(`    Status:      ${network.status || 'N/A'}`);
                });
            } else {
                console.log('NO NETWORKS FOUND IN CONFIG');
                console.log('Config keys:', Object.keys(config));
            }

            // Look specifically for Sepolia and Base
            console.log('\n\n=== SPECIFIC NETWORKS ===');
            const sepolia = config.networks?.find(n => n.chain_id === 11155111);
            const base = config.networks?.find(n => n.chain_id === 8453);

            console.log(`\nSepolia (11155111): ${sepolia ? '✅ FOUND' : '❌ NOT FOUND'}`);
            if (sepolia) {
                console.log(`  Custody:     ${sepolia.custody_address}`);
                console.log(`  Adjudicator: ${sepolia.adjudicator_address}`);
            }

            console.log(`\nBase (8453): ${base ? '✅ FOUND' : '❌ NOT FOUND'}`);
            if (base) {
                console.log(`  Custody:     ${base.custody_address}`);
                console.log(`  Adjudicator: ${base.adjudicator_address}`);
            }

            // If this was the config message, close
            if (response.res[1] === 'config' || config.networks) {
                ws.close();
                process.exit(0);
            }
        }

        // Don't close - wait for more messages
    } catch (err) {
        console.error('Error parsing response:', err);
        ws.close();
        process.exit(1);
    }
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    process.exit(1);
});

setTimeout(() => {
    console.error('Timeout - no response');
    ws.close();
    process.exit(1);
}, 10000);
