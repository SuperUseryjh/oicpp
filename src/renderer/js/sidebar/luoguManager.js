// 基于 vscode-luogu 实现的洛谷管理器
// 参考：vscode-luogu/src/utils/api.ts

const CSRF_TOKEN_REGEX = /<meta name="csrf-token" content="(.*)">/;

class LuoguManager {
    constructor() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.csrfToken = null;
        this.selectedFileContent = null;

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadSavedLoginState();
        this.refreshCaptcha();
        console.log('LuoguManager 初始化完成');
    }

    bindEvents() {
        document.getElementById('luogu-login-btn')?.addEventListener('click', () => this.handleLogin());
        document.getElementById('luogu-logout-btn')?.addEventListener('click', () => this.handleLogout());
        document.getElementById('luogu-refresh-captcha')?.addEventListener('click', () => this.refreshCaptcha());
        document.getElementById('luogu-captcha-img')?.addEventListener('click', () => this.refreshCaptcha());
        document.getElementById('luogu-submit-btn')?.addEventListener('click', () => this.handleSubmit());
        document.getElementById('luogu-use-current-file')?.addEventListener('click', () => this.useEditorCode());
        document.getElementById('luogu-select-file')?.addEventListener('click', () => this.selectFile());
    }

    async loadSavedLoginState() {
        const saved = localStorage.getItem('luogu_login_state');
        if (saved) {
            const state = JSON.parse(saved);
            if (state.isLoggedIn && state.user) {
                this.isLoggedIn = true;
                this.currentUser = state.user;
                this.updateUI();
                await this.fetchCsrfToken();
                return;
            }
        }
        await this.refreshCaptcha();
    }

    saveLoginState() {
        localStorage.setItem('luogu_login_state', JSON.stringify({
            isLoggedIn: this.isLoggedIn,
            user: this.currentUser
        }));
    }

    clearLoginState() {
        localStorage.removeItem('luogu_login_state');
    }

    // ========== 网络请求辅助 ==========

    async fetchJson(url, options = {}) {
        const result = await window.luoguRequest({
            url: url,
            method: options.method || 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                ...(options.headers || {})
            },
            ...options
        });

        if (result.status >= 400) {
            const error = new Error(`HTTP ${result.status}`);
            error.status = result.status;
            throw error;
        }

        return result.data;
    }

    async fetchText(url, options = {}) {
        const result = await window.luoguRequest({
            url: url,
            method: options.method || 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                ...(options.headers || {})
            },
            ...options
        });

        if (result.status >= 400) {
            throw new Error(`HTTP ${result.status}`);
        }

        return result.data;
    }

    async postJson(url, data, options = {}) {
        const result = await window.luoguRequest({
            url: url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-Token': this.csrfToken,
                ...(options.headers || {})
            },
            data: data,
            ...options
        });

        if (result.status >= 400) {
            const errorData = result.data || {};
            const error = new Error(errorData.errorMessage || `HTTP ${result.status}`);
            error.status = result.status;
            error.data = errorData;
            throw error;
        }

        return result.data;
    }

    parseCookie(cookieHeader) {
        if (!cookieHeader) return {};
        const cookies = {};
        const arr = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
        arr.forEach(c => {
            const parts = c.split(';')[0].split('=');
            if (parts.length === 2) {
                cookies[parts[0].trim()] = parts[1].trim();
            }
        });
        return cookies;
    }

    // ========== 验证码 ==========

    async refreshCaptcha() {
        try {
            const img = document.getElementById('luogu-captcha-img');
            if (!img) return;
            
            const result = await window.luoguCaptcha();
            if (result.success) {
                img.src = result.image;
            } else {
                console.warn('获取验证码失败:', result.error);
                img.src = `https://www.luogu.com.cn/lg4/captcha?t=${Date.now()}`;
            }
        } catch (e) {
            console.warn('刷新验证码失败:', e);
            const img = document.getElementById('luogu-captcha-img');
            if (img) {
                img.src = `https://www.luogu.com.cn/lg4/captcha?t=${Date.now()}`;
            }
        }
    }

    // ========== 登录 ==========

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

            const finalUsername = username.match(/^1[0-9]{10}$/) ? '+86' + username : username;

            console.log('发送登录请求:', {
                username: finalUsername,
                password: '***',
                captcha: captcha
            });

            const result = await this.postJson('https://www.luogu.com.cn/do-auth/password', {
                username: finalUsername,
                password: password,
                captcha: captcha
            });

            console.log('登录响应:', result);
            console.log('响应 headers:', result.headers);

            if (result.username) {
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

                await this.fetchCsrfToken();
                setTimeout(() => this.refreshCaptcha(), 1000);
            } else {
                this.showStatus('luogu-login-status', result.msg || '登录失败', 'error');
                await this.refreshCaptcha();
            }
        } catch (e) {
            console.error('登录失败:', e);
            this.showStatus('luogu-login-status', '登录失败：' + e.message, 'error');
            await this.refreshCaptcha();
        }
    }

    async handleLogout() {
        try {
            await this.postJson('https://www.luogu.com.cn/auth/logout', {});
        } catch (e) {}

        this.isLoggedIn = false;
        this.currentUser = null;
        this.csrfToken = null;
        this.clearLoginState();
        this.updateUI();
        this.showStatus('luogu-login-status', '已退出登录', 'success');
        await this.refreshCaptcha();
    }

    // ========== CSRF Token ==========

    async fetchCsrfToken() {
        try {
            const html = await this.fetchText('https://www.luogu.com.cn/ranking');
            const match = html.match(CSRF_TOKEN_REGEX);
            if (match) {
                this.csrfToken = match[1];
                console.log('获取到 CSRF Token');
            }
        } catch (e) {
            console.warn('获取 CSRF Token 失败:', e);
        }
    }

    async fetchCsrfTokenFromProblem(problemId) {
        try {
            const html = await this.fetchText(`https://www.luogu.com.cn/problem/${problemId}`);
            const match = html.match(CSRF_TOKEN_REGEX);
            if (match) {
                this.csrfToken = match[1];
                console.log('从题目页面获取到 CSRF Token');
            }
        } catch (e) {
            console.warn('从题目页面获取 CSRF Token 失败:', e);
        }
    }

    // ========== UI 更新 ==========

    updateUI() {
        const loginSection = document.getElementById('luogu-login-section');
        const submitSection = document.getElementById('luogu-submit-section');
        const userInfo = document.getElementById('luogu-user-info');
        const logoutBtn = document.getElementById('luogu-logout-btn');

        if (this.isLoggedIn && this.currentUser) {
            loginSection.style.display = 'none';
            submitSection.style.display = 'block';
            userInfo.style.display = 'flex';
            logoutBtn.disabled = false;

            document.getElementById('luogu-display-username').textContent = this.currentUser.username;
        } else {
            loginSection.style.display = 'block';
            submitSection.style.display = 'none';
            userInfo.style.display = 'none';
            logoutBtn.disabled = false;
        }
    }

    // ========== 代码选择 ==========

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

        this.selectedFileContent = content;
        document.getElementById('luogu-selected-file').textContent = '已使用当前编辑器代码';
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
            this.selectedFileContent = content;
            const fileName = filePath.split(/[\\/]/).pop();
            document.getElementById('luogu-selected-file').textContent = `已选择：${fileName}`;
            this.showStatus('luogu-submit-status', `已选择：${fileName}`, 'success');
        } catch (e) {
            this.showStatus('luogu-submit-status', '选择文件失败', 'error');
        }
    }

    // ========== 提交代码 ==========

    async handleSubmit() {
        if (!this.isLoggedIn) {
            this.showStatus('luogu-submit-status', '请先登录', 'error');
            return;
        }

        const problemId = document.getElementById('luogu-problem-id')?.value?.trim();
        const language = parseInt(document.getElementById('luogu-language')?.value || '1');

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

            // 先访问题目页面获取页面特定的 CSRF Token
            await this.fetchCsrfTokenFromProblem(problemId);

            const response = await this.postJson(
                `https://www.luogu.com.cn/fe/api/problem/submit/${problemId}`,
                {
                    code: this.selectedFileContent,
                    lang: language,
                    enableO2: 0
                }
            );

            console.log('提交响应:', response);

            if (response.rid) {
                this.showStatus('luogu-submit-status', `提交成功！ID: ${response.rid}`, 'success');
                setTimeout(() => this.refreshHistory(), 2000);
            } else {
                this.showStatus('luogu-submit-status', '提交失败', 'error');
            }
        } catch (e) {
            console.error('提交失败:', e);
            const errorMsg = e.data?.errorMessage || e.message || '提交失败';
            this.showStatus('luogu-submit-status', errorMsg, 'error');
        }
    }

    // ========== 提交历史 ==========

    async refreshHistory() {
        if (!this.isLoggedIn || !this.currentUser?.uid) return;

        const listEl = document.getElementById('luogu-history-list');
        listEl.innerHTML = '<div class="luogu-empty-message">加载中...</div>';

        try {
            const result = await this.fetchJson(`https://www.luogu.com.cn/record/list?user=${this.currentUser.uid}&page=1`);

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
        const map = {
            12: 'ac', 13: 'wa', 14: 'tle', 15: 'mle', 16: 're', 17: 'ce'
        };
        return map[result] || 'pending';
    }

    getStatusText(result) {
        const map = {
            12: 'AC', 13: 'WA', 14: 'TLE', 15: 'MLE', 16: 'RE', 17: 'CE'
        };
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

    activate() {
        if (this.isLoggedIn) {
            this.updateUI();
        }
    }
}

if (typeof window !== 'undefined') {
    window.LuoguManager = LuoguManager;
}
