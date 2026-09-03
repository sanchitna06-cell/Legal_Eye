/**
 * api.js – Handles all network requests (Mock version for demo)
 */

// Base URL for your backend (change this when backend is live)
const API_BASE = 'http://localhost:8000';

// ------------------------------
// MOCK DATA (Simulates Backend)
// ------------------------------
const MOCK_DATA = {
    verify: {
        status: 'verified',
        hash: '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        block: 14891,
        timestamp: '2025-08-30 12:03:11 UTC'
    },
    graph: {
        nodes: [
            { id: 1, label: 'Case #404 (Mumbai)', color: '#f97316', shape: 'dot', size: 25 },
            { id: 2, label: 'Case #112 (Delhi)', color: '#f97316', shape: 'dot', size: 20 },
            { id: 3, label: 'Phone: +91 98765 ****', color: '#38bdf8', shape: 'triangle', size: 15 },
            { id: 4, label: 'Vehicle: DL-03-CA-1234', color: '#facc15', shape: 'square', size: 15 },
            { id: 5, label: 'Accused: Vikram Singh', color: '#ef4444', shape: 'dot', size: 20 },
            { id: 6, label: 'Witness: Rajesh Kumar', color: '#22c55e', shape: 'dot', size: 15 },
        ],
        edges: [
            { from: 1, to: 3, label: 'linked' },
            { from: 1, to: 4, label: 'used' },
            { from: 2, to: 4, label: 'same vehicle' },
            { from: 2, to: 5, label: 'suspect' },
            { from: 1, to: 6, label: 'statement' },
            { from: 5, to: 3, label: 'calls' },
        ]
    },
    feed: [
        { time: '12:03 PM', actor: 'System', msg: 'Case #404 verified by Blockchain', alert: false },
        { time: '11:48 AM', actor: 'AI', msg: 'Auto-Redacted PII in Case #112', alert: false },
        { time: '11:20 AM', actor: '🚨 Security', msg: 'Tamper detected on Doc #221 – Locked', alert: true },
        { time: '10:55 AM', actor: 'NIA', msg: 'Officer Sharma viewed Case #089', alert: false },
    ]
};

// ------------------------------
// API FUNCTIONS
// ------------------------------

/**
 * Verify a document's integrity
 * @param {string} docId - The document ID
 * @returns {Promise<Object>} - { status, hash, block, timestamp }
 */
export async function verifyDocument(docId) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 400));

    // In real version, you would do:
    // const response = await fetch(`${API_BASE}/verify/${docId}`);
    // return response.json();

    // Mock: return a copy of the mock data
    return { ...MOCK_DATA.verify };
}

/**
 * Get the Criminal Nexus Graph data for a case
 * @param {string} caseId - The case ID
 * @returns {Promise<Object>} - { nodes, edges }
 */
export async function getGraphData(caseId) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { nodes: MOCK_DATA.graph.nodes, edges: MOCK_DATA.graph.edges };
}

/**
 * Simulate a tamper attack on a document (for demo)
 * @param {string} docId - The document ID
 * @returns {Promise<Object>} - { status, message, newHash }
 */
export async function tamperDocument(docId) {
    await new Promise(resolve => setTimeout(resolve, 600));

    // Mock: return tampered status
    return {
        status: 'tampered',
        message: '🚨 Hash mismatch! Document has been altered.',
        newHash: '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f' + Math.floor(Math.random() * 1000)
    };
}

/**
 * Reset tamper state (re-verify)
 * @param {string} docId 
 * @returns {Promise<Object>}
 */
export async function resetDocument(docId) {
    await new Promise(resolve => setTimeout(resolve, 400));
    return {
        status: 'verified',
        hash: MOCK_DATA.verify.hash,
        block: MOCK_DATA.verify.block,
        timestamp: MOCK_DATA.verify.timestamp
    };
}

/**
 * Get live activity feed
 * @returns {Promise<Array>}
 */
export async function getActivityFeed() {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...MOCK_DATA.feed];
}