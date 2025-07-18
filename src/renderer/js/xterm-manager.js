// 新的终端管理器 - 基于 xterm.js 和 node-pty
class XTermManager {
    constructor() {
        this.terminals = new Map();
        this.activeTerminalId = null;
        this.terminalContainer = null;
        this.isLoaded = false;
        this.nextTerminalId = 1;
        
        this.init();
    }

    async init() {
        try {
            // 检查是否在 Electron 环境中
            if (typeof require === 'undefined') {
                console.warn('终端功能仅在 Electron 环境中可用');
                return;
            }

            // 加载必要的模块
            await this.loadDependencies();
            
            // 设置终端容器
            this.setupTerminalContainer();
            
            // 创建默认终端
            this.createTerminal();
            
            console.log('XTerm 终端管理器已初始化');
            this.isLoaded = true;
        } catch (error) {
            console.error('终端初始化失败:', error);
            this.fallbackToSimpleTerminal();
        }
    }

    async loadDependencies() {
        // 在实际项目中需要安装这些依赖
        // npm install xterm node-pty
        try {
            this.Terminal = require('xterm').Terminal;
            this.FitAddon = require('xterm-addon-fit').FitAddon;
            this.pty = require('node-pty');
        } catch (error) {
            console.warn('无法加载终端依赖，使用简化版本');
            throw error;
        }
    }

    setupTerminalContainer() {
        this.terminalContainer = document.getElementById('terminal-panel');
        if (!this.terminalContainer) {
            this.terminalContainer = document.createElement('div');
            this.terminalContainer.id = 'terminal-panel';
            this.terminalContainer.className = 'terminal-panel';
            
            // 添加到主界面
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.appendChild(this.terminalContainer);
            }
        }
        
        // 设置终端面板结构
        this.terminalContainer.innerHTML = `
            <div class="terminal-header">
                <div class="terminal-tabs" id="terminal-tabs">
                    <!-- 终端标签页 -->
                </div>
                <div class="terminal-controls">
                    <button class="terminal-btn" id="new-terminal" title="新建终端">+</button>
                    <button class="terminal-btn" id="split-terminal" title="拆分终端">⊞</button>
                    <button class="terminal-btn" id="close-terminal" title="关闭终端">×</button>
                </div>
            </div>
            <div class="terminal-content" id="terminal-content">
                <!-- 终端内容 -->
            </div>
        `;
        
