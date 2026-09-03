/**
 * app.js – Main application logic
 * Controls: Redaction, Tamper Simulation, Feed, KPI updates
 */

import { verifyDocument, tamperDocument, resetDocument, getActivityFeed } from './api.js';
import { renderGraph, updateGraph } from './graph.js';

// ------------------------------
// DOM References
// ------------------------------
const redactToggle = document.getElementById('redactToggle');
const tamperBtn = document.getElementById('tamperBtn');
const docContent = document.getElementById('docContent');
const fileHashDisplay = document.getElementById('fileHashDisplay');
const currentHashSpan = document.getElementById('currentHash');
const bcStatus = document.getElementById('bcStatus');
const bcBadge = document.getElementById('bcBadge');
const lastCustodyItem = document.getElementById('lastCustodyItem');
const tamperCount = document.getElementById('tamperCount');
const verifiedCount = document.getElementById('verifiedCount');
const feedContainer = document.getElementById('activityFeed');
const verifyTime = document.getElementById('verifyTime');

let isTampered = false;
let currentDocId = '404';

// ------------------------------
// 1. AI AUTO-REDACTION TOGGLE
// ------------------------------
redactToggle.addEventListener('change', function() {
    const redactSpans = docContent.querySelectorAll('.redact');
    redactSpans.forEach(el => {
        if (this.checked) {
            el.classList.remove('reveal');
            el.textContent = '██████████';
        } else {
            el.classList.add('reveal');
            el.textContent = el.getAttribute('data-original');
        }
    });
});

// Initialize redacted state (on page load)
document.addEventListener('DOMContentLoaded', () => {
    const redactSpans = docContent.querySelectorAll('.redact');
    redactSpans.forEach(el => {
        el.textContent = '██████████';
    });
    // Start activity feed
    refreshFeed();
    // Auto-refresh feed every 12 seconds
    setInterval(refreshFeed, 12000);
    // Update timestamp
    updateTimestamp();
    setInterval(updateTimestamp, 10000);
});

// ------------------------------
// 2. TAMPER SIMULATION (THE KILLER FEATURE)
// ------------------------------
tamperBtn.addEventListener('click', async function() {
    if (isTampered) {
        // ---- RESET TO VERIFIED ----
        const result = await resetDocument(currentDocId);
        if (result.status === 'verified') {
            isTampered = false;
            setVerifiedState(result);
            tamperBtn.innerHTML = '<i class="fas fa-skull"></i> Simulate Tamper';
            tamperBtn.className = 'btn-danger';
            // Update feed
            addFeedItem('System', 'Blockchain integrity restored. Document re-verified.', false);
            // Decrease tamper count
            let count = parseInt(tamperCount.textContent);
            if (count > 0) tamperCount.textContent = count - 1;
            verifiedCount.textContent = parseInt(verifiedCount.textContent) + 1;
        }
        return;
    }

    // ---- TAMPER THE DOCUMENT ----
    tamperBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Tampering...';
    tamperBtn.disabled = true;

    const result = await tamperDocument(currentDocId);

    if (result.status === 'tampered') {
        isTampered = true;
        setTamperedState(result.newHash);
        tamperBtn.innerHTML = '<i class="fas fa-undo"></i> Reset Verification';
        tamperBtn.className = 'btn-danger btn-reset';
        // Update feed
        addFeedItem('🚨 BLOCKCHAIN', 'Tamper detected on Case #404! Document automatically locked.', true);
        // Increase tamper count
        let count = parseInt(tamperCount.textContent);
        tamperCount.textContent = count + 1;
        verifiedCount.textContent = parseInt(verifiedCount.textContent) - 1;
    }

    tamperBtn.disabled = false;
});

