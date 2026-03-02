/**
 * Electron main process — Gajraj Billing Software
 * 
 * Architecture:
 * - Custom 'app://' protocol serves static Next.js export from out/ directory
 * - API requests (/api/*) are intercepted and handled directly with SQLite
 * - No localhost, no server spawn, no external Node.js dependency
 */

const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db');
const { routeRequest } = require('./api-handlers');

/* ─── Paths ─── */
const isDev = !app.isPackaged;
const staticDir = isDev
    ? path.join(__dirname, '..', 'out')
    : path.join(process.resourcesPath, 'out');

/* ─── Register custom protocol scheme (must be before app.ready) ─── */
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
        },
    },
]);

/* ─── MIME type map ─── */
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.map': 'application/json',
    '.webp': 'image/webp',
    '.txt': 'text/plain',
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

/* ─── App lifecycle ─── */
let mainWindow = null;

app.whenReady().then(() => {
    console.log('[Main] App ready — initializing...');

    /* Initialize database in userData */
    const dbDir = app.getPath('userData');
    console.log('[Main] DB directory:', dbDir);
    initDatabase(dbDir);
    console.log('[Main] Static dir:', staticDir);

    /* Register protocol handler */
    protocol.handle('app', async (request) => {
        try {
            const url = new URL(request.url);
            const pathname = decodeURIComponent(url.pathname);

            // ─── API requests ───
            if (pathname.startsWith('/api/')) {
                console.log(`[API] ${request.method} ${pathname}${url.search || ''}`);
                let body = null;
                if (request.method === 'POST' || request.method === 'PUT') {
                    try {
                        const text = await request.text();
                        body = text ? JSON.parse(text) : {};
                    } catch (e) {
                        body = {};
                    }
                }

                const result = routeRequest(pathname, request.method, url.searchParams, body);
                return new Response(JSON.stringify(result.data), {
                    status: result.status,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // ─── Static file serving ───
            let filePath = path.join(staticDir, pathname);

            // Try exact path first
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                return new Response(fs.readFileSync(filePath), {
                    status: 200,
                    headers: { 'Content-Type': getMimeType(filePath) },
                });
            }

            // Try path/index.html (for directory-style routes)
            const indexPath = path.join(filePath, 'index.html');
            if (fs.existsSync(indexPath)) {
                return new Response(fs.readFileSync(indexPath), {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                });
            }

            // Try path.html (Next.js static export generates page.html)
            const htmlPath = filePath + '.html';
            if (fs.existsSync(htmlPath)) {
                return new Response(fs.readFileSync(htmlPath), {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                });
            }

            // SPA fallback — serve index.html for client-side routing
            const fallbackPath = path.join(staticDir, 'index.html');
            if (fs.existsSync(fallbackPath)) {
                return new Response(fs.readFileSync(fallbackPath), {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                });
            }

            return new Response('Not Found', { status: 404 });
        } catch (err) {
            console.error('[Protocol] Error handling request:', request.url, err);
            return new Response('Internal Error', { status: 500 });
        }
    });

    /* Create main window */
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'Gajraj Kirana Stores - Billing Software',
        icon: path.join(__dirname, '..', 'build', 'icon.ico'),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
        },
        show: false,
        backgroundColor: '#0a0a0a',
    });

    mainWindow.loadURL('app://./index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.maximize();
        console.log('[Main] Window shown');
    });

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
});

/* ─── Quit when all windows closed ─── */
app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        // Re-create window on macOS dock click (not applicable for Windows but good practice)
    }
});
