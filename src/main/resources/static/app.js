class ChatApp {
    constructor() {
        this.apiBaseUrl = 'http://localhost:9900/api';
        this.sessionId = this.generateSessionId();
        this.isStreaming = false;
        this.messages = [];
        this.chatHistories = this.loadChatHistories();

        this.initElements();
        this.bindEvents();
        this.initMarkdown();
        this.renderChatHistory();
    }

    initElements() {
        this.chatArea = document.getElementById('chatArea');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.chatHistoryList = document.getElementById('chatHistoryList');
        this.loadingOverlay = document.getElementById('loadingOverlay');
    }

    bindEvents() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());

        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        });

        if (this.newChatBtn) {
            this.newChatBtn.addEventListener('click', () => this.newChat());
        }
    }

    initMarkdown() {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false
            });
        }
    }

    renderMarkdown(content) {
        if (typeof marked === 'undefined') return this.escapeHtml(content);
        try {
            return marked.parse(content);
        } catch (e) {
            return this.escapeHtml(content);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    // --- Chat History ---
    loadChatHistories() {
        try {
            const stored = localStorage.getItem('chatHistories_v2');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    saveChatHistories() {
        try {
            localStorage.setItem('chatHistories_v2', JSON.stringify(this.chatHistories));
        } catch (e) {
            console.error('Save history failed:', e);
        }
    }

    renderChatHistory() {
        if (!this.chatHistoryList) return;
        this.chatHistoryList.innerHTML = '';

        this.chatHistories.forEach((history) => {
            const item = document.createElement('div');
            item.className = `history-item${history.id === this.sessionId ? ' active' : ''}`;
            item.innerHTML = `
                <svg class="history-item-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                <span class="history-item-title">${this.escapeHtml(history.title)}</span>
                <button class="history-item-delete" title="Delete">
                    <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
            `;

            item.querySelector('.history-item-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteHistory(history.id);
            });

            item.addEventListener('click', () => this.loadHistory(history.id));
            this.chatHistoryList.appendChild(item);
        });
    }

    saveCurrentChat() {
        if (this.messages.length === 0) return;

        const existing = this.chatHistories.findIndex(h => h.id === this.sessionId);
        const firstUserMsg = this.messages.find(m => m.type === 'user');
        const title = firstUserMsg
            ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')
            : 'New Chat';

        const chatHistory = {
            id: this.sessionId,
            title,
            messages: [...this.messages],
            updatedAt: new Date().toISOString()
        };

        if (existing !== -1) {
            this.chatHistories[existing] = chatHistory;
        } else {
            this.chatHistories.unshift(chatHistory);
            if (this.chatHistories.length > 50) {
                this.chatHistories = this.chatHistories.slice(0, 50);
            }
        }

        this.saveChatHistories();
        this.renderChatHistory();
    }

    loadHistory(historyId) {
        const history = this.chatHistories.find(h => h.id === historyId);
        if (!history) return;

        if (this.messages.length > 0) {
            this.saveCurrentChat();
        }

        this.sessionId = history.id;
        this.messages = [...history.messages];
        this.messagesContainer.innerHTML = '';

        history.messages.forEach(msg => {
            this.addMessage(msg.type, msg.content, false, false);
        });

        this.welcomeScreen.classList.add('hidden');
        this.renderChatHistory();
    }

    deleteHistory(historyId) {
        this.chatHistories = this.chatHistories.filter(h => h.id !== historyId);
        this.saveChatHistories();

        if (this.sessionId === historyId) {
            this.newChat();
        } else {
            this.renderChatHistory();
        }
    }

    newChat() {
        if (this.messages.length > 0) {
            this.saveCurrentChat();
        }

        this.messages = [];
        this.sessionId = this.generateSessionId();
        this.messagesContainer.innerHTML = '';
        this.welcomeScreen.classList.remove('hidden');
        this.isStreaming = false;
        this.renderChatHistory();
    }

    // --- Messaging ---
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;
        if (this.isStreaming) return;

        this.welcomeScreen.classList.add('hidden');
        this.addMessage('user', message, false, true);
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';

        this.isStreaming = true;
        this.updateSendButton();

        try {
            await this.sendStreamMessage(message);
        } catch (error) {
            this.addMessage('assistant', 'Error: ' + error.message, false, true);
        } finally {
            this.isStreaming = false;
            this.updateSendButton();
            this.saveCurrentChat();
        }
    }

    updateSendButton() {
        this.sendBtn.disabled = this.isStreaming;
    }

    addMessage(type, content, isStreaming = false, saveToHistory = true) {
        if (saveToHistory && !isStreaming && content) {
            this.messages.push({ type, content, timestamp: new Date().toISOString() });
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}${isStreaming ? ' streaming' : ''}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = type === 'assistant'
            ? '<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" fill="none"/></svg>'
            : '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" fill="none"/></svg>';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (type === 'assistant' && !isStreaming) {
            contentDiv.innerHTML = this.renderMarkdown(content);
        } else {
            contentDiv.textContent = content;
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        return messageDiv;
    }

    scrollToBottom() {
        this.chatArea.scrollTop = this.chatArea.scrollHeight;
    }

    async sendStreamMessage(message) {
        const response = await fetch(`${this.apiBaseUrl}/chat_stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Id: this.sessionId, Question: message })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const assistantDiv = this.addMessage('assistant', '', true, false);
        const contentDiv = assistantDiv.querySelector('.message-content');
        let fullResponse = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const data = line.substring(5).trim();
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        if (json.type === 'content') {
                            fullResponse += json.data || '';
                            contentDiv.innerHTML = this.renderMarkdown(fullResponse);
                        } else if (json.type === 'done') {
                            break;
                        } else if (json.type === 'error') {
                            throw new Error(json.data);
                        }
                    } catch (e) {
                        if (e.message.includes('JSON')) {
                            fullResponse += data;
                            contentDiv.textContent = fullResponse;
                        } else {
                            throw e;
                        }
                    }
                }
            }
            this.scrollToBottom();
        }

        assistantDiv.classList.remove('streaming');
        contentDiv.innerHTML = this.renderMarkdown(fullResponse);

        this.messages.push({ type: 'assistant', content: fullResponse, timestamp: new Date().toISOString() });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
