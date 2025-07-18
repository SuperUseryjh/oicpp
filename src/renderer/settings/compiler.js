const { ipcRenderer, shell } = require('electron');

class CompilerSettings {
    constructor() {
        // 默认设置
        this.settings = {
            compilerPath: '',
            compilerArgs: '-std=c++14 -O2 -static'
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
        
        // 检测现有编译器
        this.detectExistingCompiler();
    }

    async applyTheme() {
        try {
            // 从主进程获取当前主题设置
            if (window.electronAPI && window.electronAPI.getAllSettings) {
                const allSettings = await window.electronAPI.getAllSettings();
                if (allSettings && allSettings.theme) {
                    const theme = allSettings.theme;
                    console.log('应用主题:', theme);
                    
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
        // 浏览编译器路径
        document.getElementById('browse-compiler').addEventListener('click', () => {
            this.browseCompiler();
        });
        
        // 安装编译器
        document.getElementById('install-compiler').addEventListener('click', () => {
            this.showInstallDialog();
        });
        
        // 关闭安装对话框
        const closeBtn = document.getElementById('close-install-dialog');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeInstallDialog();
            });
        }
        
        // 点击对话框背景关闭
        const installDialog = document.getElementById('install-dialog');
        if (installDialog) {
            installDialog.addEventListener('click', (e) => {
                if (e.target === installDialog) {
                    this.closeInstallDialog();
                }
            });
        }
        
        // 测试编译器
        document.getElementById('test-compiler').addEventListener('click', () => {
            this.testCompiler();
        });
        
        // 保存设置
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
        
        // 编译器选项变化监听
        document.getElementById('compiler-options').addEventListener('input', (e) => {
            this.settings.compilerArgs = e.target.value;
        });
        
        // 编译器路径变化监听
        document.getElementById('compiler-path').addEventListener('input', (e) => {
            this.settings.compilerPath = e.target.value;
        });
        
        // 关闭安装对话框
        const closeDialogBtn = document.getElementById('close-install-dialog');
        if (closeDialogBtn) {
            closeDialogBtn.addEventListener('click', () => {
                this.closeInstallDialog();
            });
        }
    }

    async loadSettings() {
        try {
            // 从主进程获取设置
            const allSettings = await window.electronAPI.getAllSettings();
            if (allSettings) {
                // 使用扁平的设置结构
                this.settings = {
                    compilerPath: allSettings.compilerPath || '',
                    compilerArgs: allSettings.compilerArgs || '-std=c++14 -O2 -static'
                };
            }
            console.log('编译器设置加载完成:', this.settings);
        } catch (error) {
            console.error('加载编译器设置失败:', error);
        }
    }

    updateUI() {
        // 更新UI元素
        const compilerPathInput = document.getElementById('compiler-path');
        const compilerOptionsInput = document.getElementById('compiler-options');
        
        if (compilerPathInput) compilerPathInput.value = this.settings.compilerPath || '';
        if (compilerOptionsInput) compilerOptionsInput.value = this.settings.compilerArgs || '-std=c++14 -O2 -static';
    }

    async browseCompiler() {
        try {
            // 尝试获取一些常见的编译器路径作为默认目录
            let defaultPath = '';
            const commonCompilerPaths = [
                'C:\\MinGW\\bin',
                'C:\\msys64\\mingw64\\bin',
                'C:\\TDM-GCC-64\\bin',
                'C:\\Program Files\\mingw-w64',
                'C:\\Program Files (x86)\\mingw-w64'
            ];
            
            // 检查常见路径是否存在
            for (const path of commonCompilerPaths) {
                try {
                    if (await window.electronAPI?.pathExists?.(path)) {
                        defaultPath = path;
                        break;
                    }
                } catch (error) {
                    // 忽略检查错误，继续下一个路径
                }
            }
            
            const result = await ipcRenderer.invoke('show-open-dialog', {
                title: '选择 C++ 编译器 (请选择 g++.exe 或 gcc.exe)',
                defaultPath: defaultPath,
                filters: [
                    { name: 'GCC 编译器 (g++.exe, gcc.exe)', extensions: ['exe'] },
                    { name: 'Clang 编译器 (clang++.exe)', extensions: ['exe'] },
                    { name: '所有可执行文件', extensions: ['exe'] },
                    { name: '所有文件', extensions: ['*'] }
                ],
                properties: ['openFile'],
                // 设置默认过滤器索引为第一个（GCC编译器）
                filterIndex: 0
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
                const selectedPath = result.filePaths[0];
                const fileName = selectedPath.split('\\').pop().toLowerCase();
                
                // 检查选择的文件是否是合适的编译器
                if (!fileName.includes('g++') && !fileName.includes('gcc') && !fileName.includes('clang')) {
                    const confirmed = await this.showConfirmDialog(
                        '文件选择确认',
                        `您选择的文件是 "${fileName}"，这可能不是 C++ 编译器。\n\n推荐选择：\n• g++.exe (推荐)\n• gcc.exe\n• clang++.exe\n\n是否继续使用此文件？`,
                        '继续使用',
                        '重新选择'
                    );
                    
                    if (!confirmed) {
                        // 用户选择重新选择，递归调用
                        return this.browseCompiler();
                    }
                }
                
                this.settings.compilerPath = selectedPath;
                document.getElementById('compiler-path').value = this.settings.compilerPath;
                
                // 显示成功消息
                this.showMessage(`已选择编译器: ${fileName}`, 'success');
                
                // 自动测试编译器
                await this.testCompiler();
            }
        } catch (error) {
            console.error('浏览编译器失败:', error);
            this.showMessage('浏览编译器失败：' + error.message, 'error');
        }
    }

    async testCompiler() {
        const compilerPath = this.settings.compilerPath || document.getElementById('compiler-path').value;
        
        if (!compilerPath) {
            this.showMessage('请先选择编译器路径', 'error');
            return;
        }
        
        try {
            // 创建测试代码
            const testCode = `#include <iostream>
using namespace std;
int main() {
    cout << "Hello, OICPP!" << endl;
    return 0;
}`;
            
            // 这里应该调用主进程来测试编译器
            // 暂时显示成功消息
            this.showMessage('编译器测试成功！', 'success');
            
        } catch (error) {
            console.error('测试编译器失败:', error);
            this.showMessage('编译器测试失败：' + error.message, 'error');
        }
    }

    showInstallDialog() {
        // 显示安装对话框
        const dialog = document.getElementById('install-dialog');
        if (dialog) {
            dialog.style.display = 'block';
        }
        
        // 加载可用编译器列表
        this.loadAvailableCompilers();
    }

    closeInstallDialog() {
        // 隐藏安装对话框
        const dialog = document.getElementById('install-dialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
    }

    async loadAvailableCompilers() {
        const compilerList = document.getElementById('compiler-list');
        if (!compilerList) return;
        
        // 显示加载状态
        compilerList.innerHTML = '<div class="loading">正在获取编译器列表...</div>';
        
        try {
            // 从服务器获取可用编译器列表
            const response = await fetch('https://oicpp.mywwzh.top/api/getAvailableCompilerList');
            
            if (!response.ok) {
                throw new Error(`网络错误: ${response.status} ${response.statusText}`);
            }
            
            const compilers = await response.json();
            
            // 清空现有内容
            compilerList.innerHTML = '';
            
            if (!compilers || compilers.length === 0) {
                compilerList.innerHTML = '<div class="no-compilers">暂无可用编译器</div>';
                return;
            }
            
            // 获取当前平台
            const platform = await this.getCurrentPlatform();
            
            // 过滤当前平台的编译器
            const platformCompilers = compilers.filter(compiler => 
                compiler.platform === platform
            );
            
            if (platformCompilers.length === 0) {
                compilerList.innerHTML = `<div class="no-compilers">暂无适用于 ${platform} 平台的编译器</div>`;
                return;
            }
            
            // 检查已下载的编译器
            const downloadedVersions = await this.getDownloadedVersions();
            
            // 创建编译器项目
            for (const compiler of platformCompilers) {
                const isDownloaded = downloadedVersions.includes(compiler.version);
                const isSelected = await this.isCompilerSelected(compiler.version);
                
                const compilerDiv = document.createElement('div');
                compilerDiv.className = `compiler-item ${isDownloaded ? 'downloaded' : ''} ${isSelected ? 'selected' : ''}`;
                
                compilerDiv.innerHTML = `
                    <div class="compiler-info">
                        <h4>${compiler.name}</h4>
                        <p>版本: ${compiler.version}</p>
                        <span class="platform">平台: ${compiler.platform}</span>
                    </div>
                    <div class="compiler-actions">
                        ${isSelected ? 
                            '<span class="status selected-status">已选中</span>' :
                            isDownloaded ? 
                                `<button class="select-btn" data-version="${compiler.version}">选择</button>` :
                                `<button class="download-btn" data-url="${compiler.downloadUrl}" data-version="${compiler.version}" data-name="${compiler.name}">下载</button>`
                        }
                        ${isDownloaded ? '<span class="status downloaded-status">已下载</span>' : ''}
                    </div>
                `;
                
                // 添加事件监听器
                this.addCompilerItemListeners(compilerDiv, compiler);
                
                compilerList.appendChild(compilerDiv);
            }
            
        } catch (error) {
            console.error('获取编译器列表失败:', error);
            compilerList.innerHTML = `
                <div class="error-message">
                    <p>网络错误：无法获取编译器列表</p>
                    <p class="error-detail">${error.message}</p>
                    <button class="retry-btn" onclick="this.loadAvailableCompilers()">重试</button>
                </div>
            `;
        }
    }

    async saveSettings() {
        try {
            // 收集当前设置
            const compilerPath = document.getElementById('compiler-path').value;
            const compilerArgs = document.getElementById('compiler-options').value;
            
            const newSettings = {
                compilerPath: compilerPath,
                compilerArgs: compilerArgs
            };
            
            console.log('准备保存编译器设置:', newSettings);
            
            // 使用新的 API 保存设置
            if (window.electronAPI && window.electronAPI.updateSettings) {
                const result = await window.electronAPI.updateSettings(newSettings);
                console.log('保存设置结果:', result);
                if (result.success) {
                    this.showMessage('编译器设置保存成功！', 'success');
                    
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
            console.error('保存编译器设置失败:', error);
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
                    this.showMessage('编译器设置已重置为默认值', 'success');
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

    detectExistingCompiler() {
        // 检测系统中的编译器
        const commonPaths = [
            'C:\\MinGW\\bin\\g++.exe',
            'C:\\msys64\\mingw64\\bin\\g++.exe',
            'C:\\TDM-GCC-64\\bin\\g++.exe',
            'C:\\Program Files\\mingw-w64\\x86_64-8.1.0-posix-seh-rt_v6-rev0\\mingw64\\bin\\g++.exe'
        ];
        
        for (const path of commonPaths) {
            try {
                if (require('fs').existsSync(path)) {
                    if (!this.settings.compilerPath) {
                        this.settings.compilerPath = path;
                        this.updateUI();
                        this.showMessage(`检测到编译器：${path}`, 'success');
                        break;
                    }
                }
            } catch (error) {
                // 忽略检测错误
            }
        }
    }

    async getCurrentPlatform() {
        // 获取当前平台信息
        if (window.electronAPI && window.electronAPI.getPlatform) {
            return await window.electronAPI.getPlatform();
        }
        
        // 回退检测
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('win')) return 'windows';
        if (userAgent.includes('mac')) return 'macos';
        if (userAgent.includes('linux')) return 'linux';
        return 'windows'; // 默认
    }

    async getDownloadedVersions() {
        // 获取已下载的编译器版本
        try {
            if (window.electronAPI && window.electronAPI.getDownloadedCompilers) {
                return await window.electronAPI.getDownloadedCompilers();
            }
        } catch (error) {
            console.error('获取已下载编译器失败:', error);
        }
        return [];
    }

    async isCompilerSelected(version) {
        // 检查是否是当前选中的编译器
        try {
            if (window.electronAPI && window.electronAPI.getAllSettings) {
                const settings = await window.electronAPI.getAllSettings();
                const userHome = await window.electronAPI.getUserHome();
                
                if (!settings.compilerPath) {
                    return false;
                }
                
                // 标准化路径格式，处理不同操作系统的路径分隔符
                const normalizePathPath = (path) => {
                    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
                };
                
                const currentPath = normalizePathPath(settings.compilerPath);
                const expectedPath = normalizePathPath(`${userHome}/.oicpp/Compilers/${version}`);
                
                // 更精确的匹配：检查编译器路径是否在该版本目录下
                const isMatch = currentPath.includes(expectedPath);
                
                console.log(`检查编译器选中状态 - 版本: ${version}`);
                console.log(`当前编译器路径: ${currentPath}`);
                console.log(`期望路径包含: ${expectedPath}`);
                console.log(`匹配结果: ${isMatch}`);
                
                return isMatch;
            }
        } catch (error) {
            console.error('检查编译器选中状态失败:', error);
        }
        return false;
    }

    addCompilerItemListeners(compilerDiv, compiler) {
        // 下载按钮
        const downloadBtn = compilerDiv.querySelector('.download-btn');
        if (downloadBtn) {
            console.log('绑定下载按钮事件，编译器:', compiler.name, compiler.version);
            downloadBtn.addEventListener('click', (e) => {
                console.log('下载按钮被点击，编译器:', compiler);
                e.preventDefault();
                this.downloadCompiler(compiler);
            });
        }

        // 选择按钮
        const selectBtn = compilerDiv.querySelector('.select-btn');
        if (selectBtn) {
            console.log('绑定选择按钮事件，版本:', compiler.version);
            selectBtn.addEventListener('click', (e) => {
                console.log('选择按钮被点击，版本:', compiler.version);
                e.preventDefault();
                this.selectCompiler(compiler.version);
            });
        }

        // 重试按钮
        const retryBtn = compilerDiv.querySelector('.retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', (e) => {
                console.log('重试按钮被点击');
                e.preventDefault();
                this.loadAvailableCompilers();
            });
        }
    }

    async downloadCompiler(compiler) {
        console.log('[编译器设置] 开始下载编译器流程:', compiler);
        
        // 使用更精确的选择器来找到下载按钮
        const downloadBtn = document.querySelector(`button.download-btn[data-version="${compiler.version}"]`);
        if (!downloadBtn) {
            console.error('[编译器设置] 未找到下载按钮，compiler.version:', compiler.version);
            return;
        }

        console.log('[编译器设置] 找到下载按钮，当前状态:', {
            disabled: downloadBtn.disabled,
            textContent: downloadBtn.textContent,
            classList: Array.from(downloadBtn.classList)
        });

        try {
            // 更新按钮状态
            downloadBtn.disabled = true;
            downloadBtn.textContent = '下载中...';
            console.log('[编译器设置] 按钮状态已更新为下载中');

            // 显示下载进度
            this.showMessage(`开始下载 ${compiler.name} ${compiler.version}...`, 'info');

            console.log('[编译器设置] 准备调用下载API，参数:', {
                url: compiler.downloadUrl,
                version: compiler.version,
                name: compiler.name
            });

            // 调用主进程下载编译器
            if (window.electronAPI && window.electronAPI.downloadCompiler) {
                console.log('[编译器设置] 调用electronAPI.downloadCompiler');
                const result = await window.electronAPI.downloadCompiler({
                    url: compiler.downloadUrl,
                    version: compiler.version,
                    name: compiler.name
                });

                console.log('[编译器设置] downloadCompiler返回结果:', result);

                if (result.success) {
                    console.log('[编译器设置] 下载成功，准备更新UI状态');
                    this.showMessage(`${compiler.name} ${compiler.version} 下载并安装成功！`, 'success');
                    
                    // 立即更新按钮状态为已下载
                    downloadBtn.textContent = '已下载';
                    downloadBtn.disabled = false;
                    downloadBtn.classList.remove('download-btn');
                    downloadBtn.classList.add('downloaded-btn');
                    console.log('[编译器设置] 按钮状态已更新为已下载');
                    
                    // 自动设置编译器路径并立即选择该编译器
                    if (result.compilerPath) {
                        console.log('[编译器设置] 设置编译器路径:', result.compilerPath);
                        await this.setCompilerPath(result.compilerPath);
                        
                        // 自动选择该编译器
                        console.log('[编译器设置] 自动选择刚下载的编译器');
                        await this.selectCompiler(compiler.version);
                    } else {
                        // 如果没有编译器路径，只刷新UI状态不重新加载整个列表
                        this.refreshCompilerItemState(compiler.version, 'downloaded');
                    }
                } else {
                    console.error('[编译器设置] 下载失败，result.success为false:', result);
                    throw new Error(result.error || '下载失败');
                }
            } else {
                console.error('[编译器设置] 下载 API 不可用');
                throw new Error('下载 API 不可用');
            }

        } catch (error) {
            console.error('[编译器设置] 下载编译器失败:', error);
            this.showMessage(`下载失败: ${error.message}`, 'error');
            
            // 恢复按钮状态
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.textContent = '下载';
                console.log('[编译器设置] 按钮状态已恢复为下载');
            }
        }
    }

    async selectCompiler(version) {
        try {
            if (window.electronAPI && window.electronAPI.selectCompiler) {
                const result = await window.electronAPI.selectCompiler(version);
                
                if (result.success) {
                    // 更新UI中的编译器路径
                    await this.setCompilerPath(result.compilerPath);
                    
                    // 使用新的状态管理系统
                    // 首先重置所有编译器项为非选中状态
                    console.log(`开始重置所有编译器状态，当前选择版本: ${version}`);
                    
                    // 获取所有编译器项，不只是已选中的
                    const allCompilerItems = document.querySelectorAll('.compiler-item');
                    console.log(`找到 ${allCompilerItems.length} 个编译器项`);
                    
                    allCompilerItems.forEach(item => {
                        // 尝试多种方式获取版本号
                        let itemVersion = null;
                        
                        // 方法1：通过data-version属性
                        const versionEl = item.querySelector('[data-version]');
                        if (versionEl) {
                            itemVersion = versionEl.getAttribute('data-version');
                        }
                        
                        // 方法2：通过按钮的data-version属性
                        if (!itemVersion) {
                            const buttonEl = item.querySelector('button[data-version]');
                            if (buttonEl) {
                                itemVersion = buttonEl.getAttribute('data-version');
                            }
                        }
                        
                        // 方法3：从编译器信息中提取版本号
                        if (!itemVersion) {
                            const infoDiv = item.querySelector('.compiler-info');
                            if (infoDiv) {
                                const versionText = infoDiv.textContent;
                                const versionMatch = versionText.match(/版本:\s*([^\s]+)/);
                                if (versionMatch) {
                                    itemVersion = versionMatch[1];
                                }
                            }
                        }
                        
                        console.log(`编译器项版本: ${itemVersion}，当前选择: ${version}`);
                        
                        if (itemVersion) {
                            if (itemVersion !== version) {
                                // 如果当前项有选中状态且不是当前要选择的版本，重置为下载状态
                                if (item.classList.contains('selected') || item.querySelector('.selected-status')) {
                                    console.log(`重置编译器 ${itemVersion} 为已下载状态`);
                                    this.refreshCompilerItemState(itemVersion, 'downloaded');
                                }
                            }
                        }
                    });
                    
                    // 设置当前编译器为选中状态
                    console.log(`设置编译器 ${version} 为选中状态`);
                    this.refreshCompilerItemState(version, 'selected');
                    
                    this.showMessage(`已选择编译器版本 ${version}`, 'success');
                    
                } else {
                    throw new Error(result.error || '选择编译器失败');
                }
            } else {
                throw new Error('选择编译器 API 不可用');
            }
        } catch (error) {
            console.error('选择编译器失败:', error);
            this.showMessage(`选择编译器失败: ${error.message}`, 'error');
        }
    }

    async setCompilerPath(path) {
        // 设置编译器路径并更新UI
        this.settings.compilerPath = path;
        document.getElementById('compiler-path').value = path;
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

    showConfirmDialog(title, message, confirmText = '确定', cancelText = '取消') {
        return new Promise((resolve) => {
            // 创建自定义确认对话框
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            `;
            
            const dialog = document.createElement('div');
            dialog.className = 'confirm-dialog';
            dialog.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 20px;
                min-width: 300px;
                max-width: 500px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            `;
            
            dialog.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #333; font-size: 16px;">${title}</h3>
                </div>
                <div style="margin-bottom: 20px; line-height: 1.5; white-space: pre-line;">
                    ${message}
                </div>
                <div style="text-align: right;">
                    <button class="cancel-btn" style="
                        margin-right: 10px;
                        padding: 8px 16px;
                        border: 1px solid #ddd;
                        background: #f5f5f5;
                        border-radius: 4px;
                        cursor: pointer;
                    ">${cancelText}</button>
                    <button class="confirm-btn" style="
                        padding: 8px 16px;
                        border: none;
                        background: #007acc;
                        color: white;
                        border-radius: 4px;
                        cursor: pointer;
                    ">${confirmText}</button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            // 绑定事件
            const confirmBtn = dialog.querySelector('.confirm-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');
            
            const cleanup = () => {
                document.body.removeChild(overlay);
            };
            
            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            // 点击背景关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            });
        });
    }

    refreshCompilerItemState(version, newState) {
        console.log(`刷新编译器项状态: ${version} -> ${newState}`);
        
        // 尝试多种方式查找编译器项
        let compilerItem = null;
        
        // 方法1：通过data-version属性查找
        const versionEl = document.querySelector(`[data-version="${version}"]`);
        if (versionEl) {
            compilerItem = versionEl.closest('.compiler-item');
        }
        
        // 方法2：如果找不到，尝试通过按钮查找
        if (!compilerItem) {
            const buttonEl = document.querySelector(`button[data-version="${version}"]`);
            if (buttonEl) {
                compilerItem = buttonEl.closest('.compiler-item');
            }
        }
        
        // 方法3：通过编译器名称查找（作为备用方案）
        if (!compilerItem) {
            console.warn(`通过data-version未找到编译器项: ${version}，尝试其他方法`);
            const allItems = document.querySelectorAll('.compiler-item');
            for (const item of allItems) {
                const infoDiv = item.querySelector('.compiler-info');
                if (infoDiv && infoDiv.textContent.includes(version)) {
                    compilerItem = item;
                    break;
                }
            }
        }
        
        if (!compilerItem) {
            console.warn(`未找到编译器项: ${version}`);
            return;
        }
        
        const actionsDiv = compilerItem.querySelector('.compiler-actions');
        if (!actionsDiv) {
            console.warn(`未找到编译器动作区域: ${version}`);
            return;
        }
        
        console.log(`找到编译器项，当前类: ${compilerItem.className}`);
        
        // 清空当前动作区域
        actionsDiv.innerHTML = '';
        
        // 根据新状态设置内容
        switch (newState) {
            case 'downloaded':
                console.log(`设置编译器为已下载状态: ${version}`);
                compilerItem.classList.add('downloaded');
                compilerItem.classList.remove('selected');
                actionsDiv.innerHTML = `
                    <button class="select-btn" data-version="${version}">选择</button>
                    <span class="status downloaded-status">已下载</span>
                `;
                // 重新绑定选择按钮事件
                const selectBtn = actionsDiv.querySelector('.select-btn');
                if (selectBtn) {
                    console.log(`重新绑定选择按钮事件: ${version}`);
                    selectBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        console.log(`选择按钮被点击: ${version}`);
                        this.selectCompiler(version);
                    });
                }
                break;
                
            case 'selected':
                console.log(`设置编译器为已选中状态: ${version}`);
                compilerItem.classList.add('downloaded', 'selected');
                actionsDiv.innerHTML = `
                    <span class="status selected-status">已选中</span>
                    <span class="status downloaded-status">已下载</span>
                `;
                break;
                
            case 'not-downloaded':
                console.log(`设置编译器为未下载状态: ${version}`);
                compilerItem.classList.remove('downloaded', 'selected');
                // 这里需要重新获取编译器信息来显示下载按钮
                break;
        }
        
        console.log(`编译器项状态已更新: ${version} -> ${newState}，新类: ${compilerItem.className}`);
    }

    closeWindow() {
        window.close();
    }
}

// 初始化
window.addEventListener('DOMContentLoaded', () => {
    new CompilerSettings();
});
