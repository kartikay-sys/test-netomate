document.addEventListener('DOMContentLoaded', () => {
    const flowTextarea = document.getElementById('flow-textarea');
    const flowCount = document.getElementById('flow-count');
    const queryInput = document.getElementById('user-query');
    const suggestBtn = document.getElementById('get-suggestions-btn');
    const suggestionsList = document.getElementById('suggestions-list');
    const btnText = suggestBtn.querySelector('.btn-text');
    const loader = suggestBtn.querySelector('.loader');
    const modelSelect = document.getElementById('model-select');
    const modelUsedBadge = document.getElementById('model-used-badge');

    let currentSuggestions = [];
    let currentFlowState = [];

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
    });

    suggestBtn.addEventListener('click', async () => {
        const query = queryInput.value.trim();


        const flowLines = flowTextarea.value
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line !== '');

        currentFlowState = [...flowLines];
        const selectedModel = modelSelect.value;

        // UI state
        suggestBtn.disabled = true;
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
        suggestionsList.innerHTML = '';
        modelUsedBadge.classList.add('hidden');

        try {
            const response = await fetch('/api/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    current_flow: flowLines,
                    model: selectedModel
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            currentSuggestions = data.suggestions || [];

            // Show model used badge
            if (data.model_used) {
                modelUsedBadge.textContent = `🤖 ${data.model_used}`;
                modelUsedBadge.classList.remove('hidden');
            }

            renderSuggestions(data.suggestions, data.engine_path, data.model_used);
            
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
            'gemini-flash': { bg: 'rgba(66, 133, 244, 0.12)', text: '#8ab4f8', border: 'rgba(66, 133, 244, 0.25)' },
            'gpt-oss-120b': { bg: 'rgba(16, 163, 127, 0.12)', text: '#34d399', border: 'rgba(16, 163, 127, 0.25)' },
            frequency: { bg: 'rgba(0, 201, 167, 0.12)', text: '#00ffcc', border: 'rgba(0, 201, 167, 0.25)' },
            llm: { bg: 'rgba(139, 109, 255, 0.12)', text: '#b09aff', border: 'rgba(139, 109, 255, 0.25)' },
        };
        return colors[source] || colors.llm;
    }

    function getSourceLabel(source) {
        const labels = {
            'gemini-flash': '⚡ Gemini Flash',
            'gpt-oss-120b': '🧠 GPT OSS 120B',
            frequency: '◎ Frequency',
            llm: '◈ LLM',
        };
        return labels[source] || source;
    }

    function renderSuggestions(suggestions, enginePath, modelUsed) {
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
