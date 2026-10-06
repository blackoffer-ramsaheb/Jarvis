/**
 * J.A.R.V.I.S. Mark II Client Controller & Integration Engine
 * Full-Duplex Streaming, Multi-Turn Memory, Hardware Telemetry & Audio Synthesis
 */

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "";

    // DOM Elements - Navigation & Status
    const liveClock = document.getElementById("liveClock");
    const systemStatus = document.getElementById("systemStatus");
    const statusText = systemStatus.querySelector(".status-text");
    const ttsToggleBtn = document.getElementById("ttsToggleBtn");
    const sfxToggleBtn = document.getElementById("sfxToggleBtn");
    const arcReactor = document.getElementById("arcReactor");
    const arcStatusText = document.getElementById("arcStatusText");

    // Telemetry Gauges
    const cpuStatVal = document.getElementById("cpuStatVal");
    const cpuGaugeFill = document.getElementById("cpuGaugeFill");
    const ramStatVal = document.getElementById("ramStatVal");
    const ramGaugeFill = document.getElementById("ramGaugeFill");
    const diskStatVal = document.getElementById("diskStatVal");
    const diskGaugeFill = document.getElementById("diskGaugeFill");
    const osStatVal = document.getElementById("osStatVal");
    const powerStatVal = document.getElementById("powerStatVal");

    // Tabs
    const navTabs = document.querySelectorAll(".nav-tab");
    const tabPanes = document.querySelectorAll(".tab-pane");
    const taskCountBadge = document.getElementById("taskCountBadge");
    const docCountBadge = document.getElementById("docCountBadge");

    // Chat Elements
    const messagesStream = document.getElementById("messagesStream");
    const chatForm = document.getElementById("chatForm");
    const userInput = document.getElementById("userInput");
    const sendBtn = document.getElementById("sendBtn");
    const micBtn = document.getElementById("micBtn");
    const clearChatBtn = document.getElementById("clearChatBtn");
    const promptChips = document.querySelectorAll(".prompt-chip");

    // Task Elements
    const taskListContainer = document.getElementById("taskListContainer");
    const createTaskForm = document.getElementById("createTaskForm");
    const newTaskInput = document.getElementById("newTaskInput");
    const newTaskPriority = document.getElementById("newTaskPriority");
    const refreshTasksBtn = document.getElementById("refreshTasksBtn");
    const filterTabBtns = document.querySelectorAll(".filter-tab-btn");
    const filterCountLabel = document.getElementById("filterCountLabel");

    // RAG Elements
    const pdfDropzone = document.getElementById("pdfDropzone");
    const fileInput = document.getElementById("fileInput");
    const browseBtn = document.getElementById("browseBtn");
    const uploadProgress = document.getElementById("uploadProgress");
    const uploadFileName = document.getElementById("uploadFileName");
    const uploadStatusText = document.getElementById("uploadStatusText");
    const progressFill = document.getElementById("progressFill");
    const docList = document.getElementById("docList");
    const resetKnowledgeBtn = document.getElementById("resetKnowledgeBtn");
    const refreshDocsBtn = document.getElementById("refreshDocsBtn");

    const toastEl = document.getElementById("toast");

    // State Variables
    let isTtsEnabled = true;
    let isSfxEnabled = true;
    let isRecording = false;
    let currentTaskFilter = "all";
    let activeSessionId = localStorage.getItem("jarvis_session_id") || "session_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("jarvis_session_id", activeSessionId);

    // -------------------------------------------------------------
    // 1. Audio Synthesizer (Sci-Fi Sound FX using Web Audio API)
    // -------------------------------------------------------------
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playSfx(type) {
        if (!isSfxEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            if (type === "boot") {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "sine";
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === "send") {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "sine";
                osc.frequency.setValueAtTime(520, now);
                osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                osc.start(now);
                osc.stop(now + 0.14);
            } else if (type === "receive") {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "triangle";
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.setValueAtTime(1050, now + 0.08);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === "tool") {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "sine";
                osc.frequency.setValueAtTime(660, now);
                osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            }
        } catch (e) {
            // Audio context policy fallback
        }
    }

    if (sfxToggleBtn) {
        sfxToggleBtn.addEventListener("click", () => {
            isSfxEnabled = !isSfxEnabled;
            if (isSfxEnabled) {
                sfxToggleBtn.classList.remove("muted");
                sfxToggleBtn.innerHTML = '<i class="fa-solid fa-bell"></i>';
                showToast("HUD Sound FX enabled");
                playSfx("boot");
            } else {
                sfxToggleBtn.classList.add("muted");
                sfxToggleBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i>';
                showToast("HUD Sound FX muted");
            }
        });
    }

    // -------------------------------------------------------------
    // 2. Live Clock & Telemetry Polling
    // -------------------------------------------------------------
    function updateClock() {
        const now = new Date();
        liveClock.textContent = now.toLocaleTimeString("en-US", { hour12: false });
    }
    setInterval(updateClock, 1000);
    updateClock();

    async function fetchTelemetry() {
        try {
            const res = await fetch(`${API_BASE}/system/stats`);
            if (!res.ok) throw new Error("Telemetry offline");
            const data = await res.json();

            // CPU
            const cpu = data.cpu_percent || 0;
            cpuStatVal.textContent = `${cpu}%`;
            cpuGaugeFill.style.width = `${Math.min(cpu, 100)}%`;
            if (cpu > 80) cpuGaugeFill.classList.add("high-load");
            else cpuGaugeFill.classList.remove("high-load");

            // RAM
            const ramPct = data.ram_percent || 0;
            ramStatVal.textContent = `${ramPct}% (${data.ram_used_gb || 0}GB)`;
            ramGaugeFill.style.width = `${Math.min(ramPct, 100)}%`;

            // Disk
            const diskPct = data.disk_percent || 0;
            diskStatVal.textContent = `${diskPct}%`;
            diskGaugeFill.style.width = `${Math.min(diskPct, 100)}%`;

            // Meta
            if (data.os) osStatVal.innerHTML = `<i class="fa-brands fa-windows"></i> ${data.os}`;
            if (data.battery_percent !== null && data.battery_percent !== undefined) {
                const plugIcon = data.is_charging ? "bolt" : "battery-half";
                powerStatVal.innerHTML = `<i class="fa-solid fa-${plugIcon}"></i> ${data.battery_percent}%`;
            } else {
                powerStatVal.innerHTML = `<i class="fa-solid fa-bolt"></i> AC Online`;
            }

            systemStatus.classList.remove("offline");
            statusText.textContent = "JARVIS ONLINE";
        } catch (e) {
            systemStatus.classList.add("offline");
            statusText.textContent = "DISCONNECTED";
        }
    }
    fetchTelemetry();
    setInterval(fetchTelemetry, 4000);

    // -------------------------------------------------------------
    // 3. Arc Reactor Visual State Control
    // -------------------------------------------------------------
    function setArcState(state, text) {
        arcReactor.classList.remove("thinking", "listening");
        if (state === "thinking") arcReactor.classList.add("thinking");
        if (state === "listening") arcReactor.classList.add("listening");
        arcStatusText.textContent = text || "SYSTEM READY";
    }

    // -------------------------------------------------------------
    // 4. Tab Navigation
    // -------------------------------------------------------------
    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.tab;
            navTabs.forEach(t => t.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));

            tab.classList.add("active");
            const targetPane = document.getElementById(target);
            if (targetPane) targetPane.classList.add("active");

            if (target === "tasks-panel") loadTasks(currentTaskFilter);
            if (target === "rag-panel") loadDocuments();
        });
    });

    // -------------------------------------------------------------
    // 5. Toast Notifications
    // -------------------------------------------------------------
    let toastTimeout;
    function showToast(message) {
        clearTimeout(toastTimeout);
        toastEl.textContent = message;
        toastEl.classList.add("show");
        toastTimeout = setTimeout(() => {
            toastEl.classList.remove("show");
        }, 3500);
    }

    // -------------------------------------------------------------
    // 6. Text-To-Speech (TTS)
    // -------------------------------------------------------------
    ttsToggleBtn.addEventListener("click", () => {
        isTtsEnabled = !isTtsEnabled;
        if (isTtsEnabled) {
            ttsToggleBtn.classList.remove("muted");
            ttsToggleBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            showToast("Voice response enabled");
        } else {
            ttsToggleBtn.classList.add("muted");
            ttsToggleBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            showToast("Voice response muted");
        }
    });

    function speakText(text) {
        if (!isTtsEnabled || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();

        const cleanText = text
            .replace(/[*#_`~\[\]]/g, "")
            .replace(/https?:\/\/\S+/g, "link")
            .trim();

        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.05;
        utterance.pitch = 0.95;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes("Google") || v.name.includes("Natural") || v.lang.startsWith("en"));
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onstart = () => {
            setArcState("listening", "TRANSMITTING VOICE");
        };
        utterance.onend = () => {
            setArcState("ready", "SYSTEM READY");
        };
        utterance.onerror = () => {
            setArcState("ready", "SYSTEM READY");
        };

        window.speechSynthesis.speak(utterance);
    }

    // -------------------------------------------------------------
    // 7. Speech-to-Text (Voice Recognition)
    // -------------------------------------------------------------
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add("recording");
            setArcState("listening", "AUDIO LISTENING...");
            showToast("Listening to voice directive...");
            playSfx("boot");
        };

        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            userInput.value = transcript;
            handleUserMessage(transcript);
        };

        recognition.onerror = (e) => {
            showToast(`Voice input error: ${e.error}`);
            stopRecording();
        };

        recognition.onend = () => {
            stopRecording();
        };

        function stopRecording() {
            isRecording = false;
            micBtn.classList.remove("recording");
            setArcState("ready", "SYSTEM READY");
        }

        micBtn.addEventListener("click", () => {
            if (!isRecording) {
                try {
                    recognition.start();
                } catch (e) {
                    console.warn(e);
                }
            } else {
                recognition.stop();
            }
        });
    } else {
        micBtn.style.opacity = "0.5";
        micBtn.title = "Speech Recognition not supported in this browser";
    }

    // -------------------------------------------------------------
    // 8. Live Chat & Full-Duplex Token Streaming Engine
    // -------------------------------------------------------------
    function appendMessage(sender, text, isMarkdown = true) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const bubble = document.createElement("div");
        bubble.className = `message-bubble ${sender}`;

        let parsedHtml = text;
        if (isMarkdown && typeof marked !== "undefined") {
            parsedHtml = marked.parse(text);
        }

        bubble.innerHTML = `
            <div class="avatar">
                <i class="fa-solid ${sender === 'assistant' ? 'fa-robot' : 'fa-user'}"></i>
            </div>
            <div class="bubble-content">
                <div class="sender-name">${sender === 'assistant' ? 'JARVIS' : 'OPERATOR'}</div>
                <div class="text-body">${parsedHtml}</div>
                <div class="bubble-footer">
                    <span class="time-stamp">${timeStr}</span>
                    ${sender === 'assistant' ? `
                    <div class="bubble-actions">
                        <button class="mini-action-btn copy-btn" title="Copy text"><i class="fa-regular fa-copy"></i></button>
                        <button class="mini-action-btn speak-btn" title="Speak response"><i class="fa-solid fa-volume-high"></i></button>
                    </div>` : ''}
                </div>
            </div>
        `;

        const copyBtn = bubble.querySelector(".copy-btn");
        if (copyBtn) {
            copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard"));
            });
        }

        const speakBtn = bubble.querySelector(".speak-btn");
        if (speakBtn) {
            speakBtn.addEventListener("click", () => {
                speakText(text);
            });
        }

        messagesStream.appendChild(bubble);
        messagesStream.scrollTop = messagesStream.scrollHeight;
        return bubble;
    }

    function createStreamingBubble() {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const bubble = document.createElement("div");
        bubble.className = "message-bubble assistant streaming-bubble";

        bubble.innerHTML = `
            <div class="avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="bubble-content">
                <div class="sender-name">JARVIS</div>
                <div class="tool-trace-container" style="display:none;"></div>
                <div class="text-body"><span class="streaming-text"></span><span class="streaming-cursor"></span></div>
                <div class="bubble-footer">
                    <span class="time-stamp">${timeStr}</span>
                    <div class="bubble-actions" style="display:none;">
                        <button class="mini-action-btn copy-btn" title="Copy text"><i class="fa-regular fa-copy"></i></button>
                        <button class="mini-action-btn speak-btn" title="Speak response"><i class="fa-solid fa-volume-high"></i></button>
                    </div>
                </div>
            </div>
        `;

        messagesStream.appendChild(bubble);
        messagesStream.scrollTop = messagesStream.scrollHeight;
        return {
            element: bubble,
            traceContainer: bubble.querySelector(".tool-trace-container"),
            textContainer: bubble.querySelector(".streaming-text"),
            cursor: bubble.querySelector(".streaming-cursor"),
            footerActions: bubble.querySelector(".bubble-actions"),
            copyBtn: bubble.querySelector(".copy-btn"),
            speakBtn: bubble.querySelector(".speak-btn")
        };
    }

    async function handleUserMessage(message) {
        if (!message || !message.trim()) return;
        const query = message.trim();

        appendMessage("user", query, false);
        userInput.value = "";
        userInput.style.height = "auto";
        sendBtn.disabled = true;

        playSfx("send");
        setArcState("thinking", "PROCESSING QUERY");

        const streamBubble = createStreamingBubble();
        let accumulatedText = "";

        try {
            const response = await fetch(`${API_BASE}/ask/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: query, session_id: activeSessionId })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to connect`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop(); // Keep partial line for next iteration

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const jsonStr = line.slice(6).trim();
                        if (!jsonStr) continue;

                        try {
                            const event = JSON.parse(jsonStr);

                            if (event.type === "tool_start") {
                                playSfx("tool");
                                streamBubble.traceContainer.style.display = "flex";
                                const toolItem = document.createElement("div");
                                toolItem.className = "tool-trace-item";
                                toolItem.id = `tool-${event.name}`;
                                toolItem.innerHTML = `
                                    <i class="fa-solid fa-gear fa-spin" style="color:var(--cyan-primary);"></i>
                                    <span class="tool-name-badge">${event.name}</span>
                                    <span class="tool-output-chip">Executing protocol...</span>
                                `;
                                streamBubble.traceContainer.appendChild(toolItem);
                                setArcState("thinking", `EXECUTING ${event.name.toUpperCase()}`);
                                messagesStream.scrollTop = messagesStream.scrollHeight;
                            }
                            else if (event.type === "tool_end") {
                                playSfx("tool");
                                const toolItem = streamBubble.traceContainer.querySelector(`#tool-${event.name}`);
                                if (toolItem) {
                                    toolItem.innerHTML = `
                                        <i class="fa-solid fa-check" style="color:var(--green-active);"></i>
                                        <span class="tool-name-badge">${event.name}</span>
                                        <span class="tool-output-chip">${escapeHtml(event.output || "Completed")}</span>
                                    `;
                                }
                                messagesStream.scrollTop = messagesStream.scrollHeight;
                            }
                            else if (event.type === "token") {
                                accumulatedText += event.content;
                                if (typeof marked !== "undefined") {
                                    streamBubble.textContainer.innerHTML = marked.parse(accumulatedText);
                                } else {
                                    streamBubble.textContainer.textContent = accumulatedText;
                                }
                                messagesStream.scrollTop = messagesStream.scrollHeight;
                            }
                            else if (event.type === "done") {
                                if (event.content && !accumulatedText) {
                                    accumulatedText = event.content;
                                    if (typeof marked !== "undefined") {
                                        streamBubble.textContainer.innerHTML = marked.parse(accumulatedText);
                                    } else {
                                        streamBubble.textContainer.textContent = accumulatedText;
                                    }
                                }
                            }
                            else if (event.type === "error") {
                                accumulatedText += `\n\n⚠️ **Error:** ${event.content}`;
                                streamBubble.textContainer.innerHTML = marked.parse(accumulatedText);
                            }
                        } catch (parseErr) {
                            console.error("SSE JSON parse error:", parseErr, jsonStr);
                        }
                    }
                }
            }

            // Finalize stream bubble
            if (streamBubble.cursor) streamBubble.cursor.remove();
            streamBubble.footerActions.style.display = "flex";

            // Wire actions
            streamBubble.copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(accumulatedText).then(() => showToast("Copied to clipboard"));
            });
            streamBubble.speakBtn.addEventListener("click", () => {
                speakText(accumulatedText);
            });

            playSfx("receive");
            speakText(accumulatedText);

            // If task command detected, refresh task board
            if (/task/i.test(query)) {
                loadTasks(currentTaskFilter);
            }
        } catch (err) {
            console.error("Streaming error, falling back to synchronous /ask:", err);
            // Fallback sync attempt
            try {
                const res = await fetch(`${API_BASE}/ask`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: query, session_id: activeSessionId })
                });
                const data = await res.json();
                if (streamBubble.cursor) streamBubble.cursor.remove();
                streamBubble.textContainer.innerHTML = marked.parse(data.answer);
                streamBubble.footerActions.style.display = "flex";
                speakText(data.answer);
            } catch (fallbackErr) {
                if (streamBubble.cursor) streamBubble.cursor.remove();
                streamBubble.textContainer.innerHTML = `⚠️ **Error:** Unable to complete directive. (${err.message})`;
            }
        } finally {
            setArcState("ready", "SYSTEM READY");
            sendBtn.disabled = false;
        }
    }

    // Chat form submit
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleUserMessage(userInput.value);
    });

    // Auto-expand textarea & Enter to submit
    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event("submit"));
        }
    });

    userInput.addEventListener("input", () => {
        userInput.style.height = "auto";
        userInput.style.height = `${Math.min(userInput.scrollHeight, 120)}px`;
    });

    // Reset Session & Clear History
    clearChatBtn.addEventListener("click", async () => {
        try {
            await fetch(`${API_BASE}/chat/history?session_id=${activeSessionId}`, { method: "DELETE" });
        } catch (e) {
            console.warn("Could not delete server history:", e);
        }
        // Rotate session ID
        activeSessionId = "session_" + Math.random().toString(36).substring(2, 9);
        localStorage.setItem("jarvis_session_id", activeSessionId);

        messagesStream.innerHTML = "";
        appendMessage("assistant", "Session memory purged. New neural context established. Jarvis standing by.");
        playSfx("boot");
        showToast("New session initialized");
    });

    // Quick Prompt Chips
    promptChips.forEach(chip => {
        chip.addEventListener("click", () => {
            const prompt = chip.dataset.prompt;
            userInput.value = prompt;
            handleUserMessage(prompt);
        });
    });

    // -------------------------------------------------------------
    // 9. Interactive Task Manager API
    // -------------------------------------------------------------
    async function loadTasks(filter = "all") {
        taskListContainer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Syncing tasks...</div>`;
        try {
            const url = filter === "all" ? `${API_BASE}/tasks` : `${API_BASE}/tasks?status=${filter}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to load tasks");
            const data = await res.json();
            renderTasks(data.tasks || []);
        } catch (err) {
            taskListContainer.innerHTML = `<div class="empty-state">⚠️ Failed to load tasks (${err.message})</div>`;
        }
    }

    function renderTasks(tasks) {
        taskCountBadge.textContent = tasks.length;
        filterCountLabel.textContent = `Showing ${tasks.length} task${tasks.length === 1 ? '' : 's'}`;

        if (!tasks || tasks.length === 0) {
            taskListContainer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-clipboard-check"></i> No tasks match current filter.</div>`;
            return;
        }

        taskListContainer.innerHTML = "";
        tasks.forEach(task => {
            const isDone = task.status === "completed";
            const card = document.createElement("div");
            card.className = `task-card ${isDone ? 'completed' : ''}`;

            const prioClass = (task.priority || "medium").toLowerCase();

            card.innerHTML = `
                <div class="task-left-group">
                    <button class="task-check-btn" title="Toggle Status" data-id="${task.id}" data-status="${task.status}">
                        <i class="fa-solid ${isDone ? 'fa-check' : 'fa-circle-dot'}"></i>
                    </button>
                    <div class="task-details">
                        <div class="task-text-row">
                            <span class="prio-badge ${prioClass}">${prioClass}</span>
                            <span class="task-text">${escapeHtml(task.task)}</span>
                        </div>
                        <span class="task-meta">#${task.id} &bull; ${task.status.toUpperCase()} &bull; ${task.created_at || 'Recent'}</span>
                    </div>
                </div>
                <button class="delete-task-btn" title="Delete Task" data-id="${task.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            // Toggle Complete
            card.querySelector(".task-check-btn").addEventListener("click", async () => {
                const nextStatus = isDone ? "pending" : "completed";
                try {
                    await fetch(`${API_BASE}/tasks/${task.id}/status`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: nextStatus })
                    });
                    playSfx("tool");
                    loadTasks(currentTaskFilter);
                } catch (e) {
                    showToast(`Error: ${e.message}`);
                }
            });

            // Delete Task
            card.querySelector(".delete-task-btn").addEventListener("click", async () => {
                try {
                    await fetch(`${API_BASE}/tasks/${task.id}`, { method: "DELETE" });
                    playSfx("tool");
                    showToast(`Task #${task.id} deleted`);
                    loadTasks(currentTaskFilter);
                } catch (e) {
                    showToast(`Error: ${e.message}`);
                }
            });

            taskListContainer.appendChild(card);
        });
    }

    createTaskForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = newTaskInput.value.trim();
        const prio = newTaskPriority.value;
        if (!text) return;

        try {
            const res = await fetch(`${API_BASE}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ task: text, priority: prio })
            });
            if (!res.ok) throw new Error("Could not add task");
            newTaskInput.value = "";
            playSfx("tool");
            showToast("Task created successfully");
            loadTasks(currentTaskFilter);
        } catch (err) {
            showToast(`Error: ${err.message}`);
        }
    });

    filterTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterTabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentTaskFilter = btn.dataset.filter;
            loadTasks(currentTaskFilter);
        });
    });

    refreshTasksBtn.addEventListener("click", () => {
        loadTasks(currentTaskFilter);
        showToast("Tasks synchronized");
    });

    // -------------------------------------------------------------
    // 10. Multi-Format Knowledge Hub & Document RAG
    // -------------------------------------------------------------
    async function loadDocuments() {
        try {
            const res = await fetch(`${API_BASE}/documents`);
            if (!res.ok) return;
            const data = await res.json();
            renderDocuments(data.documents || []);
        } catch (e) {
            console.error(e);
        }
    }

    function renderDocuments(docs) {
        docCountBadge.textContent = docs.length;
        if (!docs || docs.length === 0) {
            docList.innerHTML = `<div class="empty-state">No documents indexed yet. Upload a document above.</div>`;
            return;
        }

        docList.innerHTML = "";
        docs.forEach(doc => {
            const ext = (doc.extension || "").toLowerCase();
            let iconClass = "fa-file-lines";
            if (ext === ".pdf") iconClass = "fa-file-pdf";
            else if (ext === ".docx" || ext === ".doc") iconClass = "fa-file-word";
            else if (ext === ".csv") iconClass = "fa-file-csv";
            else if (ext === ".txt" || ext === ".md") iconClass = "fa-file-code";

            const card = document.createElement("div");
            card.className = "doc-card";
            card.innerHTML = `
                <div class="doc-info">
                    <i class="fa-solid ${iconClass}" style="color:var(--cyan-primary);font-size:1.4rem;"></i>
                    <div>
                        <div class="doc-name">${escapeHtml(doc.filename)}</div>
                        <div class="doc-size">${doc.size_kb} KB &bull; ${ext.toUpperCase().replace('.', '')}</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span class="indexed-badge"><i class="fa-solid fa-check"></i> Indexed</span>
                    <button class="delete-doc-btn" title="Delete Document" data-file="${escapeHtml(doc.filename)}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            card.querySelector(".delete-doc-btn").addEventListener("click", async () => {
                if (!confirm(`Remove document '${doc.filename}' and update knowledge index?`)) return;
                try {
                    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(doc.filename)}`, {
                        method: "DELETE"
                    });
                    if (!res.ok) throw new Error("Delete failed");
                    playSfx("tool");
                    showToast(`Document '${doc.filename}' deleted`);
                    loadDocuments();
                } catch (e) {
                    showToast(`Error: ${e.message}`);
                }
            });

            docList.appendChild(card);
        });
    }

    browseBtn.addEventListener("click", () => fileInput.click());
    pdfDropzone.addEventListener("click", (e) => {
        if (e.target !== browseBtn) fileInput.click();
    });

    pdfDropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        pdfDropzone.classList.add("dragover");
    });

    pdfDropzone.addEventListener("dragleave", () => {
        pdfDropzone.classList.remove("dragover");
    });

    pdfDropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        pdfDropzone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            handleFileUpload(fileInput.files[0]);
        }
    });

    async function handleFileUpload(file) {
        const allowedExts = [".pdf", ".docx", ".doc", ".txt", ".md", ".csv"];
        const fileExt = "." + file.name.split(".").pop().toLowerCase();
        if (!allowedExts.includes(fileExt)) {
            showToast(`Unsupported format. Supported: ${allowedExts.join(", ")}`);
            return;
        }

        uploadProgress.style.display = "block";
        uploadFileName.textContent = file.name;
        uploadStatusText.textContent = "Parsing & indexing vector chunks...";
        progressFill.style.width = "40%";

        const formData = new FormData();
        formData.append("file", file);

        try {
            setArcState("thinking", "INDEXING VECTOR DB");
            const res = await fetch(`${API_BASE}/upload`, {
                method: "POST",
                body: formData
            });

            progressFill.style.width = "85%";

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `Server responded with status ${res.status}`);
            }

            const data = await res.json();
            progressFill.style.width = "100%";
            uploadStatusText.textContent = `Indexed ${data.chunks} chunks successfully!`;
            playSfx("tool");
            showToast(`Uploaded & indexed ${data.chunks} chunks`);

            setTimeout(() => {
                uploadProgress.style.display = "none";
                progressFill.style.width = "0%";
            }, 3000);

            loadDocuments();
        } catch (err) {
            uploadStatusText.textContent = `Error: ${err.message}`;
            progressFill.style.background = "var(--red-alert)";
            showToast(`Upload failed: ${err.message}`);
            setTimeout(() => {
                progressFill.style.background = "linear-gradient(90deg, var(--cyan-primary), var(--green-active))";
            }, 4000);
        } finally {
            setArcState("ready", "SYSTEM READY");
            fileInput.value = "";
        }
    }

    if (resetKnowledgeBtn) {
        resetKnowledgeBtn.addEventListener("click", async () => {
            if (!confirm("Are you sure you want to purge all indexed documents and reset the vector store?")) return;
            try {
                const res = await fetch(`${API_BASE}/documents/reset`, { method: "POST" });
                if (!res.ok) throw new Error("Reset failed");
                playSfx("tool");
                showToast("Knowledge base purged successfully");
                loadDocuments();
            } catch (e) {
                showToast(`Error: ${e.message}`);
            }
        });
    }

    if (refreshDocsBtn) {
        refreshDocsBtn.addEventListener("click", () => {
            loadDocuments();
            showToast("Document library refreshed");
        });
    }

    // Helper: Escape HTML
    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Initial load
    playSfx("boot");
    loadTasks(currentTaskFilter);
    loadDocuments();
});
