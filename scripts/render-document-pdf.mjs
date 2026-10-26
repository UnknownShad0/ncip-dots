// No browser automation dependency: Chromium's DevTools Protocol travels over
// inherited pipes. No debugging port or application HTTP session is exposed.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { accessSync, constants as fsConstants } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const options = JSON.parse(await readFile(process.argv[2], 'utf8'));
const documentUrl = pathToFileURL(path.resolve(options.html)).href;
await mkdir(options.profile, { recursive: true, mode: 0o700 });
await mkdir(options.crashDumps, { recursive: true, mode: 0o700 });
const browserEnvironment = { ...process.env, ...(options.browserEnv ?? {}) };
if (process.platform === 'win32') {
    if (!browserEnvironment.USERPROFILE && browserEnvironment.HOMEDRIVE && browserEnvironment.HOMEPATH) {
        browserEnvironment.USERPROFILE = `${browserEnvironment.HOMEDRIVE}${browserEnvironment.HOMEPATH}`;
    }
    if (browserEnvironment.USERPROFILE) {
        browserEnvironment.APPDATA ||= path.join(browserEnvironment.USERPROFILE, 'AppData', 'Roaming');
        browserEnvironment.LOCALAPPDATA ||= path.join(browserEnvironment.USERPROFILE, 'AppData', 'Local');
        browserEnvironment.TEMP ||= path.join(browserEnvironment.USERPROFILE, 'AppData', 'Local', 'Temp');
        browserEnvironment.TMP ||= browserEnvironment.TEMP;
    }
    browserEnvironment.SystemRoot ||= browserEnvironment.WINDIR;
    browserEnvironment.WINDIR ||= browserEnvironment.SystemRoot;
}
const profilePathDiagnostics = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'TEMP', 'TMP'].map(name => {
        const value = browserEnvironment[name] || '';
        let exists = false;
        let writable = false;
        try { accessSync(value, fsConstants.F_OK); exists = true; } catch {}
        try { accessSync(value, fsConstants.W_OK); writable = true; } catch {}
        return [name, { path: value || '(missing)', exists, writable }];
    }),
);
const environmentSummary = `USERNAME=${browserEnvironment.USERNAME || '(missing)'}; USERDOMAIN=${browserEnvironment.USERDOMAIN || '(missing)'}; `
    + Object.entries(profilePathDiagnostics).map(([name, info]) => `${name}=${info.path} (exists: ${info.exists ? 'yes' : 'no'}, writable: ${info.writable ? 'yes' : 'no'})`).join('; ');
