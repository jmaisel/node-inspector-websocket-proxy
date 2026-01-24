#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const junitDir = path.join(__dirname, 'reports', 'junit');
const htmlDir = path.join(__dirname, 'reports', 'html');
const outputFile = path.join(htmlDir, 'test-report.html');

if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir, { recursive: true });
}

function parseJUnitXML(xmlContent) {
    const testcases = [];

    // Extract testsuite info
    const testsuiteRegex = /<testsuite[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/testsuite>/g;
    let suiteMatch;

    while ((suiteMatch = testsuiteRegex.exec(xmlContent)) !== null) {
        const suiteName = suiteMatch[1];
        const suiteContent = suiteMatch[2];

        // Extract testcases within this suite
        const testcaseRegex = /<testcase([^>]*)>([\s\S]*?)<\/testcase>/g;
        let caseMatch;

        while ((caseMatch = testcaseRegex.exec(suiteContent)) !== null) {
            const attrs = caseMatch[1];
            const content = caseMatch[2];

            const classNameMatch = attrs.match(/classname="([^"]*)"/);
            const nameMatch = attrs.match(/\sname="([^"]*)"/);  // Add \s to avoid matching "className"
            const timeMatch = attrs.match(/time="([^"]*)"/);

            const className = classNameMatch ? classNameMatch[1] : '';
            const testName = nameMatch ? nameMatch[1] : '';
            const time = timeMatch ? timeMatch[1] : '0';

            // Check for failure (can be self-closing or with content)
            const failureMatch = content.match(/<failure[^>]*message="([^"]*)"[^>]*\/?>/);
            const errorMatch = content.match(/<system-err[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/system-err>/);

            const testcase = {
                suite: suiteName,
                className: className,
                name: testName,
                time: parseFloat(time),
                failed: !!failureMatch,
                failureMessage: failureMatch ? decodeXMLEntities(failureMatch[1]) : null,
                errorDetails: errorMatch ? errorMatch[1].trim() : null
            };

            testcases.push(testcase);
        }
    }

    return testcases;
}

function decodeXMLEntities(str) {
    return str
        .replace(/&quot;/g, '"')
        .replace(/&#xA;/g, '\n')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function parseAllJUnitFiles() {
    if (!fs.existsSync(junitDir)) {
        console.log('No JUnit reports found');
        return [];
    }

    const files = fs.readdirSync(junitDir).filter(f => f.endsWith('.xml'));
    let allTestcases = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(junitDir, file), 'utf8');
        const testcases = parseJUnitXML(content);
        allTestcases = allTestcases.concat(testcases);
    });

    return allTestcases;
}

