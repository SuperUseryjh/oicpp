// 主应用程序逻辑
class OICPPApp {
    constructor() {
        this.currentFile = null;
        this.files = new Map();
        this.settings = {
            theme: 'dark',
            fontSize: 14,
            tabSize: 4,
            wordWrap: false,
            autoCompletion: true
        };
        this.editorManager = null;
        this.initialized = false;
        
        // 不在构造函数中自动初始化，由 init.js 控制
    }

    async init() {
        try {
            console.log('开始初始化 OICPP App...');
            
            // 初始化新的编辑器管理器
            this.editorManager = new NewEditorManager();
            // 设置为全局可访问，供CustomEditor检查
            window.editorManager = this.editorManager;
            
            // 初始化编译管理器
            this.compilerManager = new CompilerManager();
            window.compilerManager = this.compilerManager;
            
            // 等待编辑器管理器初始化完成
            let attempts = 0;
            while (attempts < 100) {
                if (this.editorManager.isInitialized) {
                    console.log('编辑器管理器初始化完成');
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
            }
            
            if (attempts >= 100) {
                console.warn('编辑器管理器初始化超时，继续其他初始化...');
            }
            
            this.setupEventListeners();
            this.setupIPC();
            this.loadSettings();
            this.loadDefaultFiles();
            this.updateStatusBar();
            this.initialized = true;
            
            console.log('OICPP App 初始化完成');
        } catch (error) {
            console.error('OICPP App 初始化失败', error);
        }
    }

    setupEventListeners() {
        // 窗口大小变化
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        // 文件拖拽
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleFileDrop(e);
        });

