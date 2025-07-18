// 编辑器管理
class EditorManager {
    constructor() {
        this.editors = new Map();
        this.currentEditor = null;
        this.lineNumbers = new Map();
        this.breakpoints = new Set();
        this.autoCompletePopup = null;
        this.autoCompleteData = null;
        this.cppAutoComplete = null; // 添加C++自动补全实例
        this.settings = {
            fontSize: 14,
            tabSize: 4,
            wordWrap: false,
            showLineNumbers: true,
            highlightCurrentLine: true,
            autoCompletion: true,
            bracketMatching: true
        };
        
        this.init();
    }

    init() {
        this.loadSettings(); // 加载设置
        this.setupEventListeners();
        this.initializeEditors();
        this.createAutoCompletePopup();
        this.initializeCppAutoComplete(); // 初始化C++自动补全
    }

    // 加载设置
    loadSettings() {
        if (window.settingsManager) {
            const editorSettings = window.settingsManager.getSettings('editor');
            this.settings = {
                ...this.settings,
                ...editorSettings
            };
        }
    }

    // 初始化C++自动补全系统
    initializeCppAutoComplete() {
        if (typeof CppAutoComplete !== 'undefined') {
            this.cppAutoComplete = new CppAutoComplete();
        }
    }

    setupEventListeners() {
        // 编辑器内容变化事件
        const editors = document.querySelectorAll('.code-editor');
        editors.forEach(editor => {
            editor.addEventListener('input', (e) => {
                this.handleEditorChange(e);
            });

            editor.addEventListener('scroll', (e) => {
                this.handleEditorScroll(e);
            });

            editor.addEventListener('keydown', (e) => {
                this.handleEditorKeyDown(e);
            });

            editor.addEventListener('click', (e) => {
                this.handleEditorClick(e);
            });

            // 自动补全相关事件
            editor.addEventListener('keyup', (e) => {
                this.handleAutoComplete(e);
            });
        });

        // 行号点击事件（设置断点）
        const lineNumbers = document.querySelectorAll('.line-number');
        lineNumbers.forEach(lineNumber => {
            lineNumber.addEventListener('click', (e) => {
                this.toggleBreakpoint(e);
            });
        });

        // 全局事件监听
        document.addEventListener('click', (e) => {
            if (this.autoCompletePopup && !this.autoCompletePopup.contains(e.target)) {
                this.hideAutoComplete();
            }
        });
    }

    initializeEditors() {
        // 初始化所有编辑器
        const editorPanes = document.querySelectorAll('.editor-pane');
        editorPanes.forEach(pane => {
            const editor = pane.querySelector('.code-editor');
            const lineNumberContainer = pane.querySelector('.line-numbers');
            
            if (editor) {
                const fileName = pane.id.replace('editor-', '').replace('-', '.');
                this.editors.set(fileName, {
                    element: editor,
                    lineNumbers: lineNumberContainer,
                    content: editor.value,
                    modified: false,
                    language: this.getLanguageFromFileName(fileName)
                });
                
                // 设置初始行号
                this.updateLineNumbers(fileName);
            }
        });

        // 设置当前编辑器
        const activePane = document.querySelector('.editor-pane.active');
        if (activePane) {
            const fileName = activePane.id.replace('editor-', '').replace('-', '.');
            this.currentEditor = fileName;
        }
    }

    createAutoCompletePopup() {
        this.autoCompletePopup = document.createElement('div');
        this.autoCompletePopup.className = 'autocomplete-popup';
        this.autoCompletePopup.style.display = 'none';
        document.body.appendChild(this.autoCompletePopup);

        // 设置自动补全数据
        this.autoCompleteData = {
            keywords: [
                'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
                'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
                'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static',
                'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
                'class', 'private', 'public', 'protected', 'virtual', 'friend', 'inline',
                'template', 'typename', 'namespace', 'using', 'try', 'catch', 'throw',
                'new', 'delete', 'this', 'operator', 'true', 'false', 'nullptr'
            ],
            functions: [
                'printf', 'scanf', 'cout', 'cin', 'endl', 'flush', 'getline',
                'push_back', 'pop_back', 'size', 'empty', 'clear', 'begin', 'end',
                'insert', 'erase', 'find', 'count', 'sort', 'reverse', 'unique',
                'max', 'min', 'abs', 'sqrt', 'pow', 'sin', 'cos', 'tan', 'log',
                'string', 'vector', 'map', 'set', 'queue', 'stack', 'priority_queue',
                'pair', 'make_pair', 'first', 'second'
            ],
            userCode: new Set()
        };
    }

