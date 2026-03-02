/**
 * Electron Preload Script for Gajraj Billing Software
 * 
 * Uses contextBridge to safely expose limited APIs to the renderer.
 * nodeIntegration is disabled — this is the secure way to communicate.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    getAppVersion: () => process.env.npm_package_version || '1.0.0',
    isElectron: true,
});