        // 右键菜单
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e);
        });

        // 监听设置变化
        document.addEventListener('settings-changed', (e) => {
            this.applySettings(e.detail.type, e.detail.settings);
        });

        // 菜单栏事件处理
        this.setupMenuBarEvents();
    }

    setupMenuBarEvents() {
        // 菜单项点击事件
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('menu-dropdown-item') || 
                e.target.closest('.menu-dropdown-item')) {
                
                const menuItem = e.target.classList.contains('menu-dropdown-item') ? 
                    e.target : e.target.closest('.menu-dropdown-item');
                
                const action = menuItem.dataset.action;
                if (action) {
                    this.handleMenuAction(action);
                }
            }
        });

        // 菜单悬停效果
        document.addEventListener('mouseover', (e) => {
            if (e.target.classList.contains('menu-item')) {
                // 关闭其他菜单
                document.querySelectorAll('.menu-dropdown.active').forEach(menu => {
                    menu.classList.remove('active');
                });
                // 打开当前菜单
                const dropdown = e.target.querySelector('.menu-dropdown');
                if (dropdown) {
                    dropdown.classList.add('active');
                }
            }
        });

        // 点击空白处关闭菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-bar')) {
                document.querySelectorAll('.menu-dropdown.active').forEach(menu => {
                    menu.classList.remove('active');
                });
            }
        });
    }

    handleMenuAction(action) {
        console.log('菜单动作:', action);
        
        switch (action) {
            case 'new-file':
                this.createNewCppFile();
                break;
            case 'open-file':
                this.openFile();
                break;
            case 'open-folder':
                this.openFolder();
                break;
            case 'save-file':
                this.saveFile();
                break;
            case 'save-as':
                this.saveFileAs();
                break;
            case 'compiler-settings':
                this.openCompilerSettings();
                break;
            case 'editor-settings':
                this.openEditorSettings();
                break;
            case 'templates':
                this.openTemplateSettings();
                break;
            case 'template-settings':
                this.openTemplateSettings();
                break;
            case 'debug':
                this.startDebug();
                break;
            case 'compile':
                this.compileCode();
                break;
            case 'run':
                this.runCode();
                break;
            case 'format-code':
                this.formatCode();
                break;
            case 'find-replace':
                this.showFindReplace();
                break;
            case 'compile-run':
                this.compileAndRun();
                break;
            case 'about':
                this.showAbout();
                break;
            case 'check-update':
                this.checkForUpdates();
                break;
            default:
                console.log('未知的菜单动作:', action);
        }
    }

    setupIPC() {
        // 检查是否在Electron环境中
        if (typeof require === 'undefined') {
            console.warn('Electron IPC 不可用');
            return;
        }

        try {
            const { ipcRenderer } = require('electron');
            
            // 监听来自主进程的消息
            ipcRenderer.on('menu-new-cpp-file', () => {
                this.createNewCppFile();
            });

            ipcRenderer.on('menu-save-file', () => {
                this.saveCurrentFile();
            });

            ipcRenderer.on('menu-format-code', () => {
                this.formatCode();
            });

            ipcRenderer.on('menu-find-replace', () => {
                this.showFindReplace();
            });

            ipcRenderer.on('menu-compile', () => {
                this.compileCode();
            });

            ipcRenderer.on('menu-compile-run', () => {
                this.compileAndRun();
            });

            ipcRenderer.on('menu-debug', () => {
                this.startDebug();
            });

            ipcRenderer.on('show-debug-developing-message', () => {
                this.showDebugDevelopingMessage();
            });

            // 监听设置变化
            ipcRenderer.on('settings-changed', (event, settingsType, newSettings) => {
                console.log(`收到设置变化通知: ${settingsType}`, newSettings);
                this.applySettings(settingsType, newSettings);
            });

            // 监听所有设置重置
            ipcRenderer.on('settings-reset', (event, allSettings) => {
                console.log('收到设置重置通知:', allSettings);
                this.settings = allSettings;
                this.applySettings();
            });

            // 监听设置导入
            ipcRenderer.on('settings-imported', (event, allSettings) => {
                console.log('收到设置导入通知:', allSettings);
                this.settings = allSettings;
                this.applySettings();
            });

            // 监听文件操作
            ipcRenderer.on('file-opened', (event, filePath, content) => {
                this.openFile(filePath, content);
            });

            ipcRenderer.on('file-saved', (event, filePath) => {
                this.onFileSaved(filePath);
            });

            // 监听文件夹操作
            ipcRenderer.on('folder-opened', (event, folderPath) => {
                this.onFolderOpened(folderPath);
            });

            console.log('IPC 事件监听器已设置');
        } catch (error) {
            console.error('设置IPC失败:', error);
        }
    }

    async loadSettings() {
        try {
            // 从主进程获取设置
            if (window.electronAPI && window.electronAPI.getAllSettings) {
                const allSettings = await window.electronAPI.getAllSettings();
                if (allSettings) {
                    this.settings = allSettings;
                    console.log('从主进程加载设置成功:', this.settings);
                }
            } else {
                // 后备：从本地存储加载设置
                const savedSettings = localStorage.getItem('oicpp-settings');
                if (savedSettings) {
                    this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
                    console.log('从本地存储加载设置成功');
                }
            }
            
            this.applySettings();
            
            // 通知编译管理器更新设置
            if (this.compilerManager) {
                this.compilerManager.updateSettings({
                    compilerPath: this.settings.compilerPath || '',
                    compilerArgs: this.settings.compilerArgs || '-std=c++14 -O2 -static'
                });
                console.log('已通知编译管理器更新设置');
            }
            
        } catch (error) {
            console.error('加载设置失败:', error);
            // 使用默认设置
            this.applySettings();
        }
    }

    applySettings(settingsType = null, newSettings = null) {
        console.log('applySettings 被调用:', { settingsType, newSettings });
        
        // 如果提供了新设置，合并它们
        if (newSettings) {
            this.settings = { ...this.settings, ...newSettings };
            console.log('设置已合并:', this.settings);
        }
        
        // 应用编辑器设置
        this.updateEditorSettings();
        
        // 应用主题设置
        this.applyThemeSettings();
        
        // 保存设置到本地存储（作为缓存）
        localStorage.setItem('oicpp-settings', JSON.stringify(this.settings));
        
        // 通知编译管理器更新设置
        if (this.compilerManager && (newSettings?.compilerPath !== undefined || newSettings?.compilerArgs !== undefined || !settingsType)) {
            this.compilerManager.updateSettings({
                compilerPath: this.settings.compilerPath || '',
                compilerArgs: this.settings.compilerArgs || '-std=c++14 -O2 -static'
            });
            console.log('已通知编译管理器更新设置');
        }
        
        console.log('设置已应用:', this.settings);
    }

    applyThemeSettings() {
        const theme = this.settings.theme || 'dark';
        
        // 清除所有主题类和属性
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.removeAttribute('data-theme');
        document.body.removeAttribute('data-editor-theme');
        
        // 应用主题类和属性
        document.body.classList.add(`theme-${theme}`);
        document.body.setAttribute('data-theme', theme);
        document.body.setAttribute('data-editor-theme', theme);
        
        console.log('主题已应用:', theme);
    }

    updateEditorSettings() {
        if (this.editorManager && this.editorManager.currentEditor) {
            const editor = this.editorManager.currentEditor;
            
            // 更新编辑器选项（使用简化设置结构）
            if (editor && typeof editor.updateOptions === 'function') {
                try {
                    editor.updateOptions({
                        fontSize: this.settings.fontSize || 14,
                        tabSize: this.settings.tabSize || 4,
                        wordWrap: this.settings.wordWrap ? 'on' : 'off',
                        theme: this.settings.theme === 'light' ? 'light' : 'dark',
                        fontFamily: this.settings.font || 'Consolas',
                        lineNumbers: this.settings.lineNumbers !== false,
                        autoCompletion: this.settings.enableAutoCompletion !== false,
                        bracketMatching: this.settings.bracketMatching !== false
                    });
                    console.log('编辑器设置已更新');
                } catch (error) {
                    console.error('更新编辑器设置失败:', error);
                }
            } else if (editor && typeof editor.updateSettings === 'function') {
                // 对于自研编辑器，传递简化设置结构
                try {
                    const editorSettings = {
                        font: this.settings.font || 'Consolas',
                        fontSize: this.settings.fontSize || 14,
                        theme: this.settings.theme || 'dark',
                        enableAutoCompletion: this.settings.enableAutoCompletion !== false,
                        tabSize: this.settings.tabSize || 4,
                        wordWrap: this.settings.wordWrap || false
                    };
                    editor.updateSettings({editor: editorSettings}); // 自研编辑器可能还期望{editor: {...}}格式
                    console.log('自研编辑器设置已更新');
                } catch (error) {
                    console.error('更新自研编辑器设置失败:', error);
                }
            } else {
                console.warn('编辑器不支持设置更新方法或编辑器未初始化');
            }
        } else {
            console.warn('编辑器管理器或当前编辑器未初始化');
        }
    }

    loadDefaultFiles() {
        // 不再自动创建默认文件，显示欢迎页面
        console.log('跳过默认文件创建，显示欢迎页面');
    }

    handleResize() {
        if (this.editorManager && this.editorManager.currentEditor) {
            this.editorManager.currentEditor.focus();
        }
    }

    handleKeyDown(e) {
        // 调试：记录所有Ctrl+Z事件
        if (e.ctrlKey && e.key === 'z') {
            console.log(`全局Ctrl+Z事件被检测到，目标元素:`, e.target);
            console.log(`当前活跃编辑器:`, this.editorManager ? this.editorManager.currentEditor : '无');
            console.log(`当前标签页ID:`, this.editorManager ? this.editorManager.currentTabId : '无');
        }
        
        // 处理快捷键
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'n':
                    e.preventDefault();
                    this.createNewCppFile();
                    break;
                case 's':
                    e.preventDefault();
                    this.saveCurrentFile();
                    break;
            }
        }
        
        // F9 编译
        if (e.key === 'F9') {
            e.preventDefault();
            this.compileCode();
        }
        
        // F10 运行
        if (e.key === 'F10') {
            e.preventDefault();
            this.runCode();
        }
        
        // F11 编译并运行
        if (e.key === 'F11') {
            e.preventDefault();
            this.compileAndRun();
        }
        
        // F5 调试（开发中）
        if (e.key === 'F5') {
            e.preventDefault();
            this.showDebugDevelopingMessage();
        }
    }

    handleFileDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
            if (file.type === 'text/plain' || file.name.endsWith('.cpp') || file.name.endsWith('.c') || file.name.endsWith('.h')) {
                this.openDroppedFile(file);
            }
        });
    }

    async openDroppedFile(file) {
        try {
            const content = await file.text();
            this.openFile(file.path || file.name, content);
        } catch (error) {
            console.error('打开文件失败:', error);
        }
    }

    showContextMenu(e) {
        // TODO: 实现右键菜单
        console.log('显示右键菜单');
    }

    showDebugDevelopingMessage() {
        // 显示调试功能开发中的提示
        this.showMessage('调试功能正在开发中，敬请期待！目前可使用 F9 编译、F10 运行、F11 编译并运行', 'info');
        
        // 切换到调试面板显示开发中界面
        if (window.sidebarManager) {
            window.sidebarManager.showPanel('debug');
        }
    }

    initAutoComplete() {
        // 自研编辑器已经内置了自动补全功能
        // 可以通过 editorManager 来扩展自动补全数据
        if (this.editorManager) {
            // 添加更多的自动补全数据
            this.addCustomAutoCompleteData();
        }
    }

    addCustomAutoCompleteData() {
        // 获取用户自定义的代码片段和模板
        const customSnippets = this.loadCustomSnippets();
        
        // 遍历所有编辑器实例，添加自定义补全数据
        this.editorManager.editors.forEach(editor => {
            if (editor.autoCompleteData) {
                editor.autoCompleteData.push(...customSnippets);
            }
        });
    }

    loadCustomSnippets() {
        // 从设置中加载自定义代码片段
        const snippets = [];
        
        // 常用的竞赛编程模板
        snippets.push(
            'for (int i = 0; i < n; i++) {\n    // 代码\n}',
            'while (cin >> n) {\n    // 代码\n}',
            'vector<int> v(n);',
            'sort(v.begin(), v.end());',
            'int n, m;\ncin >> n >> m;',
            'long long ans = 0;'
        );
        
        return snippets;
    }

    // 菜单栏具体实现方法
    createNewCppFile() {
        if (this.editorManager) {
            this.editorManager.newFile('untitled.cpp');
        }
    }

    openFile() {
        if (window.electronAPI) {
            window.electronAPI.openFile();
        } else {
            // 创建文件输入元素
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.cpp,.c,.h,.hpp,.cc,.cxx,.txt';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (this.editorManager) {
                            this.editorManager.openFile(file.name, event.target.result);
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        }
    }

    openFolder() {
        if (window.electronAPI) {
            window.electronAPI.openFolder();
        } else {
            alert('打开文件夹功能需要在 Electron 环境中运行');
        }
    }

    // 设置工作区
    setWorkspace(path) {
        console.log('设置工作区:', path);
        if (window.sidebarManager) {
            const fileExplorer = window.sidebarManager.getPanelManager('files');
            if (fileExplorer) {
                fileExplorer.setWorkspace(path);
            }
        }
    }

    // 清除工作区
    clearWorkspace() {
        console.log('清除工作区');
        if (window.sidebarManager) {
            const fileExplorer = window.sidebarManager.getPanelManager('files');
            if (fileExplorer) {
                fileExplorer.clearWorkspace();
            }
        }
    }

    saveFile() {
        if (this.editorManager && this.editorManager.currentEditor) {
            const content = this.editorManager.currentEditor.getValue();
            const filePath = this.editorManager.currentEditor.getFilePath ? 
                            this.editorManager.currentEditor.getFilePath() : null;
            
            console.log('保存文件 - 文件路径:', filePath, '内容长度:', content ? content.length : 'undefined');
            
            if (window.electronAPI) {
                if (filePath) {
                    // 保存到现有文件
                    window.electronAPI.saveFile(filePath, content);
                } else {
                    // 另存为新文件
                    window.electronAPI.saveAsFile(content);
                }
            } else {
                // 浏览器环境下载文件
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'untitled.cpp';
                a.click();
                URL.revokeObjectURL(url);
            }
        } else {
            console.warn('保存文件失败: 没有编辑器管理器或当前编辑器');
        }
    }

    saveFileAs() {
        if (this.editorManager && this.editorManager.currentEditor) {
            const content = this.editorManager.currentEditor.getValue();
            if (window.electronAPI) {
                window.electronAPI.saveAsFile(content);
            } else {
                this.saveFile(); // 浏览器环境下等同于保存
            }
        }
    }

    // 保存当前文件
    saveCurrentFile() {
        if (this.editorManager && this.editorManager.currentEditor) {
            const content = this.editorManager.getCurrentContent();
            const filePath = this.editorManager.currentEditor.getFilePath ? 
                            this.editorManager.currentEditor.getFilePath() : null;
            
            console.log('保存当前文件 - 获取到的内容:', content ? `长度${content.length}` : 'undefined/null');
            console.log('保存当前文件 - 文件路径:', filePath);
            
            const event = new CustomEvent('saveFile', {
                detail: { 
                    content: content,
                    filePath: filePath
                }
            });
            document.dispatchEvent(event);
        } else {
            console.warn('保存文件失败: 没有编辑器管理器或当前编辑器');
        }
    }

    // 创建新的C++文件
    createNewCppFile() {
        if (this.editorManager) {
            this.editorManager.newFile('untitled.cpp');
        }
    }

    openCompilerSettings() {
        // 使用IPC调用打开独立的编译器设置窗口，而不是内嵌对话框
        if (window.electronAPI && window.electronAPI.openCompilerSettings) {
            window.electronAPI.openCompilerSettings();
        } else if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                ipcRenderer.invoke('open-compiler-settings').catch(error => {
                    console.error('打开编译器设置失败:', error);
                });
            } catch (error) {
                console.error('IPC 调用失败:', error);
            }
        } else {
            console.warn('无法打开编译器设置：API不可用');
        }
    }

    openEditorSettings() {
        // 使用独立窗口打开编辑器设置
        if (window.electronAPI && window.electronAPI.openEditorSettings) {
            window.electronAPI.openEditorSettings();
        } else if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('open-editor-settings');
        } else {
            console.warn('无法打开编辑器设置：Electron API 不可用');
            // 回退到内嵌对话框
            this.showSettingsDialog('editor');
        }
    }

    openTemplateSettings() {
        // 发送IPC消息打开模板设置窗口
        if (window.electronAPI && window.electronAPI.openTemplateSettings) {
            window.electronAPI.openTemplateSettings();
        } else if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('open-template-settings');
        } else {
            console.warn('无法打开模板设置：Electron API 不可用');
            // 回退到内嵌对话框
            this.showSettingsDialog('templates');
        }
    }

    showSettingsDialog(type) {
        // 创建模态对话框
        const dialog = document.createElement('div');
        dialog.className = 'settings-dialog-overlay';
        dialog.innerHTML = `
            <div class="settings-dialog">
                <div class="settings-header">
                    <h2>${this.getSettingsTitle(type)}</h2>
                    <button class="settings-close" id="close-settings-btn">×</button>
                </div>
                <div class="settings-content">
                    ${this.getSettingsContent(type)}
                </div>
                <div class="settings-footer">
                    <button class="settings-cancel" id="cancel-settings-btn">取消</button>
                    <button class="settings-save" id="save-settings-btn" data-type="${type}">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        this.setupSettingsDialogListeners(dialog, type);
    }

    setupSettingsDialogListeners(dialog, type) {
        // 关闭按钮
        const closeBtn = dialog.querySelector('#close-settings-btn');
        const cancelBtn = dialog.querySelector('#cancel-settings-btn');
        const saveBtn = dialog.querySelector('#save-settings-btn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                dialog.remove();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                dialog.remove();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings(type);
            });
        }
        
        // 编译器特定的按钮
        if (type === 'compiler') {
            const browseBtn = dialog.querySelector('#browse-compiler-btn');
            const installBtn = dialog.querySelector('#install-compiler-btn');
            
            if (browseBtn) {
                browseBtn.addEventListener('click', () => {
                    this.selectCompilerPath();
                });
            }
            
            if (installBtn) {
                installBtn.addEventListener('click', () => {
                    this.installCompiler();
                });
            }
        }
    }

    getSettingsTitle(type) {
        switch (type) {
            case 'compiler': return '编译器设置';
            case 'editor': return '编辑器设置';
            case 'templates': return '代码模板设置';
            default: return '设置';
        }
    }

    getSettingsContent(type) {
        switch (type) {
            case 'compiler':
                return `
                    <div class="setting-item">
                        <label>编译器路径:</label>
                        <div class="input-group">
                            <input type="text" id="compiler-path" value="${this.settings.compilerPath || ''}" placeholder="选择 g++.exe 路径">
                            <button id="browse-compiler-btn">浏览</button>
                            <button id="install-compiler-btn">安装编译器</button>
                        </div>
                    </div>
                    <div class="setting-item">
                        <label>编译选项:</label>
                        <input type="text" id="compiler-options" value="${this.settings.compilerArgs || '-std=c++14 -O2 -static'}" placeholder="编译选项">
                    </div>
                `;
            case 'editor':
                const currentFont = this.settings.font || 'Consolas';
                const currentTheme = this.settings.theme || 'dark';
                const currentFontSize = this.settings.fontSize || 14;
                const currentAutoComplete = this.settings.enableAutoCompletion !== false;
                
                return `
                    <div class="setting-item">
                        <label>字体:</label>
                        <select id="editor-font">
                            <option value="Consolas" ${currentFont === 'Consolas' ? 'selected' : ''}>Consolas</option>
                            <option value="Monaco" ${currentFont === 'Monaco' ? 'selected' : ''}>Monaco</option>
                            <option value="Courier New" ${currentFont === 'Courier New' ? 'selected' : ''}>Courier New</option>
                            <option value="Source Code Pro" ${currentFont === 'Source Code Pro' ? 'selected' : ''}>Source Code Pro</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <label>主题:</label>
                        <select id="editor-theme">
                            <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>深色</option>
                            <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>浅色</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <label>字体大小:</label>
                        <input type="number" id="editor-fontsize" value="${currentFontSize}" min="8" max="32">
                    </div>
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="editor-autocomplete" ${currentAutoComplete ? 'checked' : ''}>
                            启用自动补全
                        </label>
                    </div>
                `;
            case 'templates':
                return `
                    <div class="setting-item">
                        <label>C++ 模板:</label>
                        <textarea id="cpp-template" rows="15" style="width: 100%;">${this.settings.cppTemplate || this.getDefaultCppTemplate()}</textarea>
                    </div>
                `;
            default:
                return '';
        }
    }

    getDefaultCppTemplate() {
        return `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <cmath>
#include <cstring>
#include <queue>
#include <stack>
#include <map>
#include <set>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(0);
    
    // 你的代码在这里
    
    return 0;
}`;
    }

    startDebug() {
        console.log('开始调试');
        // 切换到调试面板
        if (window.sidebarManager) {
            window.sidebarManager.showPanel('debug');
        }
        
        // 初始化调试功能
        this.initializeDebugFeatures();
        
        // 自动开始调试流程
        setTimeout(() => {
            this.handleDebugStart();
        }, 100); // 短暂延迟确保UI已初始化
    }

    initializeDebugFeatures() {
        // 确保调试UI已加载
        if (!window.debugUIInitialized) {
            this.loadDebugUI();
        }
        
        // 设置调试事件监听器
        this.setupDebugEventListeners();
        
        // 设置调试IPC监听器
        this.setupDebugIPC();
    }

    loadDebugUI() {
        console.log('加载调试UI');
        
        try {
            // 动态加载debug-ui.js
            if (!document.querySelector('script[src*="debug-ui.js"]')) {
                const script = document.createElement('script');
                script.src = 'js/debug-ui.js';
                script.onload = () => {
                    console.log('调试UI脚本已加载');
                    window.debugUIInitialized = true;
                    this.initializeDebugUI();
                };
                script.onerror = () => {
                    console.error('调试UI脚本加载失败');
                    this.showDebugError('调试功能加载失败');
                };
                document.head.appendChild(script);
            } else {
                this.initializeDebugUI();
            }
        } catch (error) {
            console.error('加载调试UI失败:', error);
            this.showDebugError('调试功能初始化失败');
        }
    }

    initializeDebugUI() {
        try {
            // 如果DebugUI类可用，创建实例
            if (typeof DebugUI !== 'undefined') {
                if (!window.debugUI) {
                    window.debugUI = new DebugUI();
                    console.log('调试UI已初始化');
                }
            } else {
                // 使用简化版本
                this.setupSimplifiedDebugUI();
            }
        } catch (error) {
            console.error('初始化调试UI失败:', error);
            this.setupSimplifiedDebugUI();
        }
    }

    setupSimplifiedDebugUI() {
        console.log('设置简化版调试UI');
        
        // 移除等待消息，显示功能就绪状态
        const waitingMessages = document.querySelectorAll('.waiting-debug-message');
        waitingMessages.forEach(msg => {
            msg.textContent = '调试器就绪，等待开始调试...';
        });
        
        this.setupDebugEventListeners();
    }

    setupDebugEventListeners() {
        // 只有在没有DebugUI实例时才设置简化版事件监听器
        if (window.debugUI) {
            console.log('DebugUI已存在，跳过简化版事件监听器设置');
            return;
        }
        
        console.log('设置简化版调试事件监听器');
        
        // 开始调试按钮
        const startBtn = document.getElementById('debug-start');
        if (startBtn && !startBtn.hasAttribute('data-debug-listener')) {
            startBtn.addEventListener('click', () => {
                this.handleDebugStart();
            });
            startBtn.setAttribute('data-debug-listener', 'true');
        }

        // 调试控制按钮
        const debugControls = {
            'debug-continue': () => this.handleDebugContinue(),
            'debug-step-over': () => this.handleDebugStepOver(),
            'debug-step-into': () => this.handleDebugStepInto(),
            'debug-step-out': () => this.handleDebugStepOut(),
            'debug-stop': () => this.handleDebugStop()
        };

        Object.entries(debugControls).forEach(([id, handler]) => {
            const btn = document.getElementById(id);
            if (btn && !btn.hasAttribute('data-debug-listener')) {
                btn.addEventListener('click', handler);
                btn.setAttribute('data-debug-listener', 'true');
            }
        });
    }

    setupDebugIPC() {
        if (typeof require === 'undefined') {
            console.warn('Electron IPC 不可用');
            return;
        }

        try {
            const { ipcRenderer } = require('electron');
            
            // 避免重复添加监听器
            if (!window.debugIPCInitialized) {
                            // 调试状态变化
            ipcRenderer.on('debug-started', (event, data) => {
                console.log('[前端] 收到debug-started事件:', data);
                this.onDebugStarted(data);
            });

            ipcRenderer.on('debug-stopped', (event, data) => {
                console.log('[前端] 收到debug-stopped事件:', data);
                this.onDebugStopped(data);
            });

            ipcRenderer.on('debug-running', (event) => {
                console.log('[前端] 收到debug-running事件');
                this.onDebugRunning();
            });

            ipcRenderer.on('debug-program-exited', (event, data) => {
                this.onProgramExited(data);
            });

            ipcRenderer.on('debug-ready-waiting', (event, data) => {
                this.onDebugReadyWaiting(data);
            });

            ipcRenderer.on('debug-breakpoint-hit', (event, data) => {
                this.onBreakpointHit(data);
            });

            ipcRenderer.on('debug-error', (event, error) => {
                this.onDebugError(error);
            });

                // 变量更新
                ipcRenderer.on('debug-variables-updated', (event, variables) => {
                    this.onVariablesUpdated(variables);
                });

                // 调用栈更新
                ipcRenderer.on('debug-callstack-updated', (event, callStack) => {
                    this.onCallStackUpdated(callStack);
                });

                // 断点命中
                ipcRenderer.on('debug-breakpoint-hit', (event, breakpoint) => {
                    this.onBreakpointHit(breakpoint);
                });

                window.debugIPCInitialized = true;
                console.log('调试IPC监听器已设置');
            }
        } catch (error) {
            console.error('设置调试IPC失败:', error);
        }
    }

    async handleDebugStart() {
        console.log('开始调试会话');
        
        // 首先检查GDB是否可用
        try {
            this.showMessage('检查调试环境...', 'info');
            const gdbStatus = await this.checkGDBAvailability();
            
            if (!gdbStatus.available) {
                this.showMessage(gdbStatus.message, 'error');
                this.showGDBInstallGuide();
                return;
            }
            
            console.log('GDB检查通过:', gdbStatus.message);
        } catch (error) {
            console.error('GDB检查失败:', error);
            this.showMessage('无法检查调试环境。请确保GDB已正确安装。', 'error');
            return;
        }
        
        // 获取当前文件
        const currentFile = this.getCurrentFilePath();
        console.log('当前文件路径:', currentFile);
        
        if (!currentFile) {
            this.showMessage('没有打开的文件可以调试。请先打开一个C++源文件。', 'warning');
            return;
        }

        // 检查文件是否为C++文件
        if (!currentFile.match(/\.(cpp|cc|cxx|c)$/i)) {
            this.showMessage('请打开一个C++源文件进行调试。当前文件不是C++源文件。', 'warning');
            return;
        }

        // 先编译代码
        this.showMessage('正在编译代码，准备调试...', 'info');
        
        try {
            // 检查编译器是否可用
            if (!this.compilerManager) {
                this.showMessage('编译器未初始化，无法进行调试', 'error');
                return;
            }

            // 启动编译
            console.log('开始编译代码...');
            await this.compileBeforeDebug();
            
            // 编译成功后，检查可执行文件是否存在
            const executablePath = currentFile.replace(/\.(cpp|cc|cxx|c)$/i, '.exe');
            console.log('检查可执行文件:', executablePath);
            
            // 等待一小段时间确保文件系统同步
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 启动调试会话
            this.startDebugSession(currentFile);
            
        } catch (error) {
            console.error('编译失败:', error);
            this.showMessage('编译失败，无法启动调试: ' + error.message, 'error');
        }
    }

    // 检查GDB可用性
    async checkGDBAvailability() {
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('check-gdb-availability');
            } catch (error) {
                console.error('检查GDB可用性失败:', error);
                throw error;
            }
        } else {
            throw new Error('Electron环境不可用');
        }
    }

    // 显示GDB安装指南
    showGDBInstallGuide() {
        const container = document.getElementById('debug-variables');
        if (container) {
            container.innerHTML = `
                <div class="debug-error-message" style="padding: 16px; color: #f44747;">
                    <h3>GDB调试器未安装</h3>
                    <p>调试功能需要GDB调试器支持。请安装GDB：</p>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li><strong>Windows:</strong> 安装MinGW-w64或TDM-GCC</li>
                        <li><strong>Linux:</strong> sudo apt install gdb（Ubuntu/Debian）</li>
                        <li><strong>macOS:</strong> brew install gdb</li>
                    </ul>
                    <p style="margin-top: 16px; font-size: 12px; color: #cccccc;">
                        安装完成后重启IDE即可使用调试功能。
                    </p>
                </div>
            `;
        }
    }

    // 为调试而编译的专用方法
    async compileBeforeDebug() {
        return new Promise((resolve, reject) => {
            console.log('开始为调试编译代码...');
            
            // 确保编译管理器已初始化
            if (!this.compilerManager) {
                reject(new Error('编译器未初始化'));
                return;
            }
            
            // 检查编译器设置
            if (!this.settings.compilerPath) {
                reject(new Error('请先设置编译器路径'));
                return;
            }
            
            let resolved = false;
            
            // 监听编译结果
            const handleCompileResult = (success, error = null) => {
                if (resolved) return;
                resolved = true;
                
                // 移除事件监听器
                window.removeEventListener('compile-success', handleSuccess);
                window.removeEventListener('compile-error', handleError);
                
                if (success) {
                    console.log('编译成功，准备启动调试');
                    resolve();
                } else {
                    console.log('编译失败，无法启动调试:', error);
                    reject(new Error(error || '编译失败'));
                }
            };
            
            const handleSuccess = (event) => {
                console.log('收到编译成功事件:', event.detail);
                handleCompileResult(true);
            };
            
            const handleError = (event) => {
                console.log('收到编译失败事件:', event.detail);
                handleCompileResult(false, event.detail);
            };
            
            // 添加临时事件监听器
            window.addEventListener('compile-success', handleSuccess);
            window.addEventListener('compile-error', handleError);
            
            // 开始编译 - 这会显示编译面板
            console.log('调用编译管理器编译当前文件（调试模式）');
            try {
                this.compilerManager.compileCurrentFile({ forDebug: true });
            } catch (error) {
                handleCompileResult(false, error.message);
                return;
            }
            
            // 设置超时
            setTimeout(() => {
                if (!resolved) {
                    handleCompileResult(false, '编译超时');
                }
            }, 30000); // 30秒超时
        });
    }

    // 启动调试会话的方法
    startDebugSession(currentFile) {
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                console.log('发送start-debug IPC消息，文件:', currentFile);
                
                // 获取当前设置的断点
                const breakpoints = this.getBreakpoints();
                console.log('当前断点:', breakpoints);
                
                ipcRenderer.send('start-debug', currentFile, {
                    breakpoints: breakpoints
                });
                
                this.updateDebugControlsState(true);
                this.showMessage('正在启动调试会话...', 'info');
                this.updateDebugStatus('正在启动调试会话...');
            } catch (error) {
                console.error('启动调试失败:', error);
                this.showMessage('启动调试失败: ' + error.message, 'error');
            }
        } else {
            console.error('require函数不可用，无法调用IPC');
            this.showMessage('调试功能初始化失败：无法访问系统API', 'error');
        }
    }

    // 获取当前设置的断点
    getBreakpoints() {
        const breakpoints = [];
        const currentFile = this.getCurrentFilePath();
        
        console.log('[前端] 获取断点，当前文件:', currentFile);
        
        try {
            // 从新的编辑器管理器获取断点
            if (window.editorManager && window.editorManager.breakpoints) {
                const allBreakpoints = window.editorManager.breakpoints;
                console.log('[前端] 编辑器管理器中的所有断点:', allBreakpoints);
                
                // 遍历所有文件的断点
                for (const [tabId, fileBreakpoints] of allBreakpoints) {
                    if (fileBreakpoints && fileBreakpoints.size > 0) {
                        // 获取该标签页对应的编辑器
                        const editor = window.editorManager.editors.get(tabId);
                        if (editor && editor.filePath) {
                            const filePath = editor.filePath;
                            for (const lineNumber of fileBreakpoints) {
                                breakpoints.push({
                                    file: filePath,
                                    line: lineNumber
                                });
                                console.log(`[前端] 找到断点: ${filePath}:${lineNumber}`);
                            }
                        }
                    }
                }
            }
            
            // 备用方案：从当前编辑器获取断点
            if (breakpoints.length === 0 && window.editorManager && window.editorManager.currentEditor) {
                const currentEditor = window.editorManager.currentEditor;
                if (currentEditor && currentEditor.breakpoints && currentFile) {
                    for (const lineNumber of currentEditor.breakpoints) {
                        breakpoints.push({
                            file: currentFile,
                            line: lineNumber
                        });
                        console.log(`[前端] 从当前编辑器找到断点: ${currentFile}:${lineNumber}`);
                    }
                }
            }
            
        } catch (error) {
            console.error('[前端] 获取断点时出错:', error);
        }
        
        console.log('[前端] 最终获取到的断点:', breakpoints);
        return breakpoints;
    }

    getCurrentFilePath() {
        // 首先尝试从编辑器管理器获取当前文件
        if (window.editorManager) {
            const currentEditor = window.editorManager.getCurrentEditor();
            if (currentEditor && currentEditor.filePath) {
                return currentEditor.filePath;
            }
        }
        
        // 如果编辑器管理器不可用，尝试从this.currentFile获取
        if (this.editor && this.currentFile) {
            return this.currentFile;
        }
        
        return null;
    }

    getBreakpoints() {
        // 获取当前设置的断点
        // 这里可以从编辑器或断点管理器获取断点信息
        try {
            if (window.editorManager) {
                const currentEditor = window.editorManager.getCurrentEditor();
                if (currentEditor && currentEditor.getBreakpoints) {
                    return currentEditor.getBreakpoints();
                }
            }
            
            // 如果没有断点管理器，返回空数组
            return [];
        } catch (error) {
            console.warn('获取断点信息失败:', error);
            return [];
        }
    }

    updateDebugControlsState(isDebugging) {
        const controls = {
            'debug-start': !isDebugging,
            'debug-continue': isDebugging,
            'debug-step-over': isDebugging,
            'debug-step-into': isDebugging,
            'debug-step-out': isDebugging,
            'debug-stop': isDebugging,
            'debug-add-watch': isDebugging,
            'debug-refresh-vars': isDebugging
        };

        Object.entries(controls).forEach(([id, enabled]) => {
            const button = document.getElementById(id);
            if (button) {
                button.disabled = !enabled;
            }
        });
    }

    onDebugStarted(data) {
        console.log('[前端] 调试已启动:', data);
        this.updateDebugControlsState(true);
        this.showMessage('调试会话已启动', 'success');
        
        // 更新所有调试面板的状态
        this.updateAllDebugPanels('调试会话已启动，程序已加载');
        
        // 更新调试状态显示
        this.updateDebugStatus('调试器已启动，程序准备运行');
        this.showDebugInfo(`调试会话已启动
        
