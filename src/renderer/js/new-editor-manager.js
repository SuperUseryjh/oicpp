// 新的编辑器管理器，使用自研编辑器
class NewEditorManager {
    constructor() {
        this.editors = new Map();
        this.currentEditor = null;
        this.currentTabId = null;
        this.breakpoints = new Map();
        this.isInitialized = false;
        
        // 延迟初始化，等待DOM完全加载
        setTimeout(() => {
            this.init();
        }, 100);
    }

    async init() {
        try {
            console.log('开始初始化编辑器管理器...');
            
            // 等待DOM加载完成
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // 多次尝试找到编辑器容器
            let attempts = 0;
            while (attempts < 10) {
                const editorContainer = document.getElementById('editor-area');
                if (editorContainer) {
                    console.log('找到编辑器容器，开始设置编辑器');
                    await this.setupEditor();
                    break;
                }
                
                console.log(`第 ${attempts + 1} 次尝试寻找编辑器容器...`);
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (attempts >= 10) {
                console.error('无法找到编辑器容器，编辑器管理器初始化失败');
            }
        } catch (error) {
            console.error('编辑器管理器初始化失败:', error);
        }
    }

    async setupEditor() {
        const editorContainer = document.getElementById('editor-area');
        if (!editorContainer) {
            console.error('找不到编辑器容器，稍后重试...');
            // 延迟重试
            setTimeout(() => {
                this.setupEditor();
            }, 100);
            return;
        }

        // 创建默认编辑器
        await this.createDefaultEditor();
        this.setupEventListeners();
        
        // 清理可能存在的重复编辑器实例
        this.cleanupDuplicateEditors();
        
        this.isInitialized = true;
        
        console.log('新编辑器管理器初始化完成');
    }

    async createDefaultEditor() {
        // 生成唯一的 tabId 而不是硬编码
        const tabId = this.generateTabId('untitled-1');
        const editorContainer = document.getElementById('editor-area');
        
        console.log(`创建默认编辑器，生成的唯一tabId: ${tabId}，容器:`, editorContainer);
        
        // 清空编辑器容器，防止重叠
        editorContainer.innerHTML = '';
        
        // 检查是否显示欢迎页面
        if (this.shouldShowWelcome()) {
            this.showWelcomePage();
            return;
        }
        
        // 创建编辑器容器
        const editorDiv = document.createElement('div');
        editorDiv.id = `editor-${tabId}`;
        editorDiv.className = 'editor-instance';
        editorDiv.style.display = 'block';  // 确保编辑器可见
        editorDiv.style.width = '100%';
        editorDiv.style.height = '100%';
        editorDiv.style.position = 'relative';
        editorContainer.appendChild(editorDiv);

        console.log('创建编辑器实例...');
        
        // 等待一小段时间确保DOM准备好
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 获取当前主题设置
        const currentTheme = document.body.getAttribute('data-theme') || 
                           document.body.getAttribute('data-editor-theme') || 'dark';
        
        // 创建自研编辑器实例
        const editor = new CustomEditor(editorDiv, {
            language: 'cpp',
            theme: currentTheme,
            fontSize: 14,
            tabSize: 4,
            wordWrap: false,
            showLineNumbers: true,
            highlightCurrentLine: true,
            autoCompletion: true,
            bracketMatching: true,
            tabId: tabId  // 传递唯一的tabId
        });

        console.log(`编辑器实例创建完成，editorId: ${editor.editorId}, tabId: ${tabId}`);

        // 设置编辑器事件回调
        editor.onSave = async (content) => {
            await this.saveFile(tabId, content);
        };

        editor.onBreakpointChange = (lineNumber, isSet) => {
            this.handleBreakpointChange(tabId, lineNumber, isSet);
        };

        // 存储编辑器实例
        this.editors.set(tabId, editor);
        this.currentEditor = editor;
        this.currentTabId = tabId;
        
        // 确保全局引用正确设置
        if (window.editorManager) {
            window.editorManager.currentEditor = editor;
        }

        // 初始化查找替换功能
        if (typeof initializeFindReplace === 'function') {
            initializeFindReplace(editor);
            console.log('查找替换功能已初始化');
        }

        // 创建默认标签页
        this.createTab(tabId, 'untitled-1.cpp', false);
        
        console.log('默认编辑器创建完成');
    }

    shouldShowWelcome() {
        // 永远不显示欢迎页面，直接创建编辑器
        // 这样可以确保用户直接进入编辑界面
        console.log('检查是否应该显示欢迎页面: false (强制不显示)');
        return false;
    }

    showWelcomePage() {
        const editorContainer = document.getElementById('editor-area');
        
        editorContainer.innerHTML = `
            <div class="welcome-page">
                <div class="welcome-header">
                    <div class="welcome-logo">
                        <svg width="64" height="64" viewBox="0 0 64 64" fill="currentColor">
                            <path d="M32 4L8 16v32l24 12 24-12V16L32 4z"/>
                            <path d="M32 20L20 24v16l12 6 12-6V24L32 20z"/>
                        </svg>
                    </div>
                    <h1 class="welcome-title">OICPP IDE</h1>
                    <p class="welcome-subtitle">专为 OI 选手优化的 C++ 开发环境</p>
                </div>
                
                <div class="welcome-content">
                    <div class="welcome-section">
                        <h2>开始</h2>
                        <div class="welcome-actions">
                            <button class="welcome-button" onclick="window.oicppApp.createNewCppFile()">
                                <span class="button-icon">📄</span>
                                <span class="button-text">新建 C++ 文件</span>
                            </button>
                            <button class="welcome-button" onclick="window.oicppApp.openFile()">
                                <span class="button-icon">📁</span>
                                <span class="button-text">打开文件</span>
                            </button>
                            <button class="welcome-button" onclick="window.oicppApp.openFolder()">
                                <span class="button-icon">📂</span>
                                <span class="button-text">打开文件夹</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="welcome-section">
                        <h2>最近文件</h2>
                        <div class="recent-files">
                            <div class="empty-recent">暂无最近文件</div>
                        </div>
                    </div>
                </div>
                
                <div class="welcome-footer">
                    <div class="version-info">
                        <span>OICPP IDE v1.0.0-alpha3</span>
                        <span>© 2024 mywwzh</span>
                    </div>
                </div>
            </div>
        `;
    }

    createTab(tabId, fileName, isDirty = false) {
        const tabBar = document.querySelector('.tab-bar');
        if (!tabBar) {
            console.warn('找不到标签栏容器');
            return;
        }

        // 检查标签页是否已存在
        const existingTab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (existingTab) {
            return;
        }

        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.tabId = tabId;
        
        if (tabId === this.currentTabId) {
            tab.classList.add('active');
        }

        tab.innerHTML = `
            <span class="tab-label">${fileName}${isDirty ? ' •' : ''}</span>
            <button class="tab-close" title="关闭">×</button>
        `;

        // 插入到添加按钮之前
        const addBtn = tabBar.querySelector('.tab-add');
        if (addBtn) {
            tabBar.insertBefore(tab, addBtn);
        } else {
            tabBar.appendChild(tab);
        }

        // 添加事件监听器
        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close')) {
                this.closeTab(tabId);
            } else {
                this.switchTab(tabId);
            }
        });
    }

    async switchTab(tabId) {
        console.log(`============= 开始切换到标签页: ${tabId} =============`);
        console.log(`当前编辑器数量: ${this.editors.size}`);
        console.log(`当前所有编辑器:`, Array.from(this.editors.keys()));
        console.log(`当前活跃标签页: ${this.currentTabId}`);
        
        // 检查目标编辑器是否存在
        const targetEditor = this.editors.get(tabId);
        if (!targetEditor) {
            console.error(`无法找到目标编辑器实例，tabId: ${tabId}`);
            console.log(`可用的编辑器:`, Array.from(this.editors.keys()));
            return;
        }
        
        console.log(`找到目标编辑器: ${targetEditor.editorId}，内容长度: ${targetEditor.content ? targetEditor.content.length : 0}`);
        
        // 保存当前编辑器状态（如果存在）
        if (this.currentTabId && this.currentEditor) {
            console.log(`保存当前编辑器 ${this.currentTabId} 的状态`);
            // 确保当前编辑器的撤销栈被保存
            this.currentEditor.saveToUndoStack();
            console.log(`保存当前编辑器 ${this.currentTabId} 的撤销栈，长度:`, this.currentEditor.undoStack.length);
            
            // 只有在有未保存修改时才保存到临时文件
            if (this.currentEditor.isModified && this.currentEditor.content && this.currentEditor.content.trim() !== '') {
                console.log(`编辑器 ${this.currentTabId} 有未保存修改，保存到临时文件`);
                await this.currentEditor.saveToTempFile();
            } else {
                console.log(`编辑器 ${this.currentTabId} 无需保存临时文件，修改状态: ${this.currentEditor.isModified}`);
            }
            
            // 确保当前编辑器失去焦点
            if (this.currentEditor.codeInputEl) {
                this.currentEditor.codeInputEl.blur();
                console.log(`当前编辑器 ${this.currentTabId} 已失去焦点`);
            }
        }
        
        // 确保所有编辑器都被隐藏（解决重叠问题）
        const allEditorDivs = document.querySelectorAll('.editor-instance');
        allEditorDivs.forEach(div => {
            div.style.display = 'none';
            div.style.visibility = 'hidden';
            div.style.zIndex = '-1';
        });
        console.log(`已隐藏所有编辑器DOM元素，总数: ${allEditorDivs.length}`);
        
        // 移除所有标签页的激活状态
        const allTabs = document.querySelectorAll('.tab');
        allTabs.forEach(tab => {
            tab.classList.remove('active');
        });
        console.log(`已移除所有标签页的激活状态`);

        // 显示目标编辑器
        const editorDiv = document.getElementById(`editor-${tabId}`);
        if (editorDiv) {
            editorDiv.style.display = 'block';
            editorDiv.style.visibility = 'visible';
            editorDiv.style.zIndex = '1';
            console.log(`显示编辑器DOM: editor-${tabId}，设置为可见`);
        } else {
            console.error(`找不到编辑器DOM元素: editor-${tabId}`);
        }

        // 激活新标签页
        const newTab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (newTab) {
            newTab.classList.add('active');
            console.log(`激活标签页: ${tabId}`);
        } else {
            console.error(`找不到标签页DOM元素: ${tabId}`);
        }

        // 更新当前编辑器
        const previousTabId = this.currentTabId;
        const previousEditor = this.currentEditor;
        this.currentTabId = tabId;
        this.currentEditor = this.editors.get(tabId);
        
        // 确保全局引用正确设置
        if (window.editorManager) {
            window.editorManager.currentEditor = this.currentEditor;
        }
        
        if (this.currentEditor) {
            console.log(`切换编辑器成功:`);
            console.log(`  从: ${previousTabId} (编辑器ID: ${previousEditor ? previousEditor.editorId : '无'})`);
            console.log(`  到: ${tabId} (编辑器ID: ${this.currentEditor.editorId})`);
            console.log(`  新编辑器撤销栈长度: ${this.currentEditor.undoStack.length}`);
            console.log(`  新编辑器内容长度: ${this.currentEditor.content ? this.currentEditor.content.length : 0}`);
            
            // 只有在编辑器被标记为修改过的情况下才尝试加载临时文件
            // 这避免了刚打开的文件被错误地覆盖为临时文件内容
            if (this.currentEditor.isModified) {
                console.log(`编辑器 ${tabId} 已被修改，尝试加载临时文件`);
                const hasTemp = await this.currentEditor.loadFromTempFile();
                if (hasTemp) {
                    console.log(`编辑器 ${tabId} 已从临时文件恢复内容`);
                    this.updateTabModifiedStatus(tabId, true);
                }
            } else {
                console.log(`编辑器 ${tabId} 未被修改，跳过临时文件加载`);
            }
            
            // 强制刷新编辑器显示，确保内容正确显示
            console.log(`强制刷新编辑器 ${tabId} 显示`);
            console.log(`刷新前编辑器内容长度: ${this.currentEditor.content ? this.currentEditor.content.length : 0}`);
            console.log(`刷新前textarea内容长度: ${this.currentEditor.codeInputEl ? this.currentEditor.codeInputEl.value.length : 0}`);
            console.log(`刷新前编辑器文件名: ${this.currentEditor.currentFileName}，文件路径: ${this.currentEditor.filePath}`);
            
            // 调试DOM元素状态
            console.log(`编辑器DOM状态: display=${this.currentEditor.container.style.display}, visibility=${this.currentEditor.container.style.visibility}`);
            console.log(`textarea DOM状态: display=${this.currentEditor.codeInputEl ? this.currentEditor.codeInputEl.style.display : 'null'}`);
            console.log(`编辑器是否可见: ${this.currentEditor.container.offsetParent !== null}`);
            
            // 调试内容同步状态
            if (this.currentEditor.debugContentSync) {
                const syncInfo = this.currentEditor.debugContentSync();
                console.log('切换标签页时的内容同步状态:', syncInfo);
            }
            
            this.currentEditor.refresh();
            
            // 刷新后再次检查内容和文件名
            console.log(`刷新后编辑器内容长度: ${this.currentEditor.content ? this.currentEditor.content.length : 0}`);
            console.log(`刷新后textarea内容长度: ${this.currentEditor.codeInputEl ? this.currentEditor.codeInputEl.value.length : 0}`);
            console.log(`刷新后编辑器文件名: ${this.currentEditor.currentFileName}，文件路径: ${this.currentEditor.filePath}`);
            
            // 确保新编辑器获得焦点，这样快捷键才能正确工作
            this.currentEditor.focus();
            console.log(`新编辑器 ${tabId} 已获得焦点`);
            
            // 更新查找替换管理器的编辑器引用
            if (typeof updateFindReplaceEditor === 'function') {
                updateFindReplaceEditor();
                console.log('已通知查找替换管理器更新编辑器引用');
            }
            
            console.log(`============= 标签页切换完成: ${tabId} =============`);
        } else {
            console.error(`无法找到编辑器实例，tabId: ${tabId}`);
            console.log(`当前存储的编辑器:`, Array.from(this.editors.keys()));
        }
    }

    closeTab(tabId) {
        const editor = this.editors.get(tabId);
        if (editor) {
            // 检查是否有未保存的更改
            const content = editor.getValue();
            if (content && content.trim() !== '') {
                const result = confirm('文件有未保存的更改，确定要关闭吗？');
                if (!result) return;
            }

            // 销毁编辑器
            editor.destroy();
            this.editors.delete(tabId);

            // 移除编辑器元素
            const editorDiv = document.getElementById(`editor-${tabId}`);
            if (editorDiv) {
                editorDiv.remove();
            }

            // 移除标签页
            const tab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
            if (tab) {
                tab.remove();
            }        // 如果关闭的是当前标签页，切换到其他标签页
        if (tabId === this.currentTabId) {
            const remainingTabs = document.querySelectorAll('.tab');
            if (remainingTabs.length > 0) {
                const nextTabId = remainingTabs[0].dataset.tabId;
                this.switchTab(nextTabId).catch(console.error);
            } else {
                // 如果没有剩余标签页，创建新的默认标签页
                this.createDefaultEditor();
            }
        }
        }
    }

    async openFile(filePath, content) {
        // 处理新建文件的情况（filePath为null）
        let fileName;
        if (filePath) {
            fileName = filePath.split('\\').pop() || filePath.split('/').pop();
        } else {
            fileName = 'untitled-' + Date.now() + '.cpp';
        }
        
        const tabId = this.generateTabId(fileName, filePath);
        
        console.log(`尝试打开文件: ${fileName}，生成的tabId: ${tabId}`);
        
        // 检查文件是否已经打开 (通过tabId或者编辑器映射)
        const existingEditor = this.editors.get(tabId);
        if (existingEditor) {
            console.log(`文件已打开，切换到现有编辑器: ${tabId}`);
            await this.switchTab(tabId);
            return;
        }
        
        // 额外检查：如果有同一文件路径的其他编辑器，先清理它们
        const editorsToRemove = [];
        for (const [editorTabId, editor] of this.editors.entries()) {
            if (editor.filePath === filePath && editorTabId !== tabId) {
                console.log(`发现重复的编辑器实例: ${editorTabId}，将被清理`);
                editorsToRemove.push(editorTabId);
            }
        }
        
        // 清理重复的编辑器
        for (const duplicateTabId of editorsToRemove) {
            this.closeTab(duplicateTabId);
        }

        console.log(`创建新标签页和编辑器实例: ${tabId}`);

        // 创建新的编辑器容器
        const editorContainer = document.getElementById('editor-area');
        const editorDiv = document.createElement('div');
        editorDiv.id = `editor-${tabId}`;
        editorDiv.className = 'editor-instance';
        editorDiv.style.display = 'none';
        editorContainer.appendChild(editorDiv);

        // 创建编辑器实例
        const language = this.getLanguageFromFileName(fileName);
        const editor = new CustomEditor(editorDiv, {
            language: language,
            theme: 'dark',
            fontSize: 14,
            tabSize: 4,
            wordWrap: false,
            showLineNumbers: true,
            highlightCurrentLine: true,
            autoCompletion: true,
            bracketMatching: true,
            tabId: tabId  // 传递唯一的tabId
        });

        console.log(`为文件 ${fileName} 创建了新的编辑器实例，editorId: ${editor.editorId}, tabId: ${tabId}`);

        // 设置文件路径
        editor.setFilePath(filePath);
        
        // 清理可能存在的旧临时文件
        await editor.deleteTempFile();
        
        // 设置文件内容（新文件不需要尝试加载临时文件）
        editor.setValue(content, true); // 标记为已保存
        
        // 初始化撤销栈
        editor.saveToUndoStack();
        console.log(`初始化编辑器 ${tabId} 的撤销栈`);

        // 设置回调
        editor.onSave = async (content) => {
            await this.saveFile(tabId, content, filePath);
        };

        editor.onBreakpointChange = (lineNumber, isSet) => {
            this.handleBreakpointChange(tabId, lineNumber, isSet);
        };

        // 存储编辑器实例
        this.editors.set(tabId, editor);
        this.currentEditor = editor;
        this.currentTabId = tabId;
        
        // 确保全局引用正确设置
        if (window.editorManager) {
            window.editorManager.currentEditor = editor;
        }
        
        // 更新查找替换管理器的编辑器引用
        if (typeof updateFindReplaceEditor === 'function') {
            updateFindReplaceEditor();
            console.log('已通知查找替换管理器更新编辑器引用');
        }

        console.log(`编辑器 ${tabId} 已存储到映射中，当前编辑器总数: ${this.editors.size}，当前活跃编辑器: ${this.currentEditor.editorId}`);

        // 创建标签页
        this.createTab(tabId, fileName, false);

        // 通知tabs.js同步标签页信息
        if (window.tabManager && typeof window.tabManager.syncTabDOMWithMap === 'function') {
            window.tabManager.tabs.set(fileName, {
                fileName: fileName,
                modified: false,
                content: content,
                active: true,
                filePath: filePath
            });
            window.tabManager.activeTab = fileName;
            window.tabManager.syncTabDOMWithMap(fileName, filePath);
        }

        // 切换到新标签页
        this.switchTab(tabId).catch(console.error);
    }

    newFile(fileName = 'untitled.cpp') {
        const tabId = this.generateTabId(fileName);
        
        // 创建新的编辑器容器
        const editorContainer = document.getElementById('editor-area');
        const editorDiv = document.createElement('div');
        editorDiv.id = `editor-${tabId}`;
        editorDiv.className = 'editor-instance';
        editorDiv.style.display = 'none';
        editorContainer.appendChild(editorDiv);

        // 创建编辑器实例
        const language = this.getLanguageFromFileName(fileName);
        const editor = new CustomEditor(editorDiv, {
            language: language,
            theme: 'dark',
            fontSize: 14,
            tabSize: 4,
            wordWrap: false,
            showLineNumbers: true,
            highlightCurrentLine: true,
            autoCompletion: true,
            bracketMatching: true,
            tabId: tabId  // 传递唯一的tabId
        });

        // 设置一些演示代码
        const demoCode = `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    // OICPP 自研编辑器演示
    cout << "欢迎使用 OICPP IDE!" << endl;
    
    // 创建一个向量并排序
    vector<int> numbers = {5, 2, 8, 1, 9, 3};
    sort(numbers.begin(), numbers.end());
    
    cout << "排序后的数组: ";
    for (int i = 0; i < numbers.size(); i++) {
        cout << numbers[i] << " ";
    }
    cout << endl;
    
    return 0;
}`;
        
        console.log('设置演示代码...');
        editor.setValue(demoCode);

        // 设置回调
        editor.onSave = async (content) => {
            await this.saveFile(tabId, content);
        };

        editor.onBreakpointChange = (lineNumber, isSet) => {
            this.handleBreakpointChange(tabId, lineNumber, isSet);
        };

        // 存储编辑器实例
        this.editors.set(tabId, editor);

        // 创建标签页
        this.createTab(tabId, fileName, false);

        // 切换到新标签页
        this.switchTab(tabId).catch(console.error);
    }

    getLanguageFromFileName(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        switch (extension) {
            case 'cpp':
            case 'cc':
            case 'cxx':
            case 'c++':
                return 'cpp';
            case 'c':
                return 'c';
            case 'h':
            case 'hpp':
            case 'hxx':
                return 'cpp';
            case 'js':
                return 'javascript';
            case 'ts':
                return 'typescript';
            case 'py':
                return 'python';
            case 'java':
                return 'java';
            case 'cs':
                return 'csharp';
            case 'html':
                return 'html';
            case 'css':
                return 'css';
            case 'json':
                return 'json';
            case 'xml':
                return 'xml';
            case 'md':
                return 'markdown';
            default:
                return 'cpp';
        }
    }

    getFileTemplate(language) {
        // 只支持 C++ 模板
        if (language === 'cpp' || language === 'c') {
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
        
        return ''; // 其他语言返回空模板
    }

    generateTabId(fileName, filePath = null) {
        // 为了避免重复创建编辑器，我们需要基于文件路径生成一致的ID
        if (filePath) {
            // 使用文件路径生成一致的ID
            return `file_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else {
            // 对于新文件，生成唯一的ID
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 9);
            return `${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}_${random}`;
        }
    }

    async saveFile(tabId, content, filePath = null) {
        try {
            // 检查内容是否有效
            if (content === undefined || content === null) {
                throw new Error('文件内容为空或未定义');
            }

            // 确保内容是字符串
            const contentStr = String(content);
            console.log('saveFile方法被调用，内容长度:', contentStr.length);

            if (filePath) {
                // 保存到指定路径
                if (window.electronAPI) {
                    console.log('调用electronAPI.saveFile，路径:', filePath, '内容长度:', contentStr.length);
                    await window.electronAPI.saveFile(filePath, contentStr);
                    console.log(`文件保存成功: ${filePath}`);
                } else {
                    throw new Error('electronAPI 不可用');
                }
            } else {
                // 另存为
                if (window.electronAPI) {
                    const savedPath = await window.electronAPI.saveAsFile(contentStr);
                    if (savedPath) {
                        // 更新编辑器的文件路径
                        const editor = this.editors.get(tabId);
                        if (editor) {
                            editor.setFilePath(savedPath);
                        }
                        console.log(`文件另存为成功: ${savedPath}`);
                    }
                } else {
                    throw new Error('electronAPI 不可用');
                }
            }

            // 更新标签页状态
            this.updateTabModifiedStatus(tabId, false);
            
            // 标记编辑器为已保存
            const editor = this.editors.get(tabId);
            if (editor) {
                await editor.markAsSaved();
            }
        } catch (error) {
            console.error('保存文件失败:', error);
            // 可以在这里添加用户提示
            if (window.showErrorDialog) {
                window.showErrorDialog('保存失败', `无法保存文件: ${error.message}`);
            }
        }
    }

    // 更新标签页修改状态
    updateTabModifiedStatus(tabId, isModified) {
        const tab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (tab) {
            const label = tab.querySelector('.tab-label');
            if (label) {
                const text = label.textContent.replace(' •', '');
                label.textContent = isModified ? text + ' •' : text;
            }
        }
    }

    handleBreakpointChange(tabId, lineNumber, isSet) {
        if (!this.breakpoints.has(tabId)) {
            this.breakpoints.set(tabId, new Set());
        }

        const fileBreakpoints = this.breakpoints.get(tabId);
        if (isSet) {
            fileBreakpoints.add(lineNumber);
        } else {
            fileBreakpoints.delete(lineNumber);
        }

        // 通知调试器断点变化
        if (window.debugger) {
            window.debugger.onBreakpointChange(tabId, lineNumber, isSet);
        }
    }

    setupEventListeners() {
        // 新建标签页按钮
        const addBtn = document.querySelector('.tab-add');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                console.log('新建标签页按钮被点击');
                this.newFile();
            });
        }
        
        // 监听文件操作事件
        document.addEventListener('newFile', (e) => {
            this.newFile(e.detail?.fileName);
        });

        document.addEventListener('openFile', (e) => {
            this.openFile(e.detail.filePath, e.detail.content);
        });

        document.addEventListener('saveFile', async (e) => {
            console.log('saveFile事件被触发，事件详情:', e.detail);
            if (this.currentEditor && this.currentTabId) {
                try {
                    // 优先使用事件传递的内容，否则从编辑器获取
                    let content = e.detail?.content;
                    console.log('从事件获取的content:', content ? `长度${content.length}` : 'undefined/null');
                    
                    if (content === undefined || content === null) {
                        content = this.currentEditor.getValue();
                        console.log('从编辑器获取的content:', content ? `长度${content.length}` : 'undefined/null');
                    }
                    
                    if (content !== undefined && content !== null) {
                        console.log('准备保存文件，内容长度:', content.length);
                        await this.saveFile(this.currentTabId, content, e.detail?.filePath);
                    } else {
                        console.warn('无法保存文件：编辑器内容为空或未定义');
                    }
                } catch (error) {
                    console.error('保存文件时出错:', error);
                }
            } else {
                console.warn('无法保存文件：没有活跃的编辑器，currentEditor:', this.currentEditor, 'currentTabId:', this.currentTabId);
            }
        });

        // 监听主题变化
        document.addEventListener('themeChange', (e) => {
            this.updateTheme(e.detail.theme);
        });

        // 监听设置变化
        document.addEventListener('settingsChange', (e) => {
            this.updateSettings(e.detail.settings);
        });

        // 监听来自主进程的设置变化
        if (window.electronIPC && window.electronIPC.on) {
            window.electronIPC.on('settings-changed', (event, settingsType, newSettings) => {
                console.log(`编辑器管理器收到设置变化: ${settingsType}`, newSettings);
                this.handleSettingsChange(settingsType, newSettings);
            });

            window.electronIPC.on('settings-reset', (event, allSettings) => {
                console.log('编辑器管理器收到设置重置通知:', allSettings);
                this.handleSettingsReset(allSettings);
            });

            window.electronIPC.on('settings-imported', (event, allSettings) => {
                console.log('编辑器管理器收到设置导入通知:', allSettings);
                this.handleSettingsReset(allSettings);
            });
        }

        // 监听所有设置变化
        if (window.electronAPI && window.electronAPI.onAllSettingsChanged) {
            window.electronAPI.onAllSettingsChanged((allSettings) => {
                console.log('收到所有设置变化通知:', allSettings);
                this.handleAllSettingsChange(allSettings);
            });
        }
    }

    // 处理设置变化
    handleSettingsChange(settingsType, newSettings) {
        switch (settingsType) {
            case 'editor':
                this.applyEditorSettings(newSettings);
                break;
            case 'compiler':
                this.applyCompilerSettings(newSettings);
                break;
            case 'templates':
                this.applyTemplateSettings(newSettings);
                break;
            case 'general':
                this.applyGeneralSettings(newSettings);
                break;
            default:
                console.log(`未知的设置类型: ${settingsType}`);
        }
    }

    // 处理扁平设置结构的所有设置变化（新的简化设置系统）
    handleAllSettingsChange(allSettings) {
        console.log('编辑器管理器收到扁平设置结构:', allSettings);
        
        // 应用主题设置
        if (allSettings.theme) {
            const theme = allSettings.theme;
            
            // 清除所有主题类和属性
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.removeAttribute('data-theme');
            document.body.removeAttribute('data-editor-theme');
            
            // 应用主题类和属性
            document.body.classList.add(`theme-${theme}`);
            document.body.setAttribute('data-theme', theme);
            document.body.setAttribute('data-editor-theme', theme);
            
            // 更新所有Monaco编辑器的主题
            this.updateAllEditorsTheme(theme);
            
            console.log('编辑器管理器已应用主题:', theme);
        }
        
        // 应用编辑器设置
        if (allSettings.font || allSettings.fontSize || allSettings.enableAutoCompletion) {
            this.applyFlatEditorSettings(allSettings);
        }
    }

    // 应用扁平结构的编辑器设置
    applyFlatEditorSettings(settings) {
        console.log('应用扁平编辑器设置:', settings);
        
        this.editors.forEach((editor, tabId) => {
            try {
                // 更新编辑器选项
                if (editor.updateOptions) {
                    const options = {};
                    
                    if (settings.fontSize) options.fontSize = settings.fontSize;
                    if (settings.font) options.fontFamily = settings.font;
                    if (settings.theme) {
                        // Monaco编辑器主题映射 - 使用更准确的主题名称
                        const monacoTheme = this.getMonacoTheme(settings.theme);
                        options.theme = monacoTheme;
                    }
                    if (settings.enableAutoCompletion !== undefined) {
                        options.autoCompletion = settings.enableAutoCompletion;
                    }
                    
                    editor.updateOptions(options);
                    console.log(`编辑器 ${tabId} 选项已更新:`, options);
                }

                // 直接设置Monaco编辑器主题
                if (editor.setTheme && settings.theme) {
                    const monacoTheme = this.getMonacoTheme(settings.theme);
                    editor.setTheme(monacoTheme);
                    console.log(`编辑器 ${tabId} 主题设置为: ${monacoTheme}`);
                }

                // 更新字体
                if (editor.setFont && settings.font) {
                    editor.setFont(settings.font);
                }
                
            } catch (error) {
                console.error(`更新编辑器 ${tabId} 设置失败:`, error);
            }
        });
    }

    // 更新所有编辑器的主题
    updateAllEditorsTheme(theme) {
        const monacoTheme = this.getMonacoTheme(theme);
        
        this.editors.forEach((editor, tabId) => {
            try {
                if (editor.setTheme) {
                    editor.setTheme(monacoTheme);
                    console.log(`编辑器 ${tabId} 主题更新为: ${monacoTheme}`);
                }
                
                // 如果是Monaco编辑器，也可以通过updateOptions设置
                if (editor.updateOptions) {
                    editor.updateOptions({ theme: monacoTheme });
                }
            } catch (error) {
                console.error(`更新编辑器 ${tabId} 主题失败:`, error);
            }
        });
    }

    // 获取Monaco编辑器主题名称
    getMonacoTheme(theme) {
        switch (theme) {
            case 'light':
                return 'vs'; // VS Code Light 主题
            case 'dark':
                return 'vs-dark'; // VS Code Dark 主题
            case 'monokai':
                return 'monokai'; // Monokai 主题（如果有）
            case 'github':
                return 'github'; // GitHub 主题（如果有）
            default:
                return 'vs-dark'; // 默认深色主题
        }
    }

    // 处理设置重置
    handleSettingsReset(allSettings) {
        if (allSettings.editor) {
            this.applyEditorSettings(allSettings.editor);
        }
        if (allSettings.compiler) {
            this.applyCompilerSettings(allSettings.compiler);
        }
        if (allSettings.templates) {
            this.applyTemplateSettings(allSettings.templates);
        }
        if (allSettings.general) {
            this.applyGeneralSettings(allSettings.general);
        }
    }

    // 应用通用设置
    applyGeneralSettings(generalSettings) {
        console.log('应用通用设置:', generalSettings);
        
        // 应用主题
        if (generalSettings.theme) {
            document.body.setAttribute('data-theme', generalSettings.theme);
        }
        
        // 应用语言设置
        if (generalSettings.language) {
            document.documentElement.lang = generalSettings.language;
        }
    }

    // 应用编辑器设置
    applyEditorSettings(editorSettings) {
        console.log('应用编辑器设置:', editorSettings);
        
        this.editors.forEach((editor, tabId) => {
            try {
                // 更新编辑器选项
                if (editor.updateOptions) {
                    editor.updateOptions({
                        fontSize: editorSettings.fontSize || 14,
                        tabSize: editorSettings.tabSize || 4,
                        wordWrap: editorSettings.wordWrap || false,
                        lineNumbers: editorSettings.lineNumbers !== false,
                        autoCompletion: editorSettings.autoCompletion !== false,
                        bracketMatching: editorSettings.bracketMatching !== false,
                        highlightCurrentLine: editorSettings.highlightCurrentLine !== false
                    });
                }

                // 更新主题
                if (editor.setTheme && editorSettings.theme) {
                    editor.setTheme(editorSettings.theme);
                }

                // 更新字体
                if (editor.setFont && editorSettings.font) {
                    editor.setFont(editorSettings.font);
                }

                console.log(`编辑器 ${tabId} 设置已更新`);
            } catch (error) {
                console.error(`更新编辑器 ${tabId} 设置失败:`, error);
            }
        });
    }

    // 应用编译器设置
    applyCompilerSettings(compilerSettings) {
        console.log('应用编译器设置:', compilerSettings);
        // 这里可以更新编译器相关的全局设置
        if (window.compiler) {
            window.compiler.updateSettings(compilerSettings);
        }
    }

    // 应用模板设置
    applyTemplateSettings(templateSettings) {
        console.log('应用模板设置:', templateSettings);
        // 更新默认模板
        this.defaultTemplates = templateSettings;
    }

    // 编译当前文件
    compileCurrentFile() {
        if (window.compilerManager) {
            window.compilerManager.compileCurrentFile();
        } else {
            console.error('编译管理器未初始化');
        }
    }

    // 运行当前文件
    runCurrentFile() {
        if (window.compilerManager) {
            window.compilerManager.runCurrentFile();
        } else {
            console.error('编译管理器未初始化');
        }
    }

    // 编译并运行当前文件
    compileAndRun() {
        if (window.compilerManager) {
            window.compilerManager.compileAndRun();
        } else {
            console.error('编译管理器未初始化');
        }
    }

    // 清理重复的编辑器实例
    cleanupDuplicateEditors() {
        console.log('开始清理重复的编辑器实例...');
        const filePathMap = new Map(); // filePath -> tabId
        const editorsToRemove = [];
        
        for (const [tabId, editor] of this.editors.entries()) {
            if (editor.filePath) {
                const existingTabId = filePathMap.get(editor.filePath);
                if (existingTabId) {
                    // 发现重复，保留使用标准ID格式的编辑器
                    if (tabId.startsWith('file_')) {
                        // 当前编辑器使用标准格式，移除旧的
                        editorsToRemove.push(existingTabId);
                        filePathMap.set(editor.filePath, tabId);
                        console.log(`保留标准格式编辑器 ${tabId}，将移除 ${existingTabId}`);
                    } else if (!existingTabId.startsWith('file_')) {
                        // 都是旧格式，保留时间戳更大的
                        const existingTimestamp = this.extractTimestamp(existingTabId);
                        const currentTimestamp = this.extractTimestamp(tabId);
                        
                        if (currentTimestamp > existingTimestamp) {
                            editorsToRemove.push(existingTabId);
                            filePathMap.set(editor.filePath, tabId);
                        } else {
                            editorsToRemove.push(tabId);
                        }
                    } else {
                        // 已存在的是标准格式，移除当前的
                        editorsToRemove.push(tabId);
                    }
                } else {
                    filePathMap.set(editor.filePath, tabId);
                }
            }
        }
        
        // 移除重复的编辑器
        for (const tabId of editorsToRemove) {
            console.log(`清理重复编辑器: ${tabId}`);
            const editorElement = document.getElementById(`editor-${tabId}`);
            if (editorElement) {
                editorElement.remove();
            }
            this.editors.delete(tabId);
        }
        
        console.log(`清理完成，移除了 ${editorsToRemove.length} 个重复编辑器`);
    }
    
    // 从 tabId 中提取时间戳
    extractTimestamp(tabId) {
        const parts = tabId.split('_');
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (/^\d{13}$/.test(part)) { // 13位时间戳
                return parseInt(part);
            }
        }
        return 0;
    }

    // 更新主题
    updateTheme(theme) {
        console.log('编辑器管理器更新主题:', theme);
        
        // 应用主题类和属性
        const bodyClassList = document.body.classList;
        bodyClassList.remove('theme-light', 'theme-dark');
        bodyClassList.add(`theme-${theme}`);
        
        document.body.setAttribute('data-theme', theme);
        document.body.setAttribute('data-editor-theme', theme);
        
        // 更新所有Monaco编辑器的主题
        this.updateAllEditorsTheme(theme);
    }

    // 更新设置
    updateSettings(settings) {
        console.log('编辑器管理器更新设置:', settings);
        
        if (settings.theme) {
            this.updateTheme(settings.theme);
        }
        
        // 应用其他编辑器设置
        this.applyFlatEditorSettings(settings);
    }

    // 获取当前编辑器
    getCurrentEditor() {
        return this.currentEditor;
    }

    // 获取当前内容
    getCurrentContent() {
        if (this.currentEditor && this.currentEditor.getValue) {
            return this.currentEditor.getValue();
        }
        return '';
    }
}

// 导出编辑器管理器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NewEditorManager;
} else {
    window.NewEditorManager = NewEditorManager;
}
