class OptionsManager {
  constructor() {
    this.initializeElements();
    this.loadSettings();
    this.initializeEventListeners();
  }

  initializeElements() {
    this.apiKeyInput = document.getElementById('apiKey');
    this.showApiKeyButton = document.getElementById('showApiKey');
    this.saveButton = document.getElementById('saveSettings');
    this.statusElement = document.getElementById('status');
    this.languageInputs = document.getElementsByName('language');
  }

  initializeEventListeners() {
    this.saveButton.addEventListener('click', () => this.saveSettings());
    
    this.showApiKeyButton.addEventListener('click', () => {
      const type = this.apiKeyInput.type;
      this.apiKeyInput.type = type === 'password' ? 'text' : 'password';
    });
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.local.get(['apiKey', 'language']);
      if (settings.apiKey) {
        this.apiKeyInput.value = settings.apiKey;
      }
      
      if (settings.language) {
        for (const radio of this.languageInputs) {
          if (radio.value === settings.language) {
            radio.checked = true;
            break;
          }
        }
      }
    } catch (error) {
      console.error('載入設定時發生錯誤:', error);
      this.showStatus('載入設定失敗', 'error');
    }
  }

  async saveSettings() {
    try {
      const apiKey = this.apiKeyInput.value.trim();
      const language = Array.from(this.languageInputs).find(radio => radio.checked)?.value || 'zh-TW';

      if (!apiKey) {
        this.showStatus('API 金鑰不能為空', 'error');
        return;
      }

      await chrome.storage.local.set({
        apiKey,
        language
      });

      this.showStatus('設定已儲存', 'success');
    } catch (error) {
      console.error('儲存設定時發生錯誤:', error);
      this.showStatus('儲存設定失敗', 'error');
    }
  }

  showStatus(message, type = 'success') {
    this.statusElement.textContent = message;
    this.statusElement.className = `status-message ${type}`;
    setTimeout(() => {
      this.statusElement.textContent = '';
      this.statusElement.className = 'status-message';
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
}); 
