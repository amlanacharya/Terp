# Electron Main Process

This directory contains the Electron main process code for TravelERP Lite.

## Files:

### `main.ts`
- Entry point for the Electron application
- Manages application lifecycle
- Starts Express server as a child process
- Sets up IPC handlers for communication with renderer process

### `preload.ts`
- Preload script that runs before the renderer process
- Creates a secure bridge between main and renderer processes using `contextBridge`
- Exposes safe APIs via `window.electronAPI`

### `server-manager.ts`
- Manages the Express server as a child process
- Handles starting, stopping, and restarting the server
- Provides status monitoring

### `window-manager.ts`
- Manages application windows
- Creates main application window
- Creates wizard windows (first-run, import, update)

## Development:

```bash
# Build Electron main process
npm run build:electron

# Run Electron in development mode
npm run electron:dev
```

## Production:

```bash
# Build everything (frontend + backend + electron)
npm run build:all

# Build Windows installer
npm run electron:build:win
```

## Architecture:

```
┌─────────────────────────────────────────┐
│         Electron Main Process            │
│  - App lifecycle                        │
│  - Window management                    │
│  - Express server management            │
│  - IPC handlers                         │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌─────▼──────────────┐
│   Renderer  │  │  Express Server     │
│   Process   │  │  (Child Process)    │
│             │  │                     │
│  (React     │  │  - API Routes       │
│   Frontend) │  │  - Business Logic   │
│             │  │  - PostgreSQL       │
└──────┬──────┘  └─────┬──────────────┘
       │                │
       │         ┌──────▼────────┐
       │         │  PostgreSQL    │
       │         │  (External/    │
       │         │   Bundled)     │
       │         └───────────────┘
       │
┌──────▼─────────────────────────────┐
│  User Interface                     │
│  - React components                 │
│  - Calls APIs via window.electronAPI│
└─────────────────────────────────────┘
```

## Testing Checklist:

### Phase 1 Day 2 - Integration Testing:

- [ ] Electron app launches without errors
- [ ] Express server starts automatically as child process
- [ ] React frontend loads in Electron window
- [ ] DevTools open in development mode
- [ ] Frontend can call Express API endpoints
- [ ] Server logs appear in console
- [ ] App closes cleanly (server stops properly)

### Manual Testing Steps:

1. **Start Electron app:**
   ```bash
   npm run electron:dev
   ```

2. **Verify console output:**
   - Should see "Starting TravelERP Lite..."
   - Should see "Starting Express server..."
   - Should see "Express server started on port 3001"

3. **Check browser window:**
   - Electron window should open
   - React app should load
   - No console errors in DevTools

4. **Test API connection:**
   - Open DevTools console
   - Run: `fetch('http://localhost:3001/api/health').then(r => r.json()).then(console.log)`
   - Should see: `{ status: 'ok' }`

5. **Test graceful shutdown:**
   - Close Electron window
   - Check that server process stops
   - No orphaned Node.js processes

## Known Issues:

- PostgreSQL service management (Phase 1 Day 3) not yet implemented
- License validation (Phase 2) not yet implemented
- Auto-updater (Phase 4) not yet implemented
