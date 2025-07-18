// 查找替换功能管理器
class FindReplaceManager {
    constructor(editor) {
        this.editor = editor;
        this.panel = null;
        this.isVisible = false;
        this.searchResults = [];
        this.currentIndex = -1;
        this.searchOptions = {
            matchCase: false,
            wholeWord: false,
            useRegex: false
        };
        this.isTyping = false; // 新增：标记是否正在输入
        
        this.init();
    }

    init() {
        // 延迟查找面板，确保DOM完全加载
        const tryInitPanel = () => {
            this.panel = document.getElementById('find-replace-panel');
            if (!this.panel) {
                console.warn('查找替换面板未找到，正在重试...');
                // 如果面板未找到，等待一段时间后重试
                setTimeout(tryInitPanel, 100);
                return;
            }

            console.log('查找替换面板已找到，开始初始化');
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            this.syncOptionsFromUI(); // 新增：同步UI选项状态
        };

        // 如果DOM已经加载，立即尝试
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', tryInitPanel);
        } else {
            tryInitPanel();
        }
    }

    // 新增：同步UI选项状态到内部状态
    syncOptionsFromUI() {
        const matchCaseCheckbox = document.getElementById('match-case');
        if (matchCaseCheckbox) {
            this.searchOptions.matchCase = matchCaseCheckbox.checked;
            console.log('同步大小写敏感选项:', this.searchOptions.matchCase);
        }

        const wholeWordCheckbox = document.getElementById('match-whole-word');
        if (wholeWordCheckbox) {
            this.searchOptions.wholeWord = wholeWordCheckbox.checked;
            console.log('同步整词匹配选项:', this.searchOptions.wholeWord);
        }

        const useRegexCheckbox = document.getElementById('use-regex');
        if (useRegexCheckbox) {
            this.searchOptions.useRegex = useRegexCheckbox.checked;
            console.log('同步正则表达式选项:', this.searchOptions.useRegex);
        }
    }

    setupEventListeners() {
        // 关闭按钮
        const closeBtn = document.getElementById('close-find-replace');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // 查找输入框
        const findInput = document.getElementById('find-input');
        if (findInput) {
            console.log('绑定查找输入框事件监听器');
            findInput.addEventListener('input', (e) => {
                console.log('查找输入框输入事件触发，值:', e.target.value);
                this.isTyping = true; // 标记正在输入
                this.onFindInputChange();
                // 短时间后清除输入状态
                setTimeout(() => {
                    this.isTyping = false;
                }, 200);
            });
            findInput.addEventListener('keydown', (e) => this.onFindInputKeydown(e));
            
            // 新增：当输入框获得焦点时，确保不跳转到编辑器
            findInput.addEventListener('focus', () => {
                this.isTyping = true;
                setTimeout(() => {
                    this.isTyping = false;
                }, 300);
            });
        } else {
            console.warn('未找到查找输入框元素');
        }

        // 替换输入框
        const replaceInput = document.getElementById('replace-input');
        if (replaceInput) {
            replaceInput.addEventListener('keydown', (e) => this.onReplaceInputKeydown(e));
        }

        // 查找按钮
        const findPrevBtn = document.getElementById('find-prev');
        if (findPrevBtn) {
            findPrevBtn.addEventListener('click', () => {
                this.isTyping = false; // 确保按钮点击时不是输入状态
                this.findPrevious();
            });
        }

        const findNextBtn = document.getElementById('find-next');
        if (findNextBtn) {
            findNextBtn.addEventListener('click', () => {
                this.isTyping = false; // 确保按钮点击时不是输入状态
                this.findNext();
            });
        }

        // 替换按钮
        const replaceOneBtn = document.getElementById('replace-one');
        if (replaceOneBtn) {
            replaceOneBtn.addEventListener('click', () => this.replaceOne());
        }

        const replaceAllBtn = document.getElementById('replace-all');
        if (replaceAllBtn) {
            replaceAllBtn.addEventListener('click', () => this.replaceAll());
        }

        // 选项复选框
        const matchCaseCheckbox = document.getElementById('match-case');
        if (matchCaseCheckbox) {
            matchCaseCheckbox.addEventListener('change', (e) => {
                this.searchOptions.matchCase = e.target.checked;
                console.log('大小写敏感选项变更为:', this.searchOptions.matchCase);
                this.performSearch();
            });
        }

        const wholeWordCheckbox = document.getElementById('match-whole-word');
        if (wholeWordCheckbox) {
            wholeWordCheckbox.addEventListener('change', (e) => {
                this.searchOptions.wholeWord = e.target.checked;
                console.log('整词匹配选项变更为:', this.searchOptions.wholeWord);
                this.performSearch();
            });
        }

        const useRegexCheckbox = document.getElementById('use-regex');
        if (useRegexCheckbox) {
            useRegexCheckbox.addEventListener('change', (e) => {
                this.searchOptions.useRegex = e.target.checked;
                console.log('正则表达式选项变更为:', this.searchOptions.useRegex);
                this.performSearch();
            });
        }
    }

    setupKeyboardShortcuts() {
        // 确保只添加一次全局键盘监听器
        if (window.findReplaceKeyboardHandlerAdded) {
            return;
        }
        
        window.findReplaceKeyboardHandlerAdded = true;
        
        document.addEventListener('keydown', (e) => {
            // 确保findReplaceManager存在才处理快捷键
            if (!findReplaceManager) return;
            
            // Ctrl+F 打开查找
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                findReplaceManager.show();
                return;
            }

            // Ctrl+H 打开查找替换
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                findReplaceManager.show();
                return;
            }

            // ESC 关闭面板
            if (e.key === 'Escape' && findReplaceManager.isVisible) {
                e.preventDefault();
                findReplaceManager.hide();
                return;
            }

            // F3 查找下一个
            if (e.key === 'F3' && !e.shiftKey) {
                e.preventDefault();
                findReplaceManager.findNext();
                return;
            }
        });
    }

    show() {
        if (!this.panel) return;

        this.panel.style.display = 'block';
        this.isVisible = true;
        
        // 重新同步选项状态，确保UI与内部状态一致
        this.syncOptionsFromUI();

        // 聚焦到查找输入框
        const findInput = document.getElementById('find-input');
        if (findInput) {
            this.isTyping = true; // 设置为输入状态，避免立即跳转到编辑器
            findInput.focus();
            findInput.select();
            
            // 短时间后清除输入状态，除非用户真的在输入
            setTimeout(() => {
                if (!document.activeElement || document.activeElement !== findInput) {
                    this.isTyping = false;
                }
            }, 300);
        }

        // 如果编辑器有选中文本，自动填入查找框
        if (this.editor && this.editor.getSelectedText) {
            const selectedText = this.editor.getSelectedText();
            if (selectedText && findInput) {
                findInput.value = selectedText;
                this.isTyping = false; // 自动填入时允许跳转到编辑器
                this.performSearch();
            }
        }
    }

    hide() {
        if (!this.panel) return;

        this.panel.style.display = 'none';
        this.isVisible = false;
        this.clearHighlights();

        // 重新聚焦到编辑器
        if (this.editor && this.editor.focus) {
            this.editor.focus();
        }
    }

    onFindInputChange() {
        console.log('onFindInputChange 被调用');
        this.performSearch();
    }

    onFindInputKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.isTyping = false; // 按Enter键时不再是输入状态，允许聚焦到编辑器
            if (e.shiftKey) {
                this.findPrevious();
            } else {
                this.findNext();
            }
        }
    }

    onReplaceInputKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.replaceOne();
        }
    }

    performSearch() {
        console.log('performSearch 被调用');
        
        // 确保有最新的编辑器引用
        if (typeof updateFindReplaceEditor === 'function') {
            updateFindReplaceEditor();
        }
        
        const findInput = document.getElementById('find-input');
        if (!findInput) {
            console.warn('查找输入框未找到');
            return;
        }

        const searchText = findInput.value;
        console.log('搜索文本:', searchText);
        
        if (!searchText) {
            console.log('搜索文本为空，清除搜索');
            this.clearSearch();
            return;
        }

        // 获取编辑器内容
        const content = this.getEditorContent();
        console.log('编辑器内容长度:', content ? content.length : 0);
        console.log('编辑器内容前100字符:', content ? content.substring(0, 100) : 'null');
        
        if (!content) {
            console.warn('无法获取编辑器内容');
            return;
        }

        // 执行搜索
        console.log('开始执行搜索...');
        this.searchResults = this.findMatches(content, searchText);
        console.log('搜索结果数量:', this.searchResults.length);
        this.currentIndex = -1;

        // 高亮显示所有匹配项
        this.highlightMatches();

        // 更新状态显示
        this.updateStatus();

        // 如果有匹配项，跳转到第一个
        if (this.searchResults.length > 0) {
            this.currentIndex = 0;
            this.jumpToMatch(this.currentIndex);
            console.log('跳转到第一个匹配项');
        } else {
            console.log('没有找到匹配项');
        }
    }

    findMatches(content, searchText) {
        const matches = [];
        
        try {
            let regex;
            
            console.log('搜索选项状态:', {
                matchCase: this.searchOptions.matchCase,
                wholeWord: this.searchOptions.wholeWord,
                useRegex: this.searchOptions.useRegex
            });
            
            if (this.searchOptions.useRegex) {
                const flags = this.searchOptions.matchCase ? 'g' : 'gi';
                console.log(`创建正则表达式: pattern="${searchText}", flags="${flags}"`);
                regex = new RegExp(searchText, flags);
            } else {
                let escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                
                if (this.searchOptions.wholeWord) {
                    escapedText = '\\b' + escapedText + '\\b';
                }
                
                const flags = this.searchOptions.matchCase ? 'g' : 'gi';
                console.log(`创建字符串搜索正则表达式: pattern="${escapedText}", flags="${flags}"`);
                regex = new RegExp(escapedText, flags);
            }

            let match;
            while ((match = regex.exec(content)) !== null) {
                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0]
                });
                
                // 防止无限循环
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
            }
            
            console.log(`找到 ${matches.length} 个匹配项`);
        } catch (error) {
            console.warn('搜索正则表达式错误:', error);
            return [];
        }

        return matches;
    }

    getEditorContent() {
        console.log('开始获取编辑器内容...');
        
        // 方法1：直接从传入的编辑器获取
        if (this.editor && this.editor.getValue) {
            console.log('从传入编辑器获取内容，方法: getValue');
            return this.editor.getValue();
        } else if (this.editor && this.editor.content !== undefined) {
            console.log('从传入编辑器获取内容，属性: content');
            return this.editor.content;
        }
        
        // 方法2：从全局编辑器管理器获取（NewEditorManager）
        if (window.editorManager && window.editorManager.currentEditor) {
            const currentEditor = window.editorManager.currentEditor;
            console.log('找到全局当前编辑器:', currentEditor.editorId);
            
            if (currentEditor.getValue) {
                const content = currentEditor.getValue();
                console.log('从NewEditorManager当前编辑器获取内容，长度:', content.length);
                return content;
            } else if (currentEditor.content !== undefined) {
                console.log('从NewEditorManager当前编辑器获取内容属性，长度:', currentEditor.content.length);
                return currentEditor.content;
            }
        }
        
        // 方法3：从主应用的编辑器管理器获取
        if (window.oicppApp && window.oicppApp.editorManager) {
            const manager = window.oicppApp.editorManager;
            console.log('找到主应用编辑器管理器');
            
            if (manager.currentEditor) {
                console.log('找到主应用当前编辑器:', manager.currentEditor.editorId);
                
                if (manager.currentEditor.getValue) {
                    const content = manager.currentEditor.getValue();
                    console.log('从主应用编辑器获取内容，长度:', content.length);
                    return content;
                } else if (manager.currentEditor.content !== undefined) {
                    console.log('从主应用编辑器获取内容属性，长度:', manager.currentEditor.content.length);
                    return manager.currentEditor.content;
                }
            }
        }
        
        // 方法4：直接从DOM查找当前显示的编辑器
        const visibleEditors = document.querySelectorAll('.editor-instance[style*="display: block"], .editor-instance[style*="visibility: visible"]');
        console.log('找到可见编辑器元素数量:', visibleEditors.length);
        
        for (const editorEl of visibleEditors) {
            const codeInput = editorEl.querySelector('.code-input, textarea, .code-editor');
            if (codeInput && codeInput.value) {
                console.log('从可见编辑器DOM元素获取内容，长度:', codeInput.value.length);
                return codeInput.value;
            }
        }
        
        // 方法5：尝试从所有已知编辑器实例获取
        if (window.editorManager && window.editorManager.editors) {
            console.log('尝试从所有编辑器实例获取内容...');
            for (const [tabId, editor] of window.editorManager.editors.entries()) {
                if (editor && editor.getValue) {
                    const content = editor.getValue();
                    if (content && content.length > 0) {
                        console.log(`从编辑器实例 ${tabId} 获取内容，长度:`, content.length);
                        return content;
                    }
                }
            }
        }
        
        // 方法6：最后尝试 textarea（兼容模式）
        const codeInput = document.getElementById('codeInput');
        if (codeInput) {
            console.log('从codeInput textarea获取内容，长度:', codeInput.value.length);
            return codeInput.value;
        }
        
        console.warn('所有方法都无法获取编辑器内容');
        return '';
    }

    highlightMatches() {
        // 清除之前的高亮
        this.clearHighlights();
        
        if (this.searchResults.length === 0) return;
        
        // 获取编辑器的代码输入区域
        const codeInput = document.getElementById('codeInput');
        if (!codeInput) return;
        
        // 创建高亮容器
        let highlightContainer = document.querySelector('.editor-search-highlight');
        if (!highlightContainer) {
            highlightContainer = document.createElement('div');
            highlightContainer.className = 'editor-search-highlight';
            codeInput.parentNode.appendChild(highlightContainer);
        }
        
        // 清空之前的高亮
        highlightContainer.innerHTML = '';
        
        // 获取编辑器样式信息
        const computedStyle = window.getComputedStyle(codeInput);
        const lineHeight = parseFloat(computedStyle.lineHeight);
        const fontSize = parseFloat(computedStyle.fontSize);
        const paddingLeft = parseFloat(computedStyle.paddingLeft);
        const paddingTop = parseFloat(computedStyle.paddingTop);
        
        // 为每个匹配项创建高亮元素
        this.searchResults.forEach((match, index) => {
            const position = this.getPositionFromOffset(match.start, match.end);
            if (!position) return;
            
            const highlightEl = document.createElement('div');
            highlightEl.className = index === this.currentIndex ? 
                'editor-search-match-current' : 'editor-search-match';
            
            // 计算位置
            const top = position.startLine * lineHeight + paddingTop;
            const left = this.getCharacterWidth(codeInput, position.startColumn) + paddingLeft;
            const width = this.getCharacterWidth(codeInput, match.text.length);
            
            highlightEl.style.top = top + 'px';
            highlightEl.style.left = left + 'px';
            highlightEl.style.width = width + 'px';
            highlightEl.style.height = lineHeight + 'px';
            
            highlightContainer.appendChild(highlightEl);
        });
    }

    clearHighlights() {
        console.log('clearHighlights 被调用');
        const highlightContainer = document.querySelector('.editor-search-highlight');
        if (highlightContainer) {
            highlightContainer.innerHTML = '';
            console.log('已清除高亮容器内容');
        } else {
            console.log('未找到高亮容器');
        }
    }

    getPositionFromOffset(start, end) {
        const content = this.getEditorContent();
        if (!content) return null;
        
        const lines = content.substring(0, start).split('\n');
        const startLine = lines.length - 1;
        const startColumn = lines[lines.length - 1].length;
        
        const endLines = content.substring(0, end).split('\n');
        const endLine = endLines.length - 1;
        const endColumn = endLines[endLines.length - 1].length;
        
        return {
            startLine,
            startColumn,
            endLine,
            endColumn
        };
    }

    getCharacterWidth(element, charCount) {
        // 创建一个测量用的元素
        const measurer = document.createElement('span');
        measurer.style.font = window.getComputedStyle(element).font;
        measurer.style.position = 'absolute';
        measurer.style.visibility = 'hidden';
        measurer.style.whiteSpace = 'pre';
        measurer.textContent = 'M'.repeat(charCount); // 使用 M 作为基准字符
        
        document.body.appendChild(measurer);
        const width = measurer.offsetWidth;
        document.body.removeChild(measurer);
        
        return width;
    }

    positionToRange(start, end) {
        const content = this.getEditorContent();
        const lines = content.substring(0, start).split('\n');
        const startLine = lines.length - 1;
        const startColumn = lines[lines.length - 1].length;
        
        const endLines = content.substring(0, end).split('\n');
        const endLine = endLines.length - 1;
        const endColumn = endLines[endLines.length - 1].length;
        
        return {
            startLine,
            startColumn,
            endLine,
            endColumn
        };
    }

    updateStatus() {
        const statusElement = document.getElementById('find-status');
        console.log('更新搜索状态，状态元素:', statusElement);
        
        if (!statusElement) {
            console.warn('未找到状态显示元素');
            return;
        }

        if (this.searchResults.length === 0) {
            statusElement.textContent = '未找到匹配项';
            statusElement.className = 'find-status no-results';
            console.log('设置状态：未找到匹配项');
        } else {
            const current = Math.max(0, this.currentIndex) + 1;
            const total = this.searchResults.length;
            statusElement.textContent = `第 ${current} 处，共 ${total} 处`;
            statusElement.className = 'find-status';
            console.log(`设置状态：第 ${current} 处，共 ${total} 处`);
        }
    }

    findNext() {
        if (this.searchResults.length === 0) return;
        
        this.currentIndex = (this.currentIndex + 1) % this.searchResults.length;
        this.jumpToMatch(this.currentIndex);
        this.updateStatus();
        this.highlightMatches();
    }

    findPrevious() {
        if (this.searchResults.length === 0) return;
        
        this.currentIndex = this.currentIndex <= 0 ? 
            this.searchResults.length - 1 : this.currentIndex - 1;
        this.jumpToMatch(this.currentIndex);
        this.updateStatus();
        this.highlightMatches();
    }

    jumpToMatch(index) {
        if (index < 0 || index >= this.searchResults.length) return;
        
        const match = this.searchResults[index];
        const position = this.getPositionFromOffset(match.start, match.end);
        
        console.log(`跳转到匹配项 ${index + 1}，位置:`, match, '输入状态:', this.isTyping);
        
        // 尝试多种方式设置编辑器选中范围
        let selectionSet = false;
        
        // 方法1：通过传入的编辑器API设置选中
        if (this.editor && this.editor.setSelection) {
            this.editor.setSelection(match.start, match.end);
            selectionSet = true;
            console.log('通过传入编辑器API设置选中范围');
        }
        
        // 方法2：通过NewEditorManager当前编辑器设置选中
        if (!selectionSet && window.editorManager && window.editorManager.currentEditor) {
            const currentEditor = window.editorManager.currentEditor;
            console.log('尝试通过NewEditorManager当前编辑器设置选中，编辑器:', currentEditor.editorId);
            
            if (currentEditor.setSelection) {
                currentEditor.setSelection(match.start, match.end);
                selectionSet = true;
                console.log('通过NewEditorManager编辑器setSelection设置选中范围');
            } else if (currentEditor.codeInputEl) {
                // 直接操作编辑器的textarea元素
                const textarea = currentEditor.codeInputEl;
                // 只有在非输入状态时才强制聚焦
                if (!this.isTyping) {
                    textarea.focus();
                }
                textarea.setSelectionRange(match.start, match.end);
                selectionSet = true;
                console.log('通过NewEditorManager编辑器textarea设置选中范围，是否聚焦:', !this.isTyping);
            }
        }
        
        // 方法3：通过主应用编辑器管理器设置选中
        if (!selectionSet && window.oicppApp && window.oicppApp.editorManager) {
            const manager = window.oicppApp.editorManager;
            if (manager.currentEditor) {
                console.log('尝试通过主应用编辑器管理器设置选中，编辑器:', manager.currentEditor.editorId);
                
                if (manager.currentEditor.setSelection) {
                    manager.currentEditor.setSelection(match.start, match.end);
                    selectionSet = true;
                    console.log('通过主应用编辑器setSelection设置选中范围');
                } else if (manager.currentEditor.codeInputEl) {
                    const textarea = manager.currentEditor.codeInputEl;
                    // 只有在非输入状态时才强制聚焦
                    if (!this.isTyping) {
                        textarea.focus();
                    }
                    textarea.setSelectionRange(match.start, match.end);
                    selectionSet = true;
                    console.log('通过主应用编辑器textarea设置选中范围，是否聚焦:', !this.isTyping);
                }
            }
        }
        
        // 方法4：直接操作可见编辑器的DOM元素
        if (!selectionSet) {
            const visibleEditors = document.querySelectorAll('.editor-instance[style*="display: block"], .editor-instance[style*="visibility: visible"]');
            for (const editorEl of visibleEditors) {
                const codeInput = editorEl.querySelector('.code-input, textarea, .code-editor');
                if (codeInput) {
                    // 只有在非输入状态时才强制聚焦
                    if (!this.isTyping) {
                        codeInput.focus();
                    }
                    codeInput.setSelectionRange(match.start, match.end);
                    selectionSet = true;
                    console.log('通过可见编辑器DOM元素设置选中范围，是否聚焦:', !this.isTyping);
                    break;
                }
            }
        }
        
        // 最后尝试 textarea
        if (!selectionSet) {
            const codeInput = document.getElementById('codeInput');
            if (codeInput) {
                // 只有在非输入状态时才强制聚焦
                if (!this.isTyping) {
                    codeInput.focus();
                }
                codeInput.setSelectionRange(match.start, match.end);
                selectionSet = true;
                console.log('通过textarea设置选中范围，是否聚焦:', !this.isTyping);
                
                // 滚动到匹配位置
                this.scrollToMatch(position);
            }
        }
        
        if (!selectionSet) {
            console.warn('无法设置编辑器选中范围');
        }
    }

    scrollToMatch(position) {
        const codeInput = document.getElementById('codeInput');
        if (!codeInput || !position) return;
        
        const computedStyle = window.getComputedStyle(codeInput);
        const lineHeight = parseFloat(computedStyle.lineHeight);
        
        // 计算目标行的像素位置
        const targetScrollTop = position.startLine * lineHeight;
        
        // 获取可视区域高度
        const visibleHeight = codeInput.clientHeight;
        
        // 将目标行滚动到可视区域中央
        const scrollTop = Math.max(0, targetScrollTop - visibleHeight / 2);
        
        codeInput.scrollTop = scrollTop;
    }

    replaceOne() {
        if (this.currentIndex < 0 || this.currentIndex >= this.searchResults.length) return;
        
        const replaceInput = document.getElementById('replace-input');
        if (!replaceInput) return;
        
        const replaceText = replaceInput.value;
        const match = this.searchResults[this.currentIndex];
        
        // 执行替换
        this.replaceAtPosition(match.start, match.end, replaceText);
        
        // 重新搜索
        this.performSearch();
    }

    replaceAll() {
        const replaceInput = document.getElementById('replace-input');
        if (!replaceInput || this.searchResults.length === 0) return;
        
        const replaceText = replaceInput.value;
        
        // 从后往前替换，避免位置偏移问题
        for (let i = this.searchResults.length - 1; i >= 0; i--) {
            const match = this.searchResults[i];
            this.replaceAtPosition(match.start, match.end, replaceText);
        }
        
        // 重新搜索
        this.performSearch();
    }

    replaceAtPosition(start, end, replaceText) {
        console.log(`执行替换，位置: ${start}-${end}，替换文本:`, replaceText);
        
        if (this.editor && this.editor.replaceRange) {
            const range = this.positionToRange(start, end);
            this.editor.replaceRange(range, replaceText);
            console.log('通过编辑器replaceRange方法执行替换');
            return;
        }

        // 获取当前内容
        const content = this.getEditorContent();
        if (!content) {
            console.warn('无法获取编辑器内容进行替换');
            return;
        }
        
        // 执行替换
        const newContent = content.substring(0, start) + replaceText + content.substring(end);
        console.log('新内容长度:', newContent.length);
        
        // 尝试多种方式设置内容
        let contentSet = false;
        
        // 方法1：通过传入的编辑器设置
        if (this.editor && this.editor.setValue) {
            this.editor.setValue(newContent);
            contentSet = true;
            console.log('通过传入编辑器setValue方法设置内容');
        }
        
        // 方法2：通过NewEditorManager当前编辑器设置
        if (!contentSet && window.editorManager && window.editorManager.currentEditor) {
            const currentEditor = window.editorManager.currentEditor;
            if (currentEditor.setValue) {
                currentEditor.setValue(newContent);
                contentSet = true;
                console.log('通过NewEditorManager当前编辑器设置内容');
            }
        }
        
        // 方法3：通过主应用编辑器管理器设置
        if (!contentSet && window.oicppApp && window.oicppApp.editorManager) {
            const manager = window.oicppApp.editorManager;
            if (manager.currentEditor && manager.currentEditor.setValue) {
                manager.currentEditor.setValue(newContent);
                contentSet = true;
                console.log('通过主应用编辑器管理器设置内容');
            }
        }
        
        // 方法4：直接操作可见编辑器的DOM元素
        if (!contentSet) {
            const visibleEditors = document.querySelectorAll('.editor-instance[style*="display: block"], .editor-instance[style*="visibility: visible"]');
            for (const editorEl of visibleEditors) {
                const codeInput = editorEl.querySelector('.code-input, textarea, .code-editor');
                if (codeInput) {
                    codeInput.value = newContent;
                    contentSet = true;
                    console.log('通过可见编辑器DOM元素设置内容');
                    break;
                }
            }
        }
        
        // 方法5：最后尝试直接操作 textarea
        if (!contentSet) {
            const codeInput = document.getElementById('codeInput');
            if (codeInput) {
                codeInput.value = newContent;
                contentSet = true;
                console.log('通过codeInput textarea设置内容');
            }
        }
        
        if (!contentSet) {
            console.error('无法设置编辑器内容');
        } else {
            console.log('编辑器内容替换成功');
        }
    }

    clearSearch() {
        console.log('clearSearch 被调用');
        this.searchResults = [];
        this.currentIndex = -1;
        this.clearHighlights();
        this.updateStatus();
    }
}

