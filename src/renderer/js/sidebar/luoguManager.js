class LuoguManager {
    constructor() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.csrfToken = null;
        this.selectedFile = null;
        this.selectedFileContent = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSavedLoginState();
    }

    activate() {
        // 面板激活时的回调（可选）
    }

    bindEvents() {
        document.getElementById('luogu-login-btn')?.addEventListener('click', () => this.handleLogin());
        document.getElementById('luogu-logout-btn')?.addEventListener('click', () => this.handleLogout());
        document.getElementById('luogu-captcha-refresh')?.addEventListener('click', () => this.refreshCaptcha());
        document.getElementById('luogu-captcha-img')?.addEventListener('click', () => this.refreshCaptcha());
        document.getElementById('luogu-submit-btn')?.addEventListener('click', () => this.handleSubmit());
        document.getElementById('luogu-use-editor-code')?.addEventListener('click', () => this.useEditorCode());
        document.getElementById('luogu-select-file')?.addEventListener('click', () => this.selectFile());
        document.getElementById('luogu-remove-file')?.addEventListener('click', () => this.removeSelectedFile());
        document.getElementById('luogu-refresh-history')?.addEventListener('click', () => this.refreshHistory());
    }

    loadSavedLoginState() {
        try {
            const saved = localStorage.getItem('luogu_login_state');
            if (saved) {
                const state = JSON.parse(saved);
                if (state.isLoggedIn && state.user) {
                    this.isLoggedIn = true;
                    this.currentUser = state.user;
                    this.csrfToken = state.csrfToken;
                    this.updateUI();
                    return;
                }
            }
        } catch (e) {
            console.warn('加载登录状态失败:', e);
        }
        this.refreshCaptcha();
    }

    saveLoginState() {
        localStorage.setItem('luogu_login_state', JSON.stringify({
            isLoggedIn: this.isLoggedIn,
            user: this.currentUser,
            csrfToken: this.csrfToken,
            savedAt: Date.now()
        }));
    }

    clearLoginState() {
        localStorage.removeItem('luogu_login_state');
    }

    async refreshCaptcha() {
        try {
            const img = document.getElementById('luogu-captcha-img');
            if (!img) return;
            img.src = `https://www.luogu.com.cn/lg4/captcha?t=${Date.now()}`;
        } catch (e) {
            console.warn('刷新验证码失败:', e);
        }
    }

    async handleLogin() {
        const username = document.getElementById('luogu-username')?.value?.trim();
        const password = document.getElementById('luogu-password')?.value;
        const captcha = document.getElementById('luogu-captcha')?.value?.trim();

        if (!username || !password) {
            this.showStatus('luogu-login-status', '请输入用户名和密码', 'error');
            return;
        }
        if (!captcha) {
            this.showStatus('luogu-login-status', '请输入验证码', 'error');
            return;
        }

        try {
            this.showStatus('luogu-login-status', '正在登录...', 'info');

            const res = await fetch('https://www.luogu.com.cn/do-auth/password', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Referer': 'https://www.luogu.com.cn/'
                },
                body: JSON.stringify({ username, password, captcha })
            });

            const result = await res.json();
            console.log('登录响应:', result);

            if (res.ok && result.username) {
                this.isLoggedIn = true;
                this.currentUser = {
                    username: result.username,
                    uid: result.uid || 0
                };
                
                this.saveLoginState();
                this.updateUI();
                this.showStatus('luogu-login-status', '登录成功！', 'success');
                
                document.getElementById('luogu-username').value = '';
                document.getElementById('luogu-password').value = '';
                document.getElementById('luogu-captcha').value = '';
                
                setTimeout(() => this.fetchUserInfo(), 500);
                setTimeout(() => this.refreshCaptcha(), 1000);
            } else {
                this.showStatus('luogu-login-status', result.msg || result.message || '登录失败', 'error');
                this.refreshCaptcha();
            }
        } catch (e) {
            console.error('登录失败:', e);
            this.showStatus('luogu-login-status', '登录失败：' + e.message, 'error');
            this.refreshCaptcha();
        }
    }

    async handleLogout() {
        try {
            await fetch('https://www.luogu.com.cn/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) {}
        
        this.isLoggedIn = false;
        this.currentUser = null;
        this.csrfToken = null;
        this.clearLoginState();
        this.updateUI();
        this.showStatus('luogu-login-status', '已退出登录', 'success');
        this.refreshCaptcha();
    }

    async fetchUserInfo() {
        if (!this.currentUser?.username) return;
        
        try {
            // 先访问首页获取 CSRF Token
            const homeRes = await fetch('https://www.luogu.com.cn/', {
                credentials: 'include'
            });
            const homeHtml = await homeRes.text();
            
            const csrfMatch = homeHtml.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/i);
            if (csrfMatch) {
                this.csrfToken = csrfMatch[1];
                console.log('获取到 CSRF Token');
                this.saveLoginState();
            }

            // 尝试从登录响应中获取 UID（如果有的话）
            // 如果没有 UID，后续使用用户名获取记录
            if (!this.currentUser.uid && this.currentUser.username) {
                // 尝试从首页 HTML 中提取当前用户 UID
                const uidMatch = homeHtml.match(/"uid":\s*(\d+)/i);
                if (uidMatch) {
                    this.currentUser.uid = parseInt(uidMatch[1]);
                    console.log('获取到 UID:', this.currentUser.uid);
                }
            }

            this.saveLoginState();
            this.updateUI();
            
            // 刷新历史记录
            setTimeout(() => this.refreshHistory(), 500);
        } catch (e) {
            console.warn('获取用户信息失败:', e);
        }
    }

    updateUI() {
        const loginSection = document.getElementById('luogu-login-section');
        const submitSection = document.getElementById('luogu-submit-section');
        const userInfo = document.getElementById('luogu-user-info');
        const logoutBtn = document.getElementById('luogu-logout-btn');

        if (this.isLoggedIn) {
            loginSection.style.display = 'none';
            submitSection.style.display = 'block';
            userInfo.style.display = 'flex';
            logoutBtn.disabled = false;

            document.getElementById('luogu-display-username').textContent = this.currentUser.username;
            document.getElementById('luogu-display-uid').textContent = `UID: ${this.currentUser.uid}`;
            document.getElementById('luogu-solved-count').textContent = this.currentUser.solvedProblemCount || 0;
            document.getElementById('luogu-submit-count').textContent = this.currentUser.submittedProblemCount || 0;
        } else {
            loginSection.style.display = 'block';
            submitSection.style.display = 'none';
            userInfo.style.display = 'none';
            logoutBtn.disabled = true;
        }
    }

    async useEditorCode() {
        const activeTab = window.tabManager?.getActiveTab?.();
        if (!activeTab) {
            this.showStatus('luogu-submit-status', '请先打开一个代码文件', 'error');
            return;
        }

        const content = activeTab.editor?.getValue?.() || '';
        if (!content.trim()) {
            this.showStatus('luogu-submit-status', '当前编辑器内容为空', 'error');
            return;
        }

        this.selectedFile = { name: activeTab.fileName || 'code.cpp', path: 'editor' };
        this.selectedFileContent = content;
        this.updateSelectedFileUI();
        this.showStatus('luogu-submit-status', '已使用当前编辑器代码', 'success');
    }

    async selectFile() {
        try {
            const result = await window.electronAPI?.showOpenDialog?.({
                title: '选择代码文件',
                properties: ['openFile'],
                filters: [{ name: '代码文件', extensions: ['cpp', 'c', 'py', 'java', 'pas'] }]
            });

            const filePath = result?.filePaths?.[0];
            if (!filePath) return;

            const content = await window.electronAPI?.readFileContent?.(filePath);
            this.selectedFile = { name: filePath.split(/[\\/]/).pop(), path: filePath };
            this.selectedFileContent = content;
            
            this.updateSelectedFileUI();
            this.showStatus('luogu-submit-status', `已选择：${this.selectedFile.name}`, 'success');
        } catch (e) {
            this.showStatus('luogu-submit-status', '选择文件失败', 'error');
        }
    }

    removeSelectedFile() {
        this.selectedFile = null;
        this.selectedFileContent = null;
        this.updateSelectedFileUI();
        this.showStatus('luogu-submit-status', '已移除', 'info');
    }

    updateSelectedFileUI() {
        const el = document.getElementById('luogu-selected-file');
        const nameEl = document.getElementById('luogu-file-name');
        if (this.selectedFile) {
            el.style.display = 'flex';
            nameEl.textContent = this.selectedFile.name;
        } else {
            el.style.display = 'none';
        }
    }

    async handleSubmit() {
        if (!this.isLoggedIn) {
            this.showStatus('luogu-submit-status', '请先登录', 'error');
            return;
        }

        const problemId = document.getElementById('luogu-problem-id')?.value?.trim();
        const language = document.getElementById('luogu-language')?.value || 'C++';

        if (!problemId) {
            this.showStatus('luogu-submit-status', '请输入题目编号', 'error');
            return;
        }
        if (!this.selectedFileContent) {
            this.showStatus('luogu-submit-status', '请选择代码', 'error');
            return;
        }

        try {
            this.showStatus('luogu-submit-status', '正在提交...', 'info');

            // 关键：必须先访问题目页面获取该题目特定的 CSRF Token
            const problemUrl = `https://www.luogu.com.cn/problem/${problemId}`;
            console.log('访问题目页面:', problemUrl);
            
            const problemRes = await fetch(problemUrl, {
                credentials: 'include',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml',
                    'Referer': 'https://www.luogu.com.cn/'
                }
            });
            
            if (!problemRes.ok) {
                console.error('访问题目页面失败:', problemRes.status);
                throw new Error(`无法访问题目页面 (HTTP ${problemRes.status})，请检查题目编号`);
            }
            
            const problemHtml = await problemRes.text();
            console.log('题目页面 HTML 长度:', problemHtml.length);
            
            const csrfMatch = problemHtml.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/i);
            
            if (!csrfMatch) {
                console.error('CSRF Token 匹配失败');
                throw new Error('无法从题目页面获取 CSRF Token');
            }
            
            const pageCsrfToken = csrfMatch[1];
            console.log('获取到题目页面 CSRF Token:', pageCsrfToken.substring(0, 20) + '...');

            // 使用 Electron IPC 通过主进程发送请求
            const submitUrl = `https://www.luogu.com.cn/fe/api/problem/submit/${problemId}`;
            console.log('提交 URL:', submitUrl);

            try {
                const result = await window.electronAPI.luoguSubmit(
                    problemId,
                    this.selectedFileContent,
                    this.mapLanguage(language),
                    pageCsrfToken
                );
                
                console.log('提交响应:', result);

                if (result.code === 200 || result.rid) {
                    const rid = result.data?.rid || result.rid;
                    this.showStatus('luogu-submit-status', `提交成功！ID: ${rid}`, 'success');
                    setTimeout(() => this.refreshHistory(), 2000);
                } else {
                    this.showStatus('luogu-submit-status', result.msg || result.message || result.data || '提交失败', 'error');
                }
            } catch (e) {
                console.error('IPC 提交失败:', e);
                throw e;
            }
        } catch (e) {
            console.error('提交失败:', e);
            this.showStatus('luogu-submit-status', '提交失败：' + e.message, 'error');
        }
    }

    mapLanguage(lang) {
        const map = { 'C++': 1, 'C': 2, 'Python 3': 3, 'Python': 3, 'Java': 4, 'Pascal': 5 };
        return map[lang] || 1;
    }

    async refreshHistory() {
        if (!this.isLoggedIn || !this.currentUser?.uid) return;

        const listEl = document.getElementById('luogu-history-list');
        listEl.innerHTML = '<div class="luogu-empty-message">加载中...</div>';

        try {
            const res = await fetch(`https://www.luogu.com.cn/record/list?user=${this.currentUser.uid}&page=1`, {
                credentials: 'include'
            });
            const result = await res.json();

            if (result.code === 200) {
                const records = result.data?.records || [];
                if (records.length === 0) {
                    listEl.innerHTML = '<div class="luogu-empty-message">暂无记录</div>';
                    return;
                }

                listEl.innerHTML = '';
                records.slice(0, 10).forEach(rec => {
                    const div = document.createElement('div');
                    div.className = 'luogu-history-item';
                    const statusClass = this.getStatusClass(rec.result);
                    const statusText = this.getStatusText(rec.result);
                    div.innerHTML = `
                        <div>
                            <div class="luogu-history-problem">${rec.problem?.pid || '未知'}</div>
                            <div class="luogu-history-time">${this.getTimeAgo(rec.showTime)}</div>
                        </div>
                        <div class="luogu-history-status ${statusClass}">${statusText}</div>
                    `;
                    div.onclick = () => {
                        if (rec.id) window.electronAPI?.openExternal?.(`https://www.luogu.com.cn/record/${rec.id}`);
                    };
                    listEl.appendChild(div);
                });
            } else {
                listEl.innerHTML = '<div class="luogu-empty-message">加载失败</div>';
            }
        } catch (e) {
            console.error('刷新历史失败:', e);
            listEl.innerHTML = '<div class="luogu-empty-message">加载失败</div>';
        }
    }

    getStatusClass(result) {
        const map = { 12: 'ac', 13: 'wa', 14: 'tle', 15: 'mle', 16: 're', 17: 'ce' };
        return map[result] || 'pending';
    }

    getStatusText(result) {
        const map = { 12: 'AC', 13: 'WA', 14: 'TLE', 15: 'MLE', 16: 'RE', 17: 'CE' };
        return map[result] || 'Pending';
    }

    getTimeAgo(ts) {
        if (!ts) return '未知';
        const diff = Date.now() - ts;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        return Math.floor(diff / 86400000) + '天前';
    }

    showStatus(elId, msg, type = 'info') {
        const el = document.getElementById(elId);
        if (!el) return;
        el.textContent = msg;
        el.className = `${elId} show ${type}`;
        if (type !== 'info') {
            setTimeout(() => el.classList.remove('show'), 5000);
        }
    }
}

if (typeof window !== 'undefined') {
    window.LuoguManager = LuoguManager;
}
