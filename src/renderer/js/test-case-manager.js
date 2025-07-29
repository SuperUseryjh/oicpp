class TestCaseManager {
    constructor() {
        this.platformSelect = document.getElementById('platform-select');
        this.urlInput = document.getElementById('url-input');
        this.fetchButton = document.getElementById('fetch-test-cases-btn');
        this.messageElement = document.getElementById('test-case-message');
        this.testCasesContainer = document.getElementById('test-cases-container');

        this.setupEventListeners();
    }

    setupEventListeners() {
        if (this.fetchButton) {
            this.fetchButton.addEventListener('click', () => this.fetchTestCases());
        }
    }

    async fetchTestCases() {
        const url = this.urlInput.value.trim();
        const platform = this.platformSelect.value;

        if (!url) {
            this.showMessage('请输入URL', 'error');
            return;
        }

        this.showMessage('正在获取测试用例...', 'info');
        this.testCasesContainer.innerHTML = ''; // 清空之前的测试用例

        try {
            if (window.electronAPI && window.electronAPI.fetchTestCases) {
                const result = await window.electronAPI.fetchTestCases(url, platform);
                if (result.success) {
                    if (result.testCases && result.testCases.length > 0) {
                        this.displayTestCases(result.testCases);
                        this.showMessage(`成功获取 ${result.testCases.length} 组测试用例`, 'success');
                    } else {
                        this.showMessage('未找到测试用例。请检查URL或平台。', 'warning');
                    }
                } else {
                    this.showMessage(`获取测试用例失败: ${result.error}`, 'error');
                }
            } else {
                this.showMessage('Electron API 不可用，无法获取测试用例。', 'error');
            }
        } catch (error) {
            this.showMessage(`发生错误: ${error.message}`, 'error');
            console.error('获取测试用例时发生错误:', error);
        }
    }

    displayTestCases(testCases) {
        this.testCasesContainer.innerHTML = '';
        testCases.forEach((testCase, index) => {
            const testCaseDiv = document.createElement('div');
            testCaseDiv.className = 'test-case-pair';
            testCaseDiv.innerHTML = `
                <div class="test-case-input">
                    <h4>输入 ${index + 1}</h4>
                    <pre>${this.escapeHtml(testCase.input)}</pre>
                </div>
                <div class="test-case-output">
                    <h4>输出 ${index + 1}</h4>
                    <pre>${this.escapeHtml(testCase.output)}</pre>
                </div>
            `;
            this.testCasesContainer.appendChild(testCaseDiv);
        });
    }

    showMessage(message, type = 'info') {
        if (this.messageElement) {
            this.messageElement.textContent = message;
            this.messageElement.className = `message ${type}`;
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// 确保在DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 只有当test-case-panel存在时才初始化TestCaseManager
    if (document.querySelector('.test-case-panel')) {
        window.testCaseManager = new TestCaseManager();
    }
});