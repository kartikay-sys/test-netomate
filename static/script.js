document.addEventListener('DOMContentLoaded', () => {
    // ── Login Elements ──────────────────────────────────────────
    const loginScreen = document.getElementById('login-screen');
    const loginForm = document.getElementById('login-form');
    const loginUserInput = document.getElementById('login-user');
    const loginPassInput = document.getElementById('login-pass');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');
    const appContainer = document.getElementById('app-container');
    const userGreeting = document.getElementById('user-greeting');
    const logoutBtn = document.getElementById('logout-btn');

    // ── Resume Modal Elements ───────────────────────────────────
    const resumeModal = document.getElementById('resume-modal');
    const resumeQuerySection = document.getElementById('resume-query-section');
    const resumeQueryText = document.getElementById('resume-query-text');
    const resumeFlowSection = document.getElementById('resume-flow-section');
    const resumeFlowList = document.getElementById('resume-flow-list');
    const resumeContinueBtn = document.getElementById('resume-continue-btn');
    const resumeFreshBtn = document.getElementById('resume-fresh-btn');

    // ── App Element refs ────────────────────────────────────────
    const flowTextarea = document.getElementById('flow-textarea');
    const flowCount = document.getElementById('flow-count');
    const flowStepList = document.getElementById('flow-step-list');
    const flowAddInput = document.getElementById('flow-add-input');
    const flowAddBtn = document.getElementById('flow-add-btn');
    const flowClearBtn = document.getElementById('flow-clear-btn');
    const flowCopyBtn = document.getElementById('flow-copy-btn');
    const flowFinishBtn = document.getElementById('flow-finish-btn');
    const flowEmptyMsg = document.getElementById('flow-empty-msg');
    const queryInput = document.getElementById('user-query');
    const suggestBtn = document.getElementById('get-suggestions-btn');
    const suggestionsList = document.getElementById('suggestions-list');
    const btnText = suggestBtn.querySelector('.btn-text');
    const loader = suggestBtn.querySelector('.loader');

    const rawTextModal = document.getElementById('raw-text-modal');
    const modalTextarea = document.getElementById('modal-textarea');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const copyModalBtn = document.getElementById('copy-modal-btn');

    // ── Scenario Context Elements ───────────────────────────────
    const scenarioPanel = document.querySelector('.scenario-panel');
    const scenarioInput = document.getElementById('scenario-input');
    const scenarioSaveBtn = document.getElementById('scenario-save-btn');
    const scenarioClearBtn = document.getElementById('scenario-clear-btn');
    const scenarioStatus = document.getElementById('scenario-status');

    // ── Session Memory Elements ─────────────────────────────────
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const sessionTimeline = document.getElementById('session-timeline');
    const exportSessionBtn = document.getElementById('export-session-btn');
    const clearSessionBtn = document.getElementById('clear-session-btn');

    let currentSuggestions = [];
    let currentFlowState = [];
    let currentScenario = "";
    let userId = null;
    let userName = null;
    let sessionLog = []; // Local log of events for export/memory

    // ── Flow step data ──────────────────────────────────────────
    let flowSteps = [];
    let dragSrcIndex = null;

    // ── Auto-save debounce ──────────────────────────────────────
    let saveProgressTimer = null;
    function debounceSaveProgress() {
        if (saveProgressTimer) clearTimeout(saveProgressTimer);
        saveProgressTimer = setTimeout(() => {
            if (!userId) return;
            fetch('/api/save_progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    query: queryInput.value.trim(),
                    flow_steps: flowSteps,
                    scenario: currentScenario
                })
            }).catch(err => console.warn('Auto-save failed:', err));
        }, 1000);
    }

    // ── Tab Switching Logic ────────────────────────────────────
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            
            // Toggle buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle contents
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabName}-tab`) {
                    content.classList.add('active');
                }
            });
        });
    });

    // ── Session Memory / Logging ───────────────────────────────
    function addLogEvent(action, text, details = null) {
        // action 'interaction' expects text = query, details = suggestions[]
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const eventId = `event-${Date.now()}`;
        const eventIndex = sessionLog.length + 1;
        const event = { id: eventId, action, text, details, time: timestamp, index: eventIndex };
        sessionLog.push(event);

        const eventEl = document.createElement('div');
        eventEl.className = `timeline-event interaction compact-event`;
        eventEl.id = eventId;
        eventEl.dataset.index = eventIndex;
        eventEl.onclick = () => window.jumpToEvent(eventIndex);
        
        eventEl.innerHTML = `
            <div class="compact-query">
                <span class="event-action-tag">Query</span>
                <span class="event-text">${text}</span>
            </div>
        `;

        // Remove empty state if present
        const emptyState = sessionTimeline.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        sessionTimeline.prepend(eventEl);
    }

    window.jumpToEvent = function(index) {
        const event = sessionLog.find(e => e.index === index);
        if (event) {
            queryInput.value = event.text;
            
            // Switch to suggestions tab
            const suggestionTabBtn = document.querySelector('.tab-btn[data-tab="suggestions"]');
            if (suggestionTabBtn) suggestionTabBtn.click();
            
            // Restore previous suggestions without an API call
            currentSuggestions = event.details || [];
            renderSuggestions(currentSuggestions);
            
            showToast(`Restored query #${index}`);
        }
    };

    clearSessionBtn.addEventListener('click', () => {
        if (sessionLog.length === 0) return;
        if (confirm('Clear entire session history?')) {
            sessionLog = [];
            sessionTimeline.innerHTML = `
                <div class="empty-state">
                    <p>No activity recorded yet.</p>
                </div>
            `;
            showToast('History cleared');
        }
    });

    exportSessionBtn.addEventListener('click', () => {
        if (sessionLog.length === 0) {
            showToast('No logs to export');
            return;
        }

        const reportHeader = `NETOMATE SESSION LOG\nGenerated: ${new Date().toLocaleString()}\nUser: ${userName}\n------------------------------------------\n\n`;
        const logText = reportHeader + sessionLog.map(e => {
            let line = `[${e.time}] ${e.action.toUpperCase()}: ${e.text}`;
            if (e.details && Array.isArray(e.details)) {
                line += `\n    Suggestions: ${e.details.map(s => s.function || s).join(', ')}`;
            }
            return line;
        }).join('\n\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `netomate_report_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Report exported successfully');
    });

    // ═══════════════════════════════════════════════════════════════
    //  SCENARIO MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    function updateScenarioUI() {
        if (currentScenario) {
            scenarioStatus.classList.remove('hidden');
            scenarioPanel.classList.add('active-scenario');
            scenarioClearBtn.classList.remove('hidden');
            scenarioSaveBtn.querySelector('.btn-text').textContent = 'Update';
        } else {
            scenarioStatus.classList.add('hidden');
            scenarioPanel.classList.remove('active-scenario');
            scenarioClearBtn.classList.add('hidden');
            scenarioSaveBtn.querySelector('.btn-text').textContent = 'Set Scenario';
        }
    }

    scenarioSaveBtn.addEventListener('click', () => {
        const val = scenarioInput.value.trim();
        if (!val) return;
        
        currentScenario = val;
        
        scenarioSaveBtn.disabled = true;
        scenarioSaveBtn.querySelector('.btn-text').classList.add('hidden');
        scenarioSaveBtn.querySelector('.loader').classList.remove('hidden');
        
        // Simulate a small delay for UX
        setTimeout(() => {
            updateScenarioUI();
            debounceSaveProgress();
            
            scenarioSaveBtn.disabled = false;
            scenarioSaveBtn.querySelector('.btn-text').classList.remove('hidden');
            scenarioSaveBtn.querySelector('.loader').classList.add('hidden');
            
            // Success indication
            const origText = scenarioSaveBtn.querySelector('.btn-text').textContent;
            scenarioSaveBtn.querySelector('.btn-text').textContent = 'Saved!';
            scenarioSaveBtn.classList.add('success-state'); // Reuse class if needed
            setTimeout(() => {
                scenarioSaveBtn.querySelector('.btn-text').textContent = origText;
                scenarioSaveBtn.classList.remove('success-state');
            }, 1500);
        }, 400);
    });

    scenarioClearBtn.addEventListener('click', () => {
        currentScenario = "";
        scenarioInput.value = "";
        updateScenarioUI();
        debounceSaveProgress();
    });

    // ═══════════════════════════════════════════════════════════════
    //  LOGIN FLOW
    // ═══════════════════════════════════════════════════════════════

    // Check if already authenticated
    const savedUser = sessionStorage.getItem('netomateUserId');
    const savedName = sessionStorage.getItem('netomateUserName');
    if (savedUser) {
        userId = savedUser;
        userName = savedName || savedUser;
        showApp();
        checkForPreviousProgress();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const uid = loginUserInput.value.trim();
        const pass = loginPassInput.value;

        if (!uid || !pass) return;

        loginBtn.disabled = true;
        loginBtn.querySelector('.btn-text').classList.add('hidden');
        loginBtn.querySelector('.loader').classList.remove('hidden');
        loginError.classList.add('hidden');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, password: pass })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            userId = data.user_id;
            userName = data.name || data.user_id;
            sessionStorage.setItem('netomateUserId', userId);
            sessionStorage.setItem('netomateUserName', userName);

            showApp();
            await checkForPreviousProgress();

        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
        } finally {
            loginBtn.disabled = false;
            loginBtn.querySelector('.btn-text').classList.remove('hidden');
            loginBtn.querySelector('.loader').classList.add('hidden');
        }
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('netomateUserId');
        sessionStorage.removeItem('netomateUserName');
        userId = null;
        userName = null;
        flowSteps = [];
        currentScenario = "";
        scenarioInput.value = "";
        updateScenarioUI();
        renderFlowSteps();
        queryInput.value = '';
        suggestionsList.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <p>Submit a query to see smart suggestions.</p>
            </div>`;
        appContainer.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        loginUserInput.value = '';
        loginPassInput.value = '';
        loginError.classList.add('hidden');
        loginUserInput.focus();
    });

    function showApp() {
        loginScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userGreeting.textContent = `Hi, ${userName}`;
    }

    async function checkForPreviousProgress() {
        try {
            const response = await fetch(`/api/get_session?user_id=${userId}`);
            const data = await response.json();

            if (data.status === 'ok') {
                // Check in-progress state first
                let progress = data.last_progress;

                // Fallback to most recent completed flow from history
                if ((!progress || (!progress.query && (!progress.flow_steps || progress.flow_steps.length === 0) && !progress.scenario))
                    && data.history && data.history.length > 0) {
                    const latest = data.history[0];
                    progress = {
                        query: latest.query || '',
                        flow_steps: latest.flow || [],
                        scenario: latest.scenario || ''
                    };
                }

                if (progress) {
                    const hasQuery = progress.query && progress.query.trim() !== '';
                    const hasFlow = progress.flow_steps && progress.flow_steps.length > 0;
                    const hasScenario = progress.scenario && progress.scenario.trim() !== '';

                    if (hasQuery || hasFlow || hasScenario) {
                        showResumeModal(progress);
                    }
                }
            }
        } catch (err) {
            console.warn('Failed to check previous progress:', err);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  RESUME MODAL
    // ═══════════════════════════════════════════════════════════════

    let pendingResume = null;

    function showResumeModal(progress) {
        pendingResume = progress;

        // Show query section
        if (progress.query && progress.query.trim()) {
            resumeQuerySection.classList.remove('hidden');
            resumeQueryText.textContent = `"${progress.query}"`;
        } else {
            resumeQuerySection.classList.add('hidden');
        }

        // Show flow section
        if (progress.flow_steps && progress.flow_steps.length > 0) {
            resumeFlowSection.classList.remove('hidden');
            let html = '';
            progress.flow_steps.forEach((step, idx) => {
                html += `
                    <div class="resume-flow-item">
                        <span class="resume-flow-num">${idx + 1}</span>
                        <span>${step}</span>
                    </div>`;
            });
            resumeFlowList.innerHTML = html;
        } else {
            resumeFlowSection.classList.add('hidden');
        }

        resumeModal.classList.remove('hidden');
    }

    resumeContinueBtn.addEventListener('click', () => {
        if (pendingResume) {
            if (pendingResume.query) {
                queryInput.value = pendingResume.query;
            }
            if (pendingResume.scenario) {
                currentScenario = pendingResume.scenario;
                scenarioInput.value = currentScenario;
                updateScenarioUI();
            }
            if (pendingResume.flow_steps && pendingResume.flow_steps.length > 0) {
                flowSteps = [...pendingResume.flow_steps];
                renderFlowSteps();
            }
        }
        pendingResume = null;
        resumeModal.classList.add('hidden');
    });

    resumeFreshBtn.addEventListener('click', () => {
        pendingResume = null;
        resumeModal.classList.add('hidden');
        // Clear saved progress on server
        if (userId) {
            fetch('/api/save_progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, query: '', flow_steps: [], scenario: '' })
            }).catch(() => {});
        }
    });

    // ═══════════════════════════════════════════════════════════════
    //  FLOW MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    function syncTextarea() {
        flowTextarea.value = flowSteps.join('\n');
        flowCount.textContent = `${flowSteps.length} step${flowSteps.length !== 1 ? 's' : ''}`;
        
        const hasSteps = flowSteps.length > 0;
        flowClearBtn.classList.toggle('hidden', !hasSteps);
        if (flowFinishBtn) flowFinishBtn.classList.toggle('hidden', !hasSteps);
        if (flowCopyBtn) flowCopyBtn.classList.toggle('hidden', !hasSteps);
        
        flowEmptyMsg.style.display = hasSteps ? 'none' : '';
    }

    function renderFlowSteps() {
        flowStepList.querySelectorAll('.flow-step-item, .flow-step-placeholder').forEach(el => el.remove());

        flowSteps.forEach((name, idx) => {
            const item = createStepElement(name, idx);
            flowStepList.appendChild(item);
        });

        syncTextarea();
    }

    function createStepElement(name, idx) {
        const item = document.createElement('div');
        item.className = 'flow-step-item';
        item.draggable = true;
        item.dataset.index = idx;

        item.innerHTML = `
            <span class="flow-step-handle" title="Drag to reorder">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
            </span>
            <span class="flow-step-num">${idx + 1}</span>
            <span class="flow-step-name" title="${name}">${name}</span>
            <button class="flow-step-remove" title="Remove step" data-remove="${idx}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('touchstart', handleTouchStart, { passive: false });
        item.addEventListener('touchmove', handleTouchMove, { passive: false });
        item.addEventListener('touchend', handleTouchEnd);

        item.querySelector('.flow-step-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            const removeIdx = parseInt(e.currentTarget.dataset.remove);
            flowSteps.splice(removeIdx, 1);
            renderFlowSteps();
            debounceSaveProgress();
        });

        return item;
    }

    // ── Add step ────────────────────────────────────────────────
    function addStep(name) {
        const cleaned = name.trim();
        if (!cleaned) return;
        flowSteps.push(cleaned);
        renderFlowSteps();
        debounceSaveProgress();
    }

    flowAddBtn.addEventListener('click', () => {
        addStep(flowAddInput.value);
        flowAddInput.value = '';
        flowAddInput.focus();
    });

    flowAddInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addStep(flowAddInput.value);
            flowAddInput.value = '';
        }
    });

    flowAddInput.addEventListener('paste', (e) => {
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const lines = pasted.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
        if (lines.length > 1) {
            e.preventDefault();
            lines.forEach(line => addStep(line));
            flowAddInput.value = '';
        }
    });

    flowClearBtn.addEventListener('click', () => {
        if (flowSteps.length === 0) return;
        if (confirm('Clear all flow steps?')) {
            flowSteps = [];
            renderFlowSteps();
            debounceSaveProgress();
        }
    });

    if (flowFinishBtn) {
        flowFinishBtn.addEventListener('click', async () => {
            if (flowSteps.length === 0) return;
            
            flowFinishBtn.disabled = true;
            flowFinishBtn.querySelector('.btn-text').classList.add('hidden');
            flowFinishBtn.querySelector('.loader').classList.remove('hidden');

            try {
                const response = await fetch('/api/save_session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        flow_steps: flowSteps,
                        query: queryInput.value.trim(),
                        scenario: currentScenario
                    })
                });
                const data = await response.json();
                if (data.status === 'ok') {
                    // Show a temporary success state without destroying the DOM
                    const originalText = flowFinishBtn.querySelector('.btn-text').textContent;
                    const btnIcon = flowFinishBtn.querySelector('svg');
                    
                    flowFinishBtn.classList.add('success-state');
                    flowFinishBtn.querySelector('.btn-text').textContent = 'Saved!';
                    
                    setTimeout(() => {
                        flowFinishBtn.classList.remove('success-state');
                        flowFinishBtn.querySelector('.btn-text').textContent = originalText;
                    }, 2000);
                }
            } catch (err) {
                console.warn('Failed to save session:', err);
                alert('Failed to store the flow. Check console.');
            } finally {
                flowFinishBtn.disabled = false;
                const btnTextEl = flowFinishBtn.querySelector('.btn-text');
                const loaderEl = flowFinishBtn.querySelector('.loader');
                if (btnTextEl) btnTextEl.classList.remove('hidden');
                if (loaderEl) loaderEl.classList.add('hidden');
            }
        });
    }

    // Modal Copy Logic
    if (flowCopyBtn) {
        flowCopyBtn.addEventListener('click', () => {
            modalTextarea.value = flowSteps.join('\n');
            rawTextModal.classList.remove('hidden');
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            rawTextModal.classList.add('hidden');
        });
    }

    if (copyModalBtn) {
        copyModalBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(modalTextarea.value)
                .then(() => {
                    const originalHTML = copyModalBtn.innerHTML;
                    copyModalBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 6L9 17l-5-5"></path>
                        </svg>
                        Copied!
                    `;
                    setTimeout(() => {
                        copyModalBtn.innerHTML = originalHTML;
                    }, 2000);
                })
                .catch(err => console.error('Failed to copy text: ', err));
        });
    }

    // ── Drag & Drop (mouse) ─────────────────────────────────────
    function handleDragStart(e) {
        dragSrcIndex = parseInt(this.dataset.index);
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragSrcIndex);
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        flowStepList.querySelectorAll('.flow-step-item').forEach(el => el.classList.remove('drag-over'));
        flowStepList.querySelectorAll('.flow-step-placeholder').forEach(el => el.remove());
        dragSrcIndex = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        e.preventDefault();
        this.classList.add('drag-over');
    }

    function handleDragLeave() {
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');

        const dropIdx = parseInt(this.dataset.index);
        if (dragSrcIndex === null || dragSrcIndex === dropIdx) return;

        const [moved] = flowSteps.splice(dragSrcIndex, 1);
        flowSteps.splice(dropIdx, 0, moved);
        renderFlowSteps();
        debounceSaveProgress();
    }

    // ── Touch Drag (mobile) ─────────────────────────────────────
    let touchDragItem = null;
    let touchClone = null;
    let touchStartY = 0;

    function handleTouchStart(e) {
        if (e.target.closest('.flow-step-remove')) return;
        touchDragItem = this;
        touchStartY = e.touches[0].clientY;
        dragSrcIndex = parseInt(this.dataset.index);

        const timer = setTimeout(() => {
            touchDragItem.classList.add('dragging');
        }, 150);
        touchDragItem._touchTimer = timer;
    }

    function handleTouchMove(e) {
        if (!touchDragItem) return;
        e.preventDefault();

        const touch = e.touches[0];
        const items = [...flowStepList.querySelectorAll('.flow-step-item:not(.dragging)')];

        items.forEach(el => {
            const rect = el.getBoundingClientRect();
            el.classList.toggle('drag-over', touch.clientY > rect.top && touch.clientY < rect.bottom);
        });
    }

    function handleTouchEnd(e) {
        if (!touchDragItem) return;
        clearTimeout(touchDragItem._touchTimer);

        const overItem = flowStepList.querySelector('.flow-step-item.drag-over');
        if (overItem) {
            const dropIdx = parseInt(overItem.dataset.index);
            if (dragSrcIndex !== null && dragSrcIndex !== dropIdx) {
                const [moved] = flowSteps.splice(dragSrcIndex, 1);
                flowSteps.splice(dropIdx, 0, moved);
                renderFlowSteps();
                debounceSaveProgress();
            }
        }

        flowStepList.querySelectorAll('.flow-step-item').forEach(el => {
            el.classList.remove('dragging');
            el.classList.remove('drag-over');
        });

        touchDragItem = null;
        dragSrcIndex = null;
    }

    // Quick prompt buttons
    document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            queryInput.value = btn.textContent;
            suggestBtn.click();
        });
    });

    // ── Get Suggestions ─────────────────────────────────────────
    suggestBtn.addEventListener('click', async () => {
        const query = queryInput.value.trim();
        const flowLines = flowSteps.slice();
        currentFlowState = [...flowLines];

        suggestBtn.disabled = true;
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
        suggestionsList.innerHTML = '';

        currentSuggestions = [];

        // Auto-save progress on query
        debounceSaveProgress();

        try {
            const response = await fetch('/api/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    current_flow: flowLines,
                    scenario: currentScenario,
                    use_memory: true,
                    session_log: sessionLog
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            currentSuggestions = data.suggestions || [];
            addLogEvent('interaction', query || "(Automatic Analysis)", currentSuggestions);
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

    // ── Render suggestions ──────────────────────────────────────
    function getSourceColor(source) {
        const colors = {
            'gpt-oss-120b': { bg: 'rgba(16, 163, 127, 0.12)', text: '#34d399', border: 'rgba(16, 163, 127, 0.25)' },
            frequency: { bg: 'rgba(0, 201, 167, 0.12)', text: '#00ffcc', border: 'rgba(0, 201, 167, 0.25)' },
            llm: { bg: 'rgba(139, 109, 255, 0.12)', text: '#b09aff', border: 'rgba(139, 109, 255, 0.25)' },
        };
        return colors[source] || colors.llm;
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

        suggestions.forEach((item, idx) => {
            const func = item.function || 'unknown_function';
            const exp = item.explanation || 'No explanation provided.';
            const conf = item.confidence || 0;
            const source = item.source || 'llm';
            const occurrences = item.occurrences || 0;

            let colorClass = 'score-low';
            if (conf >= 80) colorClass = 'score-high';
            else if (conf >= 50) colorClass = 'score-med';

            let typeBadgeHtml = '';
            if (item.type === 'missing') {
                typeBadgeHtml = `<span class="source-badge" style="background:rgba(255, 193, 7, 0.15);color:#ffb700;border:1px solid rgba(255, 193, 7, 0.3)">⚠️ Missing</span>`;
            } else if (item.type === 'next') {
                typeBadgeHtml = `<span class="source-badge" style="background:rgba(23, 162, 184, 0.15);color:#17a2b8;border:1px solid rgba(23, 162, 184, 0.3)">⏭️ Next</span>`;
            }

            const isSelected = flowSteps.includes(func) ? 'selected' : '';

            html += `
                <div class="suggestion-card clickable ${isSelected}" data-fn="${func}" title="Click to add to flow">
                    <div class="rank-pill">${idx + 1}</div>
                    <div class="suggestion-content">
                        <div class="suggestion-header">
                            <div class="func-name">${func}</div>
                            <div class="suggestion-badges">
                                ${typeBadgeHtml}
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

        document.querySelectorAll('.suggestion-card.clickable').forEach(card => {
            card.addEventListener('click', () => handleSuggestionClick(card));
        });
    }

    async function handleSuggestionClick(card) {
        const fn = card.dataset.fn;
        if (!fn) return;

        const isSelected = card.classList.contains('selected');

        if (isSelected) {
            card.classList.remove('selected');
            const idx = flowSteps.lastIndexOf(fn);
            if (idx !== -1) {
                flowSteps.splice(idx, 1);
                renderFlowSteps();
            }
            // Remove highlight from timeline
            document.querySelectorAll(`.details-list li[data-fn="${fn}"]`).forEach(li => li.classList.remove('selected-item'));
        } else {
            card.classList.add('selected');
            flowSteps.push(fn);
            renderFlowSteps();

            // Highlight in timeline
            document.querySelectorAll(`.details-list li[data-fn="${fn}"]`).forEach(li => li.classList.add('selected-item'));

            try {
                // We no longer log separate selection events as they are visually reflected in the interaction cards
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

        debounceSaveProgress();
    }
});
