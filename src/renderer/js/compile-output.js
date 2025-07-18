// 编译输出面板管理器
class CompileOutputManager {
    constructor() {
        this.panel = null;
        this.statusText = null;
        this.commandText = null;
        this.messagesContainer = null;
        this.isVisible = false;
        this.currentCommand = '';
        this.startTime = null;
        
        this.init();
    }

    init() {
        this.panel = document.getElementById('compile-output-panel');
        this.statusText = document.getElementById('compile-status-text');
        this.commandText = document.getElementById('compile-command-text');
        this.messagesContainer = document.getElementById('compile-output-messages');
        
        if (!this.panel) {
            console.error('编译输出面板元素未找到');
            return;
        }
        
        this.setupEventListeners();
        console.log('编译输出管理器初始化完成');
    }

    setupEventListeners() {
        // 关闭按钮
        const closeBtn = document.getElementById('close-compile-output');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide();
            });
        }

        // 清除输出按钮
        const clearBtn = document.getElementById('clear-compile-output');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearMessages();
            });
        }

        // ESC键关闭面板
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            }
        });
    }

    // 显示面板
    show() {
        if (!this.panel) return;
        
        this.panel.classList.add('show');
        this.isVisible = true;
        
        // 调整编辑器区域高度
        const editorArea = document.getElementById('editor-area');
        if (editorArea) {
            editorArea.classList.add('with-compile-output');
        }
        
        // 触发编辑器重新布局
        this.triggerEditorResize();
    }

    // 隐藏面板
    hide() {
        if (!this.panel) return;
        
        this.panel.classList.remove('show');
        this.isVisible = false;
        
        // 恢复编辑器区域高度
        const editorArea = document.getElementById('editor-area');
        if (editorArea) {
            editorArea.classList.remove('with-compile-output');
        }
        
        // 触发编辑器重新布局
        this.triggerEditorResize();
    }

    // 切换面板显示状态
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    // 触发编辑器重新调整大小
    triggerEditorResize() {
        setTimeout(() => {
            if (window.app && window.app.editorManager) {
                const currentEditor = window.app.editorManager.getCurrentEditor();
                if (currentEditor && typeof currentEditor.layout === 'function') {
                    currentEditor.layout();
                }
            }
        }, 350); // 等待动画完成
    }

    // 设置状态
    setStatus(status, command = '') {
        if (this.statusText) {
            const indicator = this.getStatusIndicator(status);
            this.statusText.innerHTML = `${indicator}${status}`;
        }
        
        if (this.commandText && command) {
            this.commandText.textContent = command;
            this.currentCommand = command;
        }
    }

    // 获取状态指示器
    getStatusIndicator(status) {
        let className = 'ready';
        
        if (status.includes('正在编译') || status.includes('编译中')) {
            className = 'compiling';
        } else if (status.includes('成功')) {
            className = 'success';
        } else if (status.includes('失败') || status.includes('错误')) {
            className = 'error';
        }
        
        return `<span class="compile-status-indicator ${className}"></span>`;
    }

    // 添加消息
    addMessage(message, type = 'info') {
        if (!this.messagesContainer) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const messageDiv = document.createElement('div');
        messageDiv.className = `compile-message ${type}`;
        
        messageDiv.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="message-content">${this.escapeHtml(message)}</span>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        
        // 自动滚动到底部
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    // 清除所有消息
    clearMessages() {
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
        }
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 开始编译
    startCompile(command) {
        this.show();
        this.clearMessages();
        this.setStatus('正在编译...', command);
        this.startTime = Date.now();
        
        this.addMessage(`开始编译: ${command}`, 'info');
    }

    // 编译成功
    onCompileSuccess(output = '', warnings = []) {
        const endTime = Date.now();
        const duration = this.startTime ? ((endTime - this.startTime) / 1000).toFixed(2) : '0.00';
        
        this.setStatus(`编译成功 (${duration}s)`);
        
        if (output && output.trim()) {
            this.addMessage('编译输出:', 'info');
            this.addMessage(output, 'info');
        }
        
        // 显示警告信息
        if (warnings && warnings.length > 0) {
            this.addMessage(`发现 ${warnings.length} 个警告:`, 'warning');
            warnings.forEach(warning => {
                this.addMessage(warning, 'warning');
            });
        }
        
        this.addMessage(`编译成功完成，用时 ${duration} 秒`, 'success');
    }

    // 编译失败
    onCompileError(error, output = '') {
        const endTime = Date.now();
        const duration = this.startTime ? ((endTime - this.startTime) / 1000).toFixed(2) : '0.00';
        
        this.setStatus(`编译失败 (${duration}s)`);
        
        this.addMessage('编译失败:', 'error');
        
        if (output && output.trim()) {
            this.addMessage('编译器输出:', 'info');
            this.addMessage(output, 'info');
        }
        
        if (error && error.trim()) {
            this.addMessage('错误信息:', 'error');
            this.addMessage(error, 'error');
        }
        
        this.addMessage(`编译失败，用时 ${duration} 秒`, 'error');
    }

    // 运行程序
    onProgramStart() {
        this.addMessage('正在运行程序...', 'info');
    }

    // 程序运行结果
    onProgramOutput(output, exitCode = 0) {
        if (exitCode === 0) {
            this.addMessage('程序运行完成', 'success');
            if (output && output.trim()) {
                this.addMessage('程序输出:', 'info');
                this.addMessage(output, 'info');
            }
        } else {
            this.addMessage(`程序异常退出 (退出码: ${exitCode})`, 'error');
            if (output && output.trim()) {
                this.addMessage('程序输出:', 'info');
                this.addMessage(output, 'error');
            }
        }
    }

    // 程序运行错误
    onProgramError(error) {
        this.addMessage('程序运行错误:', 'error');
        this.addMessage(error, 'error');
    }

    // 获取当前状态
    getStatus() {
        return {
            isVisible: this.isVisible,
            currentCommand: this.currentCommand,
            hasMessages: this.messagesContainer ? this.messagesContainer.children.length > 0 : false
        };
    }
}

// 创建全局实例
window.compileOutputManager = new CompileOutputManager();
