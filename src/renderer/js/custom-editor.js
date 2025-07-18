// 自研代码编辑器
class CustomEditor {
    constructor(container, options = {}) {
        console.log('初始化自研编辑器，容器:', container, '选项:', options);
        
        this.container = container;
        // 编辑器ID从容器ID中提取，确保唯一性
        this.editorId = container.id;
        // 如果选项中提供了tabId，使用它；否则从容器ID中提取
        this.tabId = options.tabId || container.id.replace('editor-', '');
        
        console.log(`编辑器ID: ${this.editorId}, 标签页ID: ${this.tabId}`);
        this.options = {
            language: 'cpp',
            theme: 'dark',
            fontSize: 14,
            tabSize: 4,
            wordWrap: false,
            showLineNumbers: true,
            highlightCurrentLine: true,
            autoCompletion: true,
            bracketMatching: true,
            ...options
        };
        
        this.content = '';
        this.cursorPosition = { line: 0, column: 0 };
        this.selection = { start: null, end: null };
        this.breakpoints = new Set();
        this.decorations = new Map();
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSize = 100;
        
        console.log(`创建新的CustomEditor实例，编辑器ID: ${this.editorId}，标签页ID: ${this.tabId}，撤销栈已初始化`);
        
        // 自动补全相关
        this.autoCompletePopup = null;
        this.autoCompleteData = [];
        this.isAutoCompleteVisible = false;
        this.currentAutoCompleteMatches = [];
        this.currentAutoCompleteWord = '';
        
        // 查找替换
        this.findDialog = null;
        this.replaceDialog = null;
        this.searchResults = [];
        this.currentSearchIndex = -1;
        
        // 文件状态
        this.isModified = false;
        this.currentFileName = 'untitled.cpp';
        this.filePath = null; // 实际文件路径
        this.tempFilePath = null; // 临时文件路径
        
        this.isModified = false; // 文件修改状态
        
        this.init();
        
        console.log('自研编辑器初始化完成');
    }

    init() {
        console.log('开始初始化自研编辑器...');
        try {
            this.createEditor();
            this.setupEventListeners();
            this.initializeAutoComplete();
            this.initializeTheme();
            this.loadCppKeywords();
            this.setupCppAutoComplete();
            console.log('自研编辑器初始化完成');
        } catch (error) {
            console.error('自研编辑器初始化失败:', error);
        }
    }

    createEditor() {
        console.log('创建编辑器HTML结构...');
        
        // 清空容器
        this.container.innerHTML = '';
        
        // 为每个编辑器实例生成唯一的ID前缀
        const uniqueId = this.tabId.replace(/[^a-zA-Z0-9]/g, '_');
        
        // 创建编辑器结构
        const editorWrapper = document.createElement('div');
        editorWrapper.className = 'custom-editor-wrapper';
        
        editorWrapper.innerHTML = `
            <div class="editor-header">
                <div class="current-file-info">
                    <span class="file-name" id="currentFileName_${uniqueId}">untitled.cpp</span>
                    <span class="file-status" id="fileStatus_${uniqueId}"></span>
                </div>
            </div>
            <div class="editor-content">
                <div class="line-numbers" id="lineNumbers_${uniqueId}"></div>
                <div class="code-area">
                    <textarea class="code-input" id="codeInput_${uniqueId}" spellcheck="false" placeholder="" tabindex="0"></textarea>
                    <div class="syntax-highlight" id="syntaxHighlight_${uniqueId}"></div>
                    <div class="cursor-line" id="cursorLine_${uniqueId}"></div>
                </div>
            </div>
            <div class="editor-footer">
                <div class="editor-info">
                    <span class="cursor-info" id="cursorInfo_${uniqueId}">行 1, 列 1</span>
                    <span class="encoding-info">UTF-8</span>
                    <span class="language-info">C++</span>
                </div>
            </div>
        `;
        
        this.container.appendChild(editorWrapper);
        
        console.log('编辑器HTML结构创建完成');

        // 获取DOM元素引用，使用唯一ID
        this.lineNumbersEl = this.container.querySelector(`#lineNumbers_${uniqueId}`);
        this.codeInputEl = this.container.querySelector(`#codeInput_${uniqueId}`);
        this.syntaxHighlightEl = this.container.querySelector(`#syntaxHighlight_${uniqueId}`);
        this.cursorLineEl = this.container.querySelector(`#cursorLine_${uniqueId}`);
        this.cursorInfoEl = this.container.querySelector(`#cursorInfo_${uniqueId}`);
        
        console.log(`编辑器 ${this.editorId} DOM元素引用获取完成，唯一ID前缀: ${uniqueId}:`, {
            lineNumbers: this.lineNumbersEl,
            codeInput: this.codeInputEl,
            syntaxHighlight: this.syntaxHighlightEl,
            cursorLine: this.cursorLineEl,
            cursorInfo: this.cursorInfoEl
        });
        
        // 初始化行号
        this.updateLineNumbers();
        
        // 初始化语法高亮
        this.updateSyntaxHighlight();
        
        // 自动获得焦点
        setTimeout(() => {
            if (this.codeInputEl) {
                this.codeInputEl.focus();
                console.log(`编辑器 ${this.editorId} 已自动获得焦点`);
            }
        }, 100);
        
        // // 定期内容清理已移除，由输入事件统一处理
        
        console.log('编辑器DOM结构初始化完成');
    }

    setupEventListeners() {
        // 确保DOM元素存在后再添加事件监听器
        if (!this.codeInputEl) {
            console.error('代码输入框元素未找到，无法设置事件监听器');
            return;
        }
        
        if (!this.lineNumbersEl) {
            console.error('行号元素未找到，无法设置事件监听器');
            return;
        }

        // 代码输入事件
        this.codeInputEl.addEventListener('input', (e) => {
            this.handleInput(e);
        });

        this.codeInputEl.addEventListener('keydown', (e) => {
            console.log(`键盘事件在编辑器 ${this.editorId} 上触发:`, e.key, e.ctrlKey);
            this.handleKeyDown(e);
            // 阻止事件冒泡，确保快捷键只在当前编辑器中处理
            if (e.ctrlKey && (e.key === 'z' || e.key === 'y' || e.key === 's' || e.key === 'g')) {
                console.log(`阻止 ${e.key} 事件冒泡，编辑器ID: ${this.editorId}`);
                e.stopPropagation();
            }
        });

        this.codeInputEl.addEventListener('keyup', (e) => {
            this.handleKeyUp(e);
        });

        this.codeInputEl.addEventListener('scroll', (e) => {
            this.handleScroll(e);
        });

        this.codeInputEl.addEventListener('click', (e) => {
            this.handleClick(e);
        });

        this.codeInputEl.addEventListener('focus', (e) => {
            console.log(`编辑器 ${this.editorId} 获得焦点`);
            // 设置为当前活跃编辑器
            if (window.editorManager) {
                window.editorManager.currentEditor = this;
                window.editorManager.currentTabId = this.tabId;
            }
        });

        this.codeInputEl.addEventListener('blur', (e) => {
            console.log(`编辑器 ${this.editorId} 失去焦点`);
            // 隐藏自动补全
            this.hideAutoComplete();
        });

        this.codeInputEl.addEventListener('select', (e) => {
            this.handleSelection(e);
        });

        // 控制按钮事件已移除，因为工具栏按钮已被删除
        // 查找替换功能现在通过快捷键和菜单访问

        // 行号点击事件（设置断点）
        this.lineNumbersEl.addEventListener('click', (e) => {
            this.handleLineNumberClick(e);
        });
    }