    handleEditorChange(event) {
        const editor = event.target;
        const pane = editor.closest('.editor-pane');
        const fileName = pane.id.replace('editor-', '').replace('-', '.');
        
        const editorInfo = this.editors.get(fileName);
        if (editorInfo) {
            editorInfo.content = editor.value;
            editorInfo.modified = true;
            
            // 更新行号
            this.updateLineNumbers(fileName);
            
            // 更新标签页状态
            if (window.tabManager) {
                window.tabManager.markTabAsModified(fileName);
            }

            // 更新用户代码词汇
            this.updateUserCodeWords(editor.value);
            
            // 如果有C++自动补全系统，也更新它的代码分析
            if (this.cppAutoComplete) {
                this.cppAutoComplete.analyzeCode(editor.value);
            }
        }
    }

    handleAutoComplete(event) {
        console.log('handleAutoComplete 被调用，事件类型:', event.type);
        
        // 首先检查自动补全是否开启
        if (!this.settings.autoCompletion) {
            console.log('自动补全被禁用');
            this.hideAutoComplete();
            return;
        }

        const editor = event.target;
        const cursorPos = editor.selectionStart;
        const text = editor.value;
        
        // 检查是否应该显示自动补全
        const wordStart = this.getWordStart(text, cursorPos);
        const currentWord = text.substring(wordStart, cursorPos);
        
        console.log('当前输入的词:', currentWord, '长度:', currentWord.length);
        
        // 降低触发阈值，支持更短的前缀
        if (currentWord.length >= 1 && /^[a-zA-Z_#<"]/.test(currentWord)) {
            console.log('触发自动补全，当前词:', currentWord);
            this.showAutoComplete(editor, currentWord, wordStart);
        } else {
            console.log('不触发自动补全，当前词不符合条件');
            this.hideAutoComplete();
        }
    }

    getWordStart(text, pos) {
        let start = pos;
        
        // 检查是否在#include行
        const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
        const lineText = text.substring(lineStart, pos);
        
        if (/^\s*#include/.test(lineText)) {
            // 对于头文件，处理不同情况
            const includeMatch = lineText.match(/^\s*#include\s*(.*)$/);
            if (includeMatch) {
                const afterInclude = includeMatch[1];
                if (afterInclude.includes('<') || afterInclude.includes('"')) {
                    // 已经有 < 或 "，从最后一个分隔符开始
                    while (start > lineStart && !/[<"\s/]/.test(text[start - 1])) {
                        start--;
                    }
                } else {
                    // 还没有 < 或 "，从空格后开始
                    start = lineStart + lineText.indexOf('include') + 'include'.length;
                    while (start < pos && /\s/.test(text[start])) {
                        start++;
                    }
                }
            }
        } else if (text.substring(start - 1, start) === '<') {
            // 如果前面是 <，包含它
            start--;
        } else {
            // 普通标识符
            while (start > 0 && /[a-zA-Z0-9_]/.test(text[start - 1])) {
                start--;
            }
        }
        
        return start;
    }

    showAutoComplete(editor, word, wordStart) {
        console.log('showAutoComplete 被调用，word:', word);
        const suggestions = this.getSuggestions(word, editor);
        console.log('获取到的建议数量:', suggestions.length);
        
        if (suggestions.length === 0) {
            console.log('没有建议，隐藏弹窗');
            this.hideAutoComplete();
            return;
        }

        console.log('显示自动补全弹窗，建议:', suggestions);
        
        // 更新建议列表
        this.updateAutoCompleteList(suggestions, word, editor, wordStart);
        
        // 定位弹出框
        const rect = editor.getBoundingClientRect();
        const lineHeight = parseInt(getComputedStyle(editor).lineHeight);
        
        this.autoCompletePopup.style.display = 'block';
        this.autoCompletePopup.style.left = rect.left + 'px';
        this.autoCompletePopup.style.top = (rect.top + lineHeight) + 'px';
    }

    getSuggestions(word, editorElement = null) {
        console.log('editor.js getSuggestions 被调用，word:', word);
        let suggestions = [];
        
        // 如果有C++自动补全系统，使用它
        if (this.cppAutoComplete) {
            console.log('使用C++自动补全系统');
            // 使用传入的编辑器元素，或者尝试查找
            let editor = editorElement || 
                        document.querySelector('.code-editor') || 
                        document.querySelector('.monaco-editor textarea') ||
                        document.querySelector('textarea');
            
            console.log('找到的编辑器元素:', editor, '类型:', editor?.tagName, '有value属性:', editor?.value !== undefined);
            
            if (editor && editor.value !== undefined) {
                // 分析当前代码
                this.cppAutoComplete.analyzeCode(editor.value);
                
                // 获取当前行和列
                const lines = editor.value.substring(0, editor.selectionStart).split('\n');
                const line = lines.length;
                const column = lines[lines.length - 1].length + 1;
                
                console.log('调用 getSmartSuggestions，参数:', { word, line, column });
                // 获取智能建议
                suggestions = this.cppAutoComplete.getSmartSuggestions(word, line, column, editor.value);
                console.log('从C++自动补全系统获取到建议:', suggestions.length);
            } else {
                console.log('未找到合适的编辑器元素或没有value属性');
            }
        } else {
            console.log('C++自动补全系统未初始化');
        }
        
        // 如果没有智能建议，回退到原有系统
        if (suggestions.length === 0) {
            const lowerWord = word.toLowerCase();
            
            // 关键字匹配
            this.autoCompleteData.keywords.forEach(keyword => {
                if (keyword.toLowerCase().startsWith(lowerWord)) {
                    suggestions.push({
                        text: keyword,
                        type: 'keyword',
                        description: 'C++ 关键字'
                    });
                }
            });
            
            // 函数匹配
            this.autoCompleteData.functions.forEach(func => {
                if (func.toLowerCase().startsWith(lowerWord)) {
                    suggestions.push({
                        text: func,
                        type: 'function',
                        description: 'C++ 函数'
                    });
                }
            });
            
            // 用户代码匹配
            this.autoCompleteData.userCode.forEach(userWord => {
                if (userWord.toLowerCase().startsWith(lowerWord) && userWord !== word) {
                    suggestions.push({
                        text: userWord,
                        type: 'variable',
                        description: '用户定义'
                    });
                }
            });
        }
        
        return suggestions.slice(0, 10); // 限制建议数量
    }

    updateAutoCompleteList(suggestions, word, editor, wordStart) {
        this.autoCompletePopup.innerHTML = '';
        
        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            if (index === 0) item.classList.add('selected');
            
            const text = suggestion.text || suggestion.name;
            const type = suggestion.type;
            const description = suggestion.description || suggestion.desc || suggestion.detail || '';
            
            // 创建图标
            const icon = this.getTypeIcon(type);
            
            item.innerHTML = `
                <div class="item-icon ${type}">${icon}</div>
                <div class="item-content">
                    <div class="item-name">
                        ${this.highlightMatch(text, word)}
                        <span class="item-type">${type}</span>
                    </div>
                    ${description ? `<div class="item-desc">${description}</div>` : ''}
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.insertSuggestion(editor, text, word, wordStart);
                this.hideAutoComplete();
            });
            
            this.autoCompletePopup.appendChild(item);
        });
    }

    // 获取类型对应的图标
    getTypeIcon(type) {
        const icons = {
            'keyword': 'K',
            'function': 'F',
            'method': 'M',
            'variable': 'V',
            'class': 'C',
            'struct': 'S',
            'enum': 'E',
            'module': '#',
            'property': 'P',
            'snippet': '{}',
            'constant': 'C'
        };
        return icons[type] || 'T';
    }

    // 高亮匹配的文本
    highlightMatch(text, word) {
        if (!word) return text;
        const index = text.toLowerCase().indexOf(word.toLowerCase());
        if (index === -1) return text;
        
        return text.substring(0, index) + 
               '<span style="background-color: #094771; color: #ffffff;">' + 
               text.substring(index, index + word.length) + 
               '</span>' + 
               text.substring(index + word.length);
    }

    insertSuggestion(editor, suggestion, word, wordStart) {
        const cursorPos = editor.selectionStart;
        const text = editor.value;
        
        // 根据建议类型决定是否添加空格
        let insertText = suggestion;
        const nextChar = text.charAt(cursorPos);
        const shouldAddSpace = this.shouldAddSpaceAfterSuggestion(suggestion, nextChar);
        
        if (shouldAddSpace) {
            insertText += ' ';
        }
        
        const newText = text.substring(0, wordStart) + insertText + text.substring(cursorPos);
        editor.value = newText;
        editor.selectionStart = editor.selectionEnd = wordStart + insertText.length;
        
        // 触发变化事件
        editor.dispatchEvent(new Event('input'));
    }

    // 判断是否应该在建议后添加空格
    shouldAddSpaceAfterSuggestion(suggestion, nextChar) {
        // 如果下一个字符已经是空格或标点符号，不添加空格
        if (/[\s\(\)\{\}\[\];,\.]/.test(nextChar)) {
            return false;
        }
        
        // 头文件补全不添加空格
        if (suggestion.startsWith('<') || suggestion.startsWith('"') || suggestion.startsWith('#include')) {
            return false;
        }
        
        // 其他情况添加空格，让代码更美观
        return true;
    }

    hideAutoComplete() {
        if (this.autoCompletePopup) {
            this.autoCompletePopup.style.display = 'none';
        }
    }

    updateUserCodeWords(code) {
        // 提取用户代码中的标识符
        const identifiers = code.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g);
        if (identifiers) {
            identifiers.forEach(id => {
                if (id.length >= 3 && !this.autoCompleteData.keywords.includes(id)) {
                    this.autoCompleteData.userCode.add(id);
                }
            });
        }
    }

    selectNextSuggestion() {
        const items = this.autoCompletePopup.querySelectorAll('.autocomplete-item');
        const currentSelected = this.autoCompletePopup.querySelector('.autocomplete-item.selected');
        
        if (currentSelected) {
            currentSelected.classList.remove('selected');
            const nextIndex = Array.from(items).indexOf(currentSelected) + 1;
            if (nextIndex < items.length) {
                items[nextIndex].classList.add('selected');
            } else {
                items[0].classList.add('selected');
            }
        }
    }

    selectPrevSuggestion() {
        const items = this.autoCompletePopup.querySelectorAll('.autocomplete-item');
        const currentSelected = this.autoCompletePopup.querySelector('.autocomplete-item.selected');
        
        if (currentSelected) {
            currentSelected.classList.remove('selected');
            const prevIndex = Array.from(items).indexOf(currentSelected) - 1;
            if (prevIndex >= 0) {
                items[prevIndex].classList.add('selected');
            } else {
                items[items.length - 1].classList.add('selected');
            }
        }
    }

    forceShowAutoComplete(editor) {
        // 即使设置关闭了自动补全，Ctrl+Space也应该能强制显示
        const cursorPos = editor.selectionStart;
        const text = editor.value;
        const wordStart = this.getWordStart(text, cursorPos);
        const currentWord = text.substring(wordStart, cursorPos);
        
        this.showAutoComplete(editor, currentWord, wordStart);
    }

    insertTab(editor) {
        const spaces = ' '.repeat(this.settings.tabSize);
        const cursorPos = editor.selectionStart;
        const text = editor.value;
        
        const newText = text.substring(0, cursorPos) + spaces + text.substring(cursorPos);
        editor.value = newText;
        editor.selectionStart = editor.selectionEnd = cursorPos + spaces.length;
        
        // 触发变化事件
        editor.dispatchEvent(new Event('input'));
    }

    handleEnterKey(editor) {
        const cursorPos = editor.selectionStart;
        const text = editor.value;
        const lines = text.substring(0, cursorPos).split('\n');
        const currentLine = lines[lines.length - 1];
        
        // 计算当前行的缩进
        const indent = currentLine.match(/^\s*/)[0];
        
        // 如果当前行以 { 结尾，增加缩进
        let newIndent = indent;
        if (currentLine.trim().endsWith('{')) {
            newIndent += ' '.repeat(this.settings.tabSize);
        }
        
        // 插入换行和缩进
        setTimeout(() => {
            const newCursorPos = editor.selectionStart;
            const newText = editor.value.substring(0, newCursorPos) + newIndent + editor.value.substring(newCursorPos);
            editor.value = newText;
            editor.selectionStart = editor.selectionEnd = newCursorPos + newIndent.length;
            
            // 触发变化事件
            editor.dispatchEvent(new Event('input'));
        }, 0);
    }

    toggleBreakpoint(event) {
        const lineNumber = event.target;
        const lineNum = parseInt(lineNumber.textContent);
        const fileName = this.currentEditor;
        
        const breakpointId = `${fileName}:${lineNum}`;
        
        if (this.breakpoints.has(breakpointId)) {
            this.breakpoints.delete(breakpointId);
            lineNumber.classList.remove('has-breakpoint');
        } else {
            this.breakpoints.add(breakpointId);
            lineNumber.classList.add('has-breakpoint');
        }
        
        // 通知调试器断点变化
        if (window.debugManager) {
            window.debugManager.updateBreakpoints(Array.from(this.breakpoints));
        }
    }

    getBreakpoints() {
        return Array.from(this.breakpoints);
    }

    clearBreakpoints() {
        this.breakpoints.clear();
        document.querySelectorAll('.line-number.has-breakpoint').forEach(el => {
            el.classList.remove('has-breakpoint');
        });
    }

    handleEditorScroll(event) {
        const editor = event.target;
        const pane = editor.closest('.editor-pane');
        const lineNumbers = pane.querySelector('.line-numbers');
        
        if (lineNumbers) {
            // 同步行号滚动
            lineNumbers.scrollTop = editor.scrollTop;
        }
    }

    handleEditorKeyDown(event) {
        const editor = event.target;
        
        // 处理自动补全快捷键
        if (this.autoCompletePopup && this.autoCompletePopup.style.display === 'block') {
            const selectedItem = this.autoCompletePopup.querySelector('.autocomplete-item.selected');
            
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.selectNextSuggestion();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.selectPrevSuggestion();
            } else if (event.key === 'Tab' || event.key === 'Enter') {
                event.preventDefault();
                if (selectedItem) {
                    selectedItem.click();
                }
            } else if (event.key === 'Escape') {
                this.hideAutoComplete();
            }
            return;
        }
        
        // Tab 键处理
        if (event.key === 'Tab') {
            event.preventDefault();
            this.insertTab(editor);
            return;
        }
        
        // 自动匹配括号
        if (event.key === '(' || event.key === '[' || event.key === '{') {
            this.autoMatchBrackets(editor, event.key);
        }
        
        // 处理回车键自动缩进
        if (event.key === 'Enter') {
            this.handleEnterKey(editor);
        }
        
        // Ctrl+Space 强制显示自动补全 (即使设置中关闭了自动补全)
        if (event.ctrlKey && event.key === ' ') {
            event.preventDefault();
            this.forceShowAutoComplete(editor);
            return;
        }
    }

    handleEditorClick(event) {
        const editor = event.target;
        const pane = editor.closest('.editor-pane');
        const fileName = pane.id.replace('editor-', '').replace('-', '.');
        
        this.currentEditor = fileName;
        this.updateStatusBar();
    }

    autoMatchBrackets(editor, openBracket) {
        const bracketMap = {
            '(': ')',
            '[': ']',
            '{': '}'
        };
        
        const closeBracket = bracketMap[openBracket];
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        
        // 如果有选中文本，用括号包围
        if (start !== end) {
            const selectedText = editor.value.substring(start, end);
            editor.value = editor.value.substring(0, start) + 
                           openBracket + selectedText + closeBracket + 
                           editor.value.substring(end);
            editor.selectionStart = start + 1;
            editor.selectionEnd = start + 1 + selectedText.length;
        } else {
            // 插入匹配的括号
            editor.value = editor.value.substring(0, start) + 
                           openBracket + closeBracket + 
                           editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + 1;
        }
    }

    handleEnterKey(editor) {
        const start = editor.selectionStart;
        const lines = editor.value.substring(0, start).split('\n');
        const currentLine = lines[lines.length - 1];
        
        // 计算缩进
        const indent = currentLine.match(/^\s*/)[0];
        
        // 检查是否需要额外缩进
        let extraIndent = '';
        if (currentLine.trim().endsWith('{') || currentLine.trim().endsWith(':')) {
            extraIndent = ' '.repeat(this.settings.tabSize);
        }
        
        setTimeout(() => {
            const newStart = editor.selectionStart;
            editor.value = editor.value.substring(0, newStart) + 
                           indent + extraIndent + 
                           editor.value.substring(newStart);
            editor.selectionStart = editor.selectionEnd = newStart + indent.length + extraIndent.length;
        }, 0);
    }

    updateLineNumbers(fileName) {
        const editorInfo = this.editors.get(fileName);
        if (!editorInfo) return;
        
        const editor = editorInfo.element;
        const lineContainer = editorInfo.lineNumbers;
        
        if (!lineContainer) return;
        
        const lines = editor.value.split('\n');
        const lineCount = Math.max(lines.length, 10);
        
        lineContainer.innerHTML = '';
        
        for (let i = 1; i <= lineCount; i++) {
            const lineNumber = document.createElement('div');
            lineNumber.className = 'line-number';
            lineNumber.dataset.line = i;
            lineNumber.textContent = i;
            
            // 检查是否有断点
            if (this.breakpoints.has(`${fileName}:${i}`)) {
                lineNumber.classList.add('breakpoint');
            }
            
            lineNumber.addEventListener('click', (e) => {
                this.toggleBreakpoint(e);
            });
            
            lineContainer.appendChild(lineNumber);
        }
    }

    toggleBreakpoint(event) {
        const lineNumber = event.target;
        const line = lineNumber.dataset.line;
        const pane = lineNumber.closest('.editor-pane');
        const fileName = pane.id.replace('editor-', '').replace('-', '.');
        
        const breakpointId = `${fileName}:${line}`;
        
        if (this.breakpoints.has(breakpointId)) {
            // 移除断点
            this.breakpoints.delete(breakpointId);
            lineNumber.classList.remove('breakpoint');
            console.log(`移除断点: ${breakpointId}`);
        } else {
            // 添加断点
            this.breakpoints.add(breakpointId);
            lineNumber.classList.add('breakpoint');
            console.log(`添加断点: ${breakpointId}`);
        }
        
        // 更新状态栏
        this.updateStatusBar();
    }

    getLanguageFromFileName(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const languageMap = {
            'cpp': 'cpp',
            'c': 'c',
            'java': 'java',
            'py': 'python',
            'js': 'javascript',
            'ts': 'typescript',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'xml': 'xml',
            'txt': 'text'
        };
        
        return languageMap[ext] || 'text';
    }

    updateStatusBar() {
        const statusBar = document.querySelector('.status-bar');
        if (!statusBar) return;
        
        const leftStatus = statusBar.querySelector('.status-left');
        const rightStatus = statusBar.querySelector('.status-right');
        
        if (this.currentEditor) {
            const editorInfo = this.editors.get(this.currentEditor);
            if (editorInfo) {
                const editor = editorInfo.element;
                const cursorPosition = this.getCursorPosition(editor);
                const language = this.getLanguageDisplayName(editorInfo.language);
                
                leftStatus.innerHTML = `
                    <span class="status-item">行 ${cursorPosition.line}, 列 ${cursorPosition.column}</span>
                    <span class="status-item">UTF-8</span>
                    <span class="status-item">${language}</span>
                `;
                
                const breakpointCount = Array.from(this.breakpoints).filter(bp => bp.startsWith(this.currentEditor)).length;
                const status = editorInfo.modified ? '● 已修改' : '✓ 就绪';
                
                rightStatus.innerHTML = `
                    <span class="status-item">${status}</span>
                    ${breakpointCount > 0 ? `<span class="status-item">断点: ${breakpointCount}</span>` : ''}
                `;
            }
        }
    }

    getCursorPosition(editor) {
        const text = editor.value;
        const position = editor.selectionStart;
        const lines = text.substring(0, position).split('\n');
        
        return {
            line: lines.length,
            column: lines[lines.length - 1].length + 1
        };
    }

    getLanguageDisplayName(language) {
        const displayNames = {
            'cpp': 'C++',
            'c': 'C',
            'java': 'Java',
            'python': 'Python',
            'javascript': 'JavaScript',
            'typescript': 'TypeScript',
            'html': 'HTML',
            'css': 'CSS',
            'json': 'JSON',
            'xml': 'XML',
            'text': 'Plain Text'
        };
        
        return displayNames[language] || 'Plain Text';
    }

    // 获取当前编辑器内容
    getCurrentContent() {
        if (this.currentEditor) {
            const editorInfo = this.editors.get(this.currentEditor);
            return editorInfo ? editorInfo.content : '';
        }
        return '';
    }

    // 设置编辑器内容
    setContent(fileName, content) {
        const editorInfo = this.editors.get(fileName);
        if (editorInfo) {
            editorInfo.element.value = content;
            editorInfo.content = content;
            editorInfo.modified = false;
            this.updateLineNumbers(fileName);
        }
    }

    // 格式化代码
    formatCode() {
        if (this.currentEditor) {
            console.log(`格式化代码: ${this.currentEditor}`);
            // TODO: 实现代码格式化功能
        }
    }

    // 查找文本
    findText(text, caseSensitive = false) {
        if (this.currentEditor) {
            const editorInfo = this.editors.get(this.currentEditor);
            if (editorInfo) {
                const editor = editorInfo.element;
                const content = caseSensitive ? editor.value : editor.value.toLowerCase();
                const searchText = caseSensitive ? text : text.toLowerCase();
                
                const index = content.indexOf(searchText);
                if (index !== -1) {
                    editor.focus();
                    editor.setSelectionRange(index, index + text.length);
                    return true;
                }
            }
        }
        return false;
    }

    // 替换文本
    replaceText(searchText, replaceText, replaceAll = false) {
        if (this.currentEditor) {
            const editorInfo = this.editors.get(this.currentEditor);
            if (editorInfo) {
                const editor = editorInfo.element;
                if (replaceAll) {
                    editor.value = editor.value.replace(new RegExp(searchText, 'g'), replaceText);
                } else {
                    editor.value = editor.value.replace(searchText, replaceText);
                }
                editorInfo.content = editor.value;
                editorInfo.modified = true;
                this.updateLineNumbers(this.currentEditor);
            }
        }
    }
}

// 初始化编辑器管理器
let editorManager;
document.addEventListener('DOMContentLoaded', () => {
    editorManager = new EditorManager();
    console.log('编辑器管理器已初始化');
});
