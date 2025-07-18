const { ipcRenderer } = require('electron');

class TemplatesSettings {
    constructor() {
        // 默认设置
        this.settings = {
            cppTemplate: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    // 在这里编写你的代码
    
    return 0;
}`
        };
        
        this.init();
    }

    async init() {
        console.log('初始化模板设置页面');
        
        // 应用主题
        await this.applyTheme();
        
        // 加载设置
        await this.loadSettings();
        
        // 设置事件监听器
        this.setupEventListeners();
        
        // 更新UI
        this.updateUI();
    }

    async applyTheme() {
        try {
            // 从主进程获取当前主题设置
            if (window.electronAPI && window.electronAPI.getAllSettings) {
                const allSettings = await window.electronAPI.getAllSettings();
                if (allSettings && allSettings.theme) {
                    const theme = allSettings.theme;
                    console.log('模板设置应用主题:', theme);
                    
                    // 清除现有主题类
                    document.body.classList.remove('theme-light', 'theme-dark');
                    document.body.removeAttribute('data-theme');
                    document.body.removeAttribute('data-editor-theme');
                    
                    // 应用新主题
                    document.body.classList.add(`theme-${theme}`);
                    document.body.setAttribute('data-theme', theme);
                    document.body.setAttribute('data-editor-theme', theme);
                }
            }
        } catch (error) {
            console.error('应用主题失败:', error);
            // 默认使用深色主题
            document.body.classList.add('theme-dark');
            document.body.setAttribute('data-theme', 'dark');
        }
    }

    setupEventListeners() {
        console.log('设置事件监听器');
        
        // 保存设置
        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }
        
        // 取消按钮
        const cancelBtn = document.getElementById('cancel-settings');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeWindow();
            });
        }
        
        // 重置按钮
        const resetBtn = document.getElementById('reset-settings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSettings();
            });
        }
        
        // 预览按钮
        const previewBtn = document.getElementById('preview-template');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                this.showPreview();
            });
        }
        
        // 关闭预览按钮
        const closePreviewBtn = document.getElementById('close-preview');
        if (closePreviewBtn) {
            closePreviewBtn.addEventListener('click', () => {
                this.closePreview();
            });
        }
        
        // 预览对话框背景点击关闭
        const previewDialog = document.getElementById('preview-dialog');
        if (previewDialog) {
            previewDialog.addEventListener('click', (e) => {
                if (e.target === previewDialog) {
                    this.closePreview();
                }
            });
        }
        
        // 模板内容变化监听
        const cppTemplateTextarea = document.getElementById('cpp-template');
        if (cppTemplateTextarea) {
            cppTemplateTextarea.addEventListener('input', (e) => {
                this.settings.cppTemplate = e.target.value;
                console.log('模板内容已更新');
            });
            
            // 添加键盘快捷键支持
            cppTemplateTextarea.addEventListener('keydown', (e) => {
                // Ctrl+S 保存
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    this.saveSettings();
                }
                
                // 支持Tab键缩进
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = e.target.selectionStart;
                    const end = e.target.selectionEnd;
                    const value = e.target.value;
                    
                    e.target.value = value.substring(0, start) + '    ' + value.substring(end);
                    e.target.selectionStart = e.target.selectionEnd = start + 4;
                }
            });
        }
    }

    async loadSettings() {
        try {
            console.log('加载设置中...');
            
            // 从主进程获取设置
            if (window.electronAPI && window.electronAPI.getAllSettings) {
                const allSettings = await window.electronAPI.getAllSettings();
                if (allSettings && allSettings.cppTemplate) {
                    this.settings.cppTemplate = allSettings.cppTemplate;
                    console.log('从Electron API获取设置成功');
                }
            } else {
                console.log('Electron API不可用，尝试使用ipcRenderer');
                
                // 使用ipcRenderer作为后备
                const allSettings = await ipcRenderer.invoke('get-all-settings');
                if (allSettings && allSettings.cppTemplate) {
                    this.settings.cppTemplate = allSettings.cppTemplate;
                    console.log('从ipcRenderer获取设置成功');
                }
            }
            
            console.log('模板设置加载完成:', this.settings);
        } catch (error) {
            console.error('加载模板设置失败:', error);
            this.showMessage('加载设置失败，使用默认模板', 'error');
        }
    }

    updateUI() {
        console.log('更新UI界面');
        
        // 更新模板编辑器
        const cppTemplateTextarea = document.getElementById('cpp-template');
        if (cppTemplateTextarea) {
            cppTemplateTextarea.value = this.settings.cppTemplate;
            console.log('模板内容已加载到编辑器');
        } else {
            console.error('找不到模板编辑器元素');
        }
    }

    async saveSettings() {
        try {
            console.log('保存设置中...');
            
            // 获取当前模板内容
            const cppTemplateTextarea = document.getElementById('cpp-template');
            if (!cppTemplateTextarea) {
                throw new Error('找不到模板编辑器');
            }
            
            const cppTemplate = cppTemplateTextarea.value.trim();
            
            if (!cppTemplate) {
                this.showMessage('模板内容不能为空', 'error');
                return;
            }
            
            const newSettings = {
                cppTemplate: cppTemplate
            };
            
            console.log('准备保存的设置:', newSettings);
            
            // 使用新的 API 保存设置
            let result;
            if (window.electronAPI && window.electronAPI.updateSettings) {
                result = await window.electronAPI.updateSettings(newSettings);
            } else {
                // 使用ipcRenderer作为后备
                result = await ipcRenderer.invoke('update-settings', null, newSettings);
            }
            
            if (result && result.success) {
                this.showMessage('模板设置保存成功！', 'success');
                console.log('设置保存成功');
                
                // 延迟关闭窗口
                setTimeout(() => {
                    this.closeWindow();
                }, 1500);
            } else {
                const errorMsg = result ? result.error : '未知错误';
                this.showMessage('保存设置失败：' + errorMsg, 'error');
                console.error('保存设置失败:', errorMsg);
            }
            
        } catch (error) {
            console.error('保存模板设置失败:', error);
            this.showMessage('保存设置失败：' + error.message, 'error');
        }
    }

    async resetSettings() {
        try {
            console.log('重置设置中...');
            
            if (confirm('确定要重置模板为默认设置吗？这将丢失当前的自定义模板。')) {
                // 重置为默认模板
                const defaultTemplate = `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    // 在这里编写你的代码
    
    return 0;
}`;
                
                // 更新设置
                this.settings.cppTemplate = defaultTemplate;
                
                // 更新UI
                const cppTemplateTextarea = document.getElementById('cpp-template');
                if (cppTemplateTextarea) {
                    cppTemplateTextarea.value = defaultTemplate;
                }
                
                // 保存到文件
                const newSettings = { cppTemplate: defaultTemplate };
                
                let result;
                if (window.electronAPI && window.electronAPI.updateSettings) {
                    result = await window.electronAPI.updateSettings(newSettings);
                } else {
                    result = await ipcRenderer.invoke('update-settings', null, newSettings);
                }
                
                if (result && result.success) {
                    this.showMessage('模板已重置为默认设置', 'success');
                    console.log('设置重置成功');
                } else {
                    this.showMessage('重置设置失败：' + (result ? result.error : '未知错误'), 'error');
                }
            }
        } catch (error) {
            console.error('重置设置失败:', error);
            this.showMessage('重置设置失败：' + error.message, 'error');
        }
    }

    showPreview() {
        console.log('显示模板预览');
        
        const cppTemplateTextarea = document.getElementById('cpp-template');
        if (!cppTemplateTextarea) {
            this.showMessage('找不到模板内容', 'error');
            return;
        }
        
        const templateContent = cppTemplateTextarea.value || '// 模板内容为空';
        
        // 更新预览内容
        const previewContent = document.getElementById('preview-content');
        if (previewContent) {
            previewContent.textContent = templateContent;
        }
        
        // 显示预览对话框
        const previewDialog = document.getElementById('preview-dialog');
        if (previewDialog) {
            previewDialog.style.display = 'block';
        }
    }

    closePreview() {
        console.log('关闭模板预览');
        
        const previewDialog = document.getElementById('preview-dialog');
        if (previewDialog) {
            previewDialog.style.display = 'none';
        }
    }

    showMessage(message, type = 'info') {
        console.log(`显示消息: [${type}] ${message}`);
        
        // 移除现有的消息提示
        const existingToast = document.querySelector('.message-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // 创建消息提示
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-toast ${type}`;
        messageDiv.textContent = message;
        
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
        console.log('关闭窗口');
        
        if (window.close) {
            window.close();
        } else {
            console.warn('window.close 不可用');
        }
    }
}

// 初始化
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，初始化模板设置');
    
    try {
        new TemplatesSettings();
    } catch (error) {
        console.error('初始化模板设置失败:', error);
    }
});

// 导出给全局使用
window.TemplatesSettings = TemplatesSettings;