// ------------------------------
// 3. UI STATE HELPERS
// ------------------------------
function setVerifiedState(data) {
    bcStatus.classList.remove('tampered');
    bcBadge.className = 'badge verified';
    bcBadge.textContent = '✅ VERIFIED';
    bcStatus.querySelector('i').className = 'fas fa-shield-check';
    bcStatus.querySelector('i').style.color = '#22c55e';
    fileHashDisplay.textContent = data.hash || '0x7f83...d9069';
    currentHashSpan.textContent = (data.hash || '0x7f83...d9069').substring(0, 10) + '...' + (data.hash || '').substring((data.hash || '').length - 5);
    document.getElementById('blockNum').textContent = '#' + (data.block || 14891);
    document.getElementById('bcTimestamp').textContent = data.timestamp || '2025-08-30 12:03:11 UTC';
    lastCustodyItem.innerHTML = `
        <span class="icon"><i class="fas fa-check-circle" style="color:#22c55e;"></i></span>
        <span class="desc">Blockchain Verified</span>
        <span class="time">Just now</span>
    `;
}

function setTamperedState(newHash) {
    bcStatus.classList.add('tampered');
    bcBadge.className = 'badge tampered';
    bcBadge.textContent = '⚠️ TAMPERED';
    bcStatus.querySelector('i').className = 'fas fa-triangle-exclamation';
    bcStatus.querySelector('i').style.color = '#ef4444';
    const shortHash = (newHash || '0x9a8b...f1e0').substring(0, 10) + '...' + (newHash || '0x9a8b...f1e0').substring((newHash || '0x9a8b...f1e0').length - 5);
    fileHashDisplay.textContent = newHash || '0x9a8b...f1e0';
    currentHashSpan.textContent = shortHash;
    lastCustodyItem.innerHTML = `
        <span class="icon"><i class="fas fa-skull" style="color:#ef4444;"></i></span>
        <span class="desc" style="color:#fca5a5; font-weight:700;">🚨 HASH MISMATCH – EVIDENCE TAMPERED!</span>
        <span class="time">Just now</span>
    `;
}

// ------------------------------
// 4. ACTIVITY FEED
// ------------------------------
function addFeedItem(actor, message, isAlert = false) {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' +
                    now.getMinutes().toString().padStart(2, '0');

    const item = document.createElement('div');
    item.className = `feed-item${isAlert ? ' alert' : ''}`;
    item.innerHTML = `
        <span class="time">${timeStr}</span>
        <span class="msg"><i class="fas fa-circle" style="font-size:6px; color:${isAlert ? '#ef4444' : '#f97316'}; margin-right:8px;"></i> ${actor}: ${message}</span>
    `;
    feedContainer.prepend(item);

    // Keep feed manageable (max 15 items)
    while (feedContainer.children.length > 15) {
        feedContainer.removeChild(feedContainer.lastChild);
    }
}

async function refreshFeed() {
    try {
        const items = await getActivityFeed();
        // Clear existing feed items that are not "live" (we keep the prepended ones)
        // Simple approach: clear and rebuild
        if (feedContainer.children.length > 5) {
            // Only refresh if we have too many items, or just add new ones
            // We'll just add a "heartbeat" item every few seconds
            const lastItem = feedContainer.firstChild;
            if (lastItem) {
                const time = lastItem.querySelector('.time')?.textContent;
                // Don't spam if we already have a recent item
                const now = new Date();
                const currentHour = now.getHours().toString().padStart(2,'0');
                const currentMin = now.getMinutes().toString().padStart(2,'0');
                if (time !== `${currentHour}:${currentMin}`) {
                    // Add a heartbeat
                    addFeedItem('System', 'Blockchain heartbeat: all nodes sync OK.', false);
                }
            }
        }
    } catch (e) {
        console.warn('Feed refresh error:', e);
    }
}

// ------------------------------
// 5. TIMESTAMP UPDATER
// ------------------------------
function updateTimestamp() {
    const now = new Date();
    verifyTime.textContent = now.toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
}

// ------------------------------
// 6. INITIAL LOAD: Verify the document on page load
// ------------------------------
(async function init() {
    // Render the graph
    await renderGraph();

    // Verify current document
    const data = await verifyDocument(currentDocId);
    setVerifiedState(data);

    // Add a welcome feed item
    addFeedItem('NyayaLens', 'System initialized. All modules active.', false);

    // Update KPI counts (mock)
    verifiedCount.textContent = '1,270';
    tamperCount.textContent = '2';
})();