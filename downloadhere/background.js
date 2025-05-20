chrome.action.onClicked.addListener((tab) => {
  // 嘗試打開側邊欄
  chrome.sidePanel.open({ windowId: tab.windowId }).catch((error) => {
    console.error('無法打開側邊欄:', error);
  });
});

// 設置側邊欄行為
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('設置側邊欄行為失敗:', error)); 