    handleInput(e) {
        // 获取实际的文本内容（不包含HTML标签）
        let newContent = this.codeInputEl.value;
        
        // 只有在检测到真正的HTML污染时才清理
        if (newContent.includes('class=') || (newContent.includes('<span') && newContent.includes('</span>'))) {
            console.warn('检测到HTML标签污染，进行清理');
            const cleanContent = this.cleanHtmlContaminatedContent(newContent);
            
            if (cleanContent !== newContent) {
                // 内容被清理，更新输入框
                this.codeInputEl.value = cleanContent;
                newContent = cleanContent;
                
                // 重新定位光标到末尾
                this.codeInputEl.selectionStart = this.codeInputEl.selectionEnd = cleanContent.length;
            }
        }
        
        // 确保内容同步
        this.content = newContent;
        
        // 标记文件为已修改
        this.markAsModified();
        
        // 延迟更新语法高亮，确保DOM更新完成
        setTimeout(() => {
            this.updateSyntaxHighlight();
            this.updateLineNumbers();
            this.updateCursorInfo();
        }, 0);
        
        this.saveToUndoStack();
        
        // 触发自动补全
        if (this.options.autoCompletion) {
            this.triggerAutoComplete();
        }
    }

    handleKeyDown(e) {
        // 首先检查这个编辑器是否是当前活跃的编辑器
        if (window.editorManager && window.editorManager.currentEditor !== this) {
            console.log(`键盘事件被非活跃编辑器接收，编辑器ID: ${this.editorId}，当前活跃编辑器: ${window.editorManager.currentEditor ? window.editorManager.currentEditor.editorId : '无'}，忽略处理`);
            return;
        }
        
        // 检查事件目标是否是当前编辑器的输入元素
        if (e.target !== this.codeInputEl) {
            console.log(`键盘事件目标不是当前编辑器的输入元素，编辑器ID: ${this.editorId}，忽略处理`);
            return;
        }
        
        console.log(`处理键盘事件，编辑器ID: ${this.editorId}，标签页ID: ${this.tabId}，按键: ${e.key}，Ctrl: ${e.ctrlKey}`);
        
        // 处理自动补全键盘事件
        if (this.isAutoCompleteVisible) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.selectNextAutoCompleteItem();
                    return;
                case 'ArrowUp':
                    e.preventDefault();
                    this.selectPrevAutoCompleteItem();
                    return;
                case 'Enter':
                case 'Tab':
                    e.preventDefault();
                    this.acceptAutoCompleteSelection();
                    return;
                case 'Escape':
                    e.preventDefault();
                    this.hideAutoComplete();
                    return;
                default:
                    // 对于其他键，延迟触发自动补全，但不阻止后续处理
                    setTimeout(() => this.triggerAutoComplete(), 10);
                    // 继续执行后面的逻辑，包括括号匹配
                    break;
            }
        }
        
        // 处理特殊键盘事件（查找功能现在由全局find-replace.js处理）
        if (e.ctrlKey) {
            switch (e.key) {
                case 'g':
                    e.preventDefault();
                    this.showGotoDialog();
                    break;
                case 'z':
                    e.preventDefault();
                    console.log(`Ctrl+Z 被按下，编辑器ID: ${this.editorId}，标签页ID: ${this.tabId}`);
                    this.undo();
                    break;
                case 'y':
                    e.preventDefault();
                    console.log(`Ctrl+Y 被按下，编辑器ID: ${this.editorId}，标签页ID: ${this.tabId}`);
                    this.redo();
                    break;
                case 's':
                    e.preventDefault();
                    this.save();
                    break;
                case ' ':
                    e.preventDefault();
                    this.triggerAutoComplete();
                    break;
            }
        } else {
            // 处理特殊按键
            switch (e.key) {
                case 'Tab':
                    e.preventDefault();
                    this.insertTab();
                    break;
                case 'Enter':
                    // 自动缩进
                    this.handleEnterKey(e);
                    break;
            }
            
            // 括号匹配
            if (this.options.bracketMatching) {
                this.handleBracketInput(e);
            }
        }
    }

    handleKeyUp(e) {
        this.updateCursorInfo();
    }

    handleScroll(e) {
        // 同步滚动语法高亮和行号
        this.syntaxHighlightEl.scrollTop = this.codeInputEl.scrollTop;
        this.syntaxHighlightEl.scrollLeft = this.codeInputEl.scrollLeft;
        this.lineNumbersEl.scrollTop = this.codeInputEl.scrollTop;
    }

    handleClick(e) {
        this.updateCursorInfo();
        this.hideAutoComplete();
    }

    handleSelection(e) {
        this.updateCursorInfo();
    }

    handleLineNumberClick(e) {
        const lineNumber = parseInt(e.target.dataset.line);
        if (lineNumber) {
            this.toggleBreakpoint(lineNumber);
        }
    }

    updateSyntaxHighlight() {
        if (!this.syntaxHighlightEl) return;
        
        // 确保使用实际的文本内容，绝不使用HTML内容
        const actualContent = this.codeInputEl ? this.codeInputEl.value : this.content;
        
        console.log(`更新语法高亮，编辑器内容长度: ${this.content ? this.content.length : 0}，输入框内容长度: ${this.codeInputEl ? this.codeInputEl.value.length : 0}，实际使用内容长度: ${actualContent.length}`);
        
        // 如果内容和输入框不一致，强制同步
        if (this.content !== actualContent) {
            console.warn(`内容不一致！编辑器内容: "${this.content}"，输入框内容: "${actualContent}"`);
            this.content = actualContent; // 以输入框内容为准
        }
        
        // 检查内容是否被污染（包含HTML标签）
        if (actualContent.includes('class=') || (actualContent.includes('<span') && actualContent.includes('</span>'))) {
            console.error('检测到内容被HTML污染，停止语法高亮更新');
            return;
        }
        
        if (actualContent) {
            // 确保内容是纯文本
            const textContent = typeof actualContent === 'string' ? actualContent : String(actualContent);
            const highlightedCode = this.highlightSyntax(textContent);
            
            // 只更新语法高亮容器，不影响输入框
            this.syntaxHighlightEl.innerHTML = highlightedCode;
            console.log('语法高亮HTML已生成，HTML长度:', highlightedCode.length);
        } else {
            this.syntaxHighlightEl.innerHTML = '';
        }
        
        console.log('语法高亮已更新完成');
    }

    highlightSyntax(code) {
        if (!code) return '';
        
        let textCode = typeof code === 'string' ? code : String(code);

        const rules = [
            { pattern: /\/\/.*$/gm, class: 'comment' },
            { pattern: /\/\*[\s\S]*?\*\//g, class: 'comment' },
            { pattern: /"([^"\\]|\\.)*"/g, class: 'string' },
            { pattern: /'([^'\\]|\\.)*'/g, class: 'string' },
            { pattern: /#\s*(include|define|undef|ifdef|ifndef|if|else|elif|endif|error|pragma|line)\b.*$/gm, class: 'preprocessor' },
            { pattern: /\b(class|struct|enum|union)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, class: 'type', group: 2 }, // Types
            { pattern: /\b(alignas|alignof|and|and_eq|asm|auto|bitand|bitor|bool|break|case|catch|char|char16_t|char32_t|class|compl|const|constexpr|const_cast|continue|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|not|not_eq|nullptr|operator|or|or_eq|private|protected|public|register|reinterpret_cast|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while|xor|xor_eq)\b/g, class: 'keyword' },
            { pattern: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, class: 'function', group: 1 }, // Functions
            { pattern: /\b\d+(\.\d+)?([eE][+-]?\d+)?[flFLdD]?\b/g, class: 'number' },
            { pattern: /(\+\+|--|<<|>>|<=|>=|==|!=|&&|\|\||[+\-*/%=<>!&|^~])/g, class: 'operator' }, // Operators
        ];

        let tokens = [];
        rules.forEach((rule, priority) => {
            rule.pattern.lastIndex = 0;
            let match;
            while ((match = rule.pattern.exec(textCode))) {
                const groupIndex = rule.group || 0;
                if (match[groupIndex] === undefined) continue;
                const startIndex = match.index + match[0].indexOf(match[groupIndex]);
                const token = {
                    start: startIndex,
                    end: startIndex + match[groupIndex].length,
                    class: rule.class,
                    priority: priority
                };
                tokens.push(token);
            }
        });

        tokens.sort((a, b) => a.start - b.start || a.priority - b.priority);

        const filteredTokens = [];
        let lastEnd = 0;
        for (const token of tokens) {
            if (token.start >= lastEnd) {
                filteredTokens.push(token);
                lastEnd = token.end;
            }
        }

        let result = '';
        lastEnd = 0;
        for (const token of filteredTokens) {
            result += this.escapeHtml(textCode.substring(lastEnd, token.start));
            result += `<span class="${token.class}">${this.escapeHtml(textCode.substring(token.start, token.end))}</span>`;
            lastEnd = token.end;
        }
        result += this.escapeHtml(textCode.substring(lastEnd));

        return result;
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    updateLineNumbers() {
        // 确保使用实际的文本内容
        const actualContent = this.codeInputEl ? this.codeInputEl.value : this.content;
        const lines = actualContent.split('\n');
        
        // 确保至少有一行
        if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
            lines[0] = '';
        }
        
        const lineNumbersHtml = lines.map((line, index) => {
            const lineNumber = index + 1;
            const hasBreakpoint = this.breakpoints.has(lineNumber);
            return `<div class="line-number${hasBreakpoint ? ' breakpoint' : ''}" data-line="${lineNumber}">${lineNumber}</div>`;
        }).join('');
        
        this.lineNumbersEl.innerHTML = lineNumbersHtml;
    }

    updateCursorInfo() {
        const textarea = this.codeInputEl;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPos);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length;
        const currentColumn = lines[lines.length - 1].length + 1;
        
        this.cursorPosition = { line: currentLine, column: currentColumn };
        this.cursorInfoEl.textContent = `行 ${currentLine}, 列 ${currentColumn}`;
    }

    // 自动补全相关方法
    initializeAutoComplete() {
        // 创建自动补全弹窗
        this.autoCompletePopup = document.createElement('div');
        this.autoCompletePopup.className = 'autocomplete-popup';
        this.autoCompletePopup.style.display = 'none';
        document.body.appendChild(this.autoCompletePopup);
    }

    loadCppKeywords() {
        // 加载C++关键字
        this.autoCompleteData = [
            'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor', 'bool', 'break',
            'case', 'catch', 'char', 'char16_t', 'char32_t', 'class', 'compl', 'const', 'constexpr',
            'const_cast', 'continue', 'decltype', 'default', 'delete', 'do', 'double', 'dynamic_cast',
            'else', 'enum', 'explicit', 'export', 'extern', 'false', 'float', 'for', 'friend', 'goto',
            'if', 'inline', 'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'not', 'not_eq',
            'nullptr', 'operator', 'or', 'or_eq', 'private', 'protected', 'public', 'register',
            'reinterpret_cast', 'return', 'short', 'signed', 'sizeof', 'static', 'static_assert',
            'static_cast', 'struct', 'switch', 'template', 'this', 'thread_local', 'throw', 'true',
            'try', 'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void',
            'volatile', 'wchar_t', 'while', 'xor', 'xor_eq'
        ];
    }

    setupCppAutoComplete() {
        // 初始化 C++ 自动补全系统
        if (window.CppAutoComplete) {
            this.cppAutoComplete = new CppAutoComplete();
            
            // 定期分析代码，提取用户定义的符号
            this.codeAnalysisTimer = setInterval(() => {
                if (this.content) {
                    this.cppAutoComplete.analyzeCode(this.content);
                }
            }, 2000); // 每2秒分析一次
        }
    }

    triggerAutoComplete() {
        const textarea = this.codeInputEl;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPos);
        
        // 获取当前单词 - 优先检查头文件自动补全
        let currentWord = '';
        let isHeaderCompletion = false;
        
        // 首先检查是否在输入头文件（以 < 开头）
        const headerMatch = textBeforeCursor.match(/#include\s*<[^>]*$/);
        if (headerMatch) {
            // 提取 < 后面的部分作为当前单词
            const headerPart = headerMatch[0].match(/<([^>]*)$/);
            if (headerPart) {
                currentWord = '<' + headerPart[1];
                isHeaderCompletion = true;
            }
        }
        
        // 如果不是头文件补全，检查普通单词
        if (!isHeaderCompletion) {
            const wordMatch = textBeforeCursor.match(/[a-zA-Z_#][a-zA-Z0-9_]*$/);
            if (wordMatch) {
                currentWord = wordMatch[0];
            }
        }
        
        if (currentWord.length < 1) {
            this.hideAutoComplete();
            return;
        }
        
        // 使用增强的C++自动补全系统
        let matches = [];
        
        if (this.cppAutoComplete) {
            // 获取当前行和列
            const textBeforeCursorLines = textBeforeCursor.split('\n');
            const currentLine = textBeforeCursorLines.length;
            const currentColumn = textBeforeCursorLines[textBeforeCursorLines.length - 1].length + 1;
            
            // 获取智能建议
            const suggestions = this.cppAutoComplete.getSmartSuggestions(
                currentWord, 
                currentLine, 
                currentColumn, 
                this.content
            );
            
            matches = suggestions.map(s => ({
                text: s.text,
                type: s.type,
                description: s.description || ''
            }));
        } else {
            // 增强的基本自动补全
            matches = this.getEnhancedAutoComplete(currentWord);
        }
        
        if (matches.length === 0) {
            this.hideAutoComplete();
            return;
        }
        
        this.showAutoComplete(matches, currentWord);
    }

    getEnhancedAutoComplete(currentWord) {
        const word = currentWord.toLowerCase();
        const matches = [];
        
        // 头文件自动补全 - 优先处理
        if (currentWord.startsWith('<')) {
            const commonHeaders = [
                { name: 'iostream', description: 'C++标准输入输出流' },
                { name: 'vector', description: '动态数组容器' },
                { name: 'string', description: '字符串类' },
                { name: 'algorithm', description: '算法库' },
                { name: 'map', description: '关联容器(映射)' },
                { name: 'set', description: '关联容器(集合)' },
                { name: 'queue', description: '队列容器' },
                { name: 'stack', description: '栈容器' },
                { name: 'deque', description: '双端队列容器' },
                { name: 'list', description: '链表容器' },
                { name: 'cmath', description: '数学函数库' },
                { name: 'cstdio', description: 'C标准输入输出' },
                { name: 'cstdlib', description: 'C标准库' },
                { name: 'cstring', description: 'C字符串操作' },
                { name: 'cctype', description: '字符分类函数' },
                { name: 'climits', description: '数值限制常量' },
                { name: 'cfloat', description: '浮点数限制' },
                { name: 'cassert', description: '断言宏' },
                { name: 'ctime', description: '时间处理函数' },
                { name: 'functional', description: '函数对象和绑定' },
                { name: 'numeric', description: '数值算法' },
                { name: 'iterator', description: '迭代器库' },
                { name: 'utility', description: '实用工具' },
                { name: 'memory', description: '内存管理' },
                { name: 'fstream', description: '文件流' },
                { name: 'sstream', description: '字符串流' },
                { name: 'iomanip', description: '输入输出格式化' },
                { name: 'bitset', description: '位集合' },
                { name: 'unordered_map', description: '无序映射' },
                { name: 'unordered_set', description: '无序集合' }
            ];
            
            // 提取搜索词（去掉 < 符号）
            const searchTerm = currentWord.substring(1).toLowerCase();
            
            console.log(`头文件补全：当前单词="${currentWord}"，搜索词="${searchTerm}"`);
            
            commonHeaders.forEach(header => {
                const headerName = header.name.toLowerCase();
                
                // 如果搜索词为空（只输入了 <），显示所有头文件
                // 否则进行模糊匹配：开头匹配优先，然后是包含匹配
                if (searchTerm === '' || headerName.startsWith(searchTerm) || headerName.includes(searchTerm)) {
                    matches.push({
                        text: '<' + header.name + '>',
                        type: 'header',
                        description: header.description,
                        searchTerm: searchTerm,
                        headerName: headerName
                    });
                }
            });
            
            // 按相关性排序：开头匹配的排在前面，然后按字母顺序
            matches.sort((a, b) => {
                const aStartsWith = a.headerName.startsWith(searchTerm);
                const bStartsWith = b.headerName.startsWith(searchTerm);
                
                if (aStartsWith && !bStartsWith) return -1;
                if (!aStartsWith && bStartsWith) return 1;
                
                return a.headerName.localeCompare(b.headerName);
            });
            
            console.log(`头文件补全结果：找到${matches.length}个匹配项`);
            return matches.slice(0, 15);
        }
        
        // 基础关键字
        const keywords = [
            'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor', 'bool', 'break',
            'case', 'catch', 'char', 'char16_t', 'char32_t', 'class', 'compl', 'const', 'constexpr',
            'const_cast', 'continue', 'decltype', 'default', 'delete', 'do', 'double', 'dynamic_cast',
            'else', 'enum', 'explicit', 'export', 'extern', 'false', 'float', 'for', 'friend', 'goto',
            'if', 'inline', 'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'not', 'not_eq',
            'nullptr', 'operator', 'or', 'or_eq', 'private', 'protected', 'public', 'register',
            'reinterpret_cast', 'return', 'short', 'signed', 'sizeof', 'static', 'static_assert',
            'static_cast', 'struct', 'switch', 'template', 'this', 'thread_local', 'throw', 'true',
            'try', 'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void',
            'volatile', 'wchar_t', 'while', 'xor', 'xor_eq'
        ];
        
        // 标准库函数
        const stdFunctions = [
            'cout', 'cin', 'cerr', 'clog', 'endl', 'ends', 'flush',
            'printf', 'scanf', 'sprintf', 'sscanf', 'fprintf', 'fscanf',
            'strlen', 'strcpy', 'strncpy', 'strcat', 'strncat', 'strcmp', 'strncmp',
            'malloc', 'calloc', 'realloc', 'free',
            'memset', 'memcpy', 'memmove', 'memcmp',
            'abs', 'labs', 'fabs', 'ceil', 'floor', 'round', 'sqrt', 'pow',
            'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
            'exp', 'log', 'log10', 'rand', 'srand', 'time',
            'vector', 'string', 'map', 'set', 'unordered_map', 'unordered_set',
            'push_back', 'pop_back', 'size', 'empty', 'clear', 'begin', 'end',
            'find', 'insert', 'erase', 'sort', 'reverse', 'unique'
        ];
        
        // 常用代码片段
        const snippets = [
            { text: 'main()', type: 'snippet', description: 'int main() { return 0; }' },
            { text: 'for()', type: 'snippet', description: 'for(int i = 0; i < n; i++) {}' },
            { text: 'while()', type: 'snippet', description: 'while(condition) {}' },
            { text: 'if()', type: 'snippet', description: 'if(condition) {}' },
            { text: 'else', type: 'snippet', description: 'else {}' },
            { text: 'switch()', type: 'snippet', description: 'switch(variable) { case: break; }' },
            { text: '#include', type: 'snippet', description: '#include <iostream>' },
            { text: 'using namespace std;', type: 'snippet', description: 'using namespace std;' }
        ];
        
        // 匹配关键字
        keywords.forEach(keyword => {
            if (keyword.startsWith(word)) {
                matches.push({
                    text: keyword,
                    type: 'keyword',
                    description: 'C++ 关键字'
                });
            }
        });
        
        // 匹配标准库函数
        stdFunctions.forEach(func => {
            if (func.startsWith(word)) {
                matches.push({
                    text: func,
                    type: 'function',
                    description: '标准库函数'
                });
            }
        });
        
        // 匹配代码片段
        snippets.forEach(snippet => {
            if (snippet.text.toLowerCase().startsWith(word)) {
                matches.push(snippet);
            }
        });
        
        // 从当前代码中提取用户定义的符号
        const userSymbols = this.extractUserSymbols();
        userSymbols.forEach(symbol => {
            if (symbol.toLowerCase().startsWith(word)) {
                matches.push({
                    text: symbol,
                    type: 'variable',
                    description: '用户定义'
                });
            }
        });
        
        return matches.slice(0, 20); // 限制结果数量
    }

    extractUserSymbols() {
        const symbols = new Set();
        const content = this.content;
        
        // 提取函数名
        const functionPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
        let match;
        while ((match = functionPattern.exec(content)) !== null) {
            symbols.add(match[1]);
        }
        
        // 提取变量名
        const varPattern = /\b(?:int|float|double|char|bool|string|vector|map|set)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        while ((match = varPattern.exec(content)) !== null) {
            symbols.add(match[1]);
        }
        
        return Array.from(symbols);
    }

    showAutoComplete(matches, currentWord) {
        const textarea = this.codeInputEl;
        const rect = textarea.getBoundingClientRect();
        const cursorPos = this.getCursorScreenPosition();
        
        // 过滤掉空的或无效的匹配项
        const validMatches = matches.filter(match => match && match.text && match.text.trim() !== '');
        
        if (validMatches.length === 0) {
            this.hideAutoComplete();
            return;
        }
        
        console.log(`显示自动补全：有效匹配项${validMatches.length}个，当前单词="${currentWord}"`);
        
        const htmlContent = validMatches.map((match, index) => {
            const typeClass = match.type ? `type-${match.type}` : '';
            const icon = this.getTypeIcon(match.type);
            const text = match.text || '';
            const description = match.description || '';
            
            console.log(`生成补全项 ${index}：文本="${text}"，描述="${description}"，类型="${match.type}"`);
            
            // 确保文本内容被正确转义和显示
            const escapedText = this.escapeHtml(text);
            const escapedDescription = this.escapeHtml(description);
            
            console.log(`转义后 - 文本: "${escapedText}", 描述: "${escapedDescription}"`);
            
            // 使用更安全的方式生成HTML，确保文本内容不被隐藏
            const itemHtml = `<div class="autocomplete-item ${typeClass}${index === 0 ? ' selected' : ''}" data-index="${index}">
                ${icon}<span class="item-text">${escapedText}</span>
                ${description ? `<span class="item-description">${escapedDescription}</span>` : ''}
            </div>`;
            
            console.log(`生成HTML项 ${index}:`, itemHtml);
            return itemHtml;
        }).join('');
        
        console.log('完整HTML内容:', htmlContent);
        this.autoCompletePopup.innerHTML = htmlContent;
        
        this.autoCompletePopup.style.left = `${cursorPos.x}px`;
        this.autoCompletePopup.style.top = `${cursorPos.y + 20}px`;
        this.autoCompletePopup.style.display = 'block';
        
        this.isAutoCompleteVisible = true;
        this.currentAutoCompleteMatches = validMatches;
        this.currentAutoCompleteWord = currentWord;
        
        // 移除之前的点击事件监听器，避免重复绑定
        const oldHandler = this.autoCompletePopup._clickHandler;
        if (oldHandler) {
            this.autoCompletePopup.removeEventListener('click', oldHandler);
        }
        
        // 添加新的点击事件
        const clickHandler = (e) => {
            const item = e.target.closest('.autocomplete-item');
            if (item) {
                const index = parseInt(item.dataset.index);
                this.selectAutoCompleteItem(index);
            }
        };
        this.autoCompletePopup._clickHandler = clickHandler;
        this.autoCompletePopup.addEventListener('click', clickHandler);
    }

    getTypeIcon(type) {
        const icons = {
            'keyword': '🔑',
            'function': '⚡',
            'variable': '📦',
            'snippet': '✨',
            'header': '📄',
            'class': '🏗️',
            'method': '🔧',
            'property': '🔗'
        };
        return icons[type] || '📄';
    }

    getCursorScreenPosition() {
        const textarea = this.codeInputEl;
        const rect = textarea.getBoundingClientRect();
        
        // 创建隐藏的测量元素
        const measureEl = document.createElement('div');
        measureEl.style.position = 'absolute';
        measureEl.style.visibility = 'hidden';
        measureEl.style.whiteSpace = 'pre';
        measureEl.style.font = getComputedStyle(textarea).font;
        measureEl.style.padding = getComputedStyle(textarea).padding;
        measureEl.style.border = getComputedStyle(textarea).border;
        measureEl.style.lineHeight = getComputedStyle(textarea).lineHeight;
        
        const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
        measureEl.textContent = textBeforeCursor;
        
        document.body.appendChild(measureEl);
        
        const x = rect.left + measureEl.offsetWidth;
        const y = rect.top + measureEl.offsetHeight;
        
        document.body.removeChild(measureEl);
        
        return { x, y };
    }

    selectNextAutoCompleteItem() {
        const items = this.autoCompletePopup.querySelectorAll('.autocomplete-item');
        const selectedItem = this.autoCompletePopup.querySelector('.autocomplete-item.selected');
        
        if (selectedItem) {
            selectedItem.classList.remove('selected');
            const currentIndex = Array.from(items).indexOf(selectedItem);
            const nextIndex = (currentIndex + 1) % items.length;
            items[nextIndex].classList.add('selected');
        }
    }

    selectPrevAutoCompleteItem() {
        const items = this.autoCompletePopup.querySelectorAll('.autocomplete-item');
        const selectedItem = this.autoCompletePopup.querySelector('.autocomplete-item.selected');
        
        if (selectedItem) {
            selectedItem.classList.remove('selected');
            const currentIndex = Array.from(items).indexOf(selectedItem);
            const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
            items[prevIndex].classList.add('selected');
        }
    }

    acceptAutoCompleteSelection() {
        const selectedItem = this.autoCompletePopup.querySelector('.autocomplete-item.selected');
        if (selectedItem) {
            const index = parseInt(selectedItem.dataset.index);
            this.selectAutoCompleteItem(index);
        }
    }

    selectAutoCompleteItem(index) {
        const match = this.currentAutoCompleteMatches[index];
        if (!match) return;
        
        const textarea = this.codeInputEl;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPos);
        const textAfterCursor = textarea.value.substring(cursorPos);
        
        console.log(`选择自动补全项：${match.text}，当前单词：${this.currentAutoCompleteWord}`);
        
        let before, newText, newCursorPos;
        
        // 如果是头文件补全
        if (match.type === 'header' && this.currentAutoCompleteWord.startsWith('<')) {
            // 找到 #include < 的位置
            const includeMatch = textBeforeCursor.match(/#include\s*<[^>]*$/);
            if (includeMatch) {
                const includeStart = textBeforeCursor.lastIndexOf(includeMatch[0]);
                const beforeInclude = textBeforeCursor.substring(0, includeStart);
                
                // 替换整个 #include <...> 部分
                before = beforeInclude;
                const includeText = includeMatch[0].replace(/<[^>]*$/, match.text);
                newText = before + includeText + textAfterCursor;
                newCursorPos = before.length + includeText.length;
            } else {
                // 降级处理：按普通单词处理
                const wordStart = textBeforeCursor.lastIndexOf(this.currentAutoCompleteWord);
                before = textBeforeCursor.substring(0, wordStart);
                newText = before + match.text + textAfterCursor;
                newCursorPos = wordStart + match.text.length;
            }
        } else {
            // 普通单词补全
            const wordStart = textBeforeCursor.lastIndexOf(this.currentAutoCompleteWord);
            before = textBeforeCursor.substring(0, wordStart);
            newText = before + match.text + textAfterCursor;
            newCursorPos = wordStart + match.text.length;
        }
        
        textarea.value = newText;
        textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        
        this.content = newText;
        this.markAsModified();
        this.updateSyntaxHighlight();
        this.updateLineNumbers();
        this.hideAutoComplete();
        
        console.log(`自动补全完成：插入"${match.text}"，光标位置：${newCursorPos}`);
    }

    hideAutoComplete() {
        this.autoCompletePopup.style.display = 'none';
        this.isAutoCompleteVisible = false;
        this.currentAutoCompleteMatches = [];
        this.currentAutoCompleteWord = '';
    }

    showFindDialog() {
        // 已弃用：查找功能现在由全局find-replace.js处理
        console.log('showFindDialog被调用，但已被全局查找替换功能取代');
        return;
    }
    
    showReplaceDialog() {
        // 已弃用：替换功能现在由全局find-replace.js处理
        console.log('showReplaceDialog被调用，但已被全局查找替换功能取代');
        return;
    }
    
    async showGotoDialog() {
        try {
            const lineNumber = await dialogManager.showGotoLineDialog();
            if (lineNumber && !isNaN(lineNumber)) {
                this.gotoLine(parseInt(lineNumber));
            }
        } catch (error) {
            console.error('跳转行时出错:', error);
        }
    }
    
    findNext() {
        // 已弃用：查找功能现在由全局find-replace.js处理
        console.log('findNext被调用，但已被全局查找替换功能取代');
        return;
    }
    
    findPrev() {
        // 已弃用：查找功能现在由全局find-replace.js处理
        console.log('findPrev被调用，但已被全局查找替换功能取代');
        return;
    }
    
    replaceOne() {
        // 已弃用：替换功能现在由全局find-replace.js处理
        console.log('replaceOne被调用，但已被全局查找替换功能取代');
        return;
    }
    
    replaceAll() {
        // 已弃用：替换功能现在由全局find-replace.js处理
        console.log('replaceAll被调用，但已被全局查找替换功能取代');
        return;
    }
    
    gotoLine(lineNumber) {
        const lines = this.codeInputEl.value.split('\n');
        if (lineNumber > 0 && lineNumber <= lines.length) {
            let charIndex = 0;
            for (let i = 0; i < lineNumber - 1; i++) {
                charIndex += lines[i].length + 1; // +1 for newline
            }
            
            this.codeInputEl.selectionStart = charIndex;
            this.codeInputEl.selectionEnd = charIndex;
            this.codeInputEl.focus();
        }
    }
    
    // 公共方法：获取选中的文本
    getSelectedText() {
        const textarea = this.codeInputEl;
        return textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    }

    // 公共方法：获取编辑器内容，仅返回纯文本
    getValue() {
        return this.codeInputEl ? this.codeInputEl.value : this.content;
    }

    // 公共方法：设置编辑器内容，支持纯文本输入
    setValue(content, markAsSaved = false, preserveUndoStack = false) {
        // 只有在内容明确包含HTML污染时才清理
        let textContent = content;
        if (typeof content === 'string' && (content.includes('class=') || (content.includes('<span') && content.includes('</span>')))) {
            console.warn(`检测到HTML污染，原内容长度: ${content.length}`);
            textContent = this.cleanHtmlContaminatedContent(content);
            console.warn(`清理后内容长度: ${textContent.length}`);
        }
        
        console.log(`setValue被调用，编辑器ID: ${this.editorId}，标签页ID: ${this.tabId}，原内容长度: ${content ? content.length : 0}，处理后长度: ${textContent.length}，markAsSaved: ${markAsSaved}，preserveUndoStack: ${preserveUndoStack}`);
        
        // 如果需要保留撤销栈，先保存当前内容
        if (preserveUndoStack && this.content && this.content !== textContent) {
            this.saveToUndoStack();
        }
        
        if (this.codeInputEl) {
            console.log(`设置textarea.value，之前长度: ${this.codeInputEl.value.length}，新长度: ${textContent.length}`);
            this.codeInputEl.value = textContent;
            console.log(`设置完成，实际textarea.value长度: ${this.codeInputEl.value.length}`);
            
            // 关键修复：确保 this.content 与实际 textarea.value 同步
            this.content = this.codeInputEl.value;
            console.log(`强制同步后，this.content长度: ${this.content.length}`);
            
            if (this.content.trim()) {
                this.codeInputEl.placeholder = '';
            }
        } else {
            // 如果没有DOM元素，直接设置内容
            this.content = textContent;
        }
        
        // 如果明确标记为已保存，则重置修改状态
        if (markAsSaved) {
            this.markAsSaved();
        }
        
        this.updateSyntaxHighlight();
        this.updateLineNumbers();
        this.updateCursorInfo();
    }

    // 公共方法：刷新编辑器显示
    refresh() {
        console.log(`刷新编辑器 ${this.editorId} 显示`);
        if (this.codeInputEl) {
            // 强制更新显示
            this.updateSyntaxHighlight();
            this.updateLineNumbers();
            this.updateCursorInfo();
            
            // 确保内容同步 - 关键修复：强制重新设置textarea的值
            if (this.content !== this.codeInputEl.value) {
                console.log(`强制同步编辑器内容，内容长度: ${this.content.length}，当前textarea长度: ${this.codeInputEl.value.length}`);
                this.codeInputEl.value = this.content;
                console.log(`同步后textarea长度: ${this.codeInputEl.value.length}`);
            }
            
            // 确保文件头部标题也被更新 - 修复标签页切换时标题不更新的问题
            this.updateFileName(this.currentFileName, this.isModified);
            console.log(`已更新编辑器头部标题: ${this.currentFileName}, 修改状态: ${this.isModified}`);
        }
    }

    // 公共方法：聚焦编辑器
    focus() {
        if (this.codeInputEl) {
            this.codeInputEl.focus();
        }
    }

    // 验证并清理编辑器内容，防止 HTML 污染
    validateAndFixContent() {
        if (!this.codeInputEl) return false;
        const current = this.codeInputEl.value;
        const cleaned = this.cleanHtmlContaminatedContent(current);
        if (cleaned !== current) {
            this.codeInputEl.value = cleaned;
            this.content = cleaned;
            this.updateSyntaxHighlight();
            this.updateLineNumbers();
            this.updateCursorInfo();
            return true;
        }
        return false;
    }

    // 可选：检查代码污染状态
    checkContentContamination() {
        if (!this.codeInputEl) return { contaminated: false };
        const value = this.codeInputEl.value;
        return { contaminated: /<[^>]+>/.test(value) };
    }

    destroy() {
        if (this.autoCompletePopup) {
            this.autoCompletePopup.remove();
        }
        if (this.findDialog) {
            this.findDialog.remove();
        }
        if (this.replaceDialog) {
            this.replaceDialog.remove();
        }
        if (this.codeAnalysisTimer) {
            clearInterval(this.codeAnalysisTimer);
        }
        this.container.innerHTML = '';
    }

    // 调试方法：验证内容同步
    debugContentSync() {
        const textareaContent = this.codeInputEl ? this.codeInputEl.value : '';
        const storedContent = this.content;
        const syntaxContent = this.syntaxHighlightEl ? this.syntaxHighlightEl.textContent : '';
        
        console.log('===== 内容同步调试 =====');
        console.log('Textarea内容长度:', textareaContent.length);
        console.log('存储内容长度:', storedContent.length);
        console.log('语法高亮内容长度:', syntaxContent.length);
        console.log('内容是否同步:', textareaContent === storedContent);
        
        if (textareaContent !== storedContent) {
            console.warn('内容不同步!');
            console.log('Textarea前100字符:', textareaContent.substring(0, 100));
            console.log('存储前100字符:', storedContent.substring(0, 100));
        }
        
        return {
            textareaContent,
            storedContent,
            syntaxContent,
            isSync: textareaContent === storedContent
        };
    }

    // 调试语法高亮
    debugSyntaxHighlight() {
        const actualContent = this.codeInputEl ? this.codeInputEl.value : this.content;
        console.log('=== 语法高亮调试信息 ===');
        console.log('原始内容:', actualContent);
        console.log('转义后内容:', this.escapeHtml(actualContent));
        console.log('高亮后内容:', this.highlightSyntax(actualContent));
        console.log('syntaxHighlightEl.innerHTML:', this.syntaxHighlightEl.innerHTML);
        console.log('========================');
    }
    
    initializeTheme() {
        // 初始化主题
        this.container.classList.remove('dark-theme', 'light-theme', 'theme-dark', 'theme-light');
        
        const theme = this.options.theme || 'dark';
        const themeClass = theme === 'light' ? 'theme-light' : 'theme-dark';
        this.container.classList.add(themeClass);
        this.container.setAttribute('data-theme', theme);
        
        console.log('编辑器主题初始化:', theme, '，CSS类:', themeClass);
    }
    
    updateSettings(newSettings) {
        // 更新编辑器设置
        console.log('更新自研编辑器设置:', newSettings);
        
        if (!newSettings) return;
        
        // 备份旧设置
        const oldSettings = { ...this.options };
        
        // 处理不同的设置格式
        let settingsToApply = {};
        
        if (newSettings.editor) {
            // 嵌套格式: {editor: {...}}
            settingsToApply = newSettings.editor;
        } else if (newSettings.theme || newSettings.font || newSettings.fontSize !== undefined || 
                   newSettings.enableAutoCompletion !== undefined) {
            // 扁平格式: {theme: 'light', font: 'Monaco', ...}
            settingsToApply = {
                theme: newSettings.theme,
                font: newSettings.font,
                fontSize: newSettings.fontSize,
                autoCompletion: newSettings.enableAutoCompletion,
                tabSize: newSettings.tabSize,
                wordWrap: newSettings.wordWrap,
                showLineNumbers: newSettings.showLineNumbers
            };
        } else {
            // 直接格式
            settingsToApply = newSettings;
        }
        
        // 更新设置
        this.options = { ...this.options, ...settingsToApply };
        
        // 应用主题变更
        if (oldSettings.theme !== this.options.theme) {
            this.container.classList.remove('dark-theme', 'light-theme', 'theme-dark', 'theme-light');
            const themeClass = this.options.theme === 'light' ? 'theme-light' : 'theme-dark';
            this.container.classList.add(themeClass);
            
            // 同时更新全局主题属性，确保编辑器内的所有元素都能感知主题
            this.container.setAttribute('data-theme', this.options.theme);
            console.log('主题已更新为:', this.options.theme, '，CSS类:', themeClass);
        }
        
        // 应用字体设置
        if (oldSettings.font !== this.options.font || oldSettings.fontSize !== this.options.fontSize) {
            if (this.codeInputEl) {
                this.codeInputEl.style.fontFamily = this.options.font || 'Consolas, "Courier New", monospace';
                this.codeInputEl.style.fontSize = (this.options.fontSize || 14) + 'px';
            }
            if (this.syntaxHighlightEl) {
                this.syntaxHighlightEl.style.fontFamily = this.options.font || 'Consolas, "Courier New", monospace';
                this.syntaxHighlightEl.style.fontSize = (this.options.fontSize || 14) + 'px';
            }
            console.log('字体设置已更新:', { font: this.options.font, fontSize: this.options.fontSize });
        }
        
        // 应用标签页大小设置
        if (oldSettings.tabSize !== this.options.tabSize && this.codeInputEl) {
            // 更新标签页大小（通过CSS变量或样式）
            this.codeInputEl.style.tabSize = this.options.tabSize || 4;
            if (this.syntaxHighlightEl) {
                this.syntaxHighlightEl.style.tabSize = this.options.tabSize || 4;
            }
            console.log('标签页大小已更新为:', this.options.tabSize);
        }
        
        // 应用自动换行设置
        if (oldSettings.wordWrap !== this.options.wordWrap && this.codeInputEl) {
            this.codeInputEl.style.whiteSpace = this.options.wordWrap ? 'pre-wrap' : 'pre';
            if (this.syntaxHighlightEl) {
                this.syntaxHighlightEl.style.whiteSpace = this.options.wordWrap ? 'pre-wrap' : 'pre';
            }
            console.log('自动换行已更新为:', this.options.wordWrap);
        }
        
        // 应用行号显示设置
        if (oldSettings.showLineNumbers !== this.options.showLineNumbers) {
            const lineNumbersEl = this.container.querySelector('.line-numbers');
            if (lineNumbersEl) {
                lineNumbersEl.style.display = this.options.showLineNumbers ? 'block' : 'none';
            }
            console.log('行号显示已更新为:', this.options.showLineNumbers);
        }
        
        // 重新应用语法高亮
        this.updateSyntaxHighlight();
        
        console.log('编辑器设置更新完成');
    }
    
    cleanHtmlContaminatedContent(content) {
        if (!content) return '';
        
        // 如果内容是字符串，检查是否包含HTML标签污染
        if (typeof content === 'string') {
            // 只有当检测到真正的HTML标签时才清理（包含class、span等HTML属性）
            if (content.includes('class=') || (content.includes('<span') && content.includes('</span>'))) {
                console.warn('检测到HTML标签污染，清理内容');
                // 移除HTML标签，但保留文本内容
                const cleanContent = content.replace(/<[^>]+>/g, '');
                // 解码HTML实体
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cleanContent;
                return tempDiv.textContent || tempDiv.innerText || '';
            }
            // 如果没有HTML污染，直接返回原内容
            return content;
        }
        
        return String(content);
    }
    
    insertTab() {
        const textarea = this.codeInputEl;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const spaces = ' '.repeat(this.options.tabSize);
        
        // 保存到撤销栈
        this.saveToUndoStack();
        
        // 插入制表符（使用空格）
        const newValue = textarea.value.substring(0, start) + spaces + textarea.value.substring(end);
        textarea.value = newValue;
        this.content = newValue;
        
        // 移动光标位置
        textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
        
        // 更新界面
        this.updateSyntaxHighlight();
        this.updateLineNumbers();
        this.markAsModified();
        
        console.log(`插入Tab缩进，编辑器ID: ${this.editorId}，位置: ${start}-${end}，缩进长度: ${spaces.length}`);
    }
    
    handleEnterKey(e) {
        e.preventDefault();
        
        const textarea = this.codeInputEl;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        // 获取当前行的缩进
        const textBeforeCursor = textarea.value.substring(0, start);
        const textAfterCursor = textarea.value.substring(end);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines[lines.length - 1];
        const indent = currentLine.match(/^\s*/)[0];
        
        // 检查光标后面是否紧跟着 }
        const nextCharIsCloseBrace = textAfterCursor.trimStart().startsWith('}');
        
        // 如果当前行以 { 结尾，增加缩进
        let newIndent = indent;
        let insertText = '\n' + newIndent;
        
        if (currentLine.trim().endsWith('{')) {
            newIndent += ' '.repeat(this.options.tabSize);
            insertText = '\n' + newIndent;
            
            // 如果光标后面有 }，自动添加匹配的缩进行
            if (nextCharIsCloseBrace) {
                insertText += '\n' + indent;
            }
        }
        
        // 保存到撤销栈
        this.saveToUndoStack();
        
        // 插入换行和缩进
        const newValue = textarea.value.substring(0, start) + insertText + textarea.value.substring(end);
        textarea.value = newValue;
        this.content = newValue;
        
        // 移动光标位置
        let cursorPos = start + 1 + newIndent.length;
        textarea.selectionStart = textarea.selectionEnd = cursorPos;
        
        // 更新界面
        this.updateSyntaxHighlight();
        this.updateLineNumbers();
        this.markAsModified();
        
        console.log(`处理回车键，编辑器ID: ${this.editorId}，新缩进: "${newIndent}"`);
    }
    
    handleBracketInput(e) {
        const bracketPairs = {
            '(': ')',
            '[': ']',
            '{': '}',
            '"': '"',
            "'": "'"
        };
        
        const inputChar = e.key;
        
        // 处理右括号的自动缩进
        if (inputChar === '}') {
            this.handleCloseBrace(e);
            return;
        }
        
        // 处理左括号的自动配对
        if (bracketPairs[inputChar]) {
            // 隐藏自动补全面板
            this.hideAutoComplete();
            
            const textarea = this.codeInputEl;
            const cursorPos = textarea.selectionStart;
            const textBefore = textarea.value.substring(0, cursorPos);
            const textAfter = textarea.value.substring(cursorPos);
            
            // 插入配对的括号
            const newText = textBefore + inputChar + bracketPairs[inputChar] + textAfter;
            textarea.value = newText;
            textarea.selectionStart = textarea.selectionEnd = cursorPos + 1;
            
            this.content = newText;
            this.updateSyntaxHighlight();
            
            e.preventDefault();
        }
    }
    
    handleCloseBrace(e) {
        const textarea = this.codeInputEl;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPos);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines[lines.length - 1];
        
        // 检查当前行是否只有空白字符
        const isLineOnlyWhitespace = currentLine.trim() === '';
        
        if (isLineOnlyWhitespace && lines.length > 1) {
            // 找到正确的缩进级别（减少一级缩进）
            const previousLines = lines.slice(0, -1);
            let targetIndent = '';
            
            // 从前面的行中寻找匹配的缩进级别
            for (let i = previousLines.length - 1; i >= 0; i--) {
                const line = previousLines[i];
                if (line.trim() !== '') {
                    const lineIndent = line.match(/^\s*/)[0];
                    // 如果这行包含开括号，使用这行的缩进
                    if (line.includes('{')) {
                        targetIndent = lineIndent;
                        break;
                    }
                    // 否则，尝试减少一级缩进
                    if (lineIndent.length >= this.options.tabSize) {
                        targetIndent = lineIndent.substring(this.options.tabSize);
                        break;
                    }
                }
            }
            
            // 保存到撤销栈
            this.saveToUndoStack();
            
            // 替换当前行的缩进并添加 }
            const lineStart = textBeforeCursor.lastIndexOf('\n') + 1;
            const newText = textarea.value.substring(0, lineStart) + targetIndent + '}' + textarea.value.substring(cursorPos);
            
            textarea.value = newText;
            this.content = newText;
            
            // 移动光标到 } 后面
            textarea.selectionStart = textarea.selectionEnd = lineStart + targetIndent.length + 1;
            
            // 更新界面
            this.updateSyntaxHighlight();
            this.updateLineNumbers();
            this.markAsModified();
            
            e.preventDefault();
            console.log(`自动调整}的缩进，目标缩进: "${targetIndent}"`);
        }
    }
    
    toggleBreakpoint(lineNumber) {
        if (this.breakpoints.has(lineNumber)) {
            this.breakpoints.delete(lineNumber);
        } else {
            this.breakpoints.add(lineNumber);
        }
        this.updateLineNumbers();
    }
    
    saveToUndoStack() {
        if (this.content !== this.undoStack[this.undoStack.length - 1]) {
            this.undoStack.push(this.content);
            console.log(`保存到撤销栈，编辑器ID: ${this.editorId}，标签页ID: ${this.tabId}，内容长度: ${this.content.length}，撤销栈长度: ${this.undoStack.length}`);
            if (this.undoStack.length > this.maxUndoSize) {
                this.undoStack.shift();
                console.log(`撤销栈超出最大长度，移除最旧的记录`);
            }
            this.redoStack = []; // 清空重做栈
        }
    }
    
    undo() {
        console.log(`执行撤销操作，编辑器ID: ${this.editorId}，标签页ID: ${this.tabId}，当前撤销栈长度: ${this.undoStack.length}`);
        if (this.undoStack.length > 1) {
            this.redoStack.push(this.undoStack.pop());
            const prevContent = this.undoStack[this.undoStack.length - 1];
            console.log(`撤销到内容长度: ${prevContent.length}，撤销栈剩余: ${this.undoStack.length}`);
            this.setValue(prevContent);
        } else {
            console.log('撤销栈为空或只有一个元素，无法撤销');
        }
    }
    
    redo() {
        console.log(`执行重做操作，编辑器ID: ${this.editorId}，当前重做栈长度: ${this.redoStack.length}`);
        if (this.redoStack.length > 0) {
            const nextContent = this.redoStack.pop();
            this.undoStack.push(nextContent);
            console.log(`重做到内容长度: ${nextContent.length}，重做栈剩余: ${this.redoStack.length}`);
            this.setValue(nextContent);
        } else {
            console.log('重做栈为空，无法重做');
        }
    }
    
    async save() {
        const content = this.getValue();
        
        try {
            if (this.filePath) {
                // 已存在的文件，直接保存
                console.log(`直接保存文件: ${this.filePath}`);
                if (window.electronAPI && window.electronAPI.saveFile) {
                    await window.electronAPI.saveFile(this.filePath, content);
                    await this.markAsSaved();
                    console.log(`文件保存成功: ${this.filePath}`);
                } else {
                    console.error('electronAPI.saveFile 不可用');
                }
            } else {
                // 新文件，需要另存为
                console.log('新文件，触发另存为对话框');
                if (window.electronAPI && window.electronAPI.saveAsFile) {
                    const savedPath = await window.electronAPI.saveAsFile(content);
                    if (savedPath) {
                        this.setFilePath(savedPath);
                        await this.markAsSaved();
                        console.log(`文件另存为成功: ${savedPath}`);
                    }
                } else {
                    console.error('electronAPI.saveAsFile 不可用');
                }
            }
        } catch (error) {
            console.error('保存文件失败:', error);
        }
        
        // 触发保存事件
        const event = new CustomEvent('editor-save', {
            detail: {
                content: content,
                editor: this,
                filePath: this.filePath
            }
        });
        this.container.dispatchEvent(event);
    }

    // 标记文件为已修改
    markAsModified() {
        if (!this.isModified) {
            this.isModified = true;
            this.updateFileStatus();
            
            // 通知编辑器管理器更新标签页状态
            if (window.oicppApp && window.oicppApp.editorManager && window.oicppApp.editorManager.updateTabModifiedStatus) {
                window.oicppApp.editorManager.updateTabModifiedStatus(this.tabId, true);
            }
        }
    }

    // 标记文件为已保存
    async markAsSaved() {
        if (this.isModified) {
            console.log(`标记文件为已保存，编辑器ID: ${this.editorId}，删除临时文件`);
            this.isModified = false;
            this.updateFileStatus();
            
            // 通知编辑器管理器更新标签页状态
            if (window.oicppApp && window.oicppApp.editorManager && window.oicppApp.editorManager.updateTabModifiedStatus) {
                window.oicppApp.editorManager.updateTabModifiedStatus(this.tabId, false);
            }
            
            // 保存后删除临时文件
            try {
                await this.deleteTempFile();
                console.log(`临时文件删除成功，编辑器ID: ${this.editorId}`);
            } catch (error) {
                console.error(`删除临时文件失败，编辑器ID: ${this.editorId}:`, error);
            }
        }
    }

    // 更新文件状态显示
    updateFileStatus() {
        // 使用唯一ID查找元素，与updateFileName方法保持一致
        const uniqueId = this.tabId.replace(/[^a-zA-Z0-9]/g, '_');
        const fileStatusEl = this.container.querySelector(`#fileStatus_${uniqueId}`);
        
        console.log(`updateFileStatus调用: 编辑器${this.editorId}, 修改状态: ${this.isModified}, 找到状态元素: ${!!fileStatusEl}`);
        
        if (fileStatusEl) {
            const oldText = fileStatusEl.textContent;
            const newText = this.isModified ? ' *' : '';
            fileStatusEl.textContent = newText;
            fileStatusEl.className = this.isModified ? 'file-status modified' : 'file-status';
            console.log(`文件状态元素更新: "${oldText}" -> "${newText}"`);
        } else {
            console.error(`无法找到文件状态元素: #fileStatus_${uniqueId}`);
        }
    }

    // 更新文件名显示
    updateFileName(fileName, isModified = false) {
        this.currentFileName = fileName || 'untitled.cpp';
        this.isModified = isModified;
        
        console.log(`updateFileName调用: 编辑器${this.editorId}, 文件名: ${this.currentFileName}, 修改状态: ${this.isModified}`);
        
        // 使用唯一ID查找元素
        const uniqueId = this.tabId.replace(/[^a-zA-Z0-9]/g, '_');
        console.log(`查找DOM元素，tabId: ${this.tabId}, uniqueId: ${uniqueId}`);
        
        const fileNameEl = this.container.querySelector(`#currentFileName_${uniqueId}`);
        const fileStatusEl = this.container.querySelector(`#fileStatus_${uniqueId}`);
        
        console.log(`DOM元素查找结果: fileNameEl=${!!fileNameEl}, fileStatusEl=${!!fileStatusEl}`);
        
        if (fileNameEl) {
            const oldText = fileNameEl.textContent;
            fileNameEl.textContent = this.currentFileName;
            console.log(`文件名元素更新: "${oldText}" -> "${this.currentFileName}"`);
        } else {
            console.error(`无法找到文件名元素: #currentFileName_${uniqueId}`);
        }
        
        if (fileStatusEl) {
            const oldText = fileStatusEl.textContent;
            const newText = this.isModified ? ' *' : '';
            fileStatusEl.textContent = newText;
            fileStatusEl.className = this.isModified ? 'file-status modified' : 'file-status';
            console.log(`文件状态元素更新: "${oldText}" -> "${newText}"`);
        } else {
            console.error(`无法找到文件状态元素: #fileStatus_${uniqueId}`);
        }
   }

    // 临时文件管理
    generateTempFilePath() {
        if (!this.filePath) {
            // 对于新文件，使用 tabId 作为临时文件名
            return `user/.oicpp/codeTemp/${this.tabId}.temp`;
        } else {
            // 对于已存在的文件，使用文件路径的哈希作为临时文件名
            const fileName = this.filePath.replace(/[\\/:*?"<>|]/g, '_');
            return `user/.oicpp/codeTemp/${fileName}.temp`;
        }
    }

    async saveToTempFile() {
        // 只有在文件真正被修改且有内容时才保存临时文件
        if (!this.isModified || !this.content || this.content.trim() === '') {
            console.log(`跳过临时文件保存，修改状态: ${this.isModified}，内容长度: ${this.content ? this.content.length : 0}`);
            return;
        }

        this.tempFilePath = this.generateTempFilePath();
        console.log(`保存临时文件: ${this.tempFilePath}，内容长度: ${this.content.length}`);
        
        try {
            if (window.electronAPI && window.electronAPI.saveTempFile) {
                await window.electronAPI.saveTempFile(this.tempFilePath, this.content);
                console.log(`临时文件保存成功: ${this.tempFilePath}`);
            }
        } catch (error) {
            console.error('保存临时文件失败:', error);
        }
    }

    async loadFromTempFile() {
        // 只有在编辑器已被修改的情况下才尝试加载临时文件
        if (!this.isModified) {
            console.log(`编辑器 ${this.editorId} 未被修改，跳过临时文件加载`);
            return false;
        }
        
        if (!this.tempFilePath) {
            this.tempFilePath = this.generateTempFilePath();
        }

        console.log(`尝试加载临时文件: ${this.tempFilePath}`);
        
        try {
            if (window.electronAPI && window.electronAPI.loadTempFile) {
                const tempContent = await window.electronAPI.loadTempFile(this.tempFilePath);
                if (tempContent !== null && tempContent !== undefined) {
                    console.log(`临时文件加载成功，内容长度: ${tempContent.length}`);
                    this.setValue(tempContent, false, true); // 不标记为已保存，但保留撤销栈
                    this.isModified = true;
                    return true;
                }
            }
        } catch (error) {
            console.log('加载临时文件失败或不存在:', error.message);
        }
        return false;
    }

    async deleteTempFile() {
        if (!this.tempFilePath) {
            return;
        }

        console.log(`删除临时文件: ${this.tempFilePath}`);
        
        try {
            if (window.electronAPI && window.electronAPI.deleteTempFile) {
                await window.electronAPI.deleteTempFile(this.tempFilePath);
                console.log(`临时文件删除成功: ${this.tempFilePath}`);
                this.tempFilePath = null;
            }
        } catch (error) {
            console.error('删除临时文件失败:', error);
        }
    }

    // 设置文件路径
    setFilePath(filePath) {
        this.filePath = filePath;
        if (filePath) {
            const fileName = filePath.split('\\').pop() || filePath.split('/').pop();
            this.currentFileName = fileName;
            this.updateFileName(fileName, this.isModified);
        }
    }

    // 获取文件路径
    getFilePath() {
        return this.filePath;
    }
}

// 导出编辑器类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CustomEditor;
} else {
    window.CustomEditor = CustomEditor;
    
    // 添加全局调试函数
    window.debugEditor = function() {
        if (window.oicppApp && window.oicppApp.editorManager) {
            const currentEditor = window.oicppApp.editorManager.getCurrentEditor();
            if (currentEditor && currentEditor.debugContentSync) {
                return currentEditor.debugContentSync();
            } else {
                console.log('没有找到当前编辑器或调试方法');
            }
        } else {
            console.log('没有找到编辑器管理器');
        }
    };
    
    // 添加内容污染检查函数
    window.checkEditorContamination = function() {
        if (window.oicppApp && window.oicppApp.editorManager) {
            const currentEditor = window.oicppApp.editorManager.getCurrentEditor();
            if (currentEditor && currentEditor.checkContentContamination) {
                return currentEditor.checkContentContamination();
            } else {
                console.log('没有找到当前编辑器或检查方法');
            }
        } else {
            console.log('没有找到编辑器管理器');
        }
    };
}
