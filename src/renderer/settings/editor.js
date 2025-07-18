const { ipcRenderer } = require('electron');

class EditorSettings {
    constructor() {
        // 默认设置
        this.settings = {
            font: 'Consolas, "Courier New", monospace',
            fontSize: 14,
            theme: 'dark',
            tabSize: 4,
            wordWrap: false,
            lineNumbers: true,
            autoCompletion: true,
            bracketMatching: true,
            highlightCurrentLine: true
        };
        
        this.init();
    }

    async init() {
        // 应用主题
        await this.applyTheme();
        
        // 加载设置
        await this.loadSettings();
        
        // 设置事件监听器
        this.setupEventListeners();
        
        // 更新UI
        this.updateUI();
    }

    setupEventListeners() {
        // 保存按钮
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });
        
        // 取消按钮
        document.getElementById('cancel-settings').addEventListener('click', () => {
            this.closeWindow();
        });
        
        // 重置按钮
        const resetBtn = document.getElementById('reset-settings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSettings();
            });
        }
        
        // 关闭字体下载对话框
        const closeFontDialogBtn = document.getElementById('close-font-dialog');
        if (closeFontDialogBtn) {
            closeFontDialogBtn.addEventListener('click', () => {
                this.closeFontDialog();
            });
        }
        
        // 实时预览设置变化
        this.setupRealTimePreview();
    }

    setupRealTimePreview() {
        // 主题变化
        const themeSelect = document.getElementById('editor-theme');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.settings.theme = e.target.value;
                this.applyTheme();
            });
        }
        
        // 字体大小变化
        const fontSizeInput = document.getElementById('font-size');
        if (fontSizeInput) {
            fontSizeInput.addEventListener('input', (e) => {
                this.settings.fontSize = parseInt(e.target.value);
                this.updatePreview();
            });
        }
        
        // 字体变化
        const fontSelect = document.getElementById('editor-font');
        if (fontSelect) {
            fontSelect.addEventListener('change', (e) => {
                this.settings.font = e.target.value;
                this.updatePreview();
            });
        }
    }

    updatePreview() {
        // 更新预览区域的样式
        const preview = document.querySelector('.settings-preview');
        if (preview) {
            preview.style.fontFamily = this.settings.font;
            preview.style.fontSize = this.settings.fontSize + 'px';
        }
    }

    async loadSettings() {
        try {
            // 从主进程获取设置
            const allSettings = await window.electronAPI.getAllSettings();
            if (allSettings) {
                // 使用扁平的设置结构
                this.settings = {
                    font: allSettings.font || 'Consolas',
                    fontSize: allSettings.fontSize || 14,
                    theme: allSettings.theme || 'dark',
                    enableAutoCompletion: allSettings.enableAutoCompletion !== undefined ? allSettings.enableAutoCompletion : true
                };
            }
            console.log('编辑器设置加载完成:', this.settings);
        } catch (error) {
            console.error('加载编辑器设置失败:', error);
        }
    }

    closeFontDialog() {
        // 关闭字体下载对话框
        const dialog = document.getElementById('font-download-dialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
    }

    collectSettings() {
        // 从UI收集设置（只收集简化设置中需要的字段）
        const fontSelect = document.getElementById('editor-font');
        const fontSizeInput = document.getElementById('font-size');
        const themeSelect = document.getElementById('editor-theme');
        const autoCompletionCheck = document.getElementById('auto-completion');

        const newSettings = {};
        
        if (fontSelect) newSettings.font = fontSelect.value;
        if (fontSizeInput) newSettings.fontSize = parseInt(fontSizeInput.value);
        if (themeSelect) newSettings.theme = themeSelect.value;
        if (autoCompletionCheck) newSettings.enableAutoCompletion = autoCompletionCheck.checked;
        
        return newSettings;
    }

    async saveSettings() {
        try {
            // 收集设置
            const newSettings = this.collectSettings();
            
            // 使用新的 API 保存设置
            if (window.electronAPI && window.electronAPI.updateSettings) {
                const result = await window.electronAPI.updateSettings(newSettings);
                if (result.success) {
                    this.showMessage('编辑器设置保存成功！', 'success');
                    
                    // 延迟关闭窗口
                    setTimeout(() => {
                        this.closeWindow();
                    }, 1000);
                } else {
                    this.showMessage('保存设置失败：' + (result.error || '未知错误'), 'error');
                }
            } else {
                this.showMessage('设置 API 不可用', 'error');
            }
            
        } catch (error) {
            console.error('保存编辑器设置失败:', error);
            this.showMessage('保存设置失败：' + error.message, 'error');
        }
    }

    async resetSettings() {
        try {
            if (window.electronAPI && window.electronAPI.resetSettings) {
                const result = await window.electronAPI.resetSettings();
                if (result.success) {
                    // 重新加载设置
                    await this.loadSettings();
                    this.updateUI();
                    this.applyTheme();
                    this.showMessage('编辑器设置已重置为默认值', 'success');
                } else {
                    this.showMessage('重置设置失败：' + (result.error || '未知错误'), 'error');
                }
            } else {
                this.showMessage('设置 API 不可用', 'error');
            }
        } catch (error) {
            console.error('重置设置失败:', error);
            this.showMessage('重置设置失败：' + error.message, 'error');
        }
    }

    updateUI() {
        // 更新UI元素（只更新简化设置中的字段）
        const fontSelect = document.getElementById('editor-font');
        const fontSizeInput = document.getElementById('font-size');
        const themeSelect = document.getElementById('editor-theme');
        const autoCompletionCheck = document.getElementById('auto-completion');

        if (fontSelect && this.settings.font) fontSelect.value = this.settings.font;
        if (fontSizeInput && this.settings.fontSize) fontSizeInput.value = this.settings.fontSize;
        if (themeSelect && this.settings.theme) themeSelect.value = this.settings.theme;
        if (autoCompletionCheck && this.settings.enableAutoCompletion !== undefined) {
            autoCompletionCheck.checked = this.settings.enableAutoCompletion;
        }
        
        this.applyTheme();
    }

    async applyTheme() {
        try {
            // 从主进程获取当前主题设置
            if (window.electronAPI && window.electronAPI.getAllSettings) {
                const allSettings = await window.electronAPI.getAllSettings();
                if (allSettings && allSettings.theme) {
                    const theme = allSettings.theme;
                    console.log('编辑器设置应用主题:', theme);
                    
                    // 清除现有主题类
                    document.body.classList.remove('theme-light', 'theme-dark');
                    document.body.removeAttribute('data-theme');
                    document.body.removeAttribute('data-editor-theme');
                    
                    // 应用新主题
                    document.body.classList.add(`theme-${theme}`);
                    document.body.setAttribute('data-theme', theme);
                    document.body.setAttribute('data-editor-theme', theme);
                    return;
                }
            }
            
            // 后备方案：使用本地设置
            const body = document.body;
            body.className = body.className.replace(/theme-\w+/g, '');
            body.classList.add(`theme-${this.settings.theme || 'dark'}`);
        } catch (error) {
            console.error('应用主题失败:', error);
            // 默认使用深色主题
            document.body.classList.add('theme-dark');
            document.body.setAttribute('data-theme', 'dark');
        }
    }

    showMessage(message, type = 'info') {
        // 创建消息提示
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-toast ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        
        // 设置颜色
        switch (type) {
            case 'success':
                messageDiv.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                messageDiv.style.backgroundColor = '#f44336';
                break;
            default:
                messageDiv.style.backgroundColor = '#2196F3';
        }
        
        document.body.appendChild(messageDiv);
        
        // 显示动画
        requestAnimationFrame(() => {
            messageDiv.style.opacity = '1';
        });
        
        // 3秒后移除
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }

    closeWindow() {
        window.close();
    }
}

// 初始化
window.addEventListener('DOMContentLoaded', () => {
    new EditorSettings();
});