程序已加载: ${data.executable || data.sourceFile}
状态: 等待运行或断点命中

提示:
- 点击行号设置断点
- 使用F5继续执行
- 使用F10单步执行
- 查看右侧变量面板`);
    }

    onDebugStopped(data) {
        console.log('[前端] 调试已停止:', data);
        this.updateDebugControlsState(false);
        
        if (data.reason === 'program-exited') {
            this.showMessage(`程序运行完成，退出码: ${data.exitCode || 0}`, 'success');
            this.updateDebugStatus(`程序运行完成，退出码: ${data.exitCode || 0}`);
            this.showDebugInfo(`程序运行完成，退出码: ${data.exitCode || 0}\n\n程序输出应该在终端窗口中显示。`);
        } else {
            this.showMessage('调试会话已停止', 'info');
            this.updateDebugStatus('调试会话已停止');
            this.showDebugInfo('调试会话已停止');
        }
        
        // 恢复等待状态
        this.showWaitingMessages();
    }

    onDebugRunning() {
        console.log('[前端] 程序正在运行');
        this.updateDebugStatus('程序正在运行...');
        this.showDebugInfo('程序正在运行，请等待程序执行或命中断点\n\n如果程序需要输入，请在控制台或弹出的终端窗口中输入');
        
        // 清除继续按钮的高亮效果
        this.clearContinueButtonHighlight();
    }

    clearContinueButtonHighlight() {
        const continueBtn = document.getElementById('debug-continue');
        if (continueBtn) {
            continueBtn.style.animation = '';
            continueBtn.style.background = '';
            continueBtn.style.transform = '';
            continueBtn.title = '继续执行';
        }
    }

    onProgramExited(data) {
        console.log('[前端] 程序已退出:', data);
        this.updateDebugStatus(`程序执行完成，退出码: ${data.exitCode}`);
        this.showDebugInfo(`程序执行完成，退出码: ${data.exitCode}`);
    }

    onDebugReadyWaiting(data) {
        console.log('[前端] 调试器就绪等待:', data);
        this.updateDebugStatus('调试器已就绪，等待启动程序');
        
        const message = `调试器已成功启动并准备就绪！

