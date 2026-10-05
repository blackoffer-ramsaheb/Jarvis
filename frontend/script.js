/**
 * J.A.R.V.I.S. Client Controller & Integration Engine
 */

document.addEventListener("DOMContentLoaded", () => {
    // API Endpoints
    const API_BASE = ""; // Relative path allows working seamlessly behind FastAPI or proxy

    // DOM Elements
    const liveClock = document.getElementById("liveClock");
    const systemStatus = document.getElementById("systemStatus");
    const statusText = systemStatus.querySelector(".status-text");
    const ttsToggleBtn = document.getElementById("ttsToggleBtn");
    const arcReactor = document.getElementById("arcReactor");
    const arcStatusText = document.getElementById("arcStatusText");

    // Navigation & Tabs
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
    const refreshTasksBtn = document.getElementById("refreshTasksBtn");

    // RAG Elements
    const pdfDropzone = document.getElementById("pdfDropzone");
    const fileInput = document.getElementById("fileInput");
    const browseBtn = document.getElementById("browseBtn");
    const uploadProgress = document.getElementById("uploadProgress");
    const uploadFileName = document.getElementById("uploadFileName");
    const uploadStatusText = document.getElementById("uploadStatusText");
    const progressFill = document.getElementById("progressFill");
    const docList = document.getElementById("docList");

    const toastEl = document.getElementById("toast");

    // State Variables
    let isTtsEnabled = true;
    let isRecording = false;
    let speechRecognition = null;

    // -------------------------------------------------------------
    // 1. Clock & System Health Diagnostics
    // -------------------------------------------------------------
    function updateClock() {
        const now = new Date();
        liveClock.textContent = now.toLocaleTimeString("en-US", { hour12: false });
    }
    setInterval(updateClock, 1000);
    updateClock();

    async function checkSystemHealth() {
        try {
            const res = await fetch(`${API_BASE}/api/health`);
            if (res.ok) {
                systemStatus.classList.remove("offline");
                statusText.textContent = "JARVIS ONLINE";
            } else {
                throw new Error("API error");
            }
        } catch (err) {
            systemStatus.classList.add("offline");
            statusText.textContent = "DISCONNECTED";
        }
    }
    checkSystemHealth();
    setInterval(checkSystemHealth, 15000);

    // -------------------------------------------------------------
    // 2. Arc Reactor Visual State Control
    // -------------------------------------------------------------
    function setArcState(state, text) {
        arcReactor.classList.remove("thinking", "listening");
        if (state === "thinking") arcReactor.classList.add("thinking");
        if (state === "listening") arcReactor.classList.add("listening");
        arcStatusText.textContent = text || "SYSTEM READY";
    }

    // -------------------------------------------------------------
    // 3. Tab Navigation
    // -------------------------------------------------------------
    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.tab;
            navTabs.forEach(t => t.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));

            tab.classList.add("active");
            const targetPane = document.getElementById(target);
            if (targetPane) targetPane.classList.add("active");

            if (target === "tasks-panel") loadTasks();
            if (target === "rag-panel") loadDocuments();
        });
    });

    // -------------------------------------------------------------
    // 4. Toast Notifications
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
    // 5. Text-To-Speech (TTS)
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
        window.speechSynthesis.cancel(); // cancel pending

        // Remove markdown formatting / symbols for speech
        const cleanText = text
            .replace(/[*#_`~\[\]]/g, "")
            .replace(/https?:\/\/\S+/g, "link")
            .trim();

        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.05;
        utterance.pitch = 0.95;

        // Try to find an English voice
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
    // 6. Speech-to-Text (Voice Recognition)
    // -------------------------------------------------------------
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous = false;
        speechRecognition.interimResults = false;
        speechRecognition.lang = "en-US";

        speechRecognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add("recording");
            setArcState("listening", "AUDIO LISTENING...");
            showToast("Listening to voice directive...");
        };

        speechRecognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            userInput.value = transcript;
            handleUserMessage(transcript);
        };

        speechRecognition.onerror = (e) => {
            console.error("Speech recognition error:", e.error);
            showToast(`Voice input error: ${e.error}`);
            stopRecording();
        };

        speechRecognition.onend = () => {
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
                    speechRecognition.start();
                } catch (e) {
                    console.warn(e);
                }
            } else {
                speechRecognition.stop();
            }
        });
    } else {
        micBtn.style.opacity = "0.5";
        micBtn.title = "Speech Recognition not supported in this browser";
    }

    // -------------------------------------------------------------
    // 7. Live Chat & Directive Handling
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

        // Copy button handler
        const copyBtn = bubble.querySelector(".copy-btn");
        if (copyBtn) {
            copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard"));
            });
        }

        // Speak button handler
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

    function appendLoadingBubble() {
        const bubble = document.createElement("div");
        bubble.className = "message-bubble assistant loading-bubble";
        bubble.innerHTML = `
            <div class="avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="bubble-content">
                <div class="sender-name">JARVIS</div>
                <div class="text-body"><i class="fa-solid fa-circle-notch fa-spin"></i> Processing directive...</div>
            </div>
        `;
        messagesStream.appendChild(bubble);
        messagesStream.scrollTop = messagesStream.scrollHeight;
        return bubble;
    }

    async function handleUserMessage(message) {
        if (!message || !message.trim()) return;
        const query = message.trim();

        appendMessage("user", query, false);
        userInput.value = "";
        userInput.style.height = "auto";
        sendBtn.disabled = true;

        setArcState("thinking", "PROCESSING QUERY");
        const loadingBubble = appendLoadingBubble();

        try {
            const res = await fetch(`${API_BASE}/ask`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: query })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || "Server communication failed");
            }

            const data = await res.json();
            loadingBubble.remove();
            appendMessage("assistant", data.answer);
            speakText(data.answer);

            // If user asked something related to tasks, sync tasks list
            if (/task/i.test(query)) {
                loadTasks();
            }
        } catch (err) {
            loadingBubble.remove();
            appendMessage("assistant", `⚠️ **Error:** Unable to complete directive. (${err.message})`);
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

    // Clear Chat
    clearChatBtn.addEventListener("click", () => {
        messagesStream.innerHTML = "";
        appendMessage("assistant", "Dialogue logs cleared. Jarvis operational and standing by.");
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
    // 8. Task Manager API Integration
    // -------------------------------------------------------------
    async function loadTasks() {
        taskListContainer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Syncing tasks...</div>`;
        try {
            const res = await fetch(`${API_BASE}/tasks`);
            if (!res.ok) throw new Error("Failed to load tasks");
            const data = await res.json();
            renderTasks(data.tasks || []);
        } catch (err) {
            taskListContainer.innerHTML = `<div class="empty-state">⚠️ Failed to load tasks (${err.message})</div>`;
        }
    }

    function renderTasks(tasks) {
        taskCountBadge.textContent = tasks.length;
        if (!tasks || tasks.length === 0) {
            taskListContainer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-clipboard-check"></i> No active tasks. Add one above or tell Jarvis!</div>`;
            return;
        }

        taskListContainer.innerHTML = "";
        tasks.forEach(task => {
            const card = document.createElement("div");
            card.className = "task-card";
            card.innerHTML = `
                <div class="task-details">
                    <span class="task-text">${escapeHtml(task.task)}</span>
                    <span class="task-meta">ID: #${task.id} &bull; Created: ${task.created_at || 'Just now'}</span>
                </div>
                <button class="delete-task-btn" title="Delete Task" data-id="${task.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            card.querySelector(".delete-task-btn").addEventListener("click", () => deleteTask(task.id));
            taskListContainer.appendChild(card);
        });
    }

    createTaskForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = newTaskInput.value.trim();
        if (!text) return;

        try {
            const res = await fetch(`${API_BASE}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ task: text })
            });
            if (!res.ok) throw new Error("Could not add task");
            newTaskInput.value = "";
            showToast("Task added successfully");
            loadTasks();
        } catch (err) {
            showToast(`Error: ${err.message}`);
        }
    });

    async function deleteTask(taskId) {
        try {
            const res = await fetch(`${API_BASE}/tasks/${taskId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete task");
            showToast(`Task #${taskId} removed`);
            loadTasks();
        } catch (err) {
            showToast(`Error: ${err.message}`);
        }
    }

    refreshTasksBtn.addEventListener("click", () => {
        loadTasks();
        showToast("Tasks synchronized");
    });

    // -------------------------------------------------------------
    // 9. Document RAG Upload Integration
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
            docList.innerHTML = `<div class="empty-state">No documents indexed yet. Upload a PDF above.</div>`;
            return;
        }

        docList.innerHTML = "";
        docs.forEach(doc => {
            const card = document.createElement("div");
            card.className = "doc-card";
            card.innerHTML = `
                <div class="doc-info">
                    <i class="fa-solid fa-file-pdf"></i>
                    <div>
                        <div class="doc-name">${escapeHtml(doc.filename)}</div>
                        <div class="doc-size">${doc.size_kb} KB</div>
                    </div>
                </div>
                <span class="indexed-badge"><i class="fa-solid fa-check"></i> Indexed</span>
            `;
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
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            showToast("Only PDF files are supported");
            return;
        }

        uploadProgress.style.display = "block";
        uploadFileName.textContent = file.name;
        uploadStatusText.textContent = "Uploading & extracting chunks...";
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
            showToast(`Uploaded & indexed ${data.chunks} chunks`);

            setTimeout(() => {
                uploadProgress.style.display = "none";
                progressFill.style.width = "0%";
            }, 3500);

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

    // Initial Load
    loadTasks();
    loadDocuments();
});
