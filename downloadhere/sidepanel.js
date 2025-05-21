class ChatBot {
  constructor() {
    this.initializeElements();
    this.initializeEventListeners();
    this.loadLanguageSettings();
    this.checkApiKey();
    this.initializeSettingsModal();
    this.initializeFileUpload();
    this.initializeScreenshot();
    this.chatHistory = [];
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.REQUEST_LIMIT = 60; // 每分鐘的請求限制
    this.REQUEST_INTERVAL = 60000; // 重置間隔（毫秒）
    this.MODEL_NAME = 'gemini-2.0-flash'; // 直接替換
  }

  initializeElements() {
    this.chatMessages = document.getElementById('chatMessages');
    this.userInput = document.getElementById('userInput');
    this.sendButton = document.getElementById('sendButton');
    this.clearChatButton = document.getElementById('clearChat');
    this.settingsButton = document.getElementById('settingsButton');
    this.settingsModal = document.getElementById('settingsModal');
    this.closeSettings = document.getElementById('closeSettings');
    this.modalApiKey = document.getElementById('modalApiKey');
    this.showModalApiKey = document.getElementById('showModalApiKey');
    this.saveModalSettings = document.getElementById('saveModalSettings');
    this.modalLanguageInputs = document.getElementsByName('modalLanguage');
    this.uploadButton = document.getElementById('uploadButton');
    this.fileInput = document.getElementById('fileInput');
    this.screenshotButton = document.getElementById('screenshotButton');

    if (!this.settingsButton || !this.settingsModal) {
      console.error('找不到設定按鈕或設定對話框元素');
    }
  }

  initializeEventListeners() {
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    this.clearChatButton.addEventListener('click', () => {
      this.clearChat();
    });

    this.userInput.addEventListener('input', () => {
      this.userInput.style.height = 'auto';
      this.userInput.style.height = this.userInput.scrollHeight + 'px';
    });
  }

  async checkApiKey() {
    try {
      const result = await chrome.storage.local.get(['apiKey']);
      if (result.apiKey) {
        if (!result.apiKey.startsWith('AIza')) {
          this.addMessageToChat(`API 金鑰格式無效。請確認您使用的是從 Google AI Studio 取得的 API 金鑰 (應以 "AIza" 開頭)。
[點此前往 Google AI Studio 取得金鑰](https://aistudio.google.com/app/apikey)`, 'bot');
          this.sendButton.disabled = true;
          return;
        }
        
        this.API_KEY = result.apiKey;
        const initialized = await this.initializeGemini();
        // 只有在成功初始化後才啟用按鈕
        this.sendButton.disabled = !initialized; 
      } else {
        this.addMessageToChat(`請先設置 API 金鑰。您可以從 Google AI Studio 取得：
1. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 登入您的 Google 帳號
3. 點擊「Create API key」建立新的金鑰
4. 複製完整的 API 金鑰`, 'bot');
        this.sendButton.disabled = true;
      }
    } catch (error) {
      console.error('檢查 API 金鑰時發生錯誤:', error);
      this.addMessageToChat('載入或驗證 API 金鑰時發生錯誤，請檢查控制台以獲取詳細資訊。', 'bot');
      this.sendButton.disabled = true; // 發生錯誤時禁用按鈕
    }
  }

  async saveApiKey() {
    const apiKey = this.modalApiKey.value.trim();
    
    if (!apiKey) {
      this.showModalStatus('API 金鑰不能為空', 'error');
      return;
    }

    try {
      // 使用類別屬性中的模型名稱
      const testResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: "Test"
              }]
            }]
          })
        }
      );

      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        if (errorData.error?.code === 429) {
          throw new Error('API 配額已用盡，請稍後再試。您可以：\n1. 等待幾分鐘後重試\n2. 使用新的 API 金鑰');
        }
        throw new Error('無效的 API 金鑰');
      }

      // API 金鑰驗證成功後再儲存
      await chrome.storage.local.set({ apiKey });
      this.API_KEY = apiKey;
      this.showModalStatus('API 金鑰儲存成功', 'success');
      this.sendButton.disabled = false;
      await this.initializeGemini();
      
    } catch (error) {
      console.error('儲存 API 金鑰時發生錯誤:', error);
      this.showModalStatus(error.message, 'error');
    }
  }

  async loadLanguageSettings() {
    try {
      const { language = 'zh-TW' } = await chrome.storage.local.get(['language']);
      this.currentLanguage = language;
      this.updateUILanguage();
    } catch (error) {
      console.error('載語言設定失敗:', error);
    }
  }

  updateUILanguage() {
    const translations = {
      'zh-TW': {
        title: 'Gemini 助理',
        clearChat: '清除對話',
        settings: '設定',
        inputPlaceholder: '輸入訊息',
        apiKeyLabel: 'API 金鑰',
        apiKeyPlaceholder: '請入 Gemini API 金鑰',
        saveButton: '儲存設定',
        thinking: '正在思考...',
        chatCleared: '聊天記錄已清除',
        error: '抱歉，發生錯誤。請稍後再試。',
        modalTitle: '設定',
        languageLabel: '介面語言',
        closeButton: '關閉',
        clearChatConfirm: '確定要清除所有對話嗎？',
        clearChatMessage: '聊天記錄已清除',
        settingSaved: '設定已儲存',
        settingError: '儲存設定失敗',
        apiKeyEmpty: 'API 金鑰不能為空'
      },
      'en': {
        title: 'Gemini Assistant',
        clearChat: 'Clear Chat',
        settings: 'Settings',
        inputPlaceholder: 'Type a message',
        apiKeyLabel: 'API Key',
        apiKeyPlaceholder: 'Enter Gemini API Key',
        saveButton: 'Save Settings',
        thinking: 'Thinking...',
        chatCleared: 'Chat history cleared',
        error: 'Sorry, an error occurred. Please try again later.',
        modalTitle: 'Settings',
        languageLabel: 'Interface Language',
        closeButton: 'Close',
        clearChatConfirm: 'Are you sure you want to clear all messages?',
        clearChatMessage: 'Chat history cleared',
        settingSaved: 'Settings saved',
        settingError: 'Failed to save settings',
        apiKeyEmpty: 'API key cannot be empty'
      },
      'ja': {
        title: 'Gemini アシスタント',
        clearChat: '履歴クリア',
        settings: '設定',
        inputPlaceholder: 'メッセージを入力するか',
        apiKeyLabel: 'API キー',
        apiKeyPlaceholder: 'Gemini API キーを入力',
        saveButton: '設定を保存',
        thinking: 'え中...',
        chatCleared: 'チャット履歴をクリアしました',
        error: 'エラーが発生しました。後でもう一度お試しください。',
        modalTitle: '設定',
        languageLabel: 'インターフェース言語',
        closeButton: '閉じる',
        clearChatConfirm: 'すべてのメッセージを消去してもよろしいですか？',
        clearChatMessage: 'チャット履歴を消去しました',
        settingSaved: '設定を保存しました',
        settingError: '設定の保存に失敗しました',
        apiKeyEmpty: 'APIキーを入力してください'
      }
    };

    const t = translations[this.currentLanguage] || translations['zh-TW'];
    
    try {
      const titleSpan = document.querySelector('.chat-title span');
      if (titleSpan) titleSpan.textContent = t.title;

      const clearChatBtn = document.getElementById('clearChat');
      if (clearChatBtn) {
        clearChatBtn.title = t.clearChat;
        this.clearChatConfirmMessage = t.clearChatConfirm;
        this.clearChatMessage = t.clearChatMessage;
      }

      const settingsBtn = document.getElementById('settingsButton');
      if (settingsBtn) settingsBtn.title = t.settings;

      const userInput = document.getElementById('userInput');
      if (userInput) userInput.placeholder = t.inputPlaceholder;

      const apiKeyLabel = document.querySelector('label[for="modalApiKey"]');
      if (apiKeyLabel) apiKeyLabel.textContent = t.apiKeyLabel;

      const modalApiKey = document.getElementById('modalApiKey');
      if (modalApiKey) modalApiKey.placeholder = t.apiKeyPlaceholder;

      const saveSettings = document.getElementById('saveModalSettings');
      if (saveSettings) saveSettings.textContent = t.saveButton;

      const modalTitle = document.querySelector('.modal-header h2');
      if (modalTitle) modalTitle.textContent = t.modalTitle;

      const languageLabel = document.querySelector('.setting-item label:not([for])');
      if (languageLabel) languageLabel.textContent = t.languageLabel;

      const closeSettings = document.getElementById('closeSettings');
      if (closeSettings) closeSettings.title = t.closeButton;

      // 更新建議按鈕文字
      const suggestionButtons = document.querySelectorAll('.chip');
      if (suggestionButtons.length >= 3) {
        suggestionButtons[0].textContent = t.suggestionCode;
        suggestionButtons[1].textContent = t.suggestionDocs;
        suggestionButtons[2].textContent = t.suggestionDebug;
      }

      // 更新錯誤訊息模板
      this.errorMessage = t.error;
      this.thinkingMessage = t.thinking;
      this.chatClearedMessage = t.chatCleared;

      // 保存當前語言的設定相關訊息
      this.settingSavedMessage = t.settingSaved;
      this.settingErrorMessage = t.settingError;
      this.apiKeyEmptyMessage = t.apiKeyEmpty;

    } catch (error) {
      console.error('更新面文字時發生錯誤:', error);
    }
  }

  initializeSettingsModal() {
    if (!this.settingsButton || !this.settingsModal) {
      console.error('無法初始化設定對話框：元素未找到');
      return;
    }

    this.settingsButton.addEventListener('click', () => {
      console.log('設定按鈕被點擊');
      this.settingsModal.classList.add('show');
      this.loadSettingsToModal();
    });

    this.closeSettings.addEventListener('click', () => {
      this.settingsModal.classList.remove('show');
    });

    this.showModalApiKey.addEventListener('click', () => {
      const type = this.modalApiKey.type;
      this.modalApiKey.type = type === 'password' ? 'text' : 'password';
    });

    this.saveModalSettings.addEventListener('click', async () => {
      try {
        const apiKey = this.modalApiKey.value.trim();
        const language = Array.from(this.modalLanguageInputs).find(radio => radio.checked)?.value || 'zh-TW';

        if (!apiKey) {
          this.showModalStatus('API 金鑰能為空', 'error');
          return;
        }

        await chrome.storage.local.set({
          apiKey,
          language
        });

        this.API_KEY = apiKey;
        this.currentLanguage = language;
        this.updateUILanguage();
        await this.initializeGemini();
        
        this.showModalStatus('Save', 'success');
        setTimeout(() => {
          this.settingsModal.classList.remove('show');
        }, 1500);
      } catch (error) {
        console.error('儲存設定發生錯誤:', error);
        this.showModalStatus('儲存設定失敗', 'error');
      }
    });

    // 修改語言選項的監聽器
    this.modalLanguageInputs.forEach(radio => {
      radio.addEventListener('change', () => {
        // 立即更新語言和 UI
        this.currentLanguage = radio.value;
        this.updateUILanguage();

        // 更新 Save Settings 按鈕的文字
        const saveButtonText = {
          'zh-TW': '儲存設定',
          'en': 'Save Settings',
          'ja': '設定を保存'
        };
        this.saveModalSettings.textContent = saveButtonText[this.currentLanguage];

        // 更新其他設定相關文字
        const modalTitle = document.querySelector('.modal-header h2');
        const modalTitles = {
          'zh-TW': '設定',
          'en': 'Settings',
          'ja': '設定'
        };
        if (modalTitle) modalTitle.textContent = modalTitles[this.currentLanguage];

        const apiKeyLabel = document.querySelector('label[for="modalApiKey"]');
        const apiKeyLabels = {
          'zh-TW': 'API 金鑰',
          'en': 'API Key',
          'ja': 'APIキー'
        };
        if (apiKeyLabel) apiKeyLabel.textContent = apiKeyLabels[this.currentLanguage];

        const languageLabel = document.querySelector('.setting-item label:not([for])');
        const languageLabels = {
          'zh-TW': '介面語言',
          'en': 'Interface Language',
          'ja': 'インターフェース言語'
        };
        if (languageLabel) languageLabel.textContent = languageLabels[this.currentLanguage];

        // 添加語言切換示
        const messages = {
          'zh-TW': '已切換至繁體中文',
          'en': 'Switched to English',
          'ja': '日本語に切り替えました'
        };
        this.addMessageToChat(messages[this.currentLanguage], 'bot');
      });
    });

    // 點擊模態框外部關閉
    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) {
        this.settingsModal.classList.remove('show');
      }
    });
  }

  async loadSettingsToModal() {
    try {
      const settings = await chrome.storage.local.get(['apiKey', 'language']);
      if (settings.apiKey) {
        this.modalApiKey.value = settings.apiKey;
      }
      
      if (settings.language) {
        for (const radio of this.modalLanguageInputs) {
          if (radio.value === settings.language) {
            radio.checked = true;
            break;
          }
        }
      }
    } catch (error) {
      console.error('載入設定時發生錯誤:', error);
    }
  }

  showModalStatus(message, type = 'success') {
    const statusDiv = document.createElement('div');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    
    if (type === 'error') {
      statusDiv.style.backgroundColor = '#ffebee';
      statusDiv.style.color = '#c62828';
      statusDiv.style.border = '1px solid #ef9a9a';
    }
    
    const footer = this.settingsModal.querySelector('.modal-footer');
    footer.appendChild(statusDiv);
    
    setTimeout(() => {
      statusDiv.remove();
    }, 5000);
  }

  async initializeGemini() {
    try {
      if (!this.API_KEY || !this.API_KEY.startsWith('AIza')) {
        throw new Error(`無效的 API 金鑰格式。請依照以下步驟取得正確的金鑰：
1. 前往 Google AI Studio ([https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey))
2. 登入您的 Google 帳號
3. 點擊「Create API key」建立新的金鑰
4. 複製完整的 API 金鑰（應以 "AIza" 開頭）
5. 在設定中貼上金鑰

**重要提示:**
- 請確認您使用的是 **Google AI Studio** 的 API 金鑰，**而非** Google Cloud Console 的金鑰。
- 確保 API 金鑰完整，沒有多餘的空格或換行符。
- 確認您所在的地區支援 Gemini API 服務 ([可用地區列表](https://ai.google.dev/available_regions))。`);
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${this.API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: "Test connection"
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1,
              topK: 1,
              topP: 1
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API 錯誤詳情:', JSON.stringify(errorData, null, 2));
        
        const errorMessage = errorData.error?.message || '未知錯誤';
        const errorCode = errorData.error?.code || response.status;
        
        let detailedError = '';
        switch (errorCode) {
          case 400:
            detailedError = `API 金鑰無效 (${errorCode})：\n${errorMessage}\n\n請檢查：\n1. 是否使用了正確的 Google AI Studio 金鑰。\n2. 金鑰是否完整且無空格。\n3. 嘗試重新生成金鑰 ([點此前往](https://aistudio.google.com/app/apikey))。`;
            break;
          case 403:
            detailedError = `API 存取被拒絕 (${errorCode})：\n${errorMessage}\n\n可能的原因：\n1. 您的所在地區不支援此 API ([檢查地區](https://ai.google.dev/available_regions))。\n2. 使用了錯誤的 API 金鑰類型。`;
            break;
          case 429:
            detailedError = `API 配額已用盡 (${errorCode})：\n${errorMessage}\n\n建議：
1. 等待配額重置（通常每分鐘重置）
2. 檢查 API 使用量限制
3. 考慮升級 API 配額
4. 使用節流機制限制請求頻率`;
            break;
          default:
            detailedError = `API 錯誤 (${errorCode})：${errorMessage}\n\n請確保使用 Google AI Studio 的 API 金鑰`;
        }

        throw new Error(detailedError);
      }

      console.log('Gemini 初始化成功');
      return true;
    } catch (error) {
      console.error('Gemini 初始化錯誤:', error);
      this.addMessageToChat(`初始化失敗：\n${error.message}`, 'bot');
      return false;
    }
  }

  async getLLMResponse(message) {
    try {
      const languagePrompts = {
        'zh-TW': {
          text: '你是一個智能助理，請用繁體中文回答。請記住我們的對話內容，保持上下文連貫性。',
          image: `你是一個智能助理，請用繁體中文分析圖片。請記住我們的對話內容，保持上下文連貫性。請分析：
            1. 這張圖片顯示了什麼內容？
            2. 圖片中有什麼重要的文字、數據或資訊？
            3. 如果是網頁截圖，請說明頁面的主要內容和功能。
            4. 如果是程式碼，請解釋程式碼的功能和重點。
            請保持專業的分析語氣，並盡可能詳細地描述圖片中的實際內容。`
        },
        'en': {
          text: 'You are an AI assistant. Please answer in English. Remember our conversation and maintain context continuity.',
          image: `You are an AI assistant. Please analyze this image in English. Remember our conversation and maintain context continuity.`
        },
        'ja': {
          text: 'あなたはAIアシスタントです。日本語で答えてください。会話の内容を覚えて、文脈の一貫性を保ってください。',
          image: `あなたはAIアシスタントです。日本語で画像を分析してください。会話の内容を覚えて、文脈の一貫性を保ってください。`
        }
      };

      const prompts = languagePrompts[this.currentLanguage] || languagePrompts['zh-TW'];

      let requestBody = {
        contents: [{
          parts: [{
            text: prompts.text + "\n\n歷史對話:\n"
          }]
        }]
      };

      if (this.chatHistory.length > 0) {
        this.chatHistory.forEach(chat => {
          requestBody.contents[0].parts[0].text += 
            `${chat.role === 'user' ? 'User' : 'Assistant'}: ${chat.content}\n`;
        });
      }

      requestBody.contents[0].parts[0].text += `\nUser: ${message}`;

      if (message.startsWith('data:image')) {
        requestBody.contents[0].parts.push({
          inline_data: {
            mime_type: "image/png",
            data: message.split(',')[1]
          }
        });
        requestBody.contents[0].parts[0].text = prompts.image;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${this.API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API 錯誤詳情:', JSON.stringify(errorData, null, 2));
        
        if (errorData.error?.code === 429) {
          throw new Error(`API 配額已用盡。建議：
1. 等待幾分鐘後再試
2. 檢查您的 API 使用量
3. 考慮使用新的 API 金鑰
4. 減少請求頻率`);
        }
        
        throw new Error(errorData.error?.message || '未知錯誤');
      }

      const data = await response.json();
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('無效的 API 響應格式');
      }

      this.chatHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: data.candidates[0].content.parts[0].text }
      );

      if (this.chatHistory.length > 10) {
        this.chatHistory = this.chatHistory.slice(-10);
      }

      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Gemini API 錯誤:', error);
      throw error;
    }
  }

  async compressImage(base64String) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let width = img.width;
        let height = img.height;
        const maxSize = 1024;

        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = base64String;
    });
  }

  getSystemPromptByLanguage() {
    const prompts = {
      'zh-TW': '請用繁體中文回答以下問題。回答要清楚、準確、有條理。',
      'en': 'Please respond in English. Provide clear, accurate, and well-structured answers.',
      'ja': '以下の質問に日本語で答えてください。回答は明確で正確、そして体系的にお願いします。'
    };
    return prompts[this.currentLanguage] || prompts['zh-TW'];
  }

  async sendMessage() {
    const message = this.userInput.value.trim();
    if (!message) return;

    if (!this.API_KEY) {
      this.addMessageToChat('請先設置 API 金鑰', 'bot');
      return;
    }

    try {
      await this.checkRequestLimit();
      
      this.addMessageToChat(message, 'user');
      this.userInput.value = '';
      this.sendButton.disabled = true;
      
      this.addLoadingIndicator();
      const response = await this.getLLMResponse(message);
      this.removeLoadingIndicator();
      this.addMessageToChat(response, 'bot');
    } catch (error) {
      console.error('發送訊息錯誤:', error);
      this.removeLoadingIndicator();
      
      let errorMessage = '';
      if (error.message.includes('配額已用盡') || error.message.includes('請求限制')) {
        errorMessage = error.message;
      } else if (error.message.includes('API 請求無效')) {
        errorMessage = '無法處理此訊息，請修改後重試。';
      } else {
        errorMessage = `發生錯誤：${error.message}`;
      }
      
      this.addMessageToChat(errorMessage, 'bot');
    } finally {
      this.sendButton.disabled = false;
    }
  }

  addMessageToChat(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    
    if (sender === 'bot') {
      let cleanMessage = message.replace(/^Assistant:\s*/i, '');
      const formattedMessage = this.formatBotMessage(cleanMessage);
      messageDiv.innerHTML = formattedMessage;
    } else {
      if (message.includes('<div class="image-preview">')) {
        messageDiv.innerHTML = message;
      } else {
        messageDiv.textContent = message;
      }
    }
    
    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    if (sender === 'bot') {
      messageDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }
  }

  formatBotMessage(message) {
    return message
      .replace(/```(\w*)([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        return `<pre><code class="language-${language}">${this.escapeHtml(code.trim())}</code></pre>`;
      })
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
      .replace(/\n/g, '<br>');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  addLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.classList.add('message', 'bot-message');
    loadingDiv.textContent = this.thinkingMessage;
    this.chatMessages.appendChild(loadingDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  removeLoadingIndicator() {
    const loadingDiv = document.getElementById('loading-indicator');
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }

  async saveModalSettings() {
    try {
      const apiKey = this.modalApiKey.value.trim();
      const language = Array.from(this.modalLanguageInputs).find(radio => radio.checked)?.value || 'zh-TW';

      if (!apiKey) {
        const emptyKeyMessages = {
          'zh-TW': 'API 金鑰不能為空',
          'en': 'API key cannot be empty',
          'ja': 'APIキーを入力してください'
        };
        this.showModalStatus(emptyKeyMessages[language], 'error');
        return;
      }

      if (!apiKey.startsWith('AIza')) {
        const invalidKeyMessages = {
          'zh-TW': 'API 金鑰格式無效，必須是以 "AIza" 開頭的 Google AI Studio 金鑰',
          'en': 'Invalid API key format, must be a Google AI Studio key starting with "AIza"',
          'ja': 'APIキーの形式が無効です。"AIza"で始まる Google AI Studio キーである必要があります'
        };
        this.showModalStatus(invalidKeyMessages[language], 'error');
        return;
      }

      const originalApiKey = this.API_KEY;
      this.API_KEY = apiKey;
      const isValid = await this.initializeGemini();
      
      if (!isValid) {
        this.API_KEY = originalApiKey;
        console.error('儲存設定時 API 金鑰驗證失敗');
        const errorMessages = {
          'zh-TW': '儲存失敗：API 金鑰驗證未通過，請檢查金鑰或錯誤訊息',
          'en': 'Save failed: API key validation failed, please check the key or error messages',
          'ja': '保存に失敗しました：APIキーの検証に失敗しました。キーまたはエラーメッセージを確認してください'
        };
        this.showModalStatus(errorMessages[language], 'error');
        return;
      }

      await chrome.storage.local.set({
        apiKey,
        language
      });

      this.currentLanguage = language;
      this.updateUILanguage();
      
      this.sendButton.disabled = false;

      this.showModalStatus('Save', 'success');
      setTimeout(() => {
        this.settingsModal.classList.remove('show');
      }, 1500);
    } catch (error) {
      console.error('儲存設定時發生錯誤:', error);
      const errorMessages = {
        'zh-TW': '儲存設定時發生未知錯誤',
        'en': 'An unknown error occurred while saving settings',
        'ja': '設定の保存中に不明なエラーが発生しました'
      };
      this.showModalStatus(errorMessages[this.currentLanguage] || errorMessages['en'], 'error');
    }
  }

  clearChat() {
    if (confirm(this.clearChatConfirmMessage)) {
      this.chatMessages.innerHTML = '';
      this.chatHistory = [];
      this.addMessageToChat(this.clearChatMessage, 'bot');
    }
  }

  initializeFileUpload() {
    this.uploadButton.addEventListener('click', () => {
      this.fileInput.click();
    });

    this.fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      for (const file of files) {
        // 檔案大小限制 5MB
        if (file.size > 5 * 1024 * 1024) {
          this.addMessageToChat(`❌ 檔案「${file.name}」超過 5MB，請選擇較小的檔案。`, 'bot');
          continue;
        }
        // 顯示 loading 狀態
        const loadingId = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.addFileLoadingIndicator(file, loadingId);
        try {
          const content = await this.readFileContentEnhanced(file);
          // --- 修改：圖片預覽與分析分開 ---
          if (content.type === 'image') {
            // 1. 先顯示圖片預覽
            this.addMessageToChat(
              `<div class="image-preview"><img src="${content.data}" alt="${this.escapeHtml(content.name)}" /></div>`,
              'user'
            );
            // 2. 顯示分析中
            this.addMessageToChat('圖片分析中...', 'bot');
            // 3. 分析
            const imageData = await this.processImageWithCanvas(content.data);
            const response = await this.getLLMResponse(imageData);
            this.addMessageToChat(response, 'bot');
            // 移除 loading
            this.replaceFileLoadingIndicator(loadingId, '', 'user');
          } else {
            // 非圖片，照原本流程
            const message = await this.createFileMessageEnhanced(file, content);
            this.replaceFileLoadingIndicator(loadingId, message, 'user');
          }
        } catch (error) {
          this.replaceFileLoadingIndicator(loadingId, `❌ 檔案「${file.name}」處理失敗：${error.message}`, 'bot');
        }
      }
      this.fileInput.value = '';
    });
  }

  // 新增：支援更多格式與安全處理
  async readFileContentEnhanced(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        // 圖片
        if (file.type.startsWith('image/')) {
          resolve({ type: 'image', data: e.target.result, name: file.name });
        // 純文字/程式碼
        } else if (file.type.startsWith('text/') || file.type === 'application/json' || file.type === 'application/javascript' || file.name.match(/\.(txt|js|json|css|html|md|py|java|cpp|c|rb|php)$/i)) {
          resolve({ type: 'text', data: e.target.result, name: file.name });
        // PDF
        } else if (file.type === 'application/pdf' || file.name.match(/\.pdf$/i)) {
          resolve({ type: 'pdf', name: file.name, size: file.size });
        // Word
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.match(/\.docx?$/i)) {
          resolve({ type: 'word', name: file.name, size: file.size });
        // Excel
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.match(/\.xlsx?$/i)) {
          resolve({ type: 'excel', name: file.name, size: file.size });
        } else {
          reject(new Error('不支援的檔案類型'));
        }
      };
      reader.onerror = (error) => reject(error);
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('text/') || file.type === 'application/json' || file.type === 'application/javascript' || file.name.match(/\.(txt|js|json|css|html|md|py|java|cpp|c|rb|php)$/i)) {
        reader.readAsText(file);
      } else {
        // 其他格式不需讀內容
        reader.onload({ target: { result: null } });
      }
    });
  }

  // 新增：根據格式產生訊息
  async createFileMessageEnhanced(file, content) {
    const fileSize = this.formatFileSize(file.size);
    let message = `\uD83D\uDCC4 <strong>${this.escapeHtml(file.name)}</strong> (${fileSize})`;
    if (content.type === 'image') {
      message += `<div class="image-preview"><img src=\"${content.data}\" alt=\"${this.escapeHtml(content.name)}\" /></div>`;
    } else if (content.type === 'text') {
      message += `<pre><code>${this.escapeHtml(content.data)}</code></pre>`;
    } else if (content.type === 'pdf') {
      message += '<br>PDF 檔案，暫不支援預覽。';
    } else if (content.type === 'word') {
      message += '<br>Word 檔案，暫不支援預覽。';
    } else if (content.type === 'excel') {
      message += '<br>Excel 檔案，暫不支援預覽。';
    }
    return message;
  }

  // 新增：檔案 loading 狀態
  addFileLoadingIndicator(file, loadingId) {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.classList.add('message', 'user-message', 'file-loading');
    loadingDiv.innerHTML = `<span class="spinner"></span> 上傳「${this.escapeHtml(file.name)}」中...`;
    this.chatMessages.appendChild(loadingDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }
  replaceFileLoadingIndicator(loadingId, message, sender) {
    const loadingDiv = document.getElementById(loadingId);
    if (loadingDiv) {
      loadingDiv.className = `message ${sender}-message`;
      loadingDiv.innerHTML = message;
    }
  }

  async processImageWithCanvas(imageDataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const maxSize = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;

          ctx.drawImage(img, 0, 0, width, height);

          const processedImageData = canvas.toDataURL('image/png');
          resolve(processedImageData);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = imageDataUrl;
    });
  }

  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  initializeScreenshot() {
    this.screenshotButton.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab.url.startsWith('chrome://')) {
          throw new Error('無法在 Chrome 內部頁面使用截圖功能');
        }

        const pageImage = await chrome.tabs.captureVisibleTab(null, { format: 'png' });

        const [{ result: imageData }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: (pageImage) => {
            return new Promise((resolve) => {
              const overlay = document.createElement('div');
              overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.3);
                cursor: crosshair;
                z-index: 999999;
              `;

              const selection = document.createElement('div');
              selection.style.cssText = `
                position: fixed;
                display: none;
                border: 2px solid #0078d4;
                background: rgba(0, 120, 212, 0.1);
                z-index: 1000000;
                pointer-events: none;
              `;

              const sizeInfo = document.createElement('div');
              sizeInfo.style.cssText = `
                position: fixed;
                display: none;
                background: #0078d4;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000001;
                pointer-events: none;
              `;

              document.body.appendChild(overlay);
              document.body.appendChild(selection);
              document.body.appendChild(sizeInfo);

              let startX, startY;
              let isSelecting = false;

              const img = new Image();
              img.onload = () => {
                const scale = window.devicePixelRatio;

                overlay.addEventListener('mousedown', (e) => {
                  isSelecting = true;
                  startX = e.clientX;
                  startY = e.clientY;
                  selection.style.display = 'block';
                  sizeInfo.style.display = 'block';

                  selection.style.left = startX + 'px';
                  selection.style.top = startY + 'px';
                  selection.style.width = '0';
                  selection.style.height = '0';
                });

                overlay.addEventListener('mousemove', (e) => {
                  if (!isSelecting) {
                    selection.style.display = 'block';
                    selection.style.left = (e.clientX - 1) + 'px';
                    selection.style.top = (e.clientY - 1) + 'px';
                    selection.style.width = '2px';
                    selection.style.height = '2px';
                    return;
                  }

                  const width = e.clientX - startX;
                  const height = e.clientY - startY;
                  const left = Math.min(startX, e.clientX);
                  const top = Math.min(startY, e.clientY);

                  selection.style.left = left + 'px';
                  selection.style.top = top + 'px';
                  selection.style.width = Math.abs(width) + 'px';
                  selection.style.height = Math.abs(height) + 'px';

                  sizeInfo.textContent = `${Math.abs(width)} × ${Math.abs(height)}`;
                  sizeInfo.style.left = (left + Math.abs(width) + 10) + 'px';
                  sizeInfo.style.top = top + 'px';
                });

                overlay.addEventListener('mouseup', () => {
                  if (!isSelecting) return;
                  isSelecting = false;

                  const cropCanvas = document.createElement('canvas');
                  const width = Math.abs(event.clientX - startX);
                  const height = Math.abs(event.clientY - startY);
                  const left = Math.min(startX, event.clientX);
                  const top = Math.min(startY, event.clientY);

                  cropCanvas.width = width * scale;
                  cropCanvas.height = height * scale;
                  const cropCtx = cropCanvas.getContext('2d');

                  cropCtx.drawImage(
                    img,
                    left * scale,
                    top * scale,
                    width * scale,
                    height * scale,
                    0,
                    0,
                    width * scale,
                    height * scale
                  );

                  overlay.remove();
                  selection.remove();
                  sizeInfo.remove();

                  resolve(cropCanvas.toDataURL('image/png'));
                });

                document.addEventListener('keydown', (e) => {
                  if (e.key === 'Escape') {
                    overlay.remove();
                    selection.remove();
                    sizeInfo.remove();
                    resolve(null);
                  }
                });
              };
              img.src = pageImage;
            });
          },
          args: [pageImage]
        });

        if (imageData) {
          const message = `<div class="image-preview">
            <img src="${imageData}" alt="Screenshot" />
          </div>`;
          this.addMessageToChat(message, 'user');

          const response = await this.getLLMResponse(imageData);
          this.addMessageToChat(response, 'bot');
        }

      } catch (error) {
        console.error('截圖錯誤:', error);
        const errorMessages = {
          'zh-TW': `截圖失敗：${error.message}`,
          'en': `Screenshot failed: ${error.message}`,
          'ja': `スクリーンショットに失敗しました：${error.message}`
        };
        this.addMessageToChat(errorMessages[this.currentLanguage] || errorMessages['en'], 'bot');
      }
    });
  }

  async getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async checkRequestLimit() {
    const now = Date.now();
    if (now - this.lastRequestTime >= this.REQUEST_INTERVAL) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    if (this.requestCount >= this.REQUEST_LIMIT) {
      throw new Error('已達到每分鐘請求限制，請稍後再試。');
    }

    this.requestCount++;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.chatBot = new ChatBot();
}); 