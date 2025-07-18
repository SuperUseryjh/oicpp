const { ipcRenderer } = require('electron');

class DebugUI {
    constructor() {
        this.isDebugging = false;
        this.debugProcess = null;
        this.currentFile = null;
        this.breakpoints = new Map();
        this.variables = {
            local: new Map(),
            global: new Map(),
            watches: new Map()
        };
        this.callStack = [];
        this.expandedVariables = new Set(); // 跟踪展开的变量
        
        this.init();
    }
    
    init() {
        try {
            this.setupEventListeners();
            this.setupUI();
            this.showWaitingState();
            console.log('DebugUI初始化成功');
        } catch (error) {
            console.error('DebugUI初始化失败:', error);
            // 降级到基本功能
            this.setupBasicEventListeners();
        }
    }

    // 基本事件监听器设置，用于降级模式
    setupBasicEventListeners() {
        console.log('使用基本调试事件监听器');
        
        // 只设置必要的调试控制按钮
        const debugButtons = [
            { id: 'debug-start', handler: () => this.startDebugging() },
            { id: 'debug-stop', handler: () => this.stopDebugging() },
            { id: 'debug-continue', handler: () => this.continueExecution() },
            { id: 'debug-step-over', handler: () => this.stepOver() },
            { id: 'debug-step-into', handler: () => this.stepInto() },
            { id: 'debug-step-out', handler: () => this.stepOut() }
        ];
        
        debugButtons.forEach(({ id, handler }) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', handler);
            }
        });
        
        // 设置IPC监听器
        this.setupIPC();
    }
    
    setupEventListeners() {
        // 调试控制按钮 - 修复ID匹配
        const startBtn = document.getElementById('debug-start');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startDebugging();
            });
        }
        
        const stopBtn = document.getElementById('debug-stop');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.stopDebugging();
            });
        }
        
        const stepOverBtn = document.getElementById('debug-step-over');
        if (stepOverBtn) {
            stepOverBtn.addEventListener('click', () => {
                this.stepOver();
            });
        }
        
        const stepIntoBtn = document.getElementById('debug-step-into');
        if (stepIntoBtn) {
            stepIntoBtn.addEventListener('click', () => {
                this.stepInto();
            });
        }
        
        const stepOutBtn = document.getElementById('debug-step-out');
        if (stepOutBtn) {
            stepOutBtn.addEventListener('click', () => {
                this.stepOut();
            });
        }
        
        const continueBtn = document.getElementById('debug-continue');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.continueExecution();
            });
        }

        // 变量相关按钮
        const refreshVarsBtn = document.getElementById('debug-refresh-vars');
        if (refreshVarsBtn) {
            refreshVarsBtn.addEventListener('click', () => {
                this.refreshVariables();
            });
        }

        // 添加监视变量按钮（如果存在）
        const addWatchBtn = document.getElementById('add-watch-variable');
        if (addWatchBtn) {
            addWatchBtn.addEventListener('click', () => {
                this.addWatchVariable();
            });
        }
        
        // 输出控制
        const clearOutputBtn = document.getElementById('clear-output');
        if (clearOutputBtn) {
            clearOutputBtn.addEventListener('click', () => {
                this.clearOutput();
            });
        }
        
        // 输入控制
        const sendInputBtn = document.getElementById('send-input');
        if (sendInputBtn) {
            sendInputBtn.addEventListener('click', () => {
                this.sendInput();
            });
        }
        
        const clearInputBtn = document.getElementById('clear-input');
        if (clearInputBtn) {
            clearInputBtn.addEventListener('click', () => {
                this.clearInput();
            });
        }
        
        // 变量分类展开/收起
        document.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', () => {
                this.toggleCategory(header);
            });
        });
        
        // 将按钮添加到监视变量区域
        const watchSection = this.createWatchSection();
        if (!watchSection) {
            console.log('监视变量区域创建失败，跳过相关功能');
        }
        
        // 设置IPC监听器
        this.setupIPC();
        
        // 监听主进程的调试消息
        ipcRenderer.on('debug-started', (event, data) => {
            this.onDebugStarted(data);
        });
        
        ipcRenderer.on('debug-stopped', (event, data) => {
            this.onDebugStopped(data);
        });
        
        ipcRenderer.on('debug-output', (event, data) => {
            this.onDebugOutput(data);
        });
        
        ipcRenderer.on('debug-error', (event, error) => {
            this.onDebugError(error);
        });

        // 变量更新
        ipcRenderer.on('debug-variables-updated', (event, variables) => {
            this.updateVariablesDisplay(variables);
        });

        // 调用栈更新
        ipcRenderer.on('debug-callstack-updated', (event, callStack) => {
            this.updateCallStackDisplay(callStack);
        });

        // 断点命中
        ipcRenderer.on('debug-breakpoint-hit', (event, breakpoint) => {
            this.onBreakpointHit(breakpoint);
        });

        // 程序结束
        ipcRenderer.on('debug-program-exited', (event, data) => {
            this.onProgramExited(data);
        });
    }
    
    // 设置IPC监听器
    setupIPC() {
        // 移除已有的监听器以避免重复
        ipcRenderer.removeAllListeners('debug-started');
        ipcRenderer.removeAllListeners('debug-stopped');
        ipcRenderer.removeAllListeners('debug-output');
        ipcRenderer.removeAllListeners('debug-error');
        ipcRenderer.removeAllListeners('debug-variables-updated');
        ipcRenderer.removeAllListeners('debug-callstack-updated');
        ipcRenderer.removeAllListeners('debug-breakpoint-hit');
        ipcRenderer.removeAllListeners('debug-program-exited');
        
        // 监听主进程的调试消息
        ipcRenderer.on('debug-started', (event, data) => {
            this.onDebugStarted(data);
        });
        
        ipcRenderer.on('debug-stopped', (event, data) => {
            this.onDebugStopped(data);
        });
        
        ipcRenderer.on('debug-output', (event, data) => {
            this.onDebugOutput(data);
        });
        
        ipcRenderer.on('debug-error', (event, error) => {
            this.onDebugError(error);
        });

        // 变量更新
        ipcRenderer.on('debug-variables-updated', (event, variables) => {
            this.updateVariablesDisplay(variables);
        });

        // 调用栈更新
        ipcRenderer.on('debug-callstack-updated', (event, callStack) => {
            this.updateCallStackDisplay(callStack);
        });

        // 断点命中
        ipcRenderer.on('debug-breakpoint-hit', (event, breakpoint) => {
            this.onBreakpointHit(breakpoint);
        });

        // 程序结束
        ipcRenderer.on('debug-program-exited', (event, data) => {
            this.onProgramExited(data);
        });
    }
    
    setupUI() {
        // 设置初始UI状态
        this.updateDebugControlsState(false);
        
        // 创建监视变量输入对话框
        this.createAddWatchDialog();
    }
    
    createWatchSection() {
        // 检查是否已经有监视变量区域，如果没有则创建
        let watchSection = document.querySelector('.watch-variables-section');
        if (!watchSection) {
            const variablesPanel = document.querySelector('#debug-variables') || document.querySelector('.debug-variables');
            
            // 如果找不到变量面板，则不创建监视区域
            if (!variablesPanel) {
                console.warn('未找到变量面板元素，跳过监视变量区域创建');
                return null;
            }
            
            watchSection = document.createElement('div');
            watchSection.className = 'variable-category watch-variables-section';
            watchSection.innerHTML = `
                <div class="category-header">
                    <span class="expand-arrow">▼</span>
                    <span>监视变量</span>
                </div>
                <div class="category-content">
                    <div class="watch-controls">
                        <button class="add-watch-btn">+ 添加监视变量</button>
                    </div>
                    <div id="watch-variables" class="variable-list">
                        <div class="no-debug-message">请开始调试以查看变量</div>
                    </div>
                </div>
            `;
            
            variablesPanel.appendChild(watchSection);
            
            // 添加事件监听
            const addWatchBtn = watchSection.querySelector('.add-watch-btn');
            if (addWatchBtn) {
                addWatchBtn.addEventListener('click', () => {
                    this.showAddWatchDialog();
                });
            }
            
            const categoryHeader = watchSection.querySelector('.category-header');
            if (categoryHeader) {
                categoryHeader.addEventListener('click', () => {
                    this.toggleCategory(categoryHeader);
                });
            }
        }
        
        return watchSection;
    }
    
    createAddWatchDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'add-watch-dialog';
        dialog.style.display = 'none';
        dialog.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-content">
                    <h3>添加监视变量</h3>
                    <input type="text" id="watch-variable-input" placeholder="输入变量名（如：i, array[0], obj.member）">
                    <div class="dialog-buttons">
                        <button id="add-watch-confirm" class="dialog-btn primary">添加</button>
                        <button id="add-watch-cancel" class="dialog-btn">取消</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 添加事件监听
        dialog.querySelector('#add-watch-confirm').addEventListener('click', () => {
            this.addWatchVariable();
        });
        
        dialog.querySelector('#add-watch-cancel').addEventListener('click', () => {
            this.hideAddWatchDialog();
        });
        
        dialog.querySelector('.dialog-overlay').addEventListener('click', (e) => {
            if (e.target === dialog.querySelector('.dialog-overlay')) {
                this.hideAddWatchDialog();
            }
        });
        
        // 回车键确认
        dialog.querySelector('#watch-variable-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addWatchVariable();
            }
        });
    }
    
    showWaitingState() {
        // 显示等待调试状态
        this.clearVariables();
        this.clearCallStack();
        
        // 在变量区域显示等待消息
        const localVariables = document.getElementById('local-variables');
        const globalVariables = document.getElementById('global-variables');
        const watchVariables = document.getElementById('watch-variables');
        
        if (localVariables) {
            localVariables.innerHTML = '<div class="waiting-debug-message">等待开始调试...</div>';
        }
        if (globalVariables) {
            globalVariables.innerHTML = '<div class="waiting-debug-message">等待开始调试...</div>';
        }
        if (watchVariables) {
            watchVariables.innerHTML = '<div class="waiting-debug-message">等待开始调试...</div>';
        }
        
        // 在调用堆栈区域显示等待消息
        const callStack = document.getElementById('call-stack');
        if (callStack) {
            callStack.innerHTML = '<div class="waiting-debug-message">等待开始调试...</div>';
        }
        
        this.logMessage('调试器就绪，等待开始调试...', 'info');
    }
    
    async startDebugging() {
        try {
            this.logMessage('开始调试会话...', 'info');
            
            // 获取当前文件
            const currentFile = await this.getCurrentFile();
            if (!currentFile) {
                this.logMessage('没有打开的文件可以调试', 'error');
                return;
            }
            
            // 发送开始调试请求到主进程
            ipcRenderer.send('start-debug', currentFile, {
                breakpoints: Array.from(this.breakpoints.keys())
            });
            
        } catch (error) {
            this.logMessage(`调试启动失败: ${error.message}`, 'error');
        }
    }
    
    stopDebugging() {
        if (this.isDebugging) {
            this.logMessage('停止调试会话...', 'info');
            ipcRenderer.send('stop-debug');
        }
    }
    
    stepOver() {
        if (this.isDebugging) {
            ipcRenderer.send('debug-step-over');
            this.logMessage('执行步过...', 'debug');
        }
    }
    
    stepInto() {
        if (this.isDebugging) {
            ipcRenderer.send('debug-step-into');
            this.logMessage('执行步入...', 'debug');
        }
    }
    
    stepOut() {
        if (this.isDebugging) {
            ipcRenderer.send('debug-step-out');
            this.logMessage('执行步出...', 'debug');
        }
    }
    
    continueExecution() {
        if (this.isDebugging) {
            ipcRenderer.send('debug-continue');
            this.logMessage('继续执行...', 'debug');
        }
    }
    
    sendInput() {
        const input = document.getElementById('program-input');
        if (input && input.value.trim()) {
            const inputText = input.value.trim();
            ipcRenderer.send('debug-send-input', inputText);
            this.logMessage(`输入: ${inputText}`, 'input');
            input.value = '';
        }
    }
    
    clearInput() {
        const input = document.getElementById('program-input');
        if (input) {
            input.value = '';
        }
    }
    
    clearOutput() {
        const console = document.getElementById('debug-console');
        if (console) {
            console.innerHTML = '';
        }
    }
    
    toggleCategory(header) {
        const arrow = header.querySelector('.expand-arrow');
        const content = header.nextElementSibling;
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            arrow.textContent = '▼';
        } else {
            content.style.display = 'none';
            arrow.textContent = '▶';
        }
    }
    
    // 调试事件处理
    onDebugStarted(data) {
        this.isDebugging = true;
        this.debugProcess = data.process;
        this.currentFile = data.file;
        
        this.logMessage('调试会话已启动', 'success');
        
        // 更新UI状态
        this.updateDebugControlsState(true);
        
        // 清空变量和调用堆栈
        this.clearVariables();
        this.clearCallStack();
        // 不再自动请求变量和自动监视，等断点命中或程序停止时再请求
    }
    
    onDebugStopped(data) {
        this.isDebugging = false;
        this.debugProcess = null;
        this.logMessage('调试会话已停止', 'info');
        this.updateDebugControlsState(false);
        if (data.output) {
            this.logMessage('程序输出:', 'output');
            this.logMessage(data.output, 'output');
        }
        if (data.exitCode !== undefined) {
            this.logMessage(`程序退出，退出码: ${data.exitCode}`, 'info');
        }
        // 程序停止时也请求变量和调用栈
        ipcRenderer.send('debug-request-variables');
        ipcRenderer.send('debug-request-callstack');
        this.autoAddDefaultWatches();
    }
    
    onDebugOutput(data) {
        this.logMessage(data.message, data.type || 'output');
    }
    
    onDebugError(error) {
        this.logMessage(`错误: ${error}`, 'error');
    }
    
    onBreakpointHit(breakpoint) {
        this.logMessage(`断点命中: ${breakpoint.file}:${breakpoint.line}`, 'info');
        // 请求更新变量和调用堆栈
        ipcRenderer.send('debug-request-variables');
        ipcRenderer.send('debug-request-callstack');
        // 自动添加监视变量
        this.autoAddDefaultWatches();
    }
    
    onDebugRunning(data) {
        this.logMessage('调试器正在运行...', 'info');
        this.showWaitingState(); // 切换到等待状态
    }
    
    updateDebugControlsState(isDebugging) {
        this.isDebugging = isDebugging;
        
        const controls = {
            'debug-start': !isDebugging,
            'debug-stop': isDebugging,
            'debug-step-over': isDebugging,
            'debug-step-into': isDebugging,
            'debug-step-out': isDebugging,
            'debug-continue': isDebugging,
            'debug-send-input': isDebugging
        };
        
        for (const [id, enabled] of Object.entries(controls)) {
            const element = document.getElementById(id);
            if (element) {
                element.disabled = !enabled;
            }
        }
        
        // 更新添加监视变量按钮状态
        const addWatchBtns = document.querySelectorAll('.add-watch-btn');
        addWatchBtns.forEach(btn => {
            btn.disabled = !isDebugging;
        });
    }
    
    updateVariables(variables) {
        // 更新局部变量
        if (variables.local) {
            this.variables.local = new Map(Object.entries(variables.local));
            this.renderVariables('local-variables', this.variables.local, 'local');
        }
        
        // 更新全局变量
        if (variables.global) {
            this.variables.global = new Map(Object.entries(variables.global));
            this.renderVariables('global-variables', this.variables.global, 'global');
        }
        
        // 更新监视变量
        if (variables.watches) {
            this.variables.watches = new Map(Object.entries(variables.watches));
            this.renderVariables('watch-variables', this.variables.watches, 'watch');
        }
    }

    updateVariablesDisplay(variables) {
        this.updateVariables(variables);
    }

    updateCallStackDisplay(callStack) {
        this.updateCallStack(callStack);
    }

    onProgramExited(data) {
        this.logMessage(`程序退出，退出码: ${data.exitCode || '未知'}`, 'info');
        this.updateDebugControlsState(false);
    }
    
    renderVariables(containerId, variables, scope) {
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.warn(`容器 ${containerId} 不存在`);
            return;
        }
        
        if (variables.size === 0 && scope !== 'watch') {
            container.innerHTML = '<div class="no-debug-message">没有变量</div>';
            return;
        }
        
        container.innerHTML = '';
        
        // 为监视变量区域添加控制按钮
        if (scope === 'watch' && variables.size === 0) {
            container.innerHTML = '<div class="no-debug-message">没有监视变量</div>';
        }
        
        for (const [name, variableData] of variables) {
            const variableElement = this.createVariableElement(name, variableData, scope);
            container.appendChild(variableElement);
        }
    }
    
    createVariableElement(name, variableData, scope) {
        const variableItem = document.createElement('div');
        variableItem.className = 'variable-item';
        
        const hasChildren = variableData.children && variableData.children.length > 0;
        const isExpanded = this.expandedVariables.has(name);
        
        variableItem.innerHTML = `
            <div class="variable-header" data-variable="${name}" data-scope="${scope}">
                ${hasChildren ? `<span class="expand-toggle ${isExpanded ? 'expanded' : ''}">${isExpanded ? '▼' : '▶'}</span>` : '<span class="expand-spacer"></span>'}
                <span class="variable-name" title="${variableData.type}">${name}</span>
                <span class="variable-value ${this.getValueClass(variableData)}" title="${variableData.value}">
                    ${this.formatValue(variableData)}
                </span>
                ${scope === 'watch' ? '<button class="remove-watch-btn" title="移除监视">×</button>' : ''}
            </div>
            ${hasChildren && isExpanded ? '<div class="variable-children"></div>' : ''}
        `;
        
        // 添加事件监听
        const header = variableItem.querySelector('.variable-header');
        if (hasChildren) {
            header.addEventListener('click', (e) => {
                if (!e.target.classList.contains('remove-watch-btn')) {
                    this.toggleVariableExpansion(name, variableData);
                }
            });
        }
        
        // 添加移除监视变量的事件监听
        const removeBtn = variableItem.querySelector('.remove-watch-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeWatchVariable(name);
            });
        }
        
        // 如果已展开，渲染子元素
        if (hasChildren && isExpanded) {
            this.renderVariableChildren(variableItem.querySelector('.variable-children'), variableData.children);
        }
        
        return variableItem;
    }
    
    renderVariableChildren(container, children) {
        container.innerHTML = '';
        
        const maxDisplayItems = 100;
        const displayChildren = children.slice(0, maxDisplayItems);
        
        for (const child of displayChildren) {
            const childElement = this.createVariableElement(child.name, child, 'element');
            childElement.classList.add('variable-child');
            container.appendChild(childElement);
        }
        
        if (children.length > maxDisplayItems) {
            const moreElement = document.createElement('div');
            moreElement.className = 'variable-item variable-child more-items';
            moreElement.innerHTML = `
                <div class="variable-header">
                    <span class="expand-spacer"></span>
                    <span class="variable-name">...</span>
                    <span class="variable-value">还有 ${children.length - maxDisplayItems} 个元素</span>
                </div>
            `;
            container.appendChild(moreElement);
        }
    }
    
    toggleVariableExpansion(name, variableData) {
        const isExpanded = this.expandedVariables.has(name);
        
        if (isExpanded) {
            this.expandedVariables.delete(name);
            ipcRenderer.send('debug-collapse-variable', name);
        } else {
            this.expandedVariables.add(name);
            ipcRenderer.send('debug-expand-variable', name);
        }
        
        // 重新渲染以更新UI
        this.requestVariableUpdate();
    }
    
    removeWatchVariable(name) {
        ipcRenderer.send('debug-remove-watch', name);
        this.logMessage(`已移除监视变量: ${name}`, 'info');
    }
    
    requestVariableUpdate() {
        if (this.isDebugging) {
            ipcRenderer.send('debug-request-variables');
        }
    }
    
    formatValue(variableData) {
        const { value, type, isContainer, isArray, elementCount } = variableData;
        
        if (value === null || value === undefined) {
            return '<null>';
        }
        
        let displayValue = this.escapeHtml(value.toString());
        
        // 对于容器和数组，显示额外信息
        if (isContainer || isArray) {
            const count = elementCount !== null ? elementCount : '?';
            const containerType = isArray ? '数组' : '容器';
            displayValue = `${containerType}[${count}] ${displayValue}`;
        }
        
        // 限制显示长度
        if (displayValue.length > 100) {
            displayValue = displayValue.substring(0, 97) + '...';
        }
        
        return displayValue;
    }
    
    getValueClass(variableData) {
        const { type, value } = variableData;
        
        if (value === null || value === undefined) {
            return 'value-null';
        }
        
        if (type.includes('char') || type.includes('string')) {
            return 'value-string';
        }
        
        if (type.includes('int') || type.includes('float') || type.includes('double')) {
            return 'value-number';
        }
        
        if (type.includes('bool')) {
            return 'value-boolean';
        }
        
        if (variableData.isArray) {
            return 'value-array';
        }
        
        if (variableData.isContainer) {
            return 'value-container';
        }
        
        return 'value-other';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    updateCallStack(callStack) {
        this.callStack = callStack;
        const container = document.getElementById('call-stack');
        
        if (!container) return;
        
        if (!callStack || callStack.length === 0) {
            container.innerHTML = '<div class="no-debug-message">没有调用堆栈信息</div>';
            return;
        }
        
        container.innerHTML = '';
        
        callStack.forEach((frame, index) => {
            const frameElement = document.createElement('div');
            frameElement.className = 'callstack-item';
            frameElement.innerHTML = `
                <div class="frame-info">
                    <span class="frame-index">#${index}</span>
                    <span class="frame-function">${frame.function || '未知函数'}</span>
                </div>
                <div class="frame-location">
                    <span class="frame-file">${frame.file || '未知文件'}</span>
                    ${frame.line ? `<span class="frame-line">:${frame.line}</span>` : ''}
                </div>
            `;
            
            frameElement.addEventListener('click', () => {
                // 切换到对应的堆栈帧
                this.selectStackFrame(index);
            });
            
            container.appendChild(frameElement);
        });
    }
    
    selectStackFrame(frameIndex) {
        // 这里可以实现切换到指定堆栈帧的逻辑
        this.logMessage(`切换到堆栈帧 #${frameIndex}`, 'info');
        // 可以发送IPC消息到主进程来切换帧
        // ipcRenderer.send('debug-select-frame', frameIndex);
    }
    
    clearVariables() {
        this.variables.local.clear();
        this.variables.global.clear();
        this.variables.watches.clear();
        this.expandedVariables.clear();
        
        const containers = ['local-variables', 'global-variables', 'watch-variables'];
        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = '<div class="no-debug-message">请开始调试以查看变量</div>';
            }
        });
    }
    
    clearCallStack() {
        this.callStack = [];
        const container = document.getElementById('call-stack');
        if (container) {
            container.innerHTML = '<div class="no-debug-message">请开始调试以查看调用堆栈</div>';
        }
    }
    
    logMessage(message, type = 'info') {
        const console = document.getElementById('debug-console');
        if (console) {
            const messageElement = document.createElement('div');
            messageElement.className = `console-message ${type}`;
            messageElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            console.appendChild(messageElement);
            console.scrollTop = console.scrollHeight;
        }
    }
    
    getCurrentFile() {
        // 这个方法需要与主编辑器集成来获取当前文件
        // 暂时返回一个模拟值
        return new Promise((resolve) => {
            // 可以通过IPC向主进程请求当前打开的文件
            ipcRenderer.invoke('get-current-file').then(filePath => {
                resolve(filePath);
            }).catch(() => {
                resolve(null);
            });
        });
    }
    
    loadBreakpoints() {
        // 从主进程加载断点信息
        ipcRenderer.invoke('get-breakpoints').then(breakpoints => {
            this.breakpoints = new Map(breakpoints);
            this.renderBreakpoints();
        });
    }
    
    renderBreakpoints() {
        const container = document.getElementById('breakpoints');
        
        if (this.breakpoints.size === 0) {
            container.innerHTML = '<div class="no-breakpoints-message">没有设置断点</div>';
            return;
        }
        
        container.innerHTML = '';
        
        for (const [file, lines] of this.breakpoints) {
            const fileGroup = document.createElement('div');
            fileGroup.className = 'breakpoint-group';
            
            const fileName = file.split(/[\\/]/).pop();
            fileGroup.innerHTML = `
                <div class="breakpoint-file">${fileName}</div>
                <div class="breakpoint-lines">
                    ${lines.map(line => `<div class="breakpoint-line">行 ${line}</div>`).join('')}
                </div>
            `;
            
            container.appendChild(fileGroup);
        }
    }
    
    addBreakpoint(file, line) {
        if (!this.breakpoints.has(file)) {
            this.breakpoints.set(file, new Set());
        }
        this.breakpoints.get(file).add(line);
        this.renderBreakpoints();
        
        // 通知主进程
        ipcRenderer.send('debug-add-breakpoint', { file, line });
    }
    
    removeBreakpoint(file, line) {
        if (this.breakpoints.has(file)) {
            this.breakpoints.get(file).delete(line);
            if (this.breakpoints.get(file).size === 0) {
                this.breakpoints.delete(file);
            }
            this.renderBreakpoints();
            
            // 通知主进程
            ipcRenderer.send('debug-remove-breakpoint', { file, line });
        }
    }

    showAddWatchDialog() {
        const dialog = document.querySelector('.add-watch-dialog');
        if (dialog) {
            dialog.style.display = 'block';
        } else {
            // 如果没有对话框，使用简单的prompt
            const variableName = prompt('请输入要监视的变量名:');
            if (variableName && variableName.trim()) {
                ipcRenderer.send('debug-add-watch', variableName.trim());
                this.logMessage(`正在添加监视变量: ${variableName.trim()}`, 'info');
            }
        }
    }

    hideAddWatchDialog() {
        const dialog = document.querySelector('.add-watch-dialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
    }

    refreshVariables() {
        if (this.isDebugging) {
            this.logMessage('刷新变量...', 'info');
            // 向主进程请求刷新变量
            ipcRenderer.send('debug-refresh-variables');
        } else {
            this.logMessage('请先开始调试会话', 'warning');
        }
    }

    addWatchVariable() {
        const input = document.getElementById('watch-variable-input');
        const variableName = input.value.trim();
        
        if (variableName) {
            ipcRenderer.send('debug-add-watch', variableName);
            this.hideAddWatchDialog();
            input.value = ''; // 清空输入框
            this.logMessage(`正在添加监视变量: ${variableName}`, 'info');
        } else {
            this.logMessage('请输入有效的变量名', 'warning');
        }
    }

    autoAddDefaultWatches() {
        // 只在断点命中或程序停止时自动添加监视变量
        const defaultWatchVars = ['argc', 'argv', 'i', 'result', 'answer', 'sum', 'n', 'm', 'x', 'y', 'z'];
        const isValidCppIdentifier = (name) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
        if (!this._autoWatched) this._autoWatched = new Set();
        const handler = (event, variables) => {
            const localVars = variables && variables.local ? Object.keys(variables.local) : [];
            defaultWatchVars.forEach(varName => {
                if (
                    localVars.includes(varName) &&
                    isValidCppIdentifier(varName) &&
                    !this._autoWatched.has(varName)
                ) {
                    ipcRenderer.send('debug-add-watch', varName);
                    this._autoWatched.add(varName);
                    this.logMessage(`自动添加监视变量: ${varName}`, 'info');
                }
            });
            ipcRenderer.removeListener('debug-variables-updated', handler);
        };
        ipcRenderer.on('debug-variables-updated', handler);
    }
}

// 在页面加载完成后初始化调试UI
document.addEventListener('DOMContentLoaded', () => {
    window.debugUI = new DebugUI();
});

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugUI;
}
