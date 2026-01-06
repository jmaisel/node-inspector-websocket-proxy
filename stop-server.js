#!/usr/bin/env node
/**
 * Stop Script - Gracefully stops the running test server
 *
 * This script attempts to stop the server by:
 * 1. Finding the server process by looking for 'start-server.js'
 * 2. Sending a SIGTERM signal for graceful shutdown
 * 3. Waiting briefly to confirm shutdown
 * 4. Using SIGKILL if graceful shutdown fails
 */

const { execSync } = require('child_process');

function findServerProcess() {
    try {
        // Find process ID of running server
        const result = execSync('pgrep -f "node.*start-server.js"', { encoding: 'utf8' }).trim();
        return result.split('\n').filter(pid => pid.length > 0);
    } catch (err) {
        // pgrep returns exit code 1 if no processes found
        return [];
    }
}

function stopProcess(pid, signal = 'TERM') {
    try {
        process.kill(parseInt(pid), `SIG${signal}`);
        return true;
    } catch (err) {
        console.error(`Failed to send SIG${signal} to process ${pid}:`, err.message);
        return false;
    }
}

function isProcessRunning(pid) {
    try {
        process.kill(parseInt(pid), 0);
        return true;
    } catch (err) {
        return false;
    }
}

async function main() {
    console.log('Looking for running server processes...');

    const pids = findServerProcess();

    if (pids.length === 0) {
        console.log('No server processes found.');
        return;
    }

    console.log(`Found ${pids.length} server process(es): ${pids.join(', ')}`);

    for (const pid of pids) {
        console.log(`\nStopping process ${pid}...`);

        // Send SIGTERM for graceful shutdown
        if (!stopProcess(pid, 'TERM')) {
            continue;
        }

        console.log('Sent SIGTERM, waiting for graceful shutdown...');

        // Wait up to 5 seconds for graceful shutdown
        let stopped = false;
        for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!isProcessRunning(pid)) {
                stopped = true;
                break;
            }
        }

        if (stopped) {
            console.log(`Process ${pid} stopped gracefully.`);
        } else {
            console.log(`Process ${pid} did not stop gracefully, sending SIGKILL...`);
            stopProcess(pid, 'KILL');
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!isProcessRunning(pid)) {
                console.log(`Process ${pid} forcefully stopped.`);
            } else {
                console.error(`Failed to stop process ${pid}.`);
            }
        }
    }

    console.log('\nServer shutdown complete.');
}

main().catch(err => {
    console.error('Error stopping server:', err);
    process.exit(1);
});