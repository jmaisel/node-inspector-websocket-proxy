const http = require('http');

// Test the demo-project endpoint
const postData = JSON.stringify({
    targetPath: 'test-demo-copy'
});

const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/workspace/demo-project',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('Testing POST /workspace/demo-project endpoint...\n');

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, JSON.stringify(res.headers, null, 2));

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\nResponse body:');
        try {
            console.log(JSON.stringify(JSON.parse(data), null, 2));
        } catch (e) {
            console.log(data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();