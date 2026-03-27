"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHardwareFingerprint = getHardwareFingerprint;
const si = __importStar(require("systeminformation"));
const crypto_1 = require("crypto");
/**
 * Generate a hardware fingerprint based on system components.
 * This fingerprint is used to bind licenses to specific machines.
 *
 * @returns Promise<string> - SHA256 hex hash (64 characters)
 */
async function getHardwareFingerprint() {
    try {
        const cpu = await si.cpu();
        const osInfo = await si.osInfo();
        const networkInterfaces = await si.networkInterfaces();
        // Find primary network interface (first active one with non-zero MAC)
        const primaryInterface = networkInterfaces.find(iface => iface.operstate === 'up' && iface.mac && iface.mac !== '00:00:00:00:00:00');
        // Combine hardware components into a fingerprint string
        const components = [
            cpu.manufacturer,
            cpu.brand,
            cpu.cores.toString(),
            osInfo.serial || 'unknown',
            primaryInterface?.mac || 'unknown'
        ].join('|');
        // Generate SHA256 hash
        return (0, crypto_1.createHash)('sha256').update(components).digest('hex');
    }
    catch (error) {
        console.error('Failed to generate hardware fingerprint:', error);
        // Fallback to simple hash if systeminformation fails
        // This allows the application to continue even if hardware detection fails
        return (0, crypto_1.createHash)('sha256').update(Date.now().toString()).digest('hex');
    }
}