        this.setupTerminalEvents();
    }

    setupTerminalEvents() {
        // 新建终端按钮
        document.getElementById('new-terminal').addEventListener('click', () => {
            this.createTerminal();
        });

        // 关闭终端按钮
        document.getElementById('close-terminal').addEventListener('click', () => {
            this.closeActiveTerminal();
        });

        // 拆分终端按钮
        document.getElementById('split-terminal').addEventListener('click', () => {
            this.splitTerminal();
        });
    }

    createTerminal(shell = null) {
        const terminalId = `terminal-${this.nextTerminalId++}`;
        
        // 创建终端实例
        const terminal = new this.Terminal({
            cursorBlink: true,
            theme: {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#ffffff',
                selection: '#264f78',
                black: '#000000',
                red: '#cd3131',
                green: '#0dbc79',
                yellow: '#e5e510',
                blue: '#2472c8',
                magenta: '#bc3fbc',
                cyan: '#11a8cd',
                white: '#e5e5e5',
                brightBlack: '#666666',
                brightRed: '#f14c4c',
                brightGreen: '#23d18b',
                brightYellow: '#f5f543',
                brightBlue: '#3b8eea',
                brightMagenta: '#d670d6',
                brightCyan: '#29b8db',
                brightWhite: '#ffffff'
            },
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: 14,
            lineHeight: 1.2,
            scrollback: 1000,
            cols: 80,
            rows: 24
        });

        // 添加适应插件
        const fitAddon = new this.FitAddon();
        terminal.loadAddon(fitAddon);

        // 创建终端内容容器
        const terminalDiv = document.createElement('div');
        terminalDiv.id = terminalId;
        terminalDiv.className = 'terminal-instance';
        terminalDiv.style.display = 'none';
        
        document.getElementById('terminal-content').appendChild(terminalDiv);

        // 将终端附加到DOM
        terminal.open(terminalDiv);
        fitAddon.fit();

        // 创建 pty 进程
        const shellCommand = shell || (process.platform === 'win32' ? 'powershell.exe' : 'bash');
        const ptyProcess = this.pty.spawn(shellCommand, [], {
            name: 'xterm-color',
            cols: terminal.cols,
            rows: terminal.rows,
            cwd: process.cwd(),
            env: process.env
        });

        // 连接终端和 pty
        terminal.onData((data) => {
            ptyProcess.write(data);
        });

        ptyProcess.onData((data) => {
            terminal.write(data);
        });

        ptyProcess.onExit((code) => {
            terminal.write(`\\r\\n进程已退出，退出代码: ${code}\\r\\n`);
            this.closeTerminal(terminalId);
        });

        // 监听终端大小变化
        terminal.onResize((size) => {
            ptyProcess.resize(size.cols, size.rows);
        });

        // 存储终端信息
        this.terminals.set(terminalId, {
            terminal,
            ptyProcess,
            fitAddon,
            element: terminalDiv,
            shell: shellCommand
        });

        // 创建标签页
        this.createTerminalTab(terminalId, shellCommand);

        // 激活新终端
        this.activateTerminal(terminalId);

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            setTimeout(() => {
                if (this.activeTerminalId === terminalId) {
                    fitAddon.fit();
                }
            }, 100);
        });

        return terminalId;
    }

    createTerminalTab(terminalId, shell) {
        const tabsContainer = document.getElementById('terminal-tabs');
        const tab = document.createElement('div');
        tab.className = 'terminal-tab';
        tab.dataset.terminalId = terminalId;
        tab.innerHTML = `
            <span class="terminal-tab-name">${this.getShellDisplayName(shell)}</span>
            <button class="terminal-tab-close" title="关闭">×</button>
        `;

        // 标签页点击事件
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('terminal-tab-close')) {
                this.activateTerminal(terminalId);
            }
        });

        // 关闭按钮事件
        tab.querySelector('.terminal-tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTerminal(terminalId);
        });

        tabsContainer.appendChild(tab);
    }

    getShellDisplayName(shell) {
        const name = shell.split(/[\/\\]/).pop();
        switch (name) {
            case 'powershell.exe':
                return 'PowerShell';
            case 'cmd.exe':
                return 'CMD';
            case 'bash':
                return 'Bash';
            default:
                return name;
        }
    }

    activateTerminal(terminalId) {
        // 隐藏当前活动终端
        if (this.activeTerminalId) {
            const currentTerminal = this.terminals.get(this.activeTerminalId);
            if (currentTerminal) {
                currentTerminal.element.style.display = 'none';
            }
            
            // 移除当前标签页的活动状态
            const currentTab = document.querySelector(`[data-terminal-id="${this.activeTerminalId}"]`);
            if (currentTab) {
                currentTab.classList.remove('active');
            }
        }

        // 显示新终端
        const terminal = this.terminals.get(terminalId);
        if (terminal) {
            terminal.element.style.display = 'block';
            terminal.terminal.focus();
            terminal.fitAddon.fit();
            
            // 设置活动状态
            this.activeTerminalId = terminalId;
            
            // 激活对应的标签页
            const tab = document.querySelector(`[data-terminal-id="${terminalId}"]`);
            if (tab) {
                tab.classList.add('active');
            }
        }
    }

    closeTerminal(terminalId) {
        const terminal = this.terminals.get(terminalId);
        if (terminal) {
            // 关闭 pty 进程
            terminal.ptyProcess.kill();
            
            // 销毁终端
            terminal.terminal.dispose();
            
            // 移除元素
            terminal.element.remove();
            
            // 移除标签页
            const tab = document.querySelector(`[data-terminal-id="${terminalId}"]`);
            if (tab) {
                tab.remove();
            }
            
            // 从映射中移除
            this.terminals.delete(terminalId);
            
            // 如果关闭的是当前活动终端，切换到其他终端
            if (this.activeTerminalId === terminalId) {
                this.activeTerminalId = null;
                const remainingTerminals = Array.from(this.terminals.keys());
                if (remainingTerminals.length > 0) {
                    this.activateTerminal(remainingTerminals[0]);
                }
            }
        }
    }

    closeActiveTerminal() {
        if (this.activeTerminalId) {
            this.closeTerminal(this.activeTerminalId);
        }
    }

    splitTerminal() {
        // 创建新的终端实例，使用相同的shell
        const currentTerminal = this.terminals.get(this.activeTerminalId);
        if (currentTerminal) {
            this.createTerminal(currentTerminal.shell);
        }
    }

    show() {
        if (this.terminalContainer) {
            this.terminalContainer.style.display = 'block';
            
            // 如果有活动终端，使其适应大小
            if (this.activeTerminalId) {
                const terminal = this.terminals.get(this.activeTerminalId);
                if (terminal) {
                    setTimeout(() => {
                        terminal.fitAddon.fit();
                        terminal.terminal.focus();
                    }, 100);
                }
            }
        }
    }

    hide() {
        if (this.terminalContainer) {
            this.terminalContainer.style.display = 'none';
        }
    }

    toggle() {
        if (this.terminalContainer) {
            if (this.terminalContainer.style.display === 'none') {
                this.show();
            } else {
                this.hide();
            }
        }
    }

    // 简化版终端 - 当无法加载 xterm 时使用
    fallbackToSimpleTerminal() {
        console.log('使用简化版终端');
        
        // 创建简单的终端界面
        this.terminalContainer = document.getElementById('terminal-panel');
        if (!this.terminalContainer) {
            this.terminalContainer = document.createElement('div');
            this.terminalContainer.id = 'terminal-panel';
            this.terminalContainer.className = 'terminal-panel simple-terminal';
            
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.appendChild(this.terminalContainer);
            }
        }
        
        this.terminalContainer.innerHTML = `
            <div class="terminal-header">
                <span class="terminal-title">终端 (简化版)</span>
                <div class="terminal-controls">
                    <button class="terminal-btn" id="clear-terminal">清空</button>
                    <button class="terminal-btn" id="close-terminal">×</button>
                </div>
            </div>
            <div class="terminal-content">
                <div class="terminal-output" id="terminal-output"></div>
                <div class="terminal-input-line">
                    <span class="terminal-prompt">></span>
                    <input type="text" class="terminal-input" id="terminal-input" placeholder="输入命令...">
                </div>
            </div>
        `;
        
        this.setupSimpleTerminalEvents();
        this.isLoaded = true;
    }

    setupSimpleTerminalEvents() {
        const input = document.getElementById('terminal-input');
        const output = document.getElementById('terminal-output');
        
        // 清空按钮
        document.getElementById('clear-terminal').addEventListener('click', () => {
            output.innerHTML = '';
        });
        
        // 关闭按钮
        document.getElementById('close-terminal').addEventListener('click', () => {
            this.hide();
        });
        
        // 输入处理
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const command = input.value.trim();
                if (command) {
                    this.executeSimpleCommand(command);
                    input.value = '';
                }
            }
        });
    }

    executeSimpleCommand(command) {
        const output = document.getElementById('terminal-output');
        
        // 显示命令
        const commandDiv = document.createElement('div');
        commandDiv.className = 'terminal-command';
        commandDiv.textContent = `> ${command}`;
        output.appendChild(commandDiv);
        
        // 简单的命令处理
        if (command === 'clear') {
            output.innerHTML = '';
            return;
        }
        
        if (command === 'help') {
            const helpDiv = document.createElement('div');
            helpDiv.className = 'terminal-response';
            helpDiv.innerHTML = `
                <div>可用命令:</div>
                <div>  clear - 清空终端</div>
                <div>  help - 显示帮助</div>
                <div>  echo [text] - 输出文本</div>
                <div>注意: 这是简化版终端，功能有限</div>
            `;
            output.appendChild(helpDiv);
            return;
        }
        
        if (command.startsWith('echo ')) {
            const text = command.substring(5);
            const echoDiv = document.createElement('div');
            echoDiv.className = 'terminal-response';
            echoDiv.textContent = text;
            output.appendChild(echoDiv);
            return;
        }
        
        // 默认响应
        const responseDiv = document.createElement('div');
        responseDiv.className = 'terminal-response error';
        responseDiv.textContent = `'${command}' 不是内部或外部命令，也不是可运行的程序或批处理文件。`;
        output.appendChild(responseDiv);
        
        // 滚动到底部
        output.scrollTop = output.scrollHeight;
    }
}

// 导出类
window.XTermManager = XTermManager;
