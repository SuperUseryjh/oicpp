// 标签页管理器
class TabManager {
    constructor() {
        this.tabs = new Map();
        this.activeTab = null;
        this.tabOrder = []; // 初始化 tabOrder 数组（单一编辑器模式下不使用）
        this.monacoEditorManager = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeTabs();
        
        // 获取编辑器管理器引用
        setTimeout(() => {
            if (window.oicppApp && window.oicppApp.editorManager) {
                this.monacoEditorManager = window.oicppApp.editorManager;
                console.log('标签页管理器获取到编辑器管理器引用');
            } else {
                console.warn('编辑器管理器未找到，将稍后重试');
                // 继续尝试获取引用
                setTimeout(() => {
                    if (window.oicppApp && window.oicppApp.editorManager) {
                        this.monacoEditorManager = window.oicppApp.editorManager;
                        console.log('标签页管理器延迟获取到编辑器管理器引用');
                    } else {
                        // 最后的尝试，直接从全局变量获取
                        if (window.editorManager) {
                            this.monacoEditorManager = window.editorManager;
                            console.log('标签页管理器从全局变量获取到编辑器管理器引用');
                        }
                    }
                }, 1000);
            }
        }, 100);
    }

    setupEventListeners() {
        // 标签页点击事件
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (!e.target.classList.contains('tab-close')) {
                    this.activateTab(tab.dataset.file).catch(console.error);
                }
            });
        });

        // 标签页关闭事件
        const closeBtns = document.querySelectorAll('.tab-close');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tab = e.target.closest('.tab');
                this.closeTab(tab.dataset.file);
            });
        });

        // 新建标签页按钮 - 禁用，由NewEditorManager处理
        // const addBtn = document.querySelector('.tab-add');
        // if (addBtn) {
        //     addBtn.addEventListener('click', () => {
        //         this.createNewTab();
        //     });
        // }

        // 中键点击关闭标签页
        document.addEventListener('mouseup', (e) => {
            if (e.button === 1 && e.target.closest('.tab')) {
                const tab = e.target.closest('.tab');
                this.closeTab(tab.dataset.file);
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                switch (e.key) {
                    case 'Tab':
                        e.preventDefault();
                        this.switchToNextTab();
                        break;
                    case 'w':
                        e.preventDefault();
                        this.closeActiveTab();
                        break;
                    case 't':
                        e.preventDefault();
                        this.createNewTab();
                        break;
                }
            }
        });
    }

    initializeTabs() {
        // 初始化现有标签页
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            const fileName = tab.dataset.file;
            this.tabs.set(fileName, {
                element: tab,
                fileName: fileName,
                modified: false,
                content: '',
                active: tab.classList.contains('active')
            });
            
            // tabOrder 在单一编辑器模式下不需要
            
            if (tab.classList.contains('active')) {
                this.activeTab = fileName;
            }
        });
    }

    async activateTab(fileName) {
        console.log('激活标签页:', fileName);
        
        // 获取文件信息
        var tab = this.tabs.get(fileName);
        if (!tab) {
            console.error('标签页不存在:', fileName);
            return;
        }
        
        this.activeTab = fileName;
        
        // 如果是欢迎页面
        if (tab.isWelcome) {
            this.showWelcomePage();
            return;
        }
        
        // 使用新编辑器管理器的switchTab方法
        if (this.monacoEditorManager && typeof this.monacoEditorManager.switchTab === 'function') {
            console.log('查找对应的标签页DOM元素...');
            
            // 查找对应的标签页DOM元素
            let tabId = null;
            const allTabs = document.querySelectorAll('.tab[data-tab-id]');
            console.log(`找到 ${allTabs.length} 个标签页元素`);
            
            for (const tabEl of allTabs) {
                const tabLabel = tabEl.querySelector('.tab-label');
                if (tabLabel) {
                    const tabFileName = tabLabel.textContent.replace(' •', '').trim();
                    console.log(`检查标签页: "${tabFileName}" vs "${fileName}"`);
                    if (tabFileName === fileName) {
                        tabId = tabEl.dataset.tabId;
                        console.log(`找到匹配的标签页，tabId: ${tabId}`);
                        break;
                    }
                }
            }
            
            if (tabId) {
                console.log(`通过编辑器管理器切换到标签页 ${fileName}，tabId: ${tabId}`);
                await this.monacoEditorManager.switchTab(tabId);
                return;
            } else {
                console.warn(`未找到标签页对应的DOM元素: ${fileName}`);
                // 如果找不到，尝试生成tabId
                if (this.monacoEditorManager.generateTabId) {
                    tabId = this.monacoEditorManager.generateTabId(fileName, tab.filePath);
                    console.log(`生成的tabId: ${tabId}，尝试切换`);
                    await this.monacoEditorManager.switchTab(tabId);
                    return;
                }
            }
        }
        
        // 降级：保存当前编辑器的内容（如果有的话）
        this.saveCurrentEditorContent();
        
        // 隐藏欢迎页面，显示编辑器
        const welcomeContainer = document.getElementById('welcome-container');
        const editorArea = document.querySelector('.editor-area');
        
        if (welcomeContainer) {
            welcomeContainer.style.display = 'none';
        }
        if (editorArea) {
            editorArea.style.display = 'block';
        }
        
        // 直接加载文件内容到编辑器
        this.loadFileContentToEditor(fileName, tab);
    }

    // 保存当前编辑器内容
    saveCurrentEditorContent() {
        if (!this.activeTab) return;
        
        const currentTab = this.tabs.get(this.activeTab);
        if (!currentTab) return;
        
        // 获取当前编辑器内容
        const content = this.getCurrentEditorContent();
        if (content !== null) {
            // 如果有文件路径，保存到文件系统
            if (currentTab.filePath && window.electronIPC) {
                console.log('自动保存文件内容到:', currentTab.filePath);
                window.electronIPC.send('save-file', currentTab.filePath, content);
                
                // 监听保存结果（可选，用于调试）
                const handleFileSaved = (event, savedPath, error) => {
                    if (savedPath === currentTab.filePath) {
                        if (error) {
                            console.error('自动保存失败:', error);
                        } else {
                            console.log('文件自动保存成功:', savedPath);
                        }
                        window.electronIPC.ipcRenderer.removeListener('file-saved', handleFileSaved);
                    }
                };
                window.electronIPC.on('file-saved', handleFileSaved);
            }
            
            // 更新内容缓存
            currentTab.content = content;
        }
    }

    // 获取当前编辑器内容
    getCurrentEditorContent() {
        if (this.monacoEditorManager && this.monacoEditorManager.currentEditor) {
            try {
                return this.monacoEditorManager.currentEditor.getValue();
            } catch (error) {
                console.error('获取编辑器内容失败:', error);
                return null;
            }
        }
        return null;
    }

    // 设置编辑器内容
    setEditorContent(content) {
        if (this.monacoEditorManager && this.monacoEditorManager.currentEditor) {
            try {
                this.monacoEditorManager.currentEditor.setValue(content || '');
                console.log('编辑器内容已设置');
            } catch (error) {
                console.error('设置编辑器内容失败:', error);
            }
        }
    }

    // 加载文件内容到编辑器（完全模仿sidebar.js的openFile逻辑）
    loadFileContentToEditor(fileName, tab) {
        console.log('加载文件内容到编辑器:', fileName);
        
        // 更新编辑器文件名显示
        if (this.monacoEditorManager && this.monacoEditorManager.currentEditor) {
            const editor = this.monacoEditorManager.currentEditor;
            if (editor.updateFileName) {
                editor.updateFileName(fileName, tab.modified || false);
            }
        }
        
        // 如果有文件路径，完全使用和sidebar.js openFile一样的逻辑
        if (tab.filePath && window.electronIPC) {
            console.log('从文件系统重新读取文件:', tab.filePath);
            window.electronIPC.send('read-file-content', tab.filePath);
            
            const handleFileRead = (event, filePath, content, error) => {
                if (filePath === tab.filePath) {
                    if (error) {
                        console.error('读取文件失败:', error);
                        alert('无法读取文件: ' + error);
                        // 使用缓存的内容作为降级方案
                        if (tab.content !== undefined) {
                            this.setEditorContent(tab.content);
                        }
                    } else {
                        console.log('文件内容读取成功，直接设置到当前编辑器');
                        // 直接设置到当前编辑器，不调用switchToEditor
                        this.setEditorContent(content, true); // 标记为已保存
                        // 更新缓存
                        tab.content = content;
                        tab.modified = false; // 从文件系统加载的内容标记为未修改
                        
                        // 再次更新文件名显示状态
                        if (this.monacoEditorManager && this.monacoEditorManager.currentEditor) {
                            const editor = this.monacoEditorManager.currentEditor;
                            if (editor.updateFileName) {
                                editor.updateFileName(fileName, false);
                            }
                        }
                    }
                    window.electronIPC.ipcRenderer.removeListener('file-content-read', handleFileRead);
                }
            };
            
            window.electronIPC.on('file-content-read', handleFileRead);
        } else {
            // 如果没有文件路径，使用缓存的内容或默认内容
            const content = tab.content || this.getDefaultContentForFile(fileName);
            this.setEditorContent(content, !tab.modified); // 根据修改状态决定是否标记为已保存
            console.log('使用缓存或默认内容');
        }
    }

    // 新增方法：设置编辑器内容
    setEditorContent(content, markAsSaved = false) {
        if (this.monacoEditorManager && this.monacoEditorManager.currentEditor) {
            this.monacoEditorManager.currentEditor.setValue(content, markAsSaved);
            console.log('编辑器内容已更新，保存状态:', markAsSaved);
        } else {
            console.warn('编辑器管理器或当前编辑器不可用');
        }
    }

    // 新增方法：获取文件的默认内容
    getDefaultContentForFile(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        
        if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') {
            return `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    // 在这里编写你的代码
    
    return 0;
}`;
        } else if (ext === 'c') {
            return `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    // 在这里编写你的代码
    
    return 0;
}`;
        } else if (ext === 'h' || ext === 'hpp') {
            const guard = fileName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() + '_';
            return `#ifndef ${guard}
#define ${guard}

// 在这里编写你的头文件内容

#endif // ${guard}`;
        }
        
        return '// 新文件\n';
    }

    // 简化的关闭方法（现在只是清空编辑器）
    closeTab(fileName) {
        console.log('清空编辑器');
        
        // 保存当前内容
        this.saveCurrentEditorContent();
        
        // 清空编辑器
        if (this.monacoEditorManager && this.monacoEditorManager.currentEditor) {
            this.monacoEditorManager.currentEditor.setValue('');
        }
        
        // 清除当前文件记录
        this.activeTab = null;
        this.tabs.clear();
    }

    closeActiveTab() {
        if (this.activeTab) {
            this.closeTab(this.activeTab);
        }
    }

    // 简化的新建标签页（实际上就是新建文件）
    createNewTab() {
        // 直接调用创建新C++文件的方法
        this.createNewCppFile();
    }

    generateNewFileName() {
        let counter = 1;
        let fileName = `untitled-${counter}.cpp`;
        
        while (this.tabs.has(fileName)) {
            counter++;
            fileName = `untitled-${counter}.cpp`;
        }
        
        return fileName;
    }

    async openFile(fileName, content = '', isNew = false, filePath = null) {
        console.log('打开文件:', fileName, '路径:', filePath);
        
        // 使用新编辑器管理器的openFile方法
        if (this.monacoEditorManager && typeof this.monacoEditorManager.openFile === 'function') {
            console.log('通过编辑器管理器打开文件:', fileName);
            await this.monacoEditorManager.openFile(filePath, content);
            
            // 同步标签页状态
            this.tabs.set(fileName, {
                fileName: fileName,
                modified: isNew,
                content: content,
                active: true,
                filePath: filePath
            });
            
            this.activeTab = fileName;
            
            // 确保DOM元素与tabs Map同步
            this.syncTabDOMWithMap(fileName, filePath);
            return;
        }
        
        // 降级处理
        console.log('使用降级方案打开文件:', fileName);
        
        // 不再检查文件是否已经打开，直接覆盖当前编辑器内容
        
        // 只使用编辑器管理器创建第一个编辑器实例（如果还没有的话）
        if (this.monacoEditorManager && !this.monacoEditorManager.currentEditor) {
            this.monacoEditorManager.createNewEditor(fileName, content);
        }

        // 简化标签页信息存储
        this.tabs.set(fileName, {
            fileName: fileName,
            modified: isNew,
            content: content,
            active: true,
            filePath: filePath
        });
        
        // 更新当前活动文件
        this.activeTab = fileName;
        
        // 直接激活（加载内容到编辑器）
        await this.activateTab(fileName);
    }

    // 同步标签页DOM元素与Map中的数据
    syncTabDOMWithMap(fileName, filePath) {
        console.log(`同步标签页DOM: ${fileName}`);
        
        // 查找对应的DOM元素
        const allTabs = document.querySelectorAll('.tab');
        for (const tabEl of allTabs) {
            const tabLabel = tabEl.querySelector('.tab-label');
            if (tabLabel) {
                const tabFileName = tabLabel.textContent.replace(' •', '').trim();
                if (tabFileName === fileName) {
                    // 如果DOM元素没有tabId，生成一个
                    if (!tabEl.dataset.tabId && this.monacoEditorManager && this.monacoEditorManager.generateTabId) {
                        const tabId = this.monacoEditorManager.generateTabId(fileName, filePath);
                        tabEl.dataset.tabId = tabId;
                        console.log(`为标签页 ${fileName} 设置 tabId: ${tabId}`);
                    }
                    break;
                }
            }
        }
    }

    createTabElement(fileName) {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.file = fileName;
        
        const label = document.createElement('span');
        label.className = 'tab-label';
        label.textContent = fileName;
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '×';
        
        tab.appendChild(label);
        tab.appendChild(closeBtn);
        
        // 添加事件监听器
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.activateTab(fileName).catch(console.error);
            }
        });
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(fileName);
        });
        
        return tab;
    }

    createEditorPane(fileName, content = '') {
        var pane = document.createElement('div');
        pane.className = 'editor-pane';
        pane.id = 'editor-' + fileName.replace('.', '-');

        var wrapper = document.createElement('div');
        wrapper.className = 'editor-wrapper';
        // 只创建容器，MonacoEditorManager 会在此容器下创建编辑器
        pane.appendChild(wrapper);
        return pane;
    }

    async switchToNextTab() {
        if (this.tabOrder.length <= 1) return;
        
        const currentIndex = this.tabOrder.indexOf(this.activeTab);
        const nextIndex = (currentIndex + 1) % this.tabOrder.length;
        const nextTab = this.tabOrder[nextIndex];
        
        await this.activateTab(nextTab);
    }

    async switchToPreviousTab() {
        if (this.tabOrder.length <= 1) return;
        
        const currentIndex = this.tabOrder.indexOf(this.activeTab);
        const prevIndex = (currentIndex - 1 + this.tabOrder.length) % this.tabOrder.length;
        const prevTab = this.tabOrder[prevIndex];
        
        await this.activateTab(prevTab);
    }

    markTabAsModified(fileName) {
        const tab = this.tabs.get(fileName);
        if (tab && !tab.modified) {
            tab.modified = true;
            const label = tab.element.querySelector('.tab-label');
            if (label && !label.textContent.startsWith('●')) {
                label.textContent = '● ' + fileName;
            }
        }
    }

    markTabAsSaved(fileName) {
        const tab = this.tabs.get(fileName);
        if (tab && tab.modified) {
            tab.modified = false;
            const label = tab.element.querySelector('.tab-label');
            if (label) {
                label.textContent = fileName;
            }
        }
    }

    getActiveTab() {
        return this.activeTab;
    }

    getTabCount() {
        return this.tabs.size;
    }

    getAllTabs() {
        return Array.from(this.tabs.keys());
    }

    getModifiedTabs() {
        return Array.from(this.tabs.values())
            .filter(tab => tab.modified)
            .map(tab => tab.fileName);
    }

    closeAllTabs() {
        const modifiedTabs = this.getModifiedTabs();
        if (modifiedTabs.length > 0) {
            const result = confirm(`有 ${modifiedTabs.length} 个文件未保存，确定要关闭所有标签页吗？`);
            if (!result) return;
        }
        
        const tabsToClose = [...this.tabs.keys()];
        tabsToClose.forEach(fileName => {
            this.closeTab(fileName);
        });
    }

    closeOtherTabs() {
        if (!this.activeTab) return;
        
        const currentTab = this.activeTab;
        const tabsToClose = [...this.tabs.keys()].filter(fileName => fileName !== currentTab);
        
        const modifiedTabs = tabsToClose.filter(fileName => this.tabs.get(fileName).modified);
        if (modifiedTabs.length > 0) {
            const result = confirm(`有 ${modifiedTabs.length} 个文件未保存，确定要关闭其他标签页吗？`);
            if (!result) return;
        }
        
        tabsToClose.forEach(fileName => {
            this.closeTab(fileName);
        });
    }

    showWelcomePage() {
        console.log('显示欢迎页面');
        
        // 获取欢迎页面容器
        const welcomeContainer = document.getElementById('welcome-container');
        const editorArea = document.querySelector('.editor-area');
        
        if (!welcomeContainer) {
            console.error('欢迎页面容器未找到');
            return;
        }
        
        // 隐藏编辑器，显示欢迎页面
        if (editorArea) {
            editorArea.style.display = 'none';
        }
        welcomeContainer.style.display = 'block';
        
        // 设置欢迎页面内容
        welcomeContainer.innerHTML = this.getWelcomePageContent();
        
        // 添加欢迎页面的事件监听器
        this.setupWelcomeEventListeners(welcomeContainer);
        
        // 创建欢迎页面标签对象（用于内部管理）
        const welcomeTab = {
            fileName: 'Welcome',
            content: this.getWelcomePageContent(),
            modified: false,
            isWelcome: true
        };
        
        this.tabs.set('Welcome', welcomeTab);
        this.activeTab = 'Welcome';
    }

    getWelcomePageContent() {
        return `
            <div class="welcome-page">
                <div class="welcome-header">
                    <div class="welcome-logo">OICPP IDE</div>
                    <div class="welcome-subtitle">为 OIer 优化的 C++ 编程环境</div>
                    <div class="welcome-version">版本 1.0.0</div>
                </div>
                
                <div class="welcome-content">
                    <div class="welcome-section">
                        <h3>开始</h3>
                        <div class="welcome-actions">
                            <a href="#" class="welcome-action" data-action="open-folder">
                                <span class="icon">📁</span>
                                <span>打开文件夹</span>
                                <span class="shortcut">Ctrl+K</span>
                            </a>
                        </div>
                    </div>
                    
                    <div class="welcome-section">
                        <h3>最近打开</h3>
                        <div class="welcome-recent" id="welcome-recent">
                            <div class="welcome-recent-item">
                                <span class="icon">📄</span>
                                <span>暂无最近文件</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="welcome-footer">
                    <p>OICPP IDE - 为竞赛编程而生</p>
                    <p><a href="#">使用文档</a> | <a href="#">快捷键</a> | <a href="#">关于</a></p>
                </div>
            </div>
        `;
    }

    showWelcomeContent() {
        // 隐藏编辑器区域
        const editorArea = document.querySelector('.editor-area');
        if (editorArea) {
            editorArea.style.display = 'none';
        }
        
        // 显示或创建欢迎页面
        let welcomeContainer = document.getElementById('welcome-container');
        if (!welcomeContainer) {
            welcomeContainer = document.createElement('div');
            welcomeContainer.id = 'welcome-container';
            welcomeContainer.innerHTML = this.getWelcomePageContent();
            
            // 将欢迎页面添加到编辑器容器中
            const editorTerminalContainer = document.querySelector('.editor-terminal-container');
            if (editorTerminalContainer) {
                editorTerminalContainer.appendChild(welcomeContainer);
            } else {
                console.error('未找到编辑器容器');
                return;
            }
            
            // 添加欢迎页面事件监听器
            this.setupWelcomeEventListeners(welcomeContainer);
        }
        
        welcomeContainer.style.display = 'block';
    }

    setupWelcomeEventListeners(container) {
        const actions = container.querySelectorAll('.welcome-action');
        actions.forEach(action => {
            action.addEventListener('click', (e) => {
                e.preventDefault();
                const actionType = e.currentTarget.dataset.action;
                this.handleWelcomeAction(actionType);
            });
        });
    }

    handleWelcomeAction(actionType) {
        console.log('欢迎页面操作:', actionType);
        
        switch (actionType) {
            case 'new-file':
                this.createNewCppFile();
                break;
            case 'open-file':
                if (window.oicppApp && window.oicppApp.openFile) {
                    window.oicppApp.openFile();
                }
                break;
            case 'open-folder':
                if (window.oicppApp && window.oicppApp.openFolder) {
                    window.oicppApp.openFolder();
                    // 注意：欢迎页面将在文件夹打开成功后自动关闭
                }
                break;
            case 'open-template':
                // TODO: 实现模板功能
                console.log('从模板创建功能待实现');
                break;
            default:
                console.log('未知的欢迎页面操作:', actionType);
        }
    }

    // 关闭欢迎页面
    closeWelcomePage() {
        console.log('关闭欢迎页面');
        
        const welcomeContainer = document.getElementById('welcome-container');
        const editorArea = document.querySelector('.editor-area');
        
        if (welcomeContainer) {
            welcomeContainer.style.display = 'none';
        }
        
        if (editorArea) {
            editorArea.style.display = 'block';
        }
        
        // 移除欢迎页面标签
        this.tabs.delete('Welcome');
        this.activeTab = null;
    }



    // 公共方法：获取选中的文本
    getSelectedText() {
        // 通过选中的标签页获取对应的编辑器内容
        const activeTab = this.tabs.get(this.activeTab);
        if (activeTab && this.monacoEditorManager) {
            return this.monacoEditorManager.getSelectedText(activeTab.fileName);
        }
        return '';
    }

    // 公共方法：插入文本
    insertText(text) {
        // 通过选中的标签页获取对应的编辑器实例
        const activeTab = this.tabs.get(this.activeTab);
        if (activeTab && this.monacoEditorManager) {
            this.monacoEditorManager.insertText(activeTab.fileName, text);
        }
    }

    // 公共方法：获取所有标签页的文件名
    getAllFileNames() {
        return Array.from(this.tabs.keys());
    }

    // 公共方法：获取未保存的文件
    getUnsavedFiles() {
        return Array.from(this.tabs.values())
            .filter(tab => tab.modified)
            .map(tab => tab.fileName);
    }

    // 公共方法：保存文件
    saveFile(fileName) {
        const tab = this.tabs.get(fileName);
        if (tab) {
            tab.modified = false;
            const label = tab.element.querySelector('.tab-label');
            if (label) {
                label.textContent = fileName;
            }
            
            // 调用 Monaco Editor 的保存方法
            if (this.monacoEditorManager) {
                this.monacoEditorManager.saveFile(fileName);
            }
        }
    }

    // 公共方法：保存所有文件
    saveAllFiles() {
        const unsavedFiles = this.getUnsavedFiles();
        unsavedFiles.forEach(fileName => {
            this.saveFile(fileName);
        });
    }

    // 公共方法：打开文件
    openFileDialog() {
        // 触发文件选择对话框
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.cpp,.h,.txt';
        input.style.display = 'none';
        
        document.body.appendChild(input);
        input.click();
        
        input.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                const file = files[0];
                const fileName = file.name;
                
                // 读取文件内容
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    this.openFile(fileName, content);
                };
                reader.readAsText(file);
            }
            
            document.body.removeChild(input);
        });
    }

    // 公共方法：打开文件夹
    openFolderDialog() {
        // 触发文件夹选择对话框
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.style.display = 'none';
        
        document.body.appendChild(input);
        input.click();
        
        input.addEventListener('change', (e) => {
            const files = e.target.files;
            const fileNames = Array.from(files).map(file => file.webkitRelativePath.split('/').pop());
            
            fileNames.forEach(fileName => {
                // 读取文件内容
                const file = Array.from(files).find(f => f.webkitRelativePath.endsWith(fileName));
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    this.openFile(fileName, content);
                };
                reader.readAsText(file);
            });
            
            document.body.removeChild(input);
        });
    }

    // 公共方法：从模板创建文件
    createFileFromTemplate(templateName) {
        // 根据模板名称生成文件内容
        let content = '';
        switch (templateName) {
            case 'cpp':
                content = `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}
`;
                break;
            case 'header':
                content = `#ifndef _TEMPLATE_H
#define _TEMPLATE_H

// 函数声明
void hello();

#endif
`;
                break;
            case 'source':
                content = `#include "template.h"
#include <iostream>
using namespace std;

void hello() {
    cout << "Hello from template!" << endl;
}
`;
                break;
            default:
                break;
        }
        
        // 创建新文件
        const fileName = this.generateNewFileName();
        this.openFile(fileName, content, true);
    }

    // 公共方法：显示欢迎页面
    displayWelcomePage() {
        // 检查欢迎页面标签是否已存在
        if (this.tabs.has('Welcome')) {
            this.activateTab('Welcome');
            return;
        }
        
        // 创建欢迎页面标签
        const welcomeTab = {
            fileName: 'Welcome',
            content: this.getWelcomePageContent(),
            modified: false,
            isWelcome: true
        };
        
        this.tabs.set('Welcome', welcomeTab);
        // tabOrder 在单一编辑器模式下不需要
        
        // 更新标签页UI
        this.updateTabsUI();
        
        // 激活欢迎页面
        this.activateTab('Welcome');
    }

    // 公共方法：获取欢迎页面内容
    getWelcomePageContent() {
        return `
            <div class="welcome-page">
                <div class="welcome-header">
                    <div class="welcome-logo">OICPP IDE</div>
                    <div class="welcome-subtitle">为 OIer 优化的 C++ 编程环境</div>
                    <div class="welcome-version">版本 1.0.0-alpha3</div>
                </div>
                
                <div class="welcome-content">
                    <div class="welcome-section">
                        <h3>开始</h3>
                        <div class="welcome-actions">
                            <a href="#" class="welcome-action" data-action="open-folder">
                                <span class="icon">📁</span>
                                <span>打开文件夹</span>
                                <span class="shortcut">Ctrl+K</span>
                            </a>
                        </div>
                    </div>
                    
                    <div class="welcome-section">
                        <h3>最近打开</h3>
                        <div class="welcome-recent" id="welcome-recent">
                            <div class="welcome-recent-item">
                                <span class="icon">📄</span>
                                <span>暂无最近文件</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="welcome-footer">
                    <p>OICPP IDE - 为 OIer 优化的 C++ 编程环境</p>
                    <p>版本 1.0.0-alpha3, Copyright (C) 2025 mywwzh.</p>
                </div>
            </div>
        `;
    }

    // 公共方法：更新标签页UI
    updateTabsUI() {
        const tabBar = document.querySelector('.tab-bar');
        if (!tabBar) {
            console.error('标签栏容器未找到');
            return;
        }
        
        tabBar.innerHTML = ''; // 清空现有标签
        
        this.tabOrder.forEach(fileName => {
            const tab = this.tabs.get(fileName);
            if (tab && tab.element && tab.element instanceof Element) {
                tabBar.appendChild(tab.element);
            } else {
                console.warn(`标签页 ${fileName} 缺少有效的DOM元素:`, tab);
            }
        });
        
        // 添加新建标签页按钮
        const addBtn = document.createElement('div');
        addBtn.className = 'tab tab-add';
        addBtn.innerHTML = '＋';
        addBtn.addEventListener('click', () => {
            this.createNewTab();
        });
        tabBar.appendChild(addBtn);
    }

    // 更新标签页标题
    updateTabTitle(oldName, newName) {
        const tab = this.tabs.get(oldName);
        if (tab) {
            // 更新标签页显示名称
            if (tab.element) {
                const label = tab.element.querySelector('.tab-label');
                if (label) {
                    label.textContent = newName;
                }
            }
            
            // 更新tabs映射
            this.tabs.delete(oldName);
            tab.fileName = newName;
            this.tabs.set(newName, tab);
            
            // 更新tabOrder数组
            const index = this.tabOrder.indexOf(oldName);
            if (index !== -1) {
                this.tabOrder[index] = newName;
            }
            
            // 如果是当前活动标签，更新活动标签引用
            if (this.activeTab === oldName) {
                this.activeTab = newName;
            }
            
            console.log('标签页标题已更新:', oldName, '->', newName);
        }
    }

    // 根据文件名关闭标签页
    closeTabByFileName(fileName) {
        const tab = this.tabs.get(fileName);
        if (tab) {
            this.closeTab(fileName);
            console.log('已关闭标签页:', fileName);
        }
    }

    // 更新标签页文件路径
    updateTabPath(fileName, newPath) {
        const tab = this.tabs.get(fileName);
        if (tab) {
            tab.filePath = newPath;
            console.log('标签页路径已更新:', fileName, '->', newPath);
        }
    }



    // 设置文件路径
    setFilePath(fileName, filePath) {
        const tab = this.tabs.get(fileName);
        if (tab) {
            tab.filePath = filePath;
            console.log('文件路径已设置:', fileName, '->', filePath);
        }
    }

    // 创建新的C++文件
    async createNewCppFile() {
        console.log('创建新的C++文件');
        
        // 关闭欢迎页面
        this.closeWelcomePage();
        
        // 获取设置中的模板内容
        let defaultContent = `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    // 在这里编写你的代码
    
    return 0;
}`;
        
        // 尝试从设置中获取模板
        try {
            if (window.electronAPI && window.electronAPI.getAllSettings) {
                const settings = await window.electronAPI.getAllSettings();
                if (settings && settings.cppTemplate) {
                    defaultContent = settings.cppTemplate;
                }
            }
        } catch (error) {
            console.warn('获取设置模板失败，使用默认模板:', error);
        }
        
        // 生成新文件名
        const fileName = this.generateNewFileName();
        
        // 直接在编辑器中打开新文件（临时，未保存）
        this.openFile(fileName, defaultContent, true, null);
    }
}

// 初始化标签页管理器
let tabManager;
document.addEventListener('DOMContentLoaded', () => {
    tabManager = new TabManager();
    window.tabManager = tabManager; // 全局引用
    console.log('标签页管理器已初始化');
});
