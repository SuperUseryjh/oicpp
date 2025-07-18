/**
 * C++ 编译和运行管理器
 */
class CompilerManager {
    constructor() {
        this.settings = {
            compilerPath: '',
            compilerArgs: '-std=c++14 -O2 -static',
            workingDirectory: ''
        };
        
        this.isCompiling = false;
        this.isRunning = false;
        this.compileOutput = null;
        this.shouldRunAfterCompile = false; // 是否在编译成功后自动运行
        
        this.init();
    }

    init() {
        console.log('编译管理器初始化...');
        this.createCompileOutputWindow();
        this.setupEventListeners();
        this.loadSettings(); // 加载设置
    }

    // 创建编译输出窗口
    createCompileOutputWindow() {
        // 检查是否已存在编译输出窗口
        let existingWindow = document.querySelector('.compile-output-window');
        if (existingWindow) {
            existingWindow.remove();
        }

        // 创建编译输出窗口
        this.compileOutput = document.createElement('div');
        this.compileOutput.className = 'compile-output-window hidden';
        this.compileOutput.innerHTML = `
            <div class="compile-output-header">
                <div class="compile-output-title">
                    <span class="compile-status">编译输出</span>
                </div>
                <div class="compile-output-controls">
                    <button class="compile-output-clear" title="清空输出">
                        <i class="icon-clear">🗑️</i>
                    </button>
                    <button class="compile-output-close" title="关闭">
                        <i class="icon-close">✕</i>
                    </button>
                </div>
            </div>
            <div class="compile-output-content">
                <div class="compile-output-text"></div>
            </div>
        `;

        document.body.appendChild(this.compileOutput);

        // 绑定事件
        this.compileOutput.querySelector('.compile-output-clear').addEventListener('click', () => {
            this.clearOutput();
        });

        this.compileOutput.querySelector('.compile-output-close').addEventListener('click', () => {
            this.hideOutput();
        });
    }

