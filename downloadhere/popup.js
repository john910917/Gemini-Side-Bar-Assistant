class ChatBot {
  constructor() {
    this.chatMessages = document.getElementById('chatMessages');
    this.userInput = document.getElementById('userInput');
    this.sendButton = document.getElementById('sendButton');
    
    // 從 storage 讀取 API 金鑰
    chrome.storage.local.get(['apiKey'], (result) => {
      this.API_KEY = result.apiKey;
      // 取得 API 金鑰後初始化
      if (this.API_KEY) {
        this.initializeGemini();
      } else {
        this.addMessageToChat('請先設置 API 金鑰', 'bot');
      }
    });
    
    this.initializeEventListeners();
  }

  async initializeGemini() {
    try {
      const genAI = new GoogleGenerativeAI(this.API_KEY);
      this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });
      this.chat = this.model.startChat({
        generationConfig: {
          temperature: 0.7,
          topK: 32,
          topP: 1,
          maxOutputTokens: 2048,
        },
      });
    } catch (error) {
      console.error('Gemini 初始化錯誤:', error);
      this.addMessageToChat('Gemini 初始化失敗，請檢查 API 金鑰', 'bot');
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
  }

  async sendMessage() {
    const message = this.userInput.value.trim();
    if (!message) return;

    this.addMessageToChat(message, 'user');
    this.userInput.value = '';
    this.sendButton.disabled = true;
    
    try {
      this.addLoadingIndicator();
      const response = await this.getLLMResponse(message);
      this.removeLoadingIndicator();
      this.addMessageToChat(response, 'bot');
    } catch (error) {
      console.error('Error:', error);
      this.removeLoadingIndicator();
      this.addMessageToChat('抱歉，發生錯誤。請稍後再試。', 'bot');
    } finally {
      this.sendButton.disabled = false;
    }
  }

  async getLLMResponse(message) {
    try {
      const result = await this.chat.sendMessage(message);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API 錯誤:', error);
      throw error;
    }
  }

  addMessageToChat(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    messageDiv.textContent = message;
    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  addLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.classList.add('message', 'bot-message');
    loadingDiv.textContent = '正在思考...';
    this.chatMessages.appendChild(loadingDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  removeLoadingIndicator() {
    const loadingDiv = document.getElementById('loading-indicator');
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ChatBot();
}); 
