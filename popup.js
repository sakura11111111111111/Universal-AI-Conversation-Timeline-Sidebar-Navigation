document.addEventListener('DOMContentLoaded', function() {
    // 1. 获取 DOM 元素
    const statusText = document.getElementById('status-text');
    const dot = document.querySelector('.dot');
    const toggleSwitch = document.getElementById('toggle-switch');
    const controlPanel = document.querySelector('.control-panel');

    // 2. 初始化状态检测 & 开关逻辑
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || tabs.length === 0) return;
        
        const url = tabs[0].url;
        const tabId = tabs[0].id;
        
        // 支持的域名列表
        const supportedDomains = [
            "chatgpt.com", "deepseek.com", "doubao.com", "grok.com", "x.com", 
            "chatglm.cn", "aliyun.com", "qianwen.com", "kimi.com", "yuanbao.tencent.com"
        ];
        
        const isSupported = supportedDomains.some(domain => url.includes(domain));

        if (isSupported) {
            // -- 状态：运行中 --
            statusText.innerText = "运行中：已检测到 AI 对话";
            statusText.style.color = "#4CAF50";
            dot.style.backgroundColor = "#4CAF50";
            dot.style.boxShadow = "0 0 8px rgba(76, 175, 80, 0.6)";
            
            // 启用开关
            toggleSwitch.disabled = false;
            controlPanel.style.opacity = '1';

        } else {
            // -- 状态：休眠 --
            statusText.innerText = "休眠中：非 AI 页面";
            statusText.style.color = "#aaa";
            dot.style.backgroundColor = "#666";
            dot.style.boxShadow = "none";
            
            // 禁用开关（因为没东西可关）
            toggleSwitch.disabled = true;
            controlPanel.style.opacity = '0.5';
        }
    });

    // 3. 读取本地存储，设置开关初始状态
    // 默认为 true (开启)，除非用户之前专门关掉了
    chrome.storage.sync.get(['ai_anchor_enabled'], function(result) {
        const isEnabled = result.ai_anchor_enabled !== false; 
        toggleSwitch.checked = isEnabled;
    });

    // 4. 监听开关点击事件
    toggleSwitch.addEventListener('change', function() {
        const isEnabled = this.checked;

        // A. 保存设置到 Chrome Storage
        chrome.storage.sync.set({ ai_anchor_enabled: isEnabled });

        // B. 发送消息给当前网页的 content.js，让它立即执行隐藏/显示
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if(tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "toggle_sidebar",
                    enabled: isEnabled
                });
            }
        });
    });
});