    // 设置事件监听器
    setupEventListeners() {
        // 监听编译结果 - 使用正确的 Electron IPC 方式
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                
                ipcRenderer.on('compile-result', (event, result) => {
                    this.handleCompileResult(result);
                });

                ipcRenderer.on('compile-error', (event, error) => {
                    this.handleCompileError(error);
                });

                ipcRenderer.on('run-result', (event, result) => {
                    this.handleRunResult(result);
                });

                ipcRenderer.on('run-error', (event, error) => {
                    this.handleRunError(error);
                });
                
                // 监听设置变化
                ipcRenderer.on('settings-changed', (event, settingsType, newSettings) => {
                    console.log('编译管理器收到设置变化通知:', newSettings);
                    if (newSettings && (newSettings.compilerPath !== undefined || newSettings.compilerArgs !== undefined)) {
                        this.updateSettings({
                            compilerPath: newSettings.compilerPath !== undefined ? newSettings.compilerPath : this.settings.compilerPath,
                            compilerArgs: newSettings.compilerArgs !== undefined ? newSettings.compilerArgs : this.settings.compilerArgs
                        });
                        console.log('编译管理器设置已更新:', this.settings);
                    }
                });
                
                console.log('编译管理器 IPC 监听器已设置');
            } catch (error) {
                console.error('设置编译管理器 IPC 监听器失败:', error);
            }
        } else {
            console.warn('Electron 环境不可用，跳过 IPC 监听器设置');
        }
    }

    // 从设置中获取编译器配置
    async loadSettings() {
        try {
            if (window.electronAPI && window.electronAPI.getAllSettings) {
                const allSettings = await window.electronAPI.getAllSettings();
                if (allSettings) {
                    this.updateSettings({
                        compilerPath: allSettings.compilerPath || '',
                        compilerArgs: allSettings.compilerArgs || '-std=c++14 -O2 -static'
                    });
                    console.log('编译器设置已加载:', this.settings);
                }
            } else {
                console.log('window.electronAPI 不可用，使用默认编译器设置');
                // 尝试从本地存储加载
                const savedSettings = localStorage.getItem('oicpp-settings');
                if (savedSettings) {
                    const parsed = JSON.parse(savedSettings);
                    this.updateSettings({
                        compilerPath: parsed.compilerPath || '',
                        compilerArgs: parsed.compilerArgs || '-std=c++14 -O2 -static'
                    });
                    console.log('从本地存储加载编译器设置:', this.settings);
                }
            }
        } catch (error) {
            console.error('加载编译器设置失败:', error);
        }
    }

    // 更新设置
    updateSettings(newSettings) {
        console.log('更新编译器设置:', newSettings);
        this.settings = { ...this.settings, ...newSettings };
    }

    // 编译当前文件
    async compileCurrentFile(options = {}) {
        try {
            console.log('compileCurrentFile 被调用，当前编译器设置:', this.settings);
            console.log('编译选项:', options);
            
            // 检查编译器路径
            if (!this.settings.compilerPath) {
                console.log('编译器路径为空，显示设置提示');
                this.showMessage('请先设置编译器路径', 'error');
                this.openCompilerSettings();
                return;
            }

            console.log('使用编译器路径:', this.settings.compilerPath);

            // 获取当前编辑器
            const currentEditor = window.editorManager?.getCurrentEditor();
            if (!currentEditor) {
                this.showMessage('没有打开的文件', 'error');
                return;
            }

            // 获取文件路径和内容
            const filePath = currentEditor.getFilePath();
            const content = currentEditor.getValue();

            if (!filePath || filePath.startsWith('untitled')) {
                this.showMessage('请先保存文件', 'error');
                return;
            }

            // 开始编译
            this.isCompiling = true;
            this.showOutput();
            this.setStatus('正在编译...');
            this.clearOutput();
            
            // 构建编译命令
            const inputFile = filePath;
            const outputFile = this.getExecutablePath(filePath);
            
            // 处理调试编译标志
            let compilerArgs = this.settings.compilerArgs;
            if (options.forDebug) {
                // 确保包含调试信息，并移除可能影响调试的优化
                if (!compilerArgs.includes('-g')) {
                    compilerArgs = compilerArgs + ' -g';
                }
                // 移除-O2优化，使用-O0便于调试
                compilerArgs = compilerArgs.replace(/-O[0-9s]*/g, '-O0');
                // 确保没有-s（strip）标志
                compilerArgs = compilerArgs.replace(/-s\b/g, '');
                this.appendOutput('编译模式: 调试模式 (包含调试信息，禁用优化)\n', 'info');
            } else {
                // 非调试模式也包含调试信息，以便将来调试
                if (!compilerArgs.includes('-g')) {
                    compilerArgs = compilerArgs + ' -g';
                    this.appendOutput('编译模式: 普通模式 (包含调试信息)\n', 'info');
                }
            }
            
            const compileCommand = this.buildCompileCommand(inputFile, outputFile, compilerArgs);
            
            console.log(`源文件: ${inputFile}`);
            console.log(`目标文件: ${outputFile}`);
            console.log(`编译命令: ${compileCommand}`);
            
            this.appendOutput(`编译命令: ${compileCommand}\n`, 'command');
            this.appendOutput(`目标文件: ${outputFile}\n`, 'info');
            this.appendOutput('正在编译...\n', 'info');

            // 调用主进程进行编译
            if (typeof require !== 'undefined') {
                try {
                    const { ipcRenderer } = require('electron');
                    ipcRenderer.invoke('compile-file', {
                        inputFile,
                        outputFile,
                        compilerPath: this.settings.compilerPath,
                        compilerArgs: compilerArgs, // 使用修改后的编译器参数
                        workingDirectory: this.getWorkingDirectory(filePath)
                    }).then(result => {
                        this.handleCompileResult(result);
                    }).catch(error => {
                        this.handleCompileError(error.message || error);
                    });
                } catch (error) {
                    this.handleCompileError('IPC 调用失败: ' + error.message);
                }
            } else {
                this.handleCompileError('Electron 环境不可用');
            }

        } catch (error) {
            console.error('编译失败:', error);
            this.handleCompileError(error.message);
        }
    }

    // 运行当前文件
    async runCurrentFile() {
        try {
            const currentEditor = window.editorManager?.getCurrentEditor();
            if (!currentEditor) {
                this.showMessage('没有打开的文件', 'error');
                return;
            }

            const filePath = currentEditor.getFilePath();
            if (!filePath || filePath.startsWith('untitled')) {
                this.showMessage('请先保存文件', 'error');
                return;
            }

            const executablePath = this.getExecutablePath(filePath);
            console.log(`检查可执行文件路径: ${executablePath}`);
            
            // 检查可执行文件是否存在
            const exists = await this.checkFileExists(executablePath);
            console.log(`可执行文件存在性检查结果: ${exists}`);
            
            if (!exists) {
                this.showMessage(`请先编译程序 (未找到: ${executablePath})`, 'error');
                return;
            }

            // 运行程序
            this.isRunning = true;
            this.showOutput();
            this.appendOutput(`正在启动程序: ${executablePath}\n`, 'info');
            this.runExecutable(executablePath);

        } catch (error) {
            console.error('运行失败:', error);
            this.showMessage(`运行失败: ${error.message}`, 'error');
        }
    }

    // 编译并运行
    async compileAndRun() {
        try {
            this.shouldRunAfterCompile = true; // 设置标志，编译成功后自动运行
            await this.compileCurrentFile();
        } catch (error) {
            console.error('编译并运行失败:', error);
            this.shouldRunAfterCompile = false;
        }
    }

    // 构建编译命令
    buildCompileCommand(inputFile, outputFile, customArgs = null) {
        const args = [
            customArgs || this.settings.compilerArgs,
            `-o "${outputFile}"`,
            `"${inputFile}"`
        ].filter(arg => arg.trim()).join(' ');
        
        return `"${this.settings.compilerPath}" ${args}`;
    }

    // 获取可执行文件路径
    getExecutablePath(sourceFile) {
        // 使用简单的字符串操作替代path模块
        const lastSlash = sourceFile.lastIndexOf('/') > sourceFile.lastIndexOf('\\') ? 
            sourceFile.lastIndexOf('/') : sourceFile.lastIndexOf('\\');
        const dir = sourceFile.substring(0, lastSlash);
        const fileName = sourceFile.substring(lastSlash + 1);
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        return dir + (dir.endsWith('/') || dir.endsWith('\\') ? '' : '\\') + nameWithoutExt + '.exe';
    }

    // 获取工作目录
    getWorkingDirectory(filePath) {
        const lastSlash = filePath.lastIndexOf('/') > filePath.lastIndexOf('\\') ? 
            filePath.lastIndexOf('/') : filePath.lastIndexOf('\\');
        return filePath.substring(0, lastSlash);
    }

    // 检查文件是否存在
    async checkFileExists(filePath) {
        if (typeof require !== 'undefined') {
            try {
                const fs = require('fs');
                return fs.existsSync(filePath);
            } catch (error) {
                console.error('检查文件存在性失败:', error);
                // 备用方案：使用 IPC
                try {
                    const { ipcRenderer } = require('electron');
                    return await ipcRenderer.invoke('check-file-exists', filePath);
                } catch (ipcError) {
                    console.error('IPC 检查文件失败:', ipcError);
                    return false;
                }
            }
        }
        return false;
    }

    // 运行可执行文件
    runExecutable(executablePath) {
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                ipcRenderer.invoke('run-executable', {
                    executablePath,
                    workingDirectory: this.getWorkingDirectory(executablePath)
                }).then(result => {
                    this.handleRunResult(result);
                }).catch(error => {
                    this.handleRunError(error.message || error);
                });
            } catch (error) {
                this.handleRunError('IPC 调用失败: ' + error.message);
            }
        } else {
            this.handleRunError('Electron API 不可用');
        }
    }

    // 处理编译结果
    handleCompileResult(result) {
        this.isCompiling = false;
        
        if (result.success) {
            this.setStatus('编译成功');
            this.appendOutput('编译成功!\n', 'success');
            
            if (result.warnings && result.warnings.length > 0) {
                this.appendOutput('警告信息:\n', 'warning');
                result.warnings.forEach(warning => {
                    this.appendOutput(`${warning}\n`, 'warning');
                });
            }

            // 发出编译成功事件
            window.dispatchEvent(new CustomEvent('compile-success', { 
                detail: { result } 
            }));

            // 如果是编译并运行，则继续运行
            if (this.shouldRunAfterCompile) {
                this.shouldRunAfterCompile = false; // 重置标志
                setTimeout(() => {
                    this.runCurrentFile();
                }, 500);
            }
        } else {
            this.setStatus('编译失败');
            this.appendOutput('编译失败!\n', 'error');
            this.shouldRunAfterCompile = false; // 编译失败时重置标志
            
            if (result.errors && result.errors.length > 0) {
                this.appendOutput('错误信息:\n', 'error');
                result.errors.forEach(error => {
                    this.appendOutput(`${error}\n`, 'error');
                });
            }

            // 发出编译失败事件
            window.dispatchEvent(new CustomEvent('compile-error', { 
                detail: { result } 
            }));
        }
    }

    // 处理编译错误
    handleCompileError(error) {
        this.isCompiling = false;
        this.setStatus('编译错误');
        this.appendOutput(`编译错误: ${error}\n`, 'error');
        
        // 发出编译错误事件
        window.dispatchEvent(new CustomEvent('compile-error', { 
            detail: { error } 
        }));
    }

    // 处理运行结果
    handleRunResult(result) {
        this.isRunning = false;
        if (result.success) {
            this.appendOutput('程序已在新窗口中启动\n', 'success');
            this.showMessage('程序已在新窗口中启动', 'success');
        }
        console.log('程序运行完成:', result);
    }

    // 处理运行错误
    handleRunError(error) {
        this.isRunning = false;
        this.appendOutput(`运行错误: ${error}\n`, 'error');
        this.showMessage(`运行错误: ${error}`, 'error');
    }

    // 显示编译输出窗口
    showOutput() {
        this.compileOutput.classList.remove('hidden');
        // 添加动画效果
        setTimeout(() => {
            this.compileOutput.classList.add('show');
        }, 10);
    }

    // 隐藏编译输出窗口
    hideOutput() {
        this.compileOutput.classList.remove('show');
        setTimeout(() => {
            this.compileOutput.classList.add('hidden');
        }, 300);
    }

    // 清空输出
    clearOutput() {
        const outputText = this.compileOutput.querySelector('.compile-output-text');
        if (outputText) {
            outputText.innerHTML = '';
        }
    }

    // 添加输出内容
    appendOutput(text, type = 'info') {
        const outputText = this.compileOutput.querySelector('.compile-output-text');
        if (outputText) {
            const line = document.createElement('div');
            line.className = `output-line output-${type}`;
            line.textContent = text;
            outputText.appendChild(line);
            outputText.scrollTop = outputText.scrollHeight;
        }
    }

    // 设置状态
    setStatus(status) {
        const statusElement = this.compileOutput.querySelector('.compile-status');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 创建消息提示
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-popup message-${type}`;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        // 添加显示动画
        setTimeout(() => {
            messageDiv.classList.add('show');
        }, 10);
        
        // 自动隐藏
        setTimeout(() => {
            messageDiv.classList.remove('show');
            setTimeout(() => {
                if (messageDiv.parentElement) {
                    messageDiv.parentElement.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }

    // 打开编译器设置
    openCompilerSettings() {
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                ipcRenderer.invoke('open-compiler-settings').catch(error => {
                    console.error('打开编译器设置失败:', error);
                });
            } catch (error) {
                console.error('IPC 调用失败:', error);
            }
        } else {
            console.warn('Electron API 不可用，无法打开编译器设置');
        }
    }
}

// 导出编译管理器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CompilerManager;
} else {
    window.CompilerManager = CompilerManager;
}

