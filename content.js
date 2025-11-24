(function() {
    'use strict';

    // === 1. 默认素材库 ===
// 新代码 (Chrome 扩展专用)：
const DEFAULT_GEM_STAR = chrome.runtime.getURL("assets/gem_star.png");
const DEFAULT_GEM_NORMAL = chrome.runtime.getURL("assets/gem_normal.png");

    // ==========================================================================
    // [MODULE 1] 适配器：配置层
    // ==========================================================================
    const ADAPTERS = [
        {
            name: "ChatGLM",
            match: "chatglm.cn",
            getQuestions: () => {
                const all = document.querySelectorAll('[id^="row-question-"]');
                return Array.from(all).filter(q => /^row-question-\d+$/.test(q.id) && q.offsetHeight > 0);
            },
            getText: (el) => (el.querySelector('.question-txt') || el).innerText,
            getChatId: (firstQText) => {
                const match = window.location.href.match(/\/(detail|share)\/([a-zA-Z0-9]+)/);
                return match ? match[2] : "session_" + document.title;
            }
        },
        {
            name: "DeepSeek",
            match: "chat.deepseek.com",
            getQuestions: () => {
                const allMsgs = document.querySelectorAll('.ds-message');
                const valid = Array.from(allMsgs).filter(el => {
                    let parent = el.parentElement;
                    for(let i=0; i<3; i++) {
                        if(!parent) break;
                        const style = window.getComputedStyle(parent);
                        if ((style.display === 'flex' && (style.alignItems === 'flex-end' || style.justifyContent === 'flex-end')) ||
                            style.flexDirection === 'row-reverse') {
                            return true;
                        }
                        parent = parent.parentElement;
                    }
                    return false;
                });
                valid.forEach((el, index) => {
                    if (!el.id) el.id = `gem_deepseek_id_${index}`;
                });
                return valid;
            },
            getText: (el) => el.textContent.trim(),
            getChatId: (firstQText) => {
                const match = window.location.href.match(/chat\/([a-zA-Z0-9\-]+)/);
                return match ? match[1] : "ds_session_" + firstQText.slice(0, 10);
            }
        },
        {
            name: "ChatGPT",
            match: "chatgpt.com",
            getQuestions: () => {
                const all = document.querySelectorAll('div[data-message-author-role="user"]');
                const valid = Array.from(all);
                valid.forEach((el, index) => {
                    if (!el.id) el.id = `gem_chatgpt_id_${index}`;
                });
                return valid;
            },
            getText: (el) => {
                const textNode = el.querySelector('.whitespace-pre-wrap');
                return textNode ? textNode.innerText : el.innerText;
            },
            getChatId: (firstQText) => {
                const match = window.location.href.match(/\/c\/([a-zA-Z0-9\-]+)/);
                return match ? match[1] : "gpt_nav_" + (firstQText ? firstQText.slice(0, 10) : "new");
            },
            quarantineClass: "site-chatgpt"
        },
        {
            name: "Grok",
            match: ["grok.com", "x.com"],
            getQuestions: () => {
                const allBubbles = document.querySelectorAll('.message-bubble');
                const valid = [];
                
                allBubbles.forEach(el => {
                    const parent = el.parentElement;
                    if (!parent) return;
                    if (parent.className.includes('items-end') || 
                        window.getComputedStyle(parent).alignItems === 'flex-end') {
                        valid.push(el);
                    }
                });

                valid.forEach((el, index) => {
                    if (!el.id || !el.id.startsWith('gem_')) el.id = `gem_grok_id_${index}`;
                });
                return valid;
            },
            getText: (el) => {
                const content = el.querySelector('.response-content-markdown');
                return content ? content.innerText : el.innerText;
            },
            getChatId: (firstQText) => {
                const match = window.location.href.match(/(grok|chat)\/([a-zA-Z0-9\-]+)/);
                if (match) return match[2];
                return "grok_sess_" + (firstQText ? firstQText.slice(0, 10).replace(/\s/g, '') : "new");
            },
            quarantineClass: "site-grok"
        },
        {
            name: "Doubao",
            match: "doubao.com",
            getQuestions: () => {
                // 豆包最强锚点：data-testid="send_message"
                const all = document.querySelectorAll('[data-testid="send_message"]');
                const valid = Array.from(all);
                
                // 强制注入 ID 协议
                valid.forEach((el, index) => {
                    if (!el.id) el.id = `gem_doubao_id_${index}`;
                });
                return valid;
            },
            getText: (el) => {
                // 精准提取文本，避开编辑按钮等干扰
                const content = el.querySelector('[data-testid="message_text_content"]');
                return content ? content.innerText : el.innerText;
            },
            getChatId: (firstQText) => {
                // 尝试从 URL 拿 ID
                const match = window.location.href.match(/\/chat\/([a-zA-Z0-9\-]+)/);
                return match ? match[1] : "doubao_sess_" + (firstQText ? firstQText.slice(0, 10) : "new");
            },
            quarantineClass: "site-doubao" // 开启样式隔离
        },
        {
            name: "Tongyi",
            // 【修改】变成数组，同时匹配两个域名
            match: ["tongyi.aliyun.com", "qianwen.com"],
            getQuestions: () => {
                // 使用模糊匹配，忽略后缀随机字符
                const all = document.querySelectorAll('div[class*="questionItem-"]');
                const valid = Array.from(all);
                
                valid.forEach((el, index) => {
                    if (!el.id) el.id = `gem_tongyi_id_${index}`;
                });
                return valid;
            },
            getText: (el) => {
                // 同样使用模糊匹配找到气泡内的文字
                const bubble = el.querySelector('div[class*="bubble-"]');
                return bubble ? bubble.innerText : el.innerText;
            },
            getChatId: (firstQText) => {
                // 通义的 URL 结构通常是 /chat/sessionID
                const match = window.location.href.match(/chat\/([a-zA-Z0-9\-]+)/);
                return match ? match[1] : "ty_sess_" + (firstQText ? firstQText.slice(0, 10) : "new");
            },
            quarantineClass: "site-tongyi"
        },
        {
            name: "Kimi",
            match: "www.kimi.com",
            getQuestions: () => {
                // Kimi 的类名非常规范，直接选用户气泡
                const all = document.querySelectorAll('.chat-content-item-user');
                const valid = Array.from(all);
                
                valid.forEach((el, index) => {
                    if (!el.id) el.id = `gem_kimi_id_${index}`;
                });
                return valid;
            },
            getText: (el) => {
                // 提取 .user-content 里的文本
                const content = el.querySelector('.user-content');
                return content ? content.innerText : el.innerText;
            },
            getChatId: (firstQText) => {
                // Kimi 的 URL 结构：/chat/cq...
                const match = window.location.href.match(/chat\/([a-zA-Z0-9]+)/);
                return match ? match[1] : "kimi_sess_" + (firstQText ? firstQText.slice(0, 10) : "new");
            },
            quarantineClass: "site-kimi"
        },
        {
            name: "Yuanbao",
            match: "yuanbao.tencent.com",
            getQuestions: () => {
                // 选取所有用户发的消息容器
                const all = document.querySelectorAll('.agent-chat__list__item--human');
                const valid = Array.from(all);
                
                valid.forEach((el, index) => {
                    if (!el.id) el.id = `gem_yuanbao_id_${index}`;
                });
                return valid;
            },
            getText: (el) => {
                // 优先尝试提取 .hyc-content-text，如果没有则回退到 bubble content
                const textNode = el.querySelector('.hyc-content-text');
                return textNode ? textNode.innerText : el.innerText;
            },
            getChatId: (firstQText) => {
                // 尝试从 URL 提取会话 ID (/chat/xyz)
                const match = window.location.href.match(/\/chat\/([a-zA-Z0-9\-]+)/);
                return match ? match[1] : "yb_sess_" + (firstQText ? firstQText.slice(0, 10) : "new");
            },
            quarantineClass: "site-yuanbao"
        }
    ];

    // ==========================================================================
    // [MODULE 2] 核心引擎
    // ==========================================================================
    
    const currentAdapter = ADAPTERS.find(a => {
        if (Array.isArray(a.match)) {
            return a.match.some(m => window.location.href.includes(m));
        }
        return window.location.href.includes(a.match);
    });

    if (!currentAdapter) return; 

    // 注入样式隔离类
    if (currentAdapter.quarantineClass) {
        document.body.classList.add(currentAdapter.quarantineClass);
    }

    // 智能记忆 & 设置系统
    function getStarredList(cid) {
        const raw = localStorage.getItem(`gem_nav_stars_${cid}`);
        return raw ? JSON.parse(raw) : [];
    }
    function saveStarredList(cid, list) {
        localStorage.setItem(`gem_nav_stars_${cid}`, JSON.stringify(list));
    }
    function toggleStar(qid, cid) {
        let list = getStarredList(cid);
        const idx = list.indexOf(qid);
        if (idx === -1) list.push(qid); else list.splice(idx, 1);
        saveStarredList(cid, list);
        return idx === -1;
    }
    function getUserSettings() {
        const raw = localStorage.getItem('gem_nav_settings');
        return raw ? JSON.parse(raw) : { normalIcon: null, starIcon: null };
    }
    function saveUserSettings(settings) {
        localStorage.setItem('gem_nav_settings', JSON.stringify(settings));
    }
    function compressAndSaveImage(file, type, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 100; canvas.height = 100;
                ctx.drawImage(img, 0, 0, 100, 100);
                const base64 = canvas.toDataURL('image/png');
                const settings = getUserSettings();
                settings[type] = base64;
                saveUserSettings(settings);
                callback(base64);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // DOM 结构
    const wrapper = document.createElement('div');
    wrapper.id = 'glm-nav-wrapper';
    
    const href = window.location.href;
    if (href.includes('chatgpt.com')) {
        wrapper.classList.add('site-chatgpt');
    } else if (href.includes('grok.com') || href.includes('x.com')) {
        wrapper.classList.add('site-grok');
    } else if (href.includes('yuanbao.tencent.com')) {
        wrapper.classList.add('site-yuanbao');
    }
    
    document.body.appendChild(wrapper);

    const mainContent = document.createElement('div');
    mainContent.id = 'glm-nav-main-content';
    wrapper.appendChild(mainContent);

    const btnSettings = document.createElement('div');
    btnSettings.className = 'glm-elevator-btn';
    btnSettings.innerHTML = '⚙️';
    btnSettings.title = "外观设置";
    btnSettings.style.marginBottom = '6px';
    mainContent.appendChild(btnSettings);

    const btnView = document.createElement('div');
    btnView.id = 'glm-btn-view';
    btnView.className = 'glm-elevator-btn';
    btnView.innerHTML = '≡';
    btnView.title = "切换列表视图";
    btnView.style.display = 'none';
    mainContent.appendChild(btnView);

    const btnTop = document.createElement('div');
    btnTop.className = 'glm-elevator-btn';
    btnTop.innerHTML = '▲';
    btnTop.title = "回到顶部";
    btnTop.style.display = 'none';
    mainContent.appendChild(btnTop);

    const scrollArea = document.createElement('div');
    scrollArea.id = 'glm-scroll-area';
    mainContent.appendChild(scrollArea);

    const btnBottom = document.createElement('div');
    btnBottom.className = 'glm-elevator-btn';
    btnBottom.innerHTML = '▼';
    btnBottom.title = "直达最新";
    btnBottom.style.display = 'none';
    mainContent.appendChild(btnBottom);

    const toggleBtn = document.createElement('div');
    toggleBtn.id = 'glm-toggle-btn';
    toggleBtn.innerHTML = '»';
    toggleBtn.title = "折叠/展开";
    wrapper.appendChild(toggleBtn);

    const tooltip = document.createElement('div');
    tooltip.id = 'glm-global-tooltip';
    document.body.appendChild(tooltip);

    const settingsOverlay = document.createElement('div');
    settingsOverlay.id = 'glm-settings-modal-overlay';
    settingsOverlay.innerHTML = `
        <div id="glm-settings-panel">
            <div class="glm-st-header">⚓ 侧边栏外观设置</div>
            <div class="glm-st-row">
                <div class="glm-st-label">普通状态</div>
                <div id="glm-preview-normal" class="glm-st-preview" style="background-image: url('${DEFAULT_GEM_NORMAL}')"></div>
                <div class="glm-st-actions">
                    <label class="glm-btn-upload">更换图标<input type="file" id="glm-upload-normal" accept="image/*"></label>
                    <div id="glm-reset-normal" class="glm-btn-reset">默认</div>
                </div>
            </div>
            <div class="glm-st-row">
                <div class="glm-st-label">星标状态</div>
                <div id="glm-preview-star" class="glm-st-preview" style="background-image: url('${DEFAULT_GEM_STAR}')"></div>
                <div class="glm-st-actions">
                    <label class="glm-btn-upload">更换图标<input type="file" id="glm-upload-star" accept="image/*"></label>
                    <div id="glm-reset-star" class="glm-btn-reset">默认</div>
                </div>
            </div>
            <button id="glm-btn-close-st">完成</button>
        </div>
    `;
    document.body.appendChild(settingsOverlay);

    // 逻辑控制
    let lastRenderedSignature = "";
    let isClickScrolling = false;
    let scrollDebounceTimer = null;
    let currentQuestions = [];
    let isCollapsed = false;
    let isListMode = false;

    function getCurrentIcons() {
        const settings = getUserSettings();
        return { normal: settings.normalIcon || DEFAULT_GEM_NORMAL, star: settings.starIcon || DEFAULT_GEM_STAR };
    }

    const previewNormal = settingsOverlay.querySelector('#glm-preview-normal');
    const previewStar = settingsOverlay.querySelector('#glm-preview-star');
    btnSettings.onclick = (e) => {
        e.stopPropagation();
        const icons = getCurrentIcons();
        previewNormal.style.backgroundImage = `url('${icons.normal}')`;
        previewStar.style.backgroundImage = `url('${icons.star}')`;
        settingsOverlay.classList.add('open');
    };
    settingsOverlay.querySelector('#glm-btn-close-st').onclick = () => settingsOverlay.classList.remove('open');
    settingsOverlay.onclick = (e) => { if(e.target === settingsOverlay) settingsOverlay.classList.remove('open'); };
    settingsOverlay.querySelector('#glm-upload-normal').onchange = function() {
        if (this.files && this.files[0]) compressAndSaveImage(this.files[0], 'normalIcon', (base64) => {
            previewNormal.style.backgroundImage = `url('${base64}')`; lastRenderedSignature = ""; generateNavNodes();
        });
    };
    settingsOverlay.querySelector('#glm-reset-normal').onclick = () => {
        const s = getUserSettings(); s.normalIcon = null; saveUserSettings(s);
        previewNormal.style.backgroundImage = `url('${DEFAULT_GEM_NORMAL}')`; lastRenderedSignature = ""; generateNavNodes();
    };
    settingsOverlay.querySelector('#glm-upload-star').onchange = function() {
        if (this.files && this.files[0]) compressAndSaveImage(this.files[0], 'starIcon', (base64) => {
            previewStar.style.backgroundImage = `url('${base64}')`; lastRenderedSignature = ""; generateNavNodes();
        });
    };
    settingsOverlay.querySelector('#glm-reset-star').onclick = () => {
        const s = getUserSettings(); s.starIcon = null; saveUserSettings(s);
        previewStar.style.backgroundImage = `url('${DEFAULT_GEM_STAR}')`; lastRenderedSignature = ""; generateNavNodes();
    };

    function toggleListMode() {
        isListMode = !isListMode;
        if (isListMode) {
            wrapper.classList.add('list-mode'); btnView.innerHTML = '×'; btnView.title = "关闭列表";
        } else {
            wrapper.classList.remove('list-mode'); btnView.innerHTML = '≡'; btnView.title = "切换列表视图";
        }
        setTimeout(() => {
            const activeDot = scrollArea.querySelector('.glm-nav-dot.active');
            if (activeDot) activeDot.scrollIntoView({ block: 'center', behavior: 'auto' });
        }, 50);
    }
    btnView.onclick = (e) => { e.stopPropagation(); toggleListMode(); };
    function toggleSidebar(forceState = null) {
        isCollapsed = forceState !== null ? forceState : !isCollapsed;
        if (isCollapsed) { wrapper.classList.add('collapsed'); toggleBtn.innerHTML = '⚓'; tooltip.classList.remove('visible'); }
        else { wrapper.classList.remove('collapsed'); toggleBtn.innerHTML = '»'; }
    }
    toggleBtn.onclick = (e) => { e.stopPropagation(); toggleSidebar(); };
    function checkResponsive() { if (window.innerWidth < 1400) toggleSidebar(true); }
    checkResponsive();
    window.addEventListener('resize', () => setTimeout(checkResponsive, 200));

    btnTop.onclick = () => { if (currentQuestions.length > 0) scrollToQ(currentQuestions[0], true); };
    btnBottom.onclick = () => { if (currentQuestions.length > 0) scrollToQ(currentQuestions[currentQuestions.length - 1], true); };
    // [V14.16+ 修正版] 滚动跳转逻辑
    function scrollToQ(target, isManual) {
        if (isManual) {
            isClickScrolling = true;
            // 清除之前的定时器
            if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
            // 看门狗：2秒后强制解锁
            setTimeout(() => { isClickScrolling = false; }, 2000);
        }

        // === 🚨 核心判断 ===
        // 包含 Kimi
        const isTroublemaker = ["ChatGPT", "Grok", "Doubao", "Tongyi", "Kimi", "Yuanbao"].includes(currentAdapter.name);

        // 策略：捣乱分子用瞬间跳转(auto)+顶部对齐(start)，良民用平滑滚动(smooth)+居中(center)
        const behaviorMode = isTroublemaker ? "auto" : "smooth";
        const blockMode = isTroublemaker ? "start" : "center";

        // 执行滚动
        target.scrollIntoView({ behavior: behaviorMode, block: blockMode });
        
        // 豆包、通义、Kimi 专属修正：防止被顶部栏挡住
        if (["Doubao", "Tongyi", "Kimi", "Yuanbao"].includes(currentAdapter.name) && blockMode === "start") {
            const headerOffset = 80; 
            const elementPosition = target.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({
                top: elementPosition - headerOffset,
                behavior: "auto"
            });
        }
    }

    // --- 渲染主函数 ---
    function generateNavNodes() {
        const validQuestions = currentAdapter.getQuestions();
        currentQuestions = validQuestions;

        const hasContent = validQuestions.length > 0;
        const showElevator = validQuestions.length > 3;

        wrapper.style.display = hasContent ? 'flex' : 'none';
        btnView.style.display = hasContent ? 'flex' : 'none';
        btnTop.style.display = showElevator ? 'flex' : 'none';
        btnBottom.style.display = showElevator ? 'flex' : 'none';

        if (!hasContent) return;

        const firstQText = currentAdapter.getText(validQuestions[0]);
        const lastQText = currentAdapter.getText(validQuestions[validQuestions.length-1]);
        const currentSignature = validQuestions.map(q => q.id).join('|') + `_${firstQText.slice(0,5)}_${lastQText.slice(0,5)}`;

        if (currentSignature === lastRenderedSignature) return;
        lastRenderedSignature = currentSignature;

        scrollArea.innerHTML = '';

        const currentChatId = currentAdapter.getChatId(firstQText);
        const starredList = getStarredList(currentChatId);
        const currentIcons = getCurrentIcons();

        validQuestions.forEach((q, index) => {
            const dot = document.createElement('div');
            dot.className = 'glm-nav-dot';
            dot.dataset.targetId = q.id;

            const isStarred = starredList.includes(q.id);
            if (currentIcons.star && currentIcons.star !== "null") dot.style.backgroundImage = isStarred ? `url(${currentIcons.star})` : `url(${currentIcons.normal})`;
            if(isStarred) dot.classList.add('is-starred');

            let textRaw = currentAdapter.getText(q);
            const cleanText = textRaw.replace(/\s+/g, ' ').trim();
            const tooltipText = `Q${index + 1}: ${cleanText.slice(0, 80)}${cleanText.length > 80 ? '...' : ''}`;
            const labelText = cleanText.slice(0, 60);

            dot.dataset.rawText = tooltipText;

            const labelSpan = document.createElement('span');
            labelSpan.className = 'glm-nav-label';
            labelSpan.innerText = labelText;
            dot.appendChild(labelSpan);

            dot.onmouseenter = () => {
                if (isCollapsed || isListMode) return; 
                const rect = dot.getBoundingClientRect();
                tooltip.innerText = (dot.classList.contains('is-starred') ? "⭐ " : "") + dot.dataset.rawText;
                tooltip.style.right = (window.innerWidth - rect.left + 25) + 'px';
                tooltip.style.top = (rect.top + rect.height / 2) + 'px';
                tooltip.classList.add('visible');
            };
            dot.onmouseleave = () => tooltip.classList.remove('visible');

            dot.onclick = (e) => {
                e.stopPropagation();
                
                // 1. 切换激活状态 UI
                const allDots = scrollArea.querySelectorAll('.glm-nav-dot.active');
                allDots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');

                // 2. 获取目标元素
                const targetQ = document.getElementById(q.id);
                if (targetQ) {
                    // === ⚠️ 关键修正：这里必须调用 scrollToQ，才能触发针对豆包的强制跳转逻辑 ===
                    scrollToQ(targetQ, true); 
                    
                    // 3. 高亮闪烁逻辑 (Flash Effect)
                    let flashNode = targetQ;
                    
                    if (wrapper.classList.contains('site-chatgpt') || wrapper.classList.contains('site-grok')) {
                        const bubble = targetQ.querySelector('.user-message-bubble-color') || 
                                       targetQ.querySelector('[class*="bg-"]') || 
                                       (wrapper.classList.contains('site-grok') ? targetQ : null);
                        if (bubble) {
                            flashNode = bubble;
                            const r = window.getComputedStyle(bubble).borderRadius;
                            if(r && r!=='0px') flashNode.style.setProperty('--glm-flash-radius', r);
                        }
                    }

                    document.querySelectorAll('.glm-flash-target').forEach(el => el.classList.remove('glm-flash-target'));
                    flashNode.classList.remove('glm-flash-target');
                    void flashNode.offsetWidth; // 强制重绘
                    flashNode.classList.add('glm-flash-target');
                }
            };

            dot.ondblclick = (e) => {
                e.stopPropagation();
                const nowStarred = toggleStar(q.id, currentChatId);
                const freshIcons = getCurrentIcons();
                if (freshIcons.star && freshIcons.star !== "null") dot.style.backgroundImage = nowStarred ? `url(${freshIcons.star})` : `url(${freshIcons.normal})`;
                nowStarred ? dot.classList.add('is-starred') : dot.classList.remove('is-starred');
                if (!isListMode) {
                    tooltip.innerText = (nowStarred ? "⭐ " : "") + dot.dataset.rawText;
                    dot.style.transform = "scale(1.6)";
                    setTimeout(() => dot.style.transform = "", 200);
                }
            };

            scrollArea.appendChild(dot);
        });

        if (document._gem_radar) {
            document.removeEventListener('scroll', document._gem_radar, true);
        }

        let radarTicking = false;
        document._gem_radar = () => {
            if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
            scrollDebounceTimer = setTimeout(() => {
                isClickScrolling = false;
            }, 100);

            if (isClickScrolling) return; 
            if (radarTicking) return;

            radarTicking = true;
            requestAnimationFrame(() => {
                if (!currentQuestions || currentQuestions.length === 0) {
                    radarTicking = false;
                    return;
                }

                const readingLine = window.innerHeight / 4;
                let closestQId = null;
                let minDistance = Infinity;

                for (const qData of currentQuestions) {
                    const qNode = document.getElementById(qData.id);
                    if (!qNode) continue;

                    const rect = qNode.getBoundingClientRect();
                    const distance = Math.abs(rect.top - readingLine);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestQId = qData.id;
                    }
                }

                if (closestQId) {
                    const activeDot = scrollArea.querySelector('.glm-nav-dot.active');
                    if (!activeDot || activeDot.dataset.targetId !== closestQId) {
                        if (activeDot) activeDot.classList.remove('active');
                        const newActive = scrollArea.querySelector(`.glm-nav-dot[data-target-id="${closestQId}"]`);
                        if (newActive) {
                            newActive.classList.add('active');
                            const containerH = scrollArea.clientHeight;
                            scrollArea.scrollTo({ 
                                top: newActive.offsetTop - (containerH / 2) + 12, 
                                behavior: 'smooth' 
                            });
                        }
                    }
                }
                radarTicking = false;
            });
        };

        document.addEventListener('scroll', document._gem_radar, true);
    }

    let timeout = null;
    const observer = new MutationObserver(() => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(generateNavNodes, 800);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(generateNavNodes, 1000);
// ==========================================================================
    // [MODULE 3] 全局开关控制 (终极方案：动态样式注入)
    // ==========================================================================
    
    const HIDE_STYLE_ID = 'ai-anchor-force-hide';

    function toggleSidebarVisibility(show) {
        const existingStyle = document.getElementById(HIDE_STYLE_ID);
        
        if (show) {
            // 🟢 开启：如果存在隐藏补丁，把它撕掉
            if (existingStyle) existingStyle.remove();
        } else {
            // 🔴 关闭：贴上一个“强力隐身符”
            if (!existingStyle) {
                const style = document.createElement('style');
                style.id = HIDE_STYLE_ID;
                // 使用 html body 前缀增加权重，确保压制 patch.css
                style.innerHTML = `
                    html body #glm-nav-wrapper { 
                        display: none !important; 
                        visibility: hidden !important;
                        opacity: 0 !important;
                        pointer-events: none !important;
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }

    // 1. 初始化读取状态
    chrome.storage.sync.get(['ai_anchor_enabled'], function(result) {
        // 默认为开启，只有明确记录为 false 才隐藏
        if (result.ai_anchor_enabled === false) {
            toggleSidebarVisibility(false);
        }
    });

    // 2. 监听 Popup 指令
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "toggle_sidebar") {
            // 直接调用显示/隐藏函数
            toggleSidebarVisibility(request.enabled);
        }
    });

})(); // <--- 再次提醒：这是文件结束的括号，一定要保留！