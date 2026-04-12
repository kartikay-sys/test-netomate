document.addEventListener('DOMContentLoaded', () => {
    const flowTextarea = document.getElementById('flow-textarea');
    const flowCount = document.getElementById('flow-count');
    const queryInput = document.getElementById('user-query');
    const suggestBtn = document.getElementById('get-suggestions-btn');
    const suggestionsList = document.getElementById('suggestions-list');
    const btnText = suggestBtn.querySelector('.btn-text');
    const loader = suggestBtn.querySelector('.loader');

    let currentSuggestions = [];
    let currentFlowState = [];
    
    // --- Session Memory State ---
    let sessionTimeline = JSON.parse(sessionStorage.getItem('netomateSessionTimeline')) || [];
    const timelineContainer = document.getElementById('session-timeline');
    const toggleSessionPanel = document.getElementById('toggle-session-memory');
    const clearSessionBtn = document.getElementById('clear-session-btn');
    const exportSessionBtn = document.getElementById('export-session-btn');
    const useMemoryToggle = document.getElementById('use-memory-toggle');
    
    // Auto-started flow detection
    let isFlowStarted = sessionTimeline.length > 0;

    function saveTimeline() {
        sessionStorage.setItem('netomateSessionTimeline', JSON.stringify(sessionTimeline));
        renderTimeline();
    }

    function addLogEvent(actionClass, message) {
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        sessionTimeline.push({ time: timeStr, action: actionClass, text: message });
        saveTimeline();
    }

    function renderTimeline() {
        if (!timelineContainer) return;
        
        if (sessionTimeline.length === 0) {
            timelineContainer.innerHTML = '<div class="empty-state"><p style="font-size:12px;">No session history yet.</p></div>';
            return;
        }

        let html = '';
        sessionTimeline.forEach(entry => {
            html += `
                <div class="timeline-item">
                    <span class="timeline-time">${entry.time}</span>
                    <div class="timeline-dot ${entry.action}"></div>
                    <span class="timeline-text">${entry.text}</span>
                </div>
            `;
        });
        
        timelineContainer.innerHTML = html;
        timelineContainer.scrollTop = timelineContainer.scrollHeight;
    }

    // Initialize UI on load
    renderTimeline();

    toggleSessionPanel.addEventListener('click', () => {
        timelineContainer.classList.toggle('collapsed');
    });

    clearSessionBtn.addEventListener('click', () => {
        if (confirm("Clear your session memory?")) {
            sessionTimeline = [];
            isFlowStarted = false;
            saveTimeline();
        }
    });

    exportSessionBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessionTimeline, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `session_log_${Date.now()}.json`);
        dlAnchorElem.click();
    });

    // Quick prompt buttons logic
    document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            queryInput.value = btn.textContent;
            suggestBtn.click(); // Auto-submit for max convenience
        });
    });

    // Update count when typing
    flowTextarea.addEventListener('input', () => {
        const text = flowTextarea.value.trim();
        const count = text ? text.split('\n').filter(line => line.trim() !== '').length : 0;
        flowCount.textContent = `${count} steps`;
        
        if (count > 0 && !isFlowStarted) {
            addLogEvent('action-system', 'Started flow manually');
            isFlowStarted = true;
        }
    });

    suggestBtn.addEventListener('click', async () => {
        const query = queryInput.value.trim();


        const flowLines = flowTextarea.value
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line !== '');

        currentFlowState = [...flowLines];

        // UI state
        suggestBtn.disabled = true;
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
        suggestionsList.innerHTML = '';

        // Check if previous suggestions were ignored
        if (currentSuggestions.length > 0) {
            const ignored = currentSuggestions.map(s => s.function || s.fn_name).join(', ');
            addLogEvent('action-rejected', `Ignored previous suggestions`);
            currentSuggestions = [];
        }

        if (query) {
            addLogEvent('action-query', `Asked: "<strong>${query}</strong>"`);
        } else if (!isFlowStarted && flowLines.length === 0) {
            addLogEvent('action-system', `Started empty flow`);
            isFlowStarted = true;
        }

        try {
            const response = await fetch('/api/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    current_flow: flowLines,
                    use_memory: useMemoryToggle.checked, // Send toggle status
                    session_log: useMemoryToggle.checked ? sessionTimeline : [] // Pass array if enabled
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            currentSuggestions = data.suggestions || [];

            renderSuggestions(data.suggestions, data.engine_path);
            
        } catch (error) {
            suggestionsList.innerHTML = `
                <div class="error-card">
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
        } finally {
            suggestBtn.disabled = false;
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
        }
    });

    function getSourceColor(source) {
        const colors = {
            'gpt-oss-120b': { bg: 'rgba(16, 163, 127, 0.12)', text: '#34d399', border: 'rgba(16, 163, 127, 0.25)' },
            frequency: { bg: 'rgba(0, 201, 167, 0.12)', text: '#00ffcc', border: 'rgba(0, 201, 167, 0.25)' },
            llm: { bg: 'rgba(139, 109, 255, 0.12)', text: '#b09aff', border: 'rgba(139, 109, 255, 0.25)' },
        };
        return colors[source] || colors.llm;
    }

    function getSourceLabel(source) {
        const labels = {
            'gpt-oss-120b': '🧠 GPT OSS 120B',
            frequency: '◎ Frequency',
            llm: '◈ LLM',
        };
        return labels[source] || source;
    }

    function renderSuggestions(suggestions, enginePath) {
        if (!suggestions || suggestions.length === 0) {
            suggestionsList.innerHTML = `
                <div class="empty-state">
                    No suggestions found. Try a different query.
                </div>
            `;
            return;
        }

        let html = '';

        // Engine path badge
        const pathLabel = enginePath === 'cold_start' 
            ? 'Cold Start — Frequency (no LLM call)' 
            : `LLM Full-Dataset Reasoning`;
        html += `<div class="engine-path-badge">Path: ${pathLabel}</div>`;

        suggestions.forEach((item, idx) => {
            const func = item.function || 'unknown_function';
            const exp = item.explanation || 'No explanation provided.';
            const conf = item.confidence || 0;
            const source = item.source || 'llm';
            const occurrences = item.occurrences || 0;
            const sourceColor = getSourceColor(source);
            
            let colorClass = 'score-low';
            if (conf >= 80) colorClass = 'score-high';
            else if (conf >= 50) colorClass = 'score-med';

            let typeBadgeHtml = '';
            if (item.type === 'missing') {
                typeBadgeHtml = `<span class="source-badge" style="background:rgba(255, 193, 7, 0.15);color:#ffb700;border:1px solid rgba(255, 193, 7, 0.3)">⚠️ Missing</span>`;
            } else if (item.type === 'next') {
                typeBadgeHtml = `<span class="source-badge" style="background:rgba(23, 162, 184, 0.15);color:#17a2b8;border:1px solid rgba(23, 162, 184, 0.3)">⏭️ Next</span>`;
            }

            html += `
                <div class="suggestion-card clickable" data-fn="${func}" title="Click to add to flow">
                    <div class="rank-pill">${idx + 1}</div>
                    <div class="suggestion-content">
                        <div class="suggestion-header">
                            <div class="func-name">${func}</div>
                            <div class="suggestion-badges">
                                ${typeBadgeHtml}
                                <span class="source-badge" style="background:${sourceColor.bg};color:${sourceColor.text};border:1px solid ${sourceColor.border}">
                                    ${getSourceLabel(source)}
                                </span>
                                <div class="confidence-badge ${colorClass}">
                                    ${conf}%
                                </div>
                            </div>
                        </div>
                        <div class="explanation-text">${exp}</div>
                        ${occurrences > 0 ? `<div class="occurrences-text">${occurrences} occurrence${occurrences !== 1 ? 's' : ''} in dataset</div>` : ''}
                    </div>
                </div>
            `;
        });
        
        suggestionsList.innerHTML = html;

        // Attach click handlers
        document.querySelectorAll('.suggestion-card.clickable').forEach(card => {
            card.addEventListener('click', () => handleSuggestionClick(card));
        });
    }

    async function handleSuggestionClick(card) {
        const fn = card.dataset.fn;
        if (!fn) return;

        card.classList.add('selected');
        card.style.pointerEvents = 'none';

        const currentText = flowTextarea.value.trim();
        flowTextarea.value = currentText ? currentText + '\n' + fn : fn;
        
        const lines = flowTextarea.value.split('\n').filter(l => l.trim() !== '');
        flowCount.textContent = `${lines.length} steps`;
        
        addLogEvent('action-add', `Accepted: <strong>${fn}</strong>`);
        currentSuggestions = []; // Clear current so they aren't marked as ignored

        try {
            await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    flow_state: currentFlowState,
                    suggestions: currentSuggestions,
                    selected_fn: fn,
                })
            });
        } catch (err) {
            console.warn('Feedback recording failed:', err);
        }
    }
});