${data.message || '程序已加载，等待开始执行'}

操作提示:
- 点击 "继续执行" 按钮 (▶️) 或按 F5 开始运行程序
- 如果设置了断点，程序会在断点处停止
- 如果没有断点，程序会正常运行到结束

当前状态: ${data.hasBreakpoints ? '已设置断点' : '未设置断点'}`;
        
        this.showDebugInfo(message);
        
        // 高亮继续执行按钮，提示用户点击
        this.highlightContinueButton();
    }

    highlightContinueButton() {
        const continueBtn = document.getElementById('debug-continue');
        if (continueBtn) {
            // 添加CSS动画（如果不存在）
            this.addPulseAnimation();
            
            // 添加闪烁效果提示用户
            continueBtn.style.animation = 'debug-pulse 2s infinite';
            continueBtn.style.background = '#0078d4';
            continueBtn.style.transform = 'scale(1.05)';
            continueBtn.title = '点击开始运行程序 (F5)';
            
            // 5秒后移除动画
            setTimeout(() => {
                continueBtn.style.animation = '';
                continueBtn.style.background = '';
                continueBtn.style.transform = '';
                continueBtn.title = '继续执行';
            }, 5000);
        }
    }

    addPulseAnimation() {
        // 检查是否已经添加了动画CSS
        if (!document.getElementById('debug-pulse-animation')) {
            const style = document.createElement('style');
            style.id = 'debug-pulse-animation';
            style.textContent = `
                @keyframes debug-pulse {
                    0% { 
                        transform: scale(1); 
                        box-shadow: 0 0 0 0 rgba(0, 120, 212, 0.7); 
                    }
                    50% { 
                        transform: scale(1.05); 
                        box-shadow: 0 0 0 10px rgba(0, 120, 212, 0); 
                    }
                    100% { 
                        transform: scale(1); 
                        box-shadow: 0 0 0 0 rgba(0, 120, 212, 0); 
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    updateAllDebugPanels(message) {
        // 更新所有调试面板的状态
        const containers = ['local-variables', 'global-variables', 'watch-variables', 'call-stack'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = `<div class="debug-panel-message" style="padding: 8px; color: #cccccc; font-size: 12px;">${message}</div>`;
            }
        });

        // 同时更新主调试信息显示
        this.showDebugInfo(message);
    }

    onDebugError(error) {
        console.error('调试错误:', error);
        this.showMessage('调试错误: ' + error, 'error');
        this.updateDebugControlsState(false);
    }

    onVariablesUpdated(variables) {
        console.log('变量已更新:', variables);
        this.updateVariablesDisplay(variables);
    }

    onCallStackUpdated(callStack) {
        console.log('调用堆栈已更新:', callStack);
        this.updateCallStackDisplay(callStack);
    }

    onBreakpointHit(breakpoint) {
        console.log('[前端] 断点命中:', breakpoint);
        
        const fileName = breakpoint.file ? breakpoint.file.split(/[\\/]/).pop() : '未知文件';
        this.showMessage(`断点命中: ${fileName}:${breakpoint.line}`, 'info');
        this.updateDebugStatus(`断点命中: ${fileName}:${breakpoint.line} (${breakpoint.function || '未知函数'})`);
        
        const debugInfo = `断点命中！

文件: ${fileName}
行号: ${breakpoint.line}
函数: ${breakpoint.function || '未知函数'}

程序已暂停，您可以：
- 查看右侧变量面板中的当前变量值
- 使用F5继续执行
- 使用F10单步执行
- 使用F11步入函数`;
        
        this.showDebugInfo(debugInfo);
        
        // 清除等待状态，显示调试数据
        this.clearWaitingMessages();
        
        // 高亮当前行（如果可能）
        this.highlightCurrentLine(breakpoint.file, breakpoint.line);
    }

    highlightCurrentLine(file, line) {
        // 尝试在编辑器中高亮当前执行行
        try {
            if (window.editorManager && window.editorManager.currentEditor) {
                const currentEditor = window.editorManager.currentEditor;
                if (currentEditor.highlightLine) {
                    currentEditor.highlightLine(line);
                }
            }
        } catch (error) {
            console.warn('[前端] 高亮当前行失败:', error);
        }
    }

    clearWaitingMessages() {
        const containers = ['local-variables', 'global-variables', 'watch-variables', 'call-stack'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                const waitingMsg = container.querySelector('.waiting-debug-message');
                if (waitingMsg) {
                    waitingMsg.style.display = 'none';
                }
            }
        });
    }

    showWaitingMessages() {
        const containers = ['local-variables', 'global-variables', 'watch-variables', 'call-stack'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '<div class="waiting-debug-message">等待开始调试...</div>';
            }
        });
    }

    updateDebugStatus(message) {
        // 更新调试状态显示
        const statusElement = document.querySelector('.debug-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
        
        // 也可以在控制台输出
        console.log('[调试状态]', message);
    }

    showDebugInfo(message) {
        // 在调试面板中显示信息
        const container = document.getElementById('debug-variables');
        if (container) {
            // 查找现有的信息显示区域或创建新的
            let infoElement = container.querySelector('.debug-info-message');
            if (!infoElement) {
                infoElement = document.createElement('div');
                infoElement.className = 'debug-info-message';
                infoElement.style.cssText = `
                    padding: 16px; 
                    color: #cccccc; 
                    background: #252526; 
                    border: 1px solid #464647; 
                    border-radius: 4px; 
                    margin: 8px;
                    font-size: 14px;
                    line-height: 1.5;
                `;
                container.insertBefore(infoElement, container.firstChild);
            }
            
            infoElement.innerHTML = `
                <h4 style="margin: 0 0 8px 0; color: #4fc3f7;">调试状态</h4>
                <p style="margin: 0; white-space: pre-line;">${message}</p>
            `;
        }
    }

    updateVariablesDisplay(variables) {
        // 更新局部变量
        if (variables.local) {
            this.renderVariables('local-variables', variables.local, 'local');
        }
        
        // 更新全局变量
        if (variables.global) {
            this.renderVariables('global-variables', variables.global, 'global');
        }
        
        // 更新监视变量
        if (variables.watches) {
            this.renderVariables('watch-variables', variables.watches, 'watch');
        }
    }

    renderVariables(containerId, variables, scope) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        
        if (Object.keys(variables).length === 0) {
            container.innerHTML = '<div class="no-debug-message">没有变量</div>';
            return;
        }

        Object.entries(variables).forEach(([name, data]) => {
            const variableElement = this.createVariableElement(name, data, scope);
            container.appendChild(variableElement);
        });
    }

    createVariableElement(name, data, scope) {
        const element = document.createElement('div');
        element.className = 'variable-item';
        
        const hasChildren = data.children && data.children.length > 0;
        
        element.innerHTML = `
            <div class="variable-header">
                ${hasChildren ? '<span class="expand-toggle">▶</span>' : '<span class="expand-spacer"></span>'}
                <span class="variable-name" title="${data.type || 'unknown'}">${name}</span>
                <span class="variable-value" title="${data.value || ''}">${this.formatVariableValue(data)}</span>
                ${scope === 'watch' ? '<button class="remove-watch-btn" title="移除监视">×</button>' : ''}
            </div>
        `;
        
        return element;
    }

    formatVariableValue(data) {
        if (!data.value) return '';
        
        let displayValue = data.value.toString();
        
        // 对于容器和数组，显示额外信息
        if (data.isContainer || data.isArray) {
            const count = data.elementCount !== null ? data.elementCount : '?';
            const type = data.isArray ? '数组' : '容器';
            displayValue = `${type}[${count}] ${displayValue}`;
        }
        
        // 限制显示长度
        if (displayValue.length > 50) {
            displayValue = displayValue.substring(0, 47) + '...';
        }
        
        return displayValue;
    }

    updateCallStackDisplay(callStack) {
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
            
            container.appendChild(frameElement);
        });
    }

    showDebugError(message) {
        const container = document.getElementById('debug-variables');
        if (container) {
            container.innerHTML = `
                <div class="debug-error-message" style="padding: 16px; color: #f44747;">
                    <p><strong>调试功能错误</strong></p>
                    <p>${message}</p>
                    <p style="margin-top: 8px; font-size: 11px; color: #cccccc;">
                        请检查GDB是否已安装，代码是否已编译（使用-g选项）
                    </p>
                </div>
            `;
        }
    }

    handleDebugContinue() {
        console.log('继续执行调试');
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('debug-continue');
            this.showMessage('继续执行程序...', 'info');
            this.updateDebugStatus('继续执行程序...');
        }
    }

    handleDebugStepOver() {
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('debug-step-over');
        }
    }

    handleDebugStepInto() {
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('debug-step-into');
        }
    }

    handleDebugStepOut() {
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('debug-step-out');
        }
    }

    handleDebugStop() {
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('stop-debug');
        }
    }

    handleAddWatch() {
        const variableName = prompt('请输入要监视的变量名或表达式：\n例如：myVar, array[0], obj.member');
        if (variableName && variableName.trim()) {
            if (typeof require !== 'undefined') {
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('debug-add-watch', variableName.trim());
                this.showMessage(`已添加监视变量: ${variableName.trim()}`, 'info');
            }
        }
    }

    handleRefreshVariables() {
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('debug-request-variables');
        }
    }

    toggleCategory(header) {
        const arrow = header.querySelector('.expand-arrow');
        const content = header.nextElementSibling;
        
        if (content && arrow) {
            if (content.style.display === 'none') {
                content.style.display = 'block';
                arrow.textContent = '▼';
            } else {
                content.style.display = 'none';
                arrow.textContent = '▶';
            }
        }
    }

    compileCode() {
        if (this.compilerManager) {
            this.compilerManager.compileCurrentFile();
        }
    }

    runCode() {
        if (this.compilerManager) {
            this.compilerManager.runCurrentFile();
        }
    }

    showAbout() {
        const dialog = document.createElement('div');
        dialog.className = 'about-dialog-overlay';
        dialog.innerHTML = `
            <div class="about-dialog">
                <div class="about-header">
                    <div class="about-logo">
                        <img id="about-dialog-icon" src="../../oicpp.ico" width="48" height="48" alt="OICPP IDE">
                    </div>
                    <h2>关于 OICPP IDE</h2>
                </div>
                <div class="about-content">
                    <p><strong>版本:</strong> 1.0.0-alpha3</p>
                    <p><strong>构建时间:</strong> 2025年7月16日 15:50:31</p>
                    <p><strong>开发者:</strong> mywwzh</p>
                    <p><strong>描述:</strong> 专为 OI 选手优化的 C++ 开发环境</p>
                </div>
                <div class="about-footer">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        
        // 设置用户图标路径
        this.setAboutDialogIcon();
    }

    async setAboutDialogIcon() {
        try {
            const userIconPath = await window.electronAPI.getUserIconPath();
            const aboutIcon = document.getElementById('about-dialog-icon');
            if (aboutIcon) {
                aboutIcon.src = userIconPath;
            }
        } catch (error) {
            console.warn('无法设置关于对话框图标:', error);
        }
    }

    checkForUpdates() {
        // 通过IPC调用主进程的检查更新功能
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                console.log('[渲染进程] 触发手动检查更新');
                
                // 发送检查更新信号到主进程
                ipcRenderer.send('check-updates-manual');
                
                // 显示检查中的提示
                this.showUpdateCheckingDialog();
            } catch (error) {
                console.error('[渲染进程] 检查更新失败:', error);
                alert('检查更新功能暂时不可用');
            }
        } else {
            console.warn('[渲染进程] Electron环境不可用，无法检查更新');
            alert('检查更新功能仅在Electron环境中可用');
        }
    }

    showUpdateCheckingDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'update-dialog-overlay';
        dialog.id = 'update-checking-dialog';
        dialog.innerHTML = `
            <div class="update-dialog">
                <div class="update-header">
                    <h3>检查更新</h3>
                </div>
                <div class="update-content">
                    <div class="update-spinner"></div>
                    <p>正在检查更新，请稍候...</p>
                </div>
                <div class="update-footer">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        
        // 3秒后自动关闭检查对话框（实际检查结果会由主进程处理）
        setTimeout(() => {
            const dialogElement = document.getElementById('update-checking-dialog');
            if (dialogElement) {
                dialogElement.remove();
            }
        }, 3000);
    }

    // 保存设置
    async saveSettings(type) {
        const dialog = document.querySelector('.settings-dialog-overlay');
        if (!dialog) return;
        
        // 收集设置数据（使用简化的扁平结构）
        const newSettings = {};
        
        // 根据设置类型收集数据
        switch (type) {
            case 'compiler':
                const compilerPath = dialog.querySelector('#compiler-path')?.value || '';
                const compilerOptions = dialog.querySelector('#compiler-options')?.value || '-std=c++14 -O2 -static';
                newSettings.compilerPath = compilerPath;
                newSettings.compilerArgs = compilerOptions;
                break;
            case 'editor':
                const font = dialog.querySelector('#editor-font')?.value || 'Consolas';
                const theme = dialog.querySelector('#editor-theme')?.value || 'dark';
                const fontSize = parseInt(dialog.querySelector('#editor-fontsize')?.value || '14');
                const autoComplete = dialog.querySelector('#editor-autocomplete')?.checked !== false;
                newSettings.font = font;
                newSettings.theme = theme;
                newSettings.fontSize = fontSize;
                newSettings.enableAutoCompletion = autoComplete;
                break;
            case 'templates':
                const cppTemplate = dialog.querySelector('#cpp-template')?.value || this.getDefaultCppTemplate();
                newSettings.cppTemplate = cppTemplate;
                break;
            default:
                console.warn('未知的设置类型:', type);
                return;
        }
        
        // 通过 electronAPI 保存到主进程
        try {
            if (window.electronAPI && window.electronAPI.updateSettings) {
                const result = await window.electronAPI.updateSettings(newSettings);
                if (result.success) {
                    console.log(`${type} 设置已保存:`, newSettings);
                    
                    // 更新本地设置缓存（使用扁平结构）
                    Object.assign(this.settings, newSettings);
                    
                    // 应用设置
                    this.applySettings();
                    
                    // 显示成功消息
                    this.showMessage(`${type} 设置已保存`, 'success');
                } else {
                    throw new Error(result.error || '保存失败');
                }
            } else {
                // 回退到localStorage（兼容性）
                localStorage.setItem(`oicpp_settings_${type}`, JSON.stringify({[type]: newSettings}));
                console.log(`${type} 设置已保存到本地:`, newSettings);
                this.showMessage(`${type} 设置已保存`, 'success');
            }
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showMessage('保存设置失败: ' + error.message, 'error');
        }
        
        // 关闭对话框
        dialog.remove();
    }

    async selectCompilerPath() {
        try {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                const result = await window.electronAPI.showOpenDialog({
                    title: '选择编译器',
                    filters: [
                        { name: '可执行文件', extensions: ['exe'] },
                        { name: '所有文件', extensions: ['*'] }
                    ],
                    properties: ['openFile']
                });
                
                if (!result.canceled && result.filePaths.length > 0) {
                    const compilerPath = result.filePaths[0];
                    const pathInput = document.querySelector('#compiler-path');
                    if (pathInput) {
                        pathInput.value = compilerPath;
                    }
                }
            } else {
                this.showMessage('文件选择功能不可用', 'error');
            }
        } catch (error) {
            console.error('选择编译器路径失败:', error);
            this.showMessage('选择编译器路径失败: ' + error.message, 'error');
        }
    }

    installCompiler() {
        // 简单的安装指导
        this.showMessage('请访问 https://sourceforge.net/projects/mingw-w64/ 下载并安装 MinGW-w64', 'info');
    }

    collectCompilerSettings(dialog) {
        const settings = {};
        const inputs = dialog.querySelectorAll('input, select');
        inputs.forEach(input => {
            if (input.name) {
                settings[input.name] = input.value;
            }
        });
        return settings;
    }

    collectEditorSettings(dialog) {
        const settings = {};
        const inputs = dialog.querySelectorAll('input, select');
        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    settings[input.name] = input.checked;
                } else if (input.type === 'number') {
                    settings[input.name] = parseInt(input.value);
                } else {
                    settings[input.name] = input.value;
                }
            }
        });
        return settings;
    }

    collectTerminalSettings(dialog) {
        const settings = {};
        const inputs = dialog.querySelectorAll('input, select');
        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    settings[input.name] = input.checked;
                } else {
                    settings[input.name] = input.value;
                }
            }
        });
        return settings;
    }

    showMessage(message, type = 'info') {
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
            font-size: 14px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        if (type === 'success') {
            messageDiv.style.backgroundColor = '#4CAF50';
        } else if (type === 'error') {
            messageDiv.style.backgroundColor = '#f44336';
        } else {
            messageDiv.style.backgroundColor = '#2196F3';
        }
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    // 状态栏更新
    updateStatusBar() {
        // 更新状态栏信息
        const statusBar = document.querySelector('.status-bar');
        if (statusBar) {
            const cursor = statusBar.querySelector('.cursor-position');
            const encoding = statusBar.querySelector('.encoding');
            const language = statusBar.querySelector('.language');
            
            if (this.editorManager && this.editorManager.currentEditor) {
                const editor = this.editorManager.currentEditor;
                const pos = editor.cursorPosition || { line: 1, column: 1 };
                
                if (cursor) cursor.textContent = `行 ${pos.line}, 列 ${pos.column}`;
                if (encoding) encoding.textContent = 'UTF-8';
                if (language) language.textContent = 'C++';
            }
        }
    }

    onFileSaved(filePath) {
        console.log('文件已保存:', filePath);
        // 更新文件状态
        if (this.editorManager) {
            this.editorManager.markFileSaved(filePath);
        }
    }

    onFolderOpened(folderPath) {
        console.log('文件夹已打开:', folderPath);
        
        // 关闭欢迎页面
        if (window.tabManager && window.tabManager.tabs.has('Welcome')) {
            console.log('自动关闭欢迎页面');
            window.tabManager.closeWelcomePage();
        }
        
        // 通知文件管理器设置工作区
        if (window.sidebarManager) {
            const fileExplorer = window.sidebarManager.getPanelManager('files');
            if (fileExplorer) {
                fileExplorer.setWorkspace(folderPath);
            }
            
            // 切换到文件管理器面板
            window.sidebarManager.showPanel('files');
        }
        
        // 触发工作区打开事件，用于关闭欢迎页面
        const event = new CustomEvent('workspace-opened', {
            detail: { folderPath: folderPath }
        });
        document.dispatchEvent(event);
    }

    formatCode() {
        if (this.editorManager && this.editorManager.currentEditor) {
            // 调用编辑器的格式化功能
            if (this.editorManager.currentEditor.formatCode) {
                this.editorManager.currentEditor.formatCode();
            } else {
                console.log('编辑器不支持代码格式化功能');
            }
        }
    }

    showFindReplace() {
        // 使用全局查找替换管理器显示面板
        if (typeof findReplaceManager !== 'undefined' && findReplaceManager) {
            findReplaceManager.show();
        } else {
            console.warn('查找替换功能未初始化');
        }
    }

    compileAndRun() {
        if (this.compilerManager) {
            this.compilerManager.compileAndRun();
        }
    }
}

// 导出类
window.OICPPApp = OICPPApp;

// 创建应用实例
window.app = new OICPPApp();