function generateHTML(testcases) {
    const total = testcases.length;
    const passed = testcases.filter(t => !t.failed).length;
    const failed = testcases.filter(t => t.failed).length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const totalTime = testcases.reduce((sum, t) => sum + t.time, 0).toFixed(2);

    // Group by suite
    const suites = {};
    testcases.forEach(tc => {
        if (!suites[tc.suite]) {
            suites[tc.suite] = [];
        }
        suites[tc.suite].push(tc);
    });

    const suiteNames = Object.keys(suites).sort();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebDriver Test Report - BadgerBox</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 8px;
        }
        .header p {
            opacity: 0.9;
            font-size: 13px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
            padding: 30px 40px;
            background: #fafafa;
            border-bottom: 1px solid #e5e7eb;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
            border-left: 3px solid #667eea;
        }
        .stat-card.passed { border-left-color: #10b981; }
        .stat-card.failed { border-left-color: #ef4444; }
        .stat-number {
            font-size: 36px;
            font-weight: bold;
            margin: 8px 0;
        }
        .stat-card.passed .stat-number { color: #10b981; }
        .stat-card.failed .stat-number { color: #ef4444; }
        .stat-card.total .stat-number { color: #667eea; }
        .stat-label {
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 500;
        }
        .controls {
            padding: 20px 40px;
            background: white;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            gap: 15px;
            align-items: center;
        }
        .filter-btn {
            padding: 8px 16px;
            border: 1px solid #d1d5db;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }
        .filter-btn:hover {
            background: #f3f4f6;
        }
        .filter-btn.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
        .search-box {
            flex: 1;
            max-width: 400px;
        }
        .search-box input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 13px;
        }
        .content {
            padding: 20px 40px 40px;
        }
        .suite {
            margin-bottom: 30px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
        }
        .suite-header {
            background: #f9fafb;
            padding: 15px 20px;
            border-bottom: 1px solid #e5e7eb;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .suite-header:hover {
            background: #f3f4f6;
        }
        .suite-title {
            font-size: 16px;
            font-weight: 600;
            color: #111827;
        }
        .suite-stats {
            font-size: 13px;
            color: #6b7280;
        }
        .suite-stats .passed { color: #10b981; font-weight: 600; }
        .suite-stats .failed { color: #ef4444; font-weight: 600; }
        .test {
            padding: 12px 20px;
            border-bottom: 1px solid #f3f4f6;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 15px;
        }
        .test:last-child {
            border-bottom: none;
        }
        .test.passed {
            background: #f0fdf4;
        }
        .test.failed {
            background: #fef2f2;
        }
        .test-name {
            flex: 1;
            font-size: 14px;
            color: #374151;
        }
        .test-status {
            font-size: 12px;
            font-weight: 600;
            padding: 3px 10px;
            border-radius: 3px;
            white-space: nowrap;
        }
        .test-status.passed {
            background: #10b981;
            color: white;
        }
        .test-status.failed {
            background: #ef4444;
            color: white;
        }
        .test-time {
            font-size: 12px;
            color: #9ca3af;
            white-space: nowrap;
        }
        .failure-details {
            margin-top: 10px;
            padding: 12px;
            background: #fff;
            border: 1px solid #fecaca;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }
        .failure-message {
            color: #dc2626;
            margin-bottom: 8px;
            white-space: pre-wrap;
        }
        .error-stack {
            color: #7f1d1d;
            white-space: pre-wrap;
            font-size: 11px;
        }
        .no-results {
            text-align: center;
            padding: 40px;
            color: #6b7280;
        }
        .hidden {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>WebDriver Test Report</h1>
            <p>Generated: ${new Date().toLocaleString()} | Duration: ${totalTime}s</p>
        </div>

        <div class="summary">
            <div class="stat-card total">
                <div class="stat-label">Total Tests</div>
                <div class="stat-number">${total}</div>
            </div>
            <div class="stat-card passed">
                <div class="stat-label">Passed</div>
                <div class="stat-number">${passed}</div>
            </div>
            <div class="stat-card failed">
                <div class="stat-label">Failed</div>
                <div class="stat-number">${failed}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Pass Rate</div>
                <div class="stat-number" style="color: ${passRate >= 90 ? '#10b981' : passRate >= 70 ? '#f59e0b' : '#ef4444'}">${passRate}%</div>
            </div>
        </div>

        <div class="controls">
            <button class="filter-btn active" data-filter="all">All Tests</button>
            <button class="filter-btn" data-filter="failed">Failed Only</button>
            <button class="filter-btn" data-filter="passed">Passed Only</button>
            <div class="search-box">
                <input type="text" id="search" placeholder="Search tests...">
            </div>
        </div>

        <div class="content">
            ${suiteNames.map(suiteName => {
                const tests = suites[suiteName];
                const suitePassed = tests.filter(t => !t.failed).length;
                const suiteFailed = tests.filter(t => t.failed).length;

                return `
                    <div class="suite">
                        <div class="suite-header" onclick="toggleSuite(this)">
                            <div class="suite-title">${escapeHtml(suiteName)}</div>
                            <div class="suite-stats">
                                <span class="passed">${suitePassed} passed</span> /
                                <span class="failed">${suiteFailed} failed</span>
                            </div>
                        </div>
                        <div class="suite-tests">
                            ${tests.map(test => `
                                <div class="test ${test.failed ? 'failed' : 'passed'}" data-status="${test.failed ? 'failed' : 'passed'}">
                                    <div class="test-name">
                                        ${escapeHtml(test.name)}
                                        ${test.failed && test.failureMessage ? `
                                            <div class="failure-details">
                                                <div class="failure-message">${escapeHtml(test.failureMessage)}</div>
                                                ${test.errorDetails ? `<div class="error-stack">${escapeHtml(test.errorDetails)}</div>` : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div style="display: flex; gap: 10px; align-items: center;">
                                        <div class="test-time">${test.time.toFixed(3)}s</div>
                                        <div class="test-status ${test.failed ? 'failed' : 'passed'}">${test.failed ? 'FAIL' : 'PASS'}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    </div>

    <script>
        // Filter functionality
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const filter = btn.dataset.filter;
                document.querySelectorAll('.test').forEach(test => {
                    if (filter === 'all') {
                        test.classList.remove('hidden');
                    } else {
                        if (test.dataset.status === filter) {
                            test.classList.remove('hidden');
                        } else {
                            test.classList.add('hidden');
                        }
                    }
                });

                // Hide empty suites
                document.querySelectorAll('.suite').forEach(suite => {
                    const visibleTests = suite.querySelectorAll('.test:not(.hidden)');
                    if (visibleTests.length === 0) {
                        suite.classList.add('hidden');
                    } else {
                        suite.classList.remove('hidden');
                    }
                });
            });
        });

        // Search functionality
        document.getElementById('search').addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.test').forEach(test => {
                const text = test.textContent.toLowerCase();
                if (text.includes(query)) {
                    test.classList.remove('hidden');
                } else {
                    test.classList.add('hidden');
                }
            });

            // Hide empty suites
            document.querySelectorAll('.suite').forEach(suite => {
                const visibleTests = suite.querySelectorAll('.test:not(.hidden)');
                if (visibleTests.length === 0) {
                    suite.classList.add('hidden');
                } else {
                    suite.classList.remove('hidden');
                }
            });
        });

        function toggleSuite(header) {
            const tests = header.nextElementSibling;
            if (tests.style.display === 'none') {
                tests.style.display = 'block';
            } else {
                tests.style.display = 'none';
            }
        }
    </script>
</body>
</html>`;

    fs.writeFileSync(outputFile, html);
    console.log(`\n✓ HTML report generated: ${outputFile}`);
    console.log(`  Tests: ${total} | Passed: ${passed} | Failed: ${failed} | Pass Rate: ${passRate}%`);

    console.log(`\n📋 All Tests by Suite:\n`);
    suiteNames.forEach(suiteName => {
        const tests = suites[suiteName];
        const suitePassed = tests.filter(t => !t.failed).length;
        const suiteFailed = tests.filter(t => t.failed).length;

        console.log(`\n${suiteName} (${suitePassed}/${tests.length} passed)`);
        tests.forEach(test => {
            const status = test.failed ? '✗' : '✓';
            console.log(`  ${status} ${test.name}`);
            if (test.failed && test.failureMessage) {
                const shortMsg = test.failureMessage.split('\n')[0].substring(0, 80);
                console.log(`     └─ ${shortMsg}`);
            }
        });
    });

    console.log(`Open file://${outputFile} in your browser to view\n`);
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Main
const testcases = parseAllJUnitFiles();
generateHTML(testcases);