// 全局查找替换管理器实例
let findReplaceManager = null;

// 初始化查找替换功能
function initializeFindReplace(editor) {
    console.log('初始化查找替换功能，编辑器:', editor ? editor.editorId : null);
    
    if (findReplaceManager) {
        console.log('更新现有查找替换管理器的编辑器引用');
        findReplaceManager.editor = editor;
        
        // 如果传入了新编辑器，更新引用
        if (editor) {
            console.log(`查找替换管理器编辑器已更新为: ${editor.editorId}`);
        }
    } else {
        console.log('创建新的查找替换管理器');
        findReplaceManager = new FindReplaceManager(editor);
    }
    
    // 确保全局引用正确设置
    if (typeof window !== 'undefined') {
        window.findReplaceManager = findReplaceManager;
    }
    
    console.log('查找替换功能初始化完成，当前编辑器:', findReplaceManager.editor ? findReplaceManager.editor.editorId : 'none');
}

// 提供一个方法来更新当前编辑器引用
function updateFindReplaceEditor() {
    if (findReplaceManager) {
        // 自动获取当前活跃编辑器
        let currentEditor = null;
        
        if (window.editorManager && window.editorManager.currentEditor) {
            currentEditor = window.editorManager.currentEditor;
            console.log('从NewEditorManager获取当前编辑器:', currentEditor.editorId);
        } else if (window.oicppApp && window.oicppApp.editorManager && window.oicppApp.editorManager.currentEditor) {
            currentEditor = window.oicppApp.editorManager.currentEditor;
            console.log('从主应用编辑器管理器获取当前编辑器:', currentEditor.editorId);
        }
        
        if (currentEditor && currentEditor !== findReplaceManager.editor) {
            console.log('更新查找替换管理器的编辑器引用:', currentEditor.editorId);
            findReplaceManager.editor = currentEditor;
        }
        
        return currentEditor;
    }
    return null;
}

// 确保在DOM加载后自动初始化查找替换功能
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM已加载，准备初始化查找替换功能');
    
    // 如果还没有全局查找替换管理器，创建一个
    if (!findReplaceManager) {
        console.log('创建全局查找替换管理器');
        // 使用null编辑器初始化，稍后会被替换
        findReplaceManager = new FindReplaceManager(null);
        window.findReplaceManager = findReplaceManager;
    }
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FindReplaceManager, initializeFindReplace };
}
