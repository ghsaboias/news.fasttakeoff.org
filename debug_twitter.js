#!/usr/bin/env node

// Debug script to test Twitter functionality step by step
import fetch from 'node-fetch';

const WRANGLER_URL = 'http://localhost:8787';

async function testStep(stepName, testFn) {
    console.log(`\n🔍 Testing: ${stepName}`);
    console.log('─'.repeat(50));
    try {
        const result = await testFn();
        console.log('✅ SUCCESS:', result);
        return result;
    } catch (error) {
        console.log('❌ FAILED:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response body:', await error.response.text());
        }
        throw error;
    }
}

async function main() {
    console.log('🐦 Twitter Integration Debug Tool');
    console.log('='.repeat(50));

    // Test 1: Check if wrangler is responding
    await testStep('Wrangler Server Connectivity', async () => {
        const response = await fetch(`${WRANGLER_URL}/api/channels`);
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        return 'Server is responding';
    });

    // Test 2: Check KV access (Twitter tokens)
    await testStep('KV Access - Twitter Tokens', async () => {
        const response = await fetch(`${WRANGLER_URL}/api/test-twitter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                test_mode: 'kv_only',
                report: {
                    headline: 'KV Test',
                    body: 'Test',
                    reportId: 'kv-test',
                    channelId: 'test',
                    generatedAt: new Date().toISOString(),
                    city: 'Test'
                }
            })
        });
        
        const data = await response.json();
        if (!response.ok) {
            const error = new Error(data.error || 'Unknown error');
            error.response = response;
            throw error;
        }
        return data;
    });
}

main().catch(error => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
});
