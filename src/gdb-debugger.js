// 真实的GDB调试器实现
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

class GDBDebugger extends EventEmitter {
    constructor() {
        super();
        this.gdbProcess = null;
        this.isRunning = false;
        this.currentFile = null;
        this.outputBuffer = '';
        this.breakpoints = new Map();
        this.variables = new Map();
        this.watchedVariables = new Set(); // 监视的变量
        this.callStack = [];
        this.currentFrame = null;
        this.commandQueue = [];
        this.isProcessingCommand = false;
        this.autoWatchEnabled = true; // 自动监视局部变量
    }

    async start(executable, sourceFile) {
        if (this.isRunning) {
            throw new Error('调试器已在运行');
        }

        try {
            console.log('[GDB] 开始启动调试器...');
            console.log('[GDB] 可执行文件:', executable);
            console.log('[GDB] 源文件:', sourceFile);

            // 检查可执行文件是否存在
            if (!fs.existsSync(executable)) {
                throw new Error(`可执行文件不存在: ${executable}`);
            }

            // 检查GDB是否可用
            await this.checkGDBAvailability();

            // 启动GDB进程
            console.log('[GDB] 启动GDB进程...');
            this.gdbProcess = spawn('gdb', [
                '--interpreter=mi2',
                '--quiet',
                executable
            ], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: path.dirname(executable),
                env: { ...process.env, LANG: 'C' } // 确保英文输出
            });

            if (!this.gdbProcess || !this.gdbProcess.pid) {
                throw new Error('无法启动GDB进程');
            }

            console.log('[GDB] GDB进程已启动，PID:', this.gdbProcess.pid);

            this.isRunning = true;
            this.currentFile = sourceFile;
            this.outputBuffer = '';

            // 设置事件监听
            this.setupEventHandlers();

            // 等待GDB初始化
            console.log('[GDB] 等待GDB初始化...');
            await this.waitForGDBReady();

            // 发送初始化命令
            console.log('[GDB] 发送初始化命令...');
            await this.sendInitialCommands();

            console.log('[GDB] 调试器启动成功');
            this.emit('started', { executable, sourceFile });

            return true;

        } catch (error) {
            console.error('[GDB] 启动失败:', error);
            this.isRunning = false;
            if (this.gdbProcess) {
                this.gdbProcess.kill();
                this.gdbProcess = null;
            }
            throw error;
        }
    }

    async checkGDBAvailability() {
        return new Promise((resolve, reject) => {
            console.log('[GDB] 检查GDB可用性...');
            const testProcess = spawn('gdb', ['--version'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            testProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            testProcess.on('close', (code) => {
                if (code === 0 && output.includes('GNU gdb')) {
                    console.log('[GDB] GDB可用，版本信息:', output.split('\n')[0]);
                    resolve();
                } else {
                    reject(new Error('GDB未安装或不可用。请确保已安装GDB调试器。'));
                }
            });

            testProcess.on('error', (error) => {
                reject(new Error(`GDB不可用: ${error.message}。请确保已安装GDB调试器。`));
            });

            // 设置超时
            setTimeout(() => {
                testProcess.kill();
                reject(new Error('GDB检查超时'));
            }, 5000);
        });
    }

    setupEventHandlers() {
        if (!this.gdbProcess) return;

        // 处理stdout输出
        this.gdbProcess.stdout.on('data', (data) => {
            const output = data.toString();
            this.outputBuffer += output;
            this.processGDBOutput(output);
        });

        // 处理stderr输出
        this.gdbProcess.stderr.on('data', (data) => {
            const error = data.toString();
            console.error('GDB stderr:', error);
            this.emit('error', error);
        });

        // 处理进程退出
        this.gdbProcess.on('exit', (code, signal) => {
            console.log(`GDB进程退出: code=${code}, signal=${signal}`);
            this.isRunning = false;
            this.gdbProcess = null;
            this.emit('exited', { code, signal });
        });

        // 处理进程错误
        this.gdbProcess.on('error', (error) => {
            console.error('GDB进程错误:', error);
            this.isRunning = false;
            this.gdbProcess = null;
            this.emit('error', error.message);
        });
    }

    async waitForGDBReady() {
        return new Promise((resolve, reject) => {
            console.log('[GDB] 等待GDB准备就绪...');
            
            const timeout = setTimeout(() => {
                console.error('[GDB] 初始化超时，输出内容:', this.outputBuffer);
                reject(new Error('GDB初始化超时'));
            }, 10000); // 10秒超时

            let isReady = false;
            
            const checkReady = (data) => {
                if (isReady) return;
                
                const output = data ? data.toString() : '';
                console.log('[GDB] 收到输出:', output);
                
                // MI2模式下，GDB准备就绪的标志
                if (output.includes('(gdb)') || 
                    output.includes('~"GNU gdb') ||
                    output.includes('*stopped') ||
                    this.outputBuffer.includes('(gdb)')) {
                    
                    console.log('[GDB] GDB已准备就绪');
                    isReady = true;
                    clearTimeout(timeout);
                    
                    // 延迟一点时间确保完全就绪
                    setTimeout(() => {
                        resolve();
                    }, 500);
                }
            };

            // 监听stdout输出
            this.gdbProcess.stdout.on('data', checkReady);
            
            // 监听stderr输出（调试信息）
            this.gdbProcess.stderr.on('data', (data) => {
                console.log('[GDB] stderr:', data.toString());
            });
            
            // 如果进程意外退出
            this.gdbProcess.on('exit', (code, signal) => {
                if (!isReady) {
                    console.error('[GDB] 进程意外退出:', code, signal);
                    clearTimeout(timeout);
                    reject(new Error(`GDB进程意外退出: code=${code}, signal=${signal}`));
                }
            });
        });
    }

    async sendInitialCommands() {
        try {
            console.log('[GDB] 发送初始化命令...');
            
            // 等待一小段时间确保GDB完全就绪
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 基本设置命令 - 使用最简单的设置
            const initCommands = [
                '-gdb-set confirm off',
                '-gdb-set pagination off',
                '-gdb-set breakpoint pending on'
            ];
            
            for (const command of initCommands) {
                try {
                    console.log('[GDB] 执行初始化命令:', command);
                    await this.sendCommand(command);
                    console.log('[GDB] 命令执行成功:', command);
                } catch (error) {
                    console.warn('[GDB] 命令执行失败，继续:', command, error.message);
                }
            }
            
            // 设置源文件路径
            if (this.currentFile) {
                try {
                    const sourceDir = path.dirname(this.currentFile);
                    const command = `-environment-directory "${sourceDir}"`;
                    console.log('[GDB] 设置源文件目录命令:', command);
                    await this.sendCommand(command);
                    console.log('[GDB] 源文件目录设置成功:', sourceDir);
                } catch (error) {
                    console.warn('[GDB] 设置源文件目录失败:', error.message);
                }
            }
            
            console.log('[GDB] 初始化命令发送完成');
            
        } catch (error) {
            console.error('[GDB] 初始化命令失败:', error);
            // 不抛出错误，继续执行
        }
    }

    processGDBOutput(output) {
        const lines = output.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            console.log('[GDB] 处理输出行:', trimmed);

            try {
                // 解析MI2输出
                if (trimmed.startsWith('*stopped')) {
                    this.handleStoppedEvent(trimmed);
                } else if (trimmed.startsWith('*running')) {
                    this.handleRunningEvent(trimmed);
                } else if (trimmed.startsWith('^running')) {
                    this.handleRunningEvent(trimmed);
                } else if (trimmed.startsWith('=breakpoint-created')) {
                    this.handleBreakpointCreated(trimmed);
                } else if (trimmed.startsWith('=breakpoint-deleted')) {
                    this.handleBreakpointDeleted(trimmed);
                } else if (trimmed.startsWith('^done')) {
                    this.handleCommandDone(trimmed);
                } else if (trimmed.startsWith('^error')) {
                    this.handleCommandError(trimmed);
                } else if (trimmed.startsWith('~')) {
                    this.handleConsoleOutput(trimmed);
                } else if (trimmed.startsWith('&')) {
                    this.handleLogOutput(trimmed);
                } else if (trimmed.includes('variables=')) {
                    this.parseVariables(trimmed);
                } else if (trimmed.includes('stack=')) {
                    this.parseCallStack(trimmed);
                } else if (trimmed === '(gdb)') {
                    console.log('[GDB] 收到GDB提示符');
                    // GDB准备接收下一个命令
                    if (!this.isProcessingCommand) {
                        this.emit('command-done');
                    }
                } else if (trimmed.includes('=thread-exited')) {
                    console.log('[GDB] 线程退出:', trimmed);
                    this.handleThreadExit(trimmed);
                } else if (trimmed.includes('=thread-group-exited')) {
                    console.log('[GDB] 进程组退出:', trimmed);
                    this.handleProcessExit(trimmed);
                } else if (trimmed.includes('exited with code')) {
                    console.log('[GDB] 程序退出:', trimmed);
                    this.handleProgramExit(trimmed);
                } else {
                    console.log('[GDB] 未识别的输出:', trimmed);
                }
            } catch (error) {
                console.error('[GDB] 解析输出失败:', error, 'line:', trimmed);
            }
        }
    }

    parseVariables(line) {
        try {
            // 解析GDB MI2格式的变量输出
            // 格式：^done,variables=[{name="var1",value="123",type="int"},{name="var2",value="hello",type="char*"}]
            const match = line.match(/variables=\[(.*)\]/);
            if (match) {
                const varsString = match[1];
                this.parseVariableList(varsString);
            }
            
            // 也解析单个变量的响应
            // 格式：^done,value="123",type="int"
            const valueMatch = line.match(/value="([^"]*)".*type="([^"]*)"/);
            if (valueMatch && this.currentWatchVariable) {
                const value = this.unescapeGDBString(valueMatch[1]);
                const type = valueMatch[2];
                this.updateVariable(this.currentWatchVariable, value, type, 'watch');
                this.currentWatchVariable = null;
            }
            
        } catch (error) {
            console.error('解析变量失败:', error);
        }
    }

    parseVariableList(varsString) {
        // 手动解析变量列表，支持嵌套结构
        const variables = [];
        let current = '';
        let depth = 0;
        let inString = false;
        let escape = false;
        
        for (let i = 0; i < varsString.length; i++) {
            const char = varsString[i];
            
            if (escape) {
                current += char;
                escape = false;
                continue;
            }
            
            if (char === '\\') {
                escape = true;
                current += char;
                continue;
            }
            
            if (char === '"') {
                inString = !inString;
                current += char;
                continue;
            }
            
            if (!inString) {
                if (char === '{') {
                    depth++;
                    current += char;
                } else if (char === '}') {
                    depth--;
                    current += char;
                    if (depth === 0) {
                        variables.push(current);
                        current = '';
                    }
                } else if (char === ',' && depth === 0) {
                    if (current.trim()) {
                        variables.push(current);
                        current = '';
                    }
                } else {
                    current += char;
                }
            } else {
                current += char;
            }
        }
        
        if (current.trim()) {
            variables.push(current);
        }
        
        // 解析每个变量
        for (const varStr of variables) {
            this.parseVariableData(varStr);
        }
    }

    parseVariableData(varStr) {
        const nameMatch = varStr.match(/name="([^"]*)"/);
        const valueMatch = varStr.match(/value="([^"]*)"/);
        const typeMatch = varStr.match(/type="([^"]*)"/);
        
        if (nameMatch && valueMatch && typeMatch) {
            const name = nameMatch[1];
            const rawValue = valueMatch[1];
            const type = typeMatch[1];
            
            // 转义GDB字符串
            const value = this.unescapeGDBString(rawValue);
            
            // 确定变量作用域
            const scope = this.determineVariableScope(name, type);
            
            this.updateVariable(name, value, type, scope);
        }
    }

    unescapeGDBString(str) {
        return str
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\\\/g, '\\');
    }

    determineVariableScope(name, type) {
        // 简单的作用域判断逻辑
        if (name.startsWith('::') || type.includes('static')) {
            return 'global';
        }
        return 'local';
    }

    updateVariable(name, value, type, scope) {
        const variableData = {
            name,
            value,
            type,
            scope,
            expanded: false,
            children: null,
            isContainer: this.isContainerType(type),
            isArray: this.isArrayType(type, value),
            elementCount: this.getElementCount(type, value)
        };
        
        // 如果是容器或数组，解析子元素
        if (variableData.isContainer || variableData.isArray) {
            variableData.children = this.parseContainerValue(value, type);
        }
        
        this.variables.set(name, variableData);
        
        // 触发变量更新事件
        this.emit('variables-updated', {
            name,
            data: variableData
        });
    }

    isContainerType(type) {
        const containerTypes = [
            'std::vector',
            'std::list',
            'std::deque',
            'std::set',
            'std::map',
            'std::unordered_set',
            'std::unordered_map',
            'std::array',
            'std::queue',
            'std::stack'
        ];
        
        return containerTypes.some(containerType => type.includes(containerType));
    }

    isArrayType(type, value) {
        // 检查是否为数组类型
        return type.includes('[') || value.match(/^\{.*\}$/) || type.includes('*');
    }

    getElementCount(type, value) {
        // 尝试从类型或值中获取元素数量
        const arrayMatch = type.match(/\[(\d+)\]/);
        if (arrayMatch) {
            return parseInt(arrayMatch[1]);
        }
        
        // 对于容器，尝试从值中解析
        if (value.includes('size=')) {
            const sizeMatch = value.match(/size=(\d+)/);
            if (sizeMatch) {
                return parseInt(sizeMatch[1]);
            }
        }
        
        // 简单的数组值解析
        if (value.startsWith('{') && value.endsWith('}')) {
            const elements = value.slice(1, -1).split(',');
            return elements.length;
        }
        
        return null;
    }

    parseContainerValue(value, type) {
        const children = [];
        const maxElements = 100; // 最大展开100项
        
        try {
            if (value.startsWith('{') && value.endsWith('}')) {
                // 解析数组格式 {1, 2, 3}
                const content = value.slice(1, -1);
                const elements = this.parseArrayElements(content);
                
                for (let i = 0; i < Math.min(elements.length, maxElements); i++) {
                    children.push({
                        name: `[${i}]`,
                        value: elements[i],
                        type: this.inferElementType(type),
                        scope: 'element',
                        expanded: false,
                        children: null,
                        isContainer: false,
                        isArray: false
                    });
                }
                
                if (elements.length > maxElements) {
                    children.push({
                        name: '...',
                        value: `还有 ${elements.length - maxElements} 个元素`,
                        type: 'info',
                        scope: 'info',
                        expanded: false,
                        children: null,
                        isContainer: false,
                        isArray: false
                    });
                }
            }
        } catch (error) {
            console.error('解析容器值失败:', error);
        }
        
        return children;
    }

    parseArrayElements(content) {
        const elements = [];
        let current = '';
        let depth = 0;
        let inString = false;
        let escape = false;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            
            if (escape) {
                current += char;
                escape = false;
                continue;
            }
            
            if (char === '\\') {
                escape = true;
                current += char;
                continue;
            }
            
            if (char === '"') {
                inString = !inString;
                current += char;
                continue;
            }
            
            if (!inString) {
                if (char === '{' || char === '(') {
                    depth++;
                    current += char;
                } else if (char === '}' || char === ')') {
                    depth--;
                    current += char;
                } else if (char === ',' && depth === 0) {
                    elements.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            } else {
                current += char;
            }
        }
        
        if (current.trim()) {
            elements.push(current.trim());
        }
        
        return elements;
    }

    inferElementType(containerType) {
        // 推断容器元素类型
        const templateMatch = containerType.match(/<([^>]+)>/);
        if (templateMatch) {
            return templateMatch[1];
        }
        
        if (containerType.includes('*')) {
            return containerType.replace('*', '');
        }
        
        return 'unknown';
    }

    parseCallStack(line) {
        try {
            // 解析GDB MI2格式的调用栈输出
            // 格式：^done,stack=[frame={level="0",addr="0x...",func="main",file="main.cpp",line="10"}]
            const match = line.match(/stack=\[(.*)\]/);
            if (match) {
                const stackString = match[1];
                this.callStack = this.parseStackFrames(stackString);
                
                this.emit('callstack-updated', this.callStack);
            }
        } catch (error) {
            console.error('解析调用栈失败:', error);
        }
    }

    parseStackFrames(stackString) {
        const frames = [];
        
        // 简单的解析逻辑，实际中可能需要更复杂的解析
        const frameRegex = /frame=\{([^}]+)\}/g;
        let match;
        
        while ((match = frameRegex.exec(stackString)) !== null) {
            const frameData = match[1];
            const frame = this.parseFrameData(frameData);
            if (frame) {
                frames.push(frame);
            }
        }
        
        return frames;
    }

    parseFrameData(frameData) {
        const frame = {};
        
        const patterns = {
            level: /level="([^"]+)"/,
            addr: /addr="([^"]+)"/,
            func: /func="([^"]+)"/,
            file: /file="([^"]+)"/,
            line: /line="([^"]+)"/
        };
        
        for (const [key, pattern] of Object.entries(patterns)) {
            const match = frameData.match(pattern);
            if (match) {
                frame[key] = match[1];
            }
        }
        
        return frame;
    }

    handleStoppedEvent(line) {
        const reason = this.extractMIValue(line, 'reason');
        const file = this.extractMIValue(line, 'file');
        const lineNum = this.extractMIValue(line, 'line');
        const func = this.extractMIValue(line, 'func');

        console.log(`[GDB] 程序停止: ${reason} at ${file}:${lineNum} in ${func}`);

        const stopData = {
            reason,
            file,
            line: lineNum ? parseInt(lineNum) : null,
            function: func
        };

        this.emit('stopped', stopData);

        // 如果是断点命中，发送特殊事件
        if (reason === 'breakpoint-hit' || reason?.includes('breakpoint')) {
            this.emit('breakpoint-hit', stopData);
        }

        // 自动获取变量和调用栈
        setTimeout(() => {
            this.updateVariables();
            this.updateCallStack();
        }, 300); // 稍微延迟以确保程序完全停止
    }

    handleRunningEvent(line) {
        console.log('[GDB] 程序开始运行:', line);
        this.emit('running');
    }

    handleThreadExit(line) {
        console.log('[GDB] 处理线程退出:', line);
        // 提取退出代码
        const codeMatch = line.match(/code (\d+)/);
        const exitCode = codeMatch ? parseInt(codeMatch[1]) : 0;
        
        this.emit('program-exited', {
            exitCode: exitCode,
            reason: 'normal-exit'
        });
    }

    handleProcessExit(line) {
        console.log('[GDB] 处理进程组退出:', line);
        const codeMatch = line.match(/exit-code="(\d+)"/);
        const exitCode = codeMatch ? parseInt(codeMatch[1]) : 0;
        
        // 标记程序已退出
        this.programRunning = false;
        this.programExited = true;
        
        // 清空待处理的命令队列，避免在程序退出后继续发送命令
        this.commandQueue.length = 0;
        this.currentCommand = null;
        console.log('[GDB] 程序退出，已清空命令队列');
        
        this.emit('program-exited', {
            exitCode: exitCode,
            reason: 'process-exit'
        });
    }

    handleProgramExit(line) {
        console.log('[GDB] 处理程序退出:', line);
        const codeMatch = line.match(/code (\d+)/);
        const exitCode = codeMatch ? parseInt(codeMatch[1]) : 0;
        
        this.emit('program-exited', {
            exitCode: exitCode,
            reason: 'program-exit'
        });
    }

    handleBreakpointCreated(line) {
        const number = this.extractMIValue(line, 'number');
        const file = this.extractMIValue(line, 'file');
        const lineNum = this.extractMIValue(line, 'line');
        
        if (number && file && lineNum) {
            this.breakpoints.set(number, {
                file,
                line: parseInt(lineNum),
                enabled: true
            });
            
            this.emit('breakpoint-set', {
                number,
                file,
                line: parseInt(lineNum)
            });
        }
    }

    handleBreakpointDeleted(line) {
        const number = this.extractMIValue(line, 'number');
        if (number) {
            this.breakpoints.delete(number);
            this.emit('breakpoint-removed', { number });
        }
    }

    handleCommandDone(line) {
        console.log('[GDB] 命令执行完成:', line);
        this.isProcessingCommand = false;
        this.emit('command-done');
        this.processCommandQueue();
    }

    handleCommandError(line) {
        const msg = this.extractMIValue(line, 'msg');
        console.error('[GDB] 命令执行错误:', msg, 'line:', line);
        this.emit('command-error', msg);
        this.isProcessingCommand = false;
        this.processCommandQueue();
    }

    handleConsoleOutput(line) {
        const output = this.extractConsoleOutput(line);
        this.emit('console-output', output);
    }

    handleLogOutput(line) {
        const output = this.extractConsoleOutput(line);
        this.emit('log-output', output);
    }

    extractMIValue(line, key) {
        const regex = new RegExp(`${key}="([^"]*)"`, 'g');
        const match = regex.exec(line);
        return match ? match[1] : null;
    }

    extractConsoleOutput(line) {
        if (line.startsWith('~"') || line.startsWith('&"')) {
            return line.substring(2, line.length - 1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
        return line;
    }

    async sendCommand(command) {
        return new Promise((resolve, reject) => {
            if (!this.isRunning || !this.gdbProcess) {
                reject(new Error('调试器未运行'));
                return;
            }

            console.log('[GDB] 发送命令:', command);
            this.commandQueue.push({ command, resolve, reject, timestamp: Date.now() });
            this.processCommandQueue();
        });
    }

    processCommandQueue() {
        if (this.isProcessingCommand || this.commandQueue.length === 0) {
            return;
        }

        const { command, resolve, reject, timestamp } = this.commandQueue.shift();
        this.isProcessingCommand = true;

        try {
            // 写入命令
            this.gdbProcess.stdin.write(command + '\n');
            console.log('[GDB] 命令已发送:', command);
            
            // 设置超时
            const timeout = setTimeout(() => {
                console.warn('[GDB] 命令超时:', command);
                this.isProcessingCommand = false;
                
                // 移除事件监听器
                this.removeListener('command-done', onDone);
                this.removeListener('command-error', onError);
                
                resolve(); // 解决而不是拒绝，避免阻塞
                this.processCommandQueue(); // 继续处理队列
            }, 10000); // 10秒超时

            // 监听命令完成
            const onDone = () => {
                console.log('[GDB] 命令完成:', command);
                clearTimeout(timeout);
                this.isProcessingCommand = false;
                
                // 移除事件监听器
                this.removeListener('command-error', onError);
                
                resolve();
                this.processCommandQueue(); // 处理下一个命令
            };

            const onError = (error) => {
                console.error('[GDB] 命令错误:', command, error);
                clearTimeout(timeout);
                this.isProcessingCommand = false;
                
                // 移除事件监听器
                this.removeListener('command-done', onDone);
                
                reject(new Error(error));
                this.processCommandQueue(); // 处理下一个命令
            };

            // 使用once确保只触发一次
            this.once('command-done', onDone);
            this.once('command-error', onError);

        } catch (error) {
            console.error('[GDB] 发送命令失败:', error);
            this.isProcessingCommand = false;
            reject(error);
            this.processCommandQueue(); // 处理下一个命令
        }
    }

    // 调试控制方法
    async run() {
        console.log('[GDB] 开始运行程序');
        try {
            await this.sendCommand('-exec-run');
            console.log('[GDB] 程序运行命令已发送');
        } catch (error) {
            console.error('[GDB] 运行程序失败:', error);
            throw error;
        }
    }

    async continue() {
        return this.sendCommand('-exec-continue');
    }

    async stepOver() {
        return this.sendCommand('-exec-next');
    }

    async stepInto() {
        return this.sendCommand('-exec-step');
    }

    async stepOut() {
        return this.sendCommand('-exec-finish');
    }

    async setBreakpoint(file, line) {
        console.log(`[GDB] 设置断点: ${file}:${line}`);
        try {
            // 使用相对路径和绝对路径都尝试
            const fileName = path.basename(file);
            const command = `-break-insert "${fileName}:${line}"`;
            await this.sendCommand(command);
            
            console.log(`[GDB] 断点设置成功: ${fileName}:${line}`);
            return true;
        } catch (error) {
            console.error(`[GDB] 设置断点失败: ${file}:${line}`, error);
            
            // 尝试使用完整路径
            try {
                const command = `-break-insert "${file}:${line}"`;
                await this.sendCommand(command);
                console.log(`[GDB] 断点设置成功（使用完整路径）: ${file}:${line}`);
                return true;
            } catch (error2) {
                console.error(`[GDB] 使用完整路径设置断点也失败: ${file}:${line}`, error2);
                throw error2;
            }
        }
    }

    async removeBreakpoint(number) {
        const command = `-break-delete ${number}`;
        return this.sendCommand(command);
    }

    async updateVariables() {
        // 检查程序是否已退出
        if (this.programExited || !this.programRunning) {
            console.log('[GDB] 程序已退出，跳过变量更新');
            return;
        }
        
        try {
            // 只获取局部变量，不请求寄存器
            await this.sendCommand('-stack-list-variables --all-values');
            
            // 如果启用自动监视，自动添加一些常见变量
            if (this.autoWatchEnabled) {
                await this.autoAddWatchVariables();
            }
            
            // 更新监视的变量
            for (const varName of this.watchedVariables) {
                await this.updateWatchVariable(varName);
            }
            
        } catch (error) {
            console.error('更新变量失败:', error);
        }
    }

    async autoAddWatchVariables() {
        try {
            // 自动添加常见的局部变量
            const commonVars = ['i', 'j', 'k', 'n', 'size', 'count', 'index', 'result', 'temp', 'data'];
            
            for (const varName of commonVars) {
                try {
                    await this.addWatchVariable(varName);
                } catch (error) {
                    // 忽略不存在的变量
                }
            }
            
            // 尝试获取所有局部变量并自动添加
            try {
                const localVarsCommand = '-stack-list-variables --simple-values';
                const response = await this.sendCommand(localVarsCommand);
                
                // 解析响应并添加找到的变量
                if (response && response.includes('variables=')) {
                    const varsMatch = response.match(/variables=\[(.*?)\]/);
                    if (varsMatch) {
                        const varsString = varsMatch[1];
                        const varNames = this.extractVariableNames(varsString);
                        
                        for (const varName of varNames) {
                            if (!this.watchedVariables.has(varName)) {
                                try {
                                    await this.addWatchVariable(varName);
                                } catch (error) {
                                    // 忽略添加失败的变量
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn('获取局部变量列表失败:', error);
            }
            
        } catch (error) {
            console.error('自动添加监视变量失败:', error);
        }
    }

    extractVariableNames(varsString) {
        const names = [];
        const regex = /name="([^"]+)"/g;
        let match;
        
        while ((match = regex.exec(varsString)) !== null) {
            const varName = match[1];
            // 过滤掉一些内部变量
            if (!varName.startsWith('__') && !varName.includes('std::') && varName.length < 50) {
                names.push(varName);
            }
        }
        
        return names;
    }

    async updateCallStack() {
        // 检查程序是否已退出
        if (this.programExited || !this.programRunning) {
            console.log('[GDB] 程序已退出，跳过调用栈更新');
            return;
        }
        
        try {
            const response = await this.sendCommand('-stack-list-frames');
            this.parseCallStack(response);
        } catch (error) {
            console.error('更新调用栈失败:', error);
        }
    }

    async addWatchVariable(varName) {
        try {
            this.watchedVariables.add(varName);
            await this.updateWatchVariable(varName);
        } catch (error) {
            console.error(`添加监视变量 ${varName} 失败:`, error);
            this.watchedVariables.delete(varName);
            throw error;
        }
    }

    async removeWatchVariable(varName) {
        this.watchedVariables.delete(varName);
        this.variables.delete(varName);
        
        this.emit('variable-removed', {
            name: varName
        });
    }

    async updateWatchVariable(varName) {
        try {
            this.currentWatchVariable = varName;
            // 只用 -data-evaluate-expression，不请求寄存器
            await this.sendCommand(`-data-evaluate-expression "${varName}"`);
        } catch (error) {
            // 变量可能不存在或超出作用域
            this.variables.delete(varName);
        }
    }

    async expandVariable(varName, maxElements = 100) {
        try {
            const variable = this.variables.get(varName);
            if (!variable) {
                throw new Error(`变量 ${varName} 不存在`);
            }
            
            if (variable.isContainer || variable.isArray) {
                // 只用 -var-create/-var-list-children，不请求寄存器
                await this.sendCommand(`-var-create var_${varName} * "${varName}"`);
                await this.sendCommand(`-var-list-children --all-values var_${varName}`);
            }
            
            variable.expanded = true;
            this.emit('variable-expanded', {
                name: varName,
                data: variable
            });
            
        } catch (error) {
            console.error(`展开变量 ${varName} 失败:`, error);
            throw error;
        }
    }

    async collapseVariable(varName) {
        try {
            const variable = this.variables.get(varName);
            if (!variable) {
                throw new Error(`变量 ${varName} 不存在`);
            }
            
            variable.expanded = false;
            
            this.emit('variable-collapsed', {
                name: varName,
                data: variable
            });
            
        } catch (error) {
            console.error(`收缩变量 ${varName} 失败:`, error);
            throw error;
        }
    }

    async evaluateExpression(expression) {
        try {
            const command = `-data-evaluate-expression ${expression}`;
            return this.sendCommand(command);
        } catch (error) {
            console.error('求值表达式失败:', error);
            throw error;
        }
    }

    async sendInput(input) {
        if (!this.isRunning || !this.gdbProcess) {
            throw new Error('调试器未运行');
        }

        // 发送输入到被调试程序
        this.gdbProcess.stdin.write(input + '\n');
    }

    async stop() {
        if (!this.isRunning || !this.gdbProcess) {
            return;
        }

        try {
            // 发送退出命令
            await this.sendCommand('-gdb-exit');
            
            // 等待进程结束
            await new Promise((resolve) => {
                if (this.gdbProcess) {
                    this.gdbProcess.on('exit', resolve);
                    
                    // 超时强制结束
                    setTimeout(() => {
                        if (this.gdbProcess && !this.gdbProcess.killed) {
                            this.gdbProcess.kill('SIGTERM');
                        }
                        resolve();
                    }, 5000);
                } else {
                    resolve();
                }
            });

        } catch (error) {
            console.error('停止调试器失败:', error);
            
            // 强制结束进程
            if (this.gdbProcess && !this.gdbProcess.killed) {
                this.gdbProcess.kill('SIGKILL');
            }
        } finally {
            this.isRunning = false;
            this.gdbProcess = null;
            this.outputBuffer = '';
            this.breakpoints.clear();
            this.variables.clear();
            this.callStack = [];
        }
    }

    // 获取当前状态
    getBreakpoints() {
        return Array.from(this.breakpoints.entries()).map(([number, bp]) => ({
            number,
            ...bp
        }));
    }

    getVariables() {
        return Array.from(this.variables.entries());
    }

    getCallStack() {
        return this.callStack.map(frame => ({
            level: frame.level || 0,
            function: frame.func || '未知函数',
            file: frame.file || '未知文件',
            line: frame.line ? parseInt(frame.line) : null,
            address: frame.addr || null
        }));
    }

    isDebugging() {
        return this.isRunning;
    }
}

module.exports = GDBDebugger;
