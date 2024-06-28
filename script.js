// 全局錯誤處理
window.onerror = function(message, source, lineno, colno, error) {
    console.error("全局錯誤:", message, "at", source, ":", lineno);
    addMessageToChat('system', `發生錯誤：${message}`);
};

// 未捕獲的 Promise 拒絕處理
window.addEventListener('unhandledrejection', function(event) {
    console.error("未處理的 Promise 拒絕:", event.reason);
    addMessageToChat('system', `發生錯誤：${event.reason}`);
});

const API_URL = 'http://localhost:3000/api/chat';
let groups = {
    default: []
};
let currentGroup = 'default';

function createNewGroup() {
    const newGroupName = document.getElementById('newGroupInput').value.trim();
    if (newGroupName && !groups[newGroupName]) {
        groups[newGroupName] = [];
        const option = document.createElement('option');
        option.value = newGroupName;
        option.textContent = newGroupName;
        document.getElementById('groupSelect').appendChild(option);
        document.getElementById('newGroupInput').value = '';
        saveChat();
    }
}

document.getElementById('groupSelect').addEventListener('change', function(e) {
    currentGroup = e.target.value;
    updateChatHistory();
});

function updateChatHistory() {
    const chatHistory = document.getElementById('chatHistory');
    chatHistory.innerHTML = '';
    groups[currentGroup].forEach(msg => {
        const messageElement = document.createElement('div');
        messageElement.className = `mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`;
        
        const bubble = document.createElement('div');
        bubble.className = `message-bubble p-3 inline-block ${msg.role === 'user' ? 'user-message ml-auto' : 'assistant-message mr-auto'}`;
        
        const codeBlockRegex = /```[\s\S]*?```/g;
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(msg.content)) !== null) {
            if (match.index > lastIndex) {
                bubble.appendChild(document.createTextNode(msg.content.slice(lastIndex, match.index)));
            }

            const codeBlock = document.createElement('div');
            codeBlock.className = 'code-block';
            const code = match[0].replace(/```/g, '').trim();
            const pre = document.createElement('pre');
            const codeElement = document.createElement('code');
            codeElement.textContent = code;
            pre.appendChild(codeElement);
            codeBlock.appendChild(pre);

            const copyButton = document.createElement('button');
            copyButton.textContent = '複製';
            copyButton.className = 'copy-button';
            copyButton.onclick = function() {
                navigator.clipboard.writeText(code).then(() => {
                    copyButton.textContent = '已複製!';
                    setTimeout(() => { copyButton.textContent = '複製'; }, 2000);
                });
            };
            codeBlock.appendChild(copyButton);

            bubble.appendChild(codeBlock);
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < msg.content.length) {
            bubble.appendChild(document.createTextNode(msg.content.slice(lastIndex)));
        }
        
        messageElement.appendChild(bubble);
        chatHistory.appendChild(messageElement);
    });
    scrollToBottom();

    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block);
    });
}

function scrollToBottom() {
    const chatHistory = document.getElementById('chatHistory');
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    if (!message) return;

    addMessageToChat('user', message);
    userInput.value = '';

    const selectedModel = document.getElementById('modelSelect').value;
    const contextSize = parseInt(document.getElementById('contextSize').value);

    try {
        let messagesToSend = [];
        
        if (groups[currentGroup].length > 0) {
            const recentMessages = groups[currentGroup].slice(-contextSize * 2);
            let lastRole = null;
            for (const msg of recentMessages) {
                if (msg.role !== lastRole) {
                    messagesToSend.push(msg);
                    lastRole = msg.role;
                }
            }

            // 確保消息列表以 "user" 開始，以 "assistant" 結束
            if (messagesToSend[0].role !== 'user') {
                messagesToSend.shift();
            }
            if (messagesToSend[messagesToSend.length - 1].role !== 'assistant') {
                messagesToSend.pop();
            }
        }

        // 添加新的用戶消息
        messagesToSend.push({ role: 'user', content: message });

        console.log('Messages to send:', messagesToSend); // 用於調試

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messagesToSend,
                model: selectedModel,
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json();
        console.log('API Response:', data);

        if (data.content && Array.isArray(data.content) && data.content.length > 0) {
            const assistantReply = data.content[0].text;
            addMessageToChat('assistant', assistantReply);
        } else if (data.content && typeof data.content === 'string') {
            addMessageToChat('assistant', data.content);
        } else {
            throw new Error('Unexpected response format');
        }
    } catch (error) {
        console.error('Error:', error);
        addMessageToChat('system', `發生錯誤：${error.message}`);
    }
}

function addMessageToChat(role, content) {
    groups[currentGroup].push({ role, content });
    updateChatHistory();
    saveChat(); // 每次添加消息後保存
}

document.getElementById('userInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function saveChat() {
    localStorage.setItem('claudeChatGroups', JSON.stringify(groups));
    console.log('聊天記錄已保存到 localStorage');
}

function loadChat() {
    const savedChat = localStorage.getItem('claudeChatGroups');
    if (savedChat) {
        groups = JSON.parse(savedChat);
        updateGroupSelect();
        updateChatHistory();
        console.log('聊天記錄已從 localStorage 載入');
        return true;
    }
    return false;
}

function loadChatFromFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const loadedGroups = JSON.parse(e.target.result);
            groups = loadedGroups;
            updateGroupSelect();
            updateChatHistory();
            saveChat(); // 保存到 localStorage
            alert('聊天記錄已成功載入並保存到本地存儲');
        } catch (error) {
            console.error('Error parsing JSON:', error);
            alert('載入聊天記錄時發生錯誤');
        }
    };
    reader.readAsText(file);
}

function updateGroupSelect() {
    const groupSelect = document.getElementById('groupSelect');
    groupSelect.innerHTML = '';
    Object.keys(groups).forEach(groupName => {
        const option = document.createElement('option');
        option.value = groupName;
        option.textContent = groupName;
        groupSelect.appendChild(option);
    });
    currentGroup = Object.keys(groups)[0] || 'default';
    groupSelect.value = currentGroup;
}

// 頁面加載時自動載入聊天記錄
window.onload = function() {
    if (!loadChat()) {
        console.log('沒有找到保存的聊天記錄');
    }
};

// 初始化
updateChatHistory();