let invalidWindowsEnvironment = [];
if (process.platform === 'win32') {
    invalidWindowsEnvironment = ['SystemRoot', 'WINDIR', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'TEMP', 'TMP'].filter(name => {
        return !profilePathDiagnostics[name].exists;
    });
}
const isHeadlessShell = /chrome-headless-shell(?:\.exe)?$/i.test(options.browser);
const arguments_ = [
    isHeadlessShell ? '--headless' : '--headless=new',
    '--remote-debugging-pipe', `--user-data-dir=${options.profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    ...(!isHeadlessShell ? ['--disable-component-update'] : []),
    '--disable-default-apps', '--disable-sync', '--disable-extensions',
    '--disable-dev-shm-usage', '--metrics-recording-only',
    '--disable-crash-reporter', '--disable-breakpad', `--crash-dumps-dir=${options.crashDumps}`,
    '--noerrdialogs', '--hide-scrollbars', '--force-color-profile=srgb',
];
if (options.sandbox === false) arguments_.push('--no-sandbox');

let browser;
let sequence = 0;
let buffer = '';
let errorText = '';
let session;
let scriptError = '';
const pending = new Map();
const deadline = Date.now() + options.timeout * 1000;
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function command(method, params = {}, sessionId = session) {
    return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
            pending.delete(id);
            const diagnostics = errorText.trim();
            reject(new Error(`Chromium timed out during ${method}.${diagnostics ? ` ${diagnostics}` : ''}`));
        }, Math.max(1, Math.min(30000, deadline - Date.now())));
        pending.set(id, { resolve, reject, timer });
        browser.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
    });
}

function receive(message) {
    if (message.id) {
        const request = pending.get(message.id);
        if (!request) return;
        clearTimeout(request.timer);
        pending.delete(message.id);
        if (message.error) request.reject(new Error(`${message.error.message} (${message.id})`));
        else request.resolve(message.result);
    } else if (message.method === 'Fetch.requestPaused') {
        // The only non-data resource permitted is the exact generated document.
        // In particular, never allow content to fetch private files or URLs.
        const { requestId, request } = message.params;
        const allow = request.url === documentUrl || request.url.startsWith('data:');
        void command(allow ? 'Fetch.continueRequest' : 'Fetch.failRequest', {
            requestId, ...(!allow ? { errorReason: 'BlockedByClient' } : {}),
        }, message.sessionId).catch(() => {});
    } else if (message.method === 'Runtime.exceptionThrown') {
        scriptError = message.params.exceptionDetails.exception?.description
            ?? message.params.exceptionDetails.text ?? 'The document renderer failed.';
    }
}

try {
    if (invalidWindowsEnvironment.length) {
        throw new Error(`Invalid Windows browser environment: ${invalidWindowsEnvironment.join(', ')}.`);
    }
    browser = spawn(options.browser, arguments_, {
        stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
        env: browserEnvironment,
        windowsHide: true,
    });
    browser.stderr.on('data', chunk => { errorText = (errorText + chunk.toString()).slice(-4000); });
    browser.stdio[3].on('error', () => {});
    browser.stdio[4].setEncoding('utf8');
    browser.stdio[4].on('data', chunk => {
        buffer += chunk;
        let end;
        while ((end = buffer.indexOf('\0')) !== -1) {
            const json = buffer.slice(0, end);
            buffer = buffer.slice(end + 1);
            if (json) receive(JSON.parse(json));
        }
    });
    const failed = error => {
        for (const request of pending.values()) {
            clearTimeout(request.timer);
            request.reject(error);
        }
        pending.clear();
    };
    browser.on('error', error => failed(new Error(`Could not start Chromium: ${error.message}`)));
    browser.on('exit', code => failed(new Error(`Chromium exited (${code}). ${errorText}`)));

    const { targetId } = await command('Target.createTarget', { url: 'about:blank' }, null);
    ({ sessionId: session } = await command('Target.attachToTarget', { targetId, flatten: true }, null));
    await command('Page.enable');
    await command('Runtime.enable');
    await command('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await command('Emulation.setEmulatedMedia', { media: 'screen' });
    const navigation = await command('Page.navigate', { url: documentUrl });
    if (navigation.errorText) throw new Error(`Could not open the generated document: ${navigation.errorText}`);

    let layout;
    while (Date.now() < deadline) {
        const result = await command('Runtime.evaluate', {
            expression: 'window.__DOCUMENT_RENDER_RESULT__ || null', returnByValue: true,
        });
        layout = result.result.value;
        if (layout?.error) throw new Error(`Document layout failed: ${layout.error}`);
        if (layout && Number.isInteger(layout.pages) && layout.pages > 0) break;
        if (scriptError) throw new Error(`Document script failed: ${scriptError}`);
        await pause(50);
    }
    if (!layout || !Number.isInteger(layout.pages) || layout.pages < 1) {
        throw new Error('Document pagination did not become ready before the PDF timeout.');
    }
    // Remove the measurement-only screen media override: print the frozen sheet
    // slices, not the continuous editor (which includes 24px inter-page gaps).
    await command('Emulation.setEmulatedMedia', { media: 'print' });
    const verification = await command('Runtime.evaluate', {
        expression: 'window.__DOCUMENT_VERIFY_PRINT__()', returnByValue: true,
    });
    if (verification.exceptionDetails || verification.result.value?.error) {
        throw new Error(verification.result.value?.error || 'Could not verify the frozen print sheets.');
    }
    const pdf = await command('Page.printToPDF', {
        printBackground: true, displayHeaderFooter: false, preferCSSPageSize: true,
        paperWidth: 8.5, paperHeight: 11, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
        transferMode: 'ReturnAsBase64',
    });
    const bytes = Buffer.from(pdf.data, 'base64');
    if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Chromium did not return a valid PDF.');
    await writeFile(options.output, bytes, { mode: 0o600 });
    process.stdout.write(JSON.stringify(layout));
} catch (error) {
    const diagnostics = errorText.trim();
    const stderr = diagnostics ? `\nRecent Chromium stderr:\n${diagnostics}` : '';
    process.stderr.write(`${error.message}\nBrowser: ${options.browser}\nWindows environment: ${environmentSummary}${stderr}\n`);
    process.exitCode = 1;
} finally {
    if (browser && browser.exitCode === null) {
        // Send shutdown outside command(): the render deadline may already
        // have expired, but Chromium still needs a chance to close its children.
        try {
            browser.stdio[3].write(`${JSON.stringify({ id: ++sequence, method: 'Browser.close', params: {} })}\0`);
        } catch {}
        await Promise.race([new Promise(resolve => browser.once('exit', resolve)), pause(2000)]);
        if (browser.exitCode === null && process.platform === 'win32' && browser.pid) {
            // Node's child.kill() only ends Edge's root process on Windows.
            // Kill the tree we spawned so a timed-out render cannot leave GPU
            // processes holding profile/cache files open.
            const killer = spawn('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], {
                stdio: 'ignore', windowsHide: true,
            });
            killer.on('error', () => {});
            await Promise.race([new Promise(resolve => killer.once('exit', resolve)), pause(3000)]);
        }
        if (browser.exitCode === null) {
            browser.kill('SIGKILL');
            await Promise.race([new Promise(resolve => browser.once('exit', resolve)), pause(1000)]);
        }
    }
    for (const request of pending.values()) clearTimeout(request.timer);
}
