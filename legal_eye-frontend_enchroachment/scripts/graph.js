/**
 * graph.js – Renders the Criminal Nexus Graph using vis.js
 */

import { getGraphData } from './api.js';

let networkInstance = null;

/**
 * Initialize and render the graph
 * @param {string} containerId - The DOM ID of the graph container
 * @param {string} caseId - The case ID to fetch data for
 */
export async function renderGraph(containerId = 'graph-container', caseId = '404') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn('Graph container not found');
        return;
    }

    // Fetch graph data from the API (or mock)
    const data = await getGraphData(caseId);

    // Create vis.js DataSets
    const nodes = new vis.DataSet(data.nodes);
    const edges = new vis.DataSet(data.edges);

    const options = {
        physics: {
            enabled: true,
            stabilization: { iterations: 80 }
        },
        edges: {
            smooth: true,
            font: { size: 9, color: '#94a3b8', face: 'Inter' },
            color: { color: 'rgba(255,255,255,0.2)' }
        },
        nodes: {
            font: { color: '#e2e8f0', size: 11, face: 'Inter' },
            borderWidth: 2,
            shadow: true,
            shadowColor: 'rgba(0,0,0,0.4)'
        },
        interaction: {
            hover: true,
            tooltipDelay: 200,
            navigationButtons: false
        },
        layout: {
            improvedLayout: true
        }
    };

    const network = new vis.Network(container, { nodes, edges }, options);
    networkInstance = network;

    // Fix for container sizing
    setTimeout(() => {
        network.fit();
    }, 100);

    return network;
}

/**
 * Update the graph with new data (e.g., when a case changes)
 */
export async function updateGraph(caseId) {
    if (networkInstance) {
        // Destroy old graph
        networkInstance.destroy();
        networkInstance = null;
    }
    return renderGraph('graph-container', caseId);
}

// Auto-initialize when the script loads
document.addEventListener('DOMContentLoaded', () => {
    renderGraph();
});