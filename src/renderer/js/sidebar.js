// 侧边栏管理
class SidebarManager {
    constructor() {
        this.currentPanel = 'files';
        this.panels = {
            files: new FileExplorer(),
            cloud: new CloudPanel(),
            samples: new SampleTester(),
            compare: new CodeComparer(),
            debug: new DebugPanel(),
            account: new AccountPanel()
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showPanel('files');
    }

    setupEventListeners() {
        // 侧边栏图标点击事件
        const sidebarIcons = document.querySelectorAll('.sidebar-icon');
        sidebarIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                const panelName = e.currentTarget.dataset.panel;
                this.showPanel(panelName);
            });
        });

        // 面板头部按钮事件
        this.setupPanelHeaderButtons();
    }

    setupPanelHeaderButtons() {
        // 文件管理器按钮
        const fileButtons = document.querySelectorAll('#files-panel .icon-btn');
        fileButtons.forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // 动态检查是否有工作区
                const fileExplorer = this.panels.files;
                console.log('检查工作区状态:', fileExplorer ? fileExplorer.hasWorkspace : '文件管理器不存在', '路径:', fileExplorer ? fileExplorer.currentPath : 'N/A');
                if (!fileExplorer || !fileExplorer.hasWorkspace) {
                    console.log('没有工作区，无法执行操作');
                    return;
                }
                
                switch (index) {
                    case 0: // 新建文件
                        fileExplorer.createNewFile();
                        break;
                    case 1: // 新建文件夹
                        fileExplorer.createNewFolder();
                        break;
                    case 2: // 刷新
                        fileExplorer.refresh();
                        break;
                }
            });
        });
    }

    showPanel(panelName) {
        if (this.currentPanel === panelName) return;

        // 更新图标状态
        const icons = document.querySelectorAll('.sidebar-icon');
        icons.forEach(icon => {
            icon.classList.remove('active');
            if (icon.dataset.panel === panelName) {
                icon.classList.add('active');
            }
        });

        // 更新面板内容
        const panels = document.querySelectorAll('.panel-content');
        panels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `${panelName}-panel`) {
                panel.classList.add('active');
            }
        });

        this.currentPanel = panelName;
        
        // 激活对应的面板管理器
        if (this.panels[panelName]) {
            this.panels[panelName].activate();
        }
    }

    getCurrentPanel() {
        return this.currentPanel;
    }

    getPanelManager(panelName) {
        return this.panels[panelName];
    }

    updateFileExplorerButtons() {
        const fileButtons = document.querySelectorAll('#files-panel .icon-btn');
        const fileExplorer = this.panels.files;
        const hasWorkspace = fileExplorer && fileExplorer.hasWorkspace;
        
        fileButtons.forEach((btn, index) => {
            if (index < 2) { // 新建文件和新建文件夹按钮
                btn.disabled = !hasWorkspace;
                btn.style.opacity = hasWorkspace ? '1' : '0.5';
                btn.style.cursor = hasWorkspace ? 'pointer' : 'not-allowed';
            }
        });
    }
}

// 文件资源管理器
class FileExplorer {
    constructor() {
        this.currentPath = '';
        this.files = [];
        this.selectedFile = null;
        this.selectedFiles = []; // 支持多选
        this.hasWorkspace = false;
        this.clipboard = null;
        this.expandedFolders = new Set(); // 跟踪展开的文件夹
    }

    activate() {
        console.log('激活文件资源管理器');
        this.loadFiles();
        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        // 只在文件管理器面板激活时监听键盘事件
        document.addEventListener('keydown', (e) => {
            // 检查当前是否是文件管理器面板
            if (window.sidebarManager && window.sidebarManager.getCurrentPanel() !== 'files') {
                return;
            }
            
            // 检查是否有选中的文件
            if (this.selectedFiles.length === 0) {
                return;
            }
            
            switch (e.key) {
                case 'Delete':
                    e.preventDefault();
                    if (this.selectedFiles.length > 1) {
                        this.deleteSelectedFiles();
                    } else {
                        this.deleteFile(this.selectedFile);
                    }
                    break;
                    
                case 'F2':
                    e.preventDefault();
                    if (this.selectedFiles.length === 1) {
                        this.renameFile(this.selectedFile);
                    }
                    break;
                    
                case 'c':
                    if (e.ctrlKey) {
                        // 只在文件浏览器区域获得焦点时处理复制
                        if (this.isFileExplorerFocused() && this.selectedFile) {
                            e.preventDefault();
                            if (this.selectedFiles.length > 1) {
                                this.copySelectedFiles();
                            } else {
                                this.copyFile(this.selectedFile);
                            }
                        }
                    }
                    break;
                    
                case 'x':
                    if (e.ctrlKey) {
                        // 只在文件浏览器区域获得焦点时处理剪切
                        if (this.isFileExplorerFocused() && this.selectedFile) {
                            e.preventDefault();
                            if (this.selectedFiles.length > 1) {
                                this.cutSelectedFiles();
                            } else {
                                this.cutFile(this.selectedFile);
                            }
                        }
                    }
                    break;
                    
                case 'v':
                    if (e.ctrlKey && this.clipboard) {
                        // 只在文件浏览器区域获得焦点时处理粘贴
                        if (this.isFileExplorerFocused()) {
                            e.preventDefault();
                            // 粘贴到当前选中的文件夹，或根目录
                            const targetFolder = this.selectedFile && this.selectedFile.type === 'folder' 
                                ? this.selectedFile 
                                : { path: this.currentPath, type: 'folder' };
                            this.pasteFile(targetFolder);
                        }
                    }
                    break;
                    
                case 'a':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.selectAllFiles();
                    }
                    break;
            }
        });
    }

    // 检查文件浏览器是否获得焦点
    isFileExplorerFocused() {
        const activeElement = document.activeElement;
        const filesPanel = document.querySelector('#files-panel');
        
        // 检查当前焦点是否在文件浏览器区域
        return filesPanel && (
            filesPanel.contains(activeElement) || 
            activeElement === filesPanel ||
            activeElement.closest('#files-panel') !== null
        );
    }

    selectAllFiles() {
        // 选择当前可见的所有文件
        const allItems = document.querySelectorAll('.tree-item');
        this.clearSelection();
        
        allItems.forEach(item => {
            const filePath = item.dataset.path;
            const file = this.findFileByPath(filePath);
            if (file) {
                item.classList.add('selected');
                this.selectedFiles.push(file);
            }
        });
        
        this.selectedFile = this.selectedFiles.length > 0 ? this.selectedFiles[0] : null;
        this.updateSelectionCounter();
        console.log('已选择所有文件:', this.selectedFiles.map(f => f.name));
    }

    findFileByPath(path) {
        // 在当前文件列表中查找文件
        return this.files.find(file => file.path === path);
    }

    loadFiles() {
        // 检查是否有打开的工作区
        if (!this.hasWorkspace || !this.currentPath) {
            this.showEmptyState();
            return;
        }

        // 如果有工作区，加载文件
        this.loadWorkspaceFiles();
    }

    showEmptyState() {
        const fileTree = document.querySelector('.file-tree');
        if (!fileTree) return;

        fileTree.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <div class="empty-state-title">没有打开的文件夹</div>
                <div class="empty-state-subtitle">您还没有打开文件夹</div>
                <button class="empty-state-button" onclick="window.oicppApp.openFolder()">
                    打开文件夹
                </button>
            </div>
        `;
    }

    loadWorkspaceFiles() {
        // 实际加载工作区文件的逻辑
        console.log('加载工作区文件:', this.currentPath);
        
        if (!this.currentPath) {
            this.showEmptyState();
            return;
        }
        
        // 通过 IPC 请求读取文件夹内容
        if (window.electronIPC) {
            window.electronIPC.send('read-directory', this.currentPath);
            
            // 监听文件夹内容返回
            const handleDirectoryRead = (event, dirPath, files) => {
                if (dirPath === this.currentPath) {
                    this.files = files;
                    this.renderFileTree();
                    window.electronIPC.ipcRenderer.removeListener('directory-read', handleDirectoryRead);
                }
            };
            
            window.electronIPC.on('directory-read', handleDirectoryRead);
        } else {
            console.warn('Electron IPC 不可用，无法读取文件夹');
        }
    }

    setWorkspace(path) {
        this.currentPath = path;
        this.hasWorkspace = !!path;
        console.log('设置工作区:', path, '状态:', this.hasWorkspace);
        this.loadFiles();
        
        // 通知侧边栏管理器更新按钮状态
        if (window.sidebarManager) {
            window.sidebarManager.updateFileExplorerButtons();
        }
    }

    clearWorkspace() {
        this.currentPath = '';
        this.hasWorkspace = false;
        this.files = [];
        this.selectedFile = null;
        this.selectedFiles = [];
        this.expandedFolders.clear();
        this.updateSelectionCounter();
        this.showEmptyState();
        
        // 通知侧边栏管理器更新按钮状态
        if (window.sidebarManager) {
            window.sidebarManager.updateFileExplorerButtons();
        }
    }

    renderFileTree() {
        const fileTree = document.querySelector('.file-tree');
        if (!fileTree) return;

        if (!this.hasWorkspace) {
            this.showEmptyState();
            return;
        }

        fileTree.innerHTML = '';
        
        // 添加多选提示
        const hint = document.createElement('div');
        hint.className = 'multi-select-hint';
        hint.id = 'multi-select-hint';
        hint.textContent = '按住 Ctrl 键可多选文件';
        fileTree.appendChild(hint);
        
        this.files.forEach(file => {
            const item = this.createFileTreeItem(file);
            fileTree.appendChild(item);
        });
        
        // 添加文件树的鼠标事件
        this.setupFileTreeEvents(fileTree);
    }

    setupFileTreeEvents(fileTree) {
        // 显示/隐藏多选提示
        fileTree.addEventListener('mouseenter', () => {
            const hint = fileTree.querySelector('#multi-select-hint');
            if (hint) {
                hint.classList.add('show');
            }
        });
        
        fileTree.addEventListener('mouseleave', () => {
            const hint = fileTree.querySelector('#multi-select-hint');
            if (hint) {
                hint.classList.remove('show');
            }
        });
        
        // 点击空白区域取消选择
        fileTree.addEventListener('click', (e) => {
            if (e.target === fileTree) {
                this.clearSelection();
            }
        });
        
        // 设置文件树拖拽接收
        this.setupDragAndDrop(fileTree);
    }

    createFileTreeItem(file, level = 0) {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.dataset.path = file.path;
        item.dataset.type = file.type;
        item.style.paddingLeft = `${level * 16 + 8}px`;
        
        const content = document.createElement('div');
        content.className = 'tree-item-content';
        
        // 文件夹展开/收起箭头
        if (file.type === 'folder') {
            const arrow = document.createElement('span');
            arrow.className = 'tree-item-arrow';
            arrow.textContent = '▶';
            content.appendChild(arrow);
        }
        
        const icon = document.createElement('span');
        icon.className = 'tree-item-icon';
        icon.textContent = this.getFileIcon(file);
        
        const label = document.createElement('span');
        label.className = 'tree-item-label';
        label.textContent = file.name;
        
        content.appendChild(icon);
        content.appendChild(label);
        item.appendChild(content);
        
        // 添加事件监听器
        this.addFileTreeItemListeners(item, file);
        
        return item;
    }

    getFileIcon(file) {
        if (file.type === 'folder') {
            return '📁';
        }
        
        const ext = file.extension;
        switch (ext) {
            case '.cpp':
            case '.cc':
            case '.cxx':
                return '🔷';
            case '.c':
                return '🔵';
            case '.h':
            case '.hpp':
                return '🟦';
            case '.txt':
                return '📄';
            case '.md':
                return '📝';
            case '.json':
                return '⚙️';
            default:
                return '📄';
        }
    }

    addFileTreeItemListeners(item, file) {
        const content = item.querySelector('.tree-item-content');
        
        // 点击事件
        content.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // 检查是否按住Ctrl键进行多选
            if (e.ctrlKey) {
                this.toggleFileSelection(file);
            } else {
                this.selectFile(file);
            }
            
            if (file.type === 'folder') {
                this.toggleFolder(item, file);
            } else if (file.type === 'file') {
                // 单击文件直接打开
                this.openFile(file);
            }
        });
        
        // 双击事件 - 已经在单击事件中处理文件打开，这里不需要重复处理
        content.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            // 双击时不做额外处理，避免重复打开文件
        });
        
        // 右键菜单
        content.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // 如果右键的文件不在选中列表中，则只选中当前文件
            if (!this.selectedFiles.includes(file)) {
                this.selectFile(file);
            }
            this.showContextMenu(e, file);
        });
        
        // 支持拖拽（待实现）
        content.draggable = true;
        content.addEventListener('dragstart', (e) => {
            this.handleDragStart(e, file);
        });
    }

    async toggleFolder(item, folder) {
        const arrow = item.querySelector('.tree-item-arrow');
        const isExpanded = this.expandedFolders.has(folder.path);
        
        if (isExpanded) {
            // 收起文件夹
            arrow.textContent = '▶';
            this.expandedFolders.delete(folder.path);
            
            // 移除所有子项（包括嵌套的子项）
            this.removeChildItems(item, folder.path);
        } else {
            // 展开文件夹
            arrow.textContent = '▼';
            this.expandedFolders.add(folder.path);
            
            // 请求读取子文件夹内容
            if (window.electronIPC) {
                window.electronIPC.send('read-directory', folder.path);
                
                const handleSubDirectoryRead = (event, dirPath, files) => {
                    if (dirPath === folder.path) {
                        this.insertChildItems(item, files, folder.path);
                        window.electronIPC.ipcRenderer.removeListener('directory-read', handleSubDirectoryRead);
                    }
                };
                
                window.electronIPC.on('directory-read', handleSubDirectoryRead);
            }
        }
    }

    removeChildItems(parentItem, parentPath) {
        // 递归移除所有子项
        let nextSibling = parentItem.nextElementSibling;
        const toRemove = [];
        
        while (nextSibling) {
            const itemPath = nextSibling.dataset.path;
            // 检查是否是当前文件夹的子项
            if (itemPath && itemPath.startsWith(parentPath + '/') || itemPath && itemPath.startsWith(parentPath + '\\')) {
                toRemove.push(nextSibling);
                // 如果是文件夹，也从展开状态中移除
                if (nextSibling.dataset.type === 'folder') {
                    this.expandedFolders.delete(itemPath);
                }
                nextSibling = nextSibling.nextElementSibling;
            } else {
                break;
            }
        }
        
        // 移除所有收集到的子项
        toRemove.forEach(item => item.remove());
    }

    insertChildItems(parentItem, files, parentPath) {
        const currentLevel = this.getItemLevel(parentItem);
        let insertPosition = parentItem;
        
        files.forEach(subFile => {
            const subItem = this.createFileTreeItem(subFile, currentLevel + 1);
            insertPosition.insertAdjacentElement('afterend', subItem);
            insertPosition = subItem;
        });
    }

    getItemLevel(item) {
        const paddingLeft = parseInt(item.style.paddingLeft) || 8;
        return Math.floor((paddingLeft - 8) / 16);
    }

    showContextMenu(event, file) {
        // 创建右键菜单
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'fixed';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        menu.style.zIndex = '10000';
        
        const menuItems = this.getContextMenuItems(file);
        menuItems.forEach(menuItem => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.textContent = menuItem.label;
            item.addEventListener('click', () => {
                menuItem.action();
                this.hideContextMenu();
            });
            menu.appendChild(item);
        });
        
        document.body.appendChild(menu);
        
        // 点击其他地方关闭菜单
        const hideMenu = (e) => {
            if (!menu.contains(e.target)) {
                this.hideContextMenu();
                document.removeEventListener('click', hideMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', hideMenu);
        }, 0);
    }

    getContextMenuItems(file) {
        const items = [];
        
        if (this.selectedFiles.length > 1) {
            // 多选状态下的菜单
            items.push({ label: `复制 (${this.selectedFiles.length} 项)`, action: () => this.copySelectedFiles() });
            items.push({ label: `剪切 (${this.selectedFiles.length} 项)`, action: () => this.cutSelectedFiles() });
            items.push({ label: `删除 (${this.selectedFiles.length} 项)`, action: () => this.deleteSelectedFiles() });
        } else {
            // 单选状态下的菜单
            if (file.type === 'file') {
                items.push({ label: '打开', action: () => this.openFile(file) });
                items.push({ label: '重命名', action: () => this.renameFile(file) });
                items.push({ label: '复制', action: () => this.copyFile(file) });
                items.push({ label: '剪切', action: () => this.cutFile(file) });
                items.push({ label: '删除', action: () => this.deleteFile(file) });
            } else {
                items.push({ label: '新建文件', action: () => this.createNewFileInFolder(file) });
                items.push({ label: '新建文件夹', action: () => this.createNewFolderInFolder(file) });
                items.push({ label: '重命名', action: () => this.renameFile(file) });
                items.push({ label: '复制', action: () => this.copyFile(file) });
                items.push({ label: '剪切', action: () => this.cutFile(file) });
                items.push({ label: '删除', action: () => this.deleteFile(file) });
            }
        }
        
        if (this.clipboard) {
            items.push({ label: '粘贴', action: () => this.pasteFile(file) });
        }
        
        return items;
    }

    hideContextMenu() {
        const menu = document.querySelector('.context-menu');
        if (menu) {
            menu.remove();
        }
    }

    // 文件操作方法（待实现具体逻辑）
    copyFile(file) {
        this.clipboard = { files: [file], operation: 'copy' };
        console.log('复制文件:', file.name);
    }

    cutFile(file) {
        this.clipboard = { files: [file], operation: 'cut' };
        console.log('剪切文件:', file.name);
    }

    copySelectedFiles() {
        this.clipboard = { files: [...this.selectedFiles], operation: 'copy' };
        console.log('复制文件:', this.selectedFiles.map(f => f.name));
    }

    cutSelectedFiles() {
        this.clipboard = { files: [...this.selectedFiles], operation: 'cut' };
        console.log('剪切文件:', this.selectedFiles.map(f => f.name));
    }

    deleteSelectedFiles() {
        const fileNames = this.selectedFiles.map(f => f.name);
        console.log('删除多个文件:', fileNames);
        
        // 显示确认对话框
        if (confirm(`确定要删除这 ${this.selectedFiles.length} 个文件吗？\n\n${fileNames.join('\n')}`)) {
            console.log('用户确认删除多个文件');
            
            // 删除每个选中的文件
            const filesToDelete = [...this.selectedFiles]; // 创建副本避免在删除过程中修改原数组
            let deletedCount = 0;
            let errorCount = 0;
            
            filesToDelete.forEach(file => {
                if (window.electronIPC) {
                    window.electronIPC.send('delete-file', file.path);
                    
                    const handleFileDeleted = (event, deletedPath, error) => {
                        if (deletedPath === file.path) {
                            if (error) {
                                console.error('删除文件失败:', file.name, error);
                                errorCount++;
                            } else {
                                console.log('文件删除成功:', file.name);
                                deletedCount++;
                                
                                // 如果文件在标签页中打开，关闭标签页
                                if (window.tabManager) {
                                    window.tabManager.closeTabByFileName(file.name);
                                }
                            }
                            
                            // 检查是否所有文件都处理完成
                            if (deletedCount + errorCount === filesToDelete.length) {
                                if (errorCount > 0) {
                                    alert(`删除完成！成功: ${deletedCount}，失败: ${errorCount}`);
                                }
                                
                                // 清除选择并刷新
                                this.clearSelection();
                                this.refresh();
                            }
                            
                            window.electronIPC.ipcRenderer.removeListener('file-deleted', handleFileDeleted);
                        }
                    };
                    
                    window.electronIPC.on('file-deleted', handleFileDeleted);
                } else {
                    // 模拟删除
                    console.log('模拟删除文件:', file.name);
                }
            });
            
            if (!window.electronIPC) {
                // 模拟删除完成
                this.clearSelection();
                setTimeout(() => this.refresh(), 500);
            }
        }
    }

    pasteFile(targetFolder) {
        if (!this.clipboard) return;
        
        const targetPath = targetFolder.type === 'folder' ? targetFolder.path : this.currentPath;
        console.log('粘贴文件到:', targetPath);
        console.log('粘贴的文件:', this.clipboard.files.map(f => f.name));
        console.log('操作类型:', this.clipboard.operation);
        
        if (window.electronIPC) {
            // 通过IPC请求执行粘贴操作
            this.clipboard.files.forEach(file => {
                const operation = this.clipboard.operation; // 'copy' 或 'cut'
                window.electronIPC.send('paste-file', file.path, targetPath, operation);
                
                const handleFilePasted = (event, sourcePath, destPath, operation, error) => {
                    if (sourcePath === file.path) {
                        if (error) {
                            console.error(`${operation === 'copy' ? '复制' : '移动'}文件失败:`, file.name, error);
                            alert(`${operation === 'copy' ? '复制' : '移动'}失败: ` + error);
                        } else {
                            console.log(`文件${operation === 'copy' ? '复制' : '移动'}成功:`, file.name);
                            
                            // 如果是剪切操作且文件在标签页中打开，更新标签页路径
                            if (operation === 'cut' && window.tabManager) {
                                window.tabManager.updateTabPath(file.name, destPath);
                            }
                        }
                        window.electronIPC.ipcRenderer.removeListener('file-pasted', handleFilePasted);
                    }
                };
                
                window.electronIPC.on('file-pasted', handleFilePasted);
            });
            
            // 刷新文件树
            setTimeout(() => this.refresh(), 1000);
        } else {
            // 模拟粘贴
            console.log('模拟粘贴操作');
            setTimeout(() => this.refresh(), 500);
        }
        
        // 清除剪贴板（如果是剪切操作）
        if (this.clipboard.operation === 'cut') {
            this.clipboard = null;
        }
    }

    async renameFile(file) {
        try {
            const newName = await dialogManager.showInputDialog('重命名', file.name, '请输入新名称');
            if (newName && newName !== file.name) {
                console.log('重命名文件:', file.name, '->', newName);
                
                // 通过IPC请求重命名文件
                if (window.electronIPC) {
                    window.electronIPC.send('rename-file', file.path, newName);
                    
                    const handleRenameResult = (event, oldPath, newPath, error) => {
                        if (oldPath === file.path) {
                            if (error) {
                                console.error('重命名文件失败:', error);
                                alert('重命名失败: ' + error);
                            } else {
                                console.log('文件重命名成功:', oldPath, '->', newPath);
                                // 刷新文件树以显示新名称
                                this.refresh();
                                
                                // 如果文件在标签页中打开，更新标签页标题
                                if (window.tabManager) {
                                    window.tabManager.updateTabTitle(file.name, newName);
                                }
                            }
                            window.electronIPC.ipcRenderer.removeListener('file-renamed', handleRenameResult);
                        }
                    };
                    
                    window.electronIPC.on('file-renamed', handleRenameResult);
                } else {
                    // 暂时的模拟实现
                    console.log('模拟重命名文件:', file.name, '->', newName);
                    file.name = newName;
                    this.refresh();
                }
            }
        } catch (error) {
            console.error('重命名文件时出错:', error);
        }
    }

    handleDragStart(event, file) {
        // 设置拖拽数据
        const dragData = {
            files: this.selectedFiles.includes(file) ? this.selectedFiles : [file],
            action: 'move'
        };
        event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
        event.dataTransfer.effectAllowed = 'move';
        
        // 添加拖拽样式
        event.target.closest('.tree-item').classList.add('dragging');
        
        console.log('开始拖拽:', dragData.files.map(f => f.name));
    }

    setupDragAndDrop(fileTree) {
        // 防止默认行为，允许拖拽
        fileTree.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // 查找拖拽目标
            const targetItem = e.target.closest('.tree-item');
            if (targetItem) {
                const targetType = targetItem.dataset.type;
                
                // 清除之前的拖拽悬停样式
                document.querySelectorAll('.drag-over').forEach(el => {
                    el.classList.remove('drag-over');
                });
                
                // 只有文件夹可以作为拖拽目标
                if (targetType === 'folder') {
                    targetItem.classList.add('drag-over');
                }
            } else {
                // 拖拽到根目录
                document.querySelectorAll('.drag-over').forEach(el => {
                    el.classList.remove('drag-over');
                });
                fileTree.classList.add('drag-over-root');
            }
        });
        
        // 拖拽离开时清除样式
        fileTree.addEventListener('dragleave', (e) => {
            // 只有在完全离开文件树时才清除样式
            if (!fileTree.contains(e.relatedTarget)) {
                document.querySelectorAll('.drag-over').forEach(el => {
                    el.classList.remove('drag-over');
                });
                fileTree.classList.remove('drag-over-root');
            }
        });
        
        // 处理拖拽放置
        fileTree.addEventListener('drop', (e) => {
            e.preventDefault();
            
            // 清除所有拖拽样式
            document.querySelectorAll('.dragging').forEach(el => {
                el.classList.remove('dragging');
            });
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
            fileTree.classList.remove('drag-over-root');
            
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                const targetItem = e.target.closest('.tree-item');
                
                let targetPath;
                if (targetItem) {
                    const targetType = targetItem.dataset.type;
                    if (targetType === 'folder') {
                        targetPath = targetItem.dataset.path;
                    } else {
                        // 如果拖拽到文件上，则移动到该文件的父目录
                        const itemPath = targetItem.dataset.path;
                        const lastSeparator = Math.max(itemPath.lastIndexOf('\\'), itemPath.lastIndexOf('/'));
                        targetPath = itemPath.substring(0, lastSeparator);
                    }
                } else {
                    // 拖拽到根目录
                    targetPath = this.currentPath;
                }
                
                // 执行文件移动
                this.moveFiles(dragData.files, targetPath);
                
            } catch (error) {
                console.error('处理拖拽数据时出错:', error);
            }
        });
        
        // 拖拽结束时清除样式
        fileTree.addEventListener('dragend', (e) => {
            document.querySelectorAll('.dragging').forEach(el => {
                el.classList.remove('dragging');
            });
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
            fileTree.classList.remove('drag-over-root');
        });
    }

    async moveFiles(files, targetPath) {
        console.log('移动文件:', files.map(f => f.name), '到:', targetPath);
        
        if (!window.electronIPC) {
            console.error('Electron IPC 不可用');
            return;
        }
        
        try {
            // 检查是否移动到相同位置
            const isSameLocation = files.some(file => {
                // 简单的路径比较，获取文件的父目录
                const fileDir = file.path.substring(0, file.path.lastIndexOf('\\') || file.path.lastIndexOf('/'));
                return fileDir === targetPath;
            });
            
            if (isSameLocation) {
                console.log('文件已在目标位置，无需移动');
                return;
            }
            
            // 检查是否存在同名文件
            for (const file of files) {
                const separator = targetPath.includes('\\') ? '\\' : '/';
                const newPath = targetPath + separator + file.name;
                
                // 检查目标路径是否存在
                const exists = await new Promise((resolve) => {
                    window.electronIPC.send('check-file-exists', newPath);
                    const handler = (event, filePath, fileExists) => {
                        if (filePath === newPath) {
                            window.electronIPC.ipcRenderer.removeListener('file-exists-result', handler);
                            resolve(fileExists);
                        }
                    };
                    window.electronIPC.ipcRenderer.on('file-exists-result', handler);
                });
                
                if (exists) {
                    const shouldOverwrite = confirm(`文件 "${file.name}" 已存在于目标位置。是否要覆盖？`);
                    if (!shouldOverwrite) {
                        console.log('用户取消了文件移动操作');
                        return;
                    }
                }
            }
            
            // 执行移动操作
            for (const file of files) {
                const separator = targetPath.includes('\\') ? '\\' : '/';
                const newPath = targetPath + separator + file.name;
                
                console.log(`移动文件: ${file.path} -> ${newPath}`);
                
                await new Promise((resolve, reject) => {
                    window.electronIPC.send('move-file', file.path, newPath);
                    
                    const successHandler = (event, oldPath, movedNewPath) => {
                        if (oldPath === file.path && movedNewPath === newPath) {
                            window.electronIPC.ipcRenderer.removeListener('file-moved', successHandler);
                            window.electronIPC.ipcRenderer.removeListener('file-move-error', errorHandler);
                            resolve();
                        }
                    };
                    
                    const errorHandler = (event, oldPath, error) => {
                        if (oldPath === file.path) {
                            window.electronIPC.ipcRenderer.removeListener('file-moved', successHandler);
                            window.electronIPC.ipcRenderer.removeListener('file-move-error', errorHandler);
                            reject(new Error(error));
                        }
                    };
                    
                    window.electronIPC.ipcRenderer.on('file-moved', successHandler);
                    window.electronIPC.ipcRenderer.on('file-move-error', errorHandler);
                });
            }
            
            // 移动成功后刷新文件列表
            this.refresh();
            console.log('文件移动完成');
            
        } catch (error) {
            console.error('移动文件时出错:', error);
            alert(`移动文件时出错: ${error.message}`);
        }
    }

    selectFile(file) {
        // 清除之前的选择
        this.clearSelection();

        // 选择当前文件
        const item = document.querySelector(`[data-path="${file.path}"]`);
        if (item) {
            item.classList.add('selected');
        }

        this.selectedFile = file;
        this.selectedFiles = [file];
        this.updateSelectionCounter();
        console.log('选择文件:', file.name);
    }

    toggleFileSelection(file) {
        const item = document.querySelector(`[data-path="${file.path}"]`);
        if (!item) return;

        const isSelected = this.selectedFiles.includes(file);
        
        if (isSelected) {
            // 取消选择
            item.classList.remove('selected');
            this.selectedFiles = this.selectedFiles.filter(f => f.path !== file.path);
            
            // 如果是当前主选择的文件，更新主选择
            if (this.selectedFile && this.selectedFile.path === file.path) {
                this.selectedFile = this.selectedFiles.length > 0 ? this.selectedFiles[0] : null;
            }
        } else {
            // 添加到选择
            item.classList.add('selected');
            this.selectedFiles.push(file);
            this.selectedFile = file; // 设为主选择
        }
        
        this.updateSelectionCounter();
        console.log('已选择文件:', this.selectedFiles.map(f => f.name));
    }

    clearSelection() {
        const selected = document.querySelectorAll('.tree-item.selected');
        selected.forEach(item => item.classList.remove('selected'));
        this.selectedFiles = [];
        this.selectedFile = null;
        this.updateSelectionCounter();
    }

    updateSelectionCounter() {
        const panelHeader = document.querySelector('#files-panel .panel-header');
        let counter = panelHeader.querySelector('.selection-counter');
        
        if (this.selectedFiles.length > 1) {
            if (!counter) {
                counter = document.createElement('div');
                counter.className = 'selection-counter';
                panelHeader.appendChild(counter);
            }
            counter.textContent = this.selectedFiles.length;
        } else {
            if (counter) {
                counter.remove();
            }
        }
    }

    openFile(file) {
        if (file.type === 'file') {
            console.log('打开文件:', file.name);
            
            // 通过IPC请求读取文件内容
            if (window.electronIPC) {
                window.electronIPC.send('read-file-content', file.path);
                
                const handleFileRead = (event, filePath, content, error) => {
                    if (filePath === file.path) {
                        if (error) {
                            console.error('读取文件失败:', error);
                            alert('无法读取文件: ' + error);
                        } else {
                            // 添加详细的文件内容调试信息
                            console.log(`=== 文件读取调试信息 ===`);
                            console.log(`文件路径: ${filePath}`);
                            console.log(`内容长度: ${content ? content.length : 0}`);
                            console.log(`内容前100字符: "${content ? content.substring(0, 100) : ''}"`);
                            console.log(`内容末尾100字符: "${content ? content.substring(Math.max(0, content.length - 100)) : ''}"`);
                            console.log(`====================`);
                            
                            // 直接打开文件到唯一的编辑器中
                            if (window.tabManager) {
                                window.tabManager.openFile(file.name, content, false, file.path);
                            }
                        }
                        window.electronIPC.ipcRenderer.removeListener('file-content-read', handleFileRead);
                    }
                };
                
                window.electronIPC.on('file-content-read', handleFileRead);
            }
        } else if (file.type === 'folder') {
            console.log('展开文件夹:', file.name);
            // 文件夹的展开逻辑在 toggleFolder 中处理
        }
    }

    async createNewFile() {
        console.log('创建新文件');
        
        // 检查是否有工作区
        if (!this.hasWorkspace) {
            console.log('没有工作区，无法创建文件');
            return;
        }
        
        try {
            const fileName = await dialogManager.showNewFileDialog();
            if (fileName) {
                // 通知主应用创建新文件
                if (window.oicppApp && typeof window.oicppApp.createNewCppFile === 'function') {
                    window.oicppApp.createNewCppFile();
                } else if (window.tabManager && typeof window.tabManager.createNewCppFile === 'function') {
                    window.tabManager.createNewCppFile();
                } else {
                    // 在标签页中打开新文件
                    if (window.tabManager && typeof window.tabManager.openFile === 'function') {
                        window.tabManager.openFile(fileName, '', true);
                    } else {
                        console.error('无法找到创建新文件的方法');
                    }
                }
            }
        } catch (error) {
            console.error('创建文件时出错:', error);
        }
    }

    async createNewFolder() {
        console.log('创建新文件夹');
        
        // 检查是否有工作区
        if (!this.hasWorkspace) {
            console.log('没有工作区，无法创建文件夹');
            return;
        }
        
        try {
            const folderName = await dialogManager.showNewFolderDialog();
            if (folderName) {
                // 通过IPC请求创建文件夹
                if (window.electronIPC) {
                    const folderPath = this.currentPath + '/' + folderName;
                    window.electronIPC.send('create-folder', folderPath);
                    
                    const handleFolderCreated = (event, createdPath, error) => {
                        if (createdPath === folderPath) {
                            if (error) {
                                console.error('创建文件夹失败:', error);
                                alert('创建文件夹失败: ' + error);
                            } else {
                                console.log('文件夹创建成功:', createdPath);
                                // 刷新文件树以显示新文件夹
                                this.refresh();
                            }
                            window.electronIPC.ipcRenderer.removeListener('folder-created', handleFolderCreated);
                        }
                    };
                    
                    window.electronIPC.on('folder-created', handleFolderCreated);
                } else {
                    console.log('已创建文件夹:', folderName);
                    // 模拟刷新
                    setTimeout(() => this.refresh(), 500);
                }
            }
        } catch (error) {
            console.error('创建文件夹时出错:', error);
        }
    }

    async createNewFileInFolder(folder) {
        console.log('在文件夹中创建新文件:', folder.name);
        
        try {
            const fileName = await dialogManager.showNewFileDialog();
            if (fileName) {
                // 通过IPC请求在指定文件夹中创建文件
                if (window.electronIPC) {
                    const filePath = folder.path + '/' + fileName;
                    window.electronIPC.send('create-file', filePath, '');
                    
                    const handleFileCreated = (event, createdPath, error) => {
                        if (createdPath === filePath) {
                            if (error) {
                                console.error('创建文件失败:', error);
                                alert('创建文件失败: ' + error);
                            } else {
                                console.log('在文件夹', folder.name, '中创建文件:', fileName);
                                // 刷新文件树以显示新文件
                                this.refresh();
                                
                                // 在标签页中打开新创建的文件
                                if (window.tabManager) {
                                    window.tabManager.openFile(fileName, '');
                                }
                            }
                            window.electronIPC.ipcRenderer.removeListener('file-created', handleFileCreated);
                        }
                    };
                    
                    window.electronIPC.on('file-created', handleFileCreated);
                } else {
                    console.log('在文件夹', folder.name, '中创建文件:', fileName);
                    // 模拟刷新
                    setTimeout(() => this.refresh(), 500);
                }
            }
        } catch (error) {
            console.error('在文件夹中创建文件时出错:', error);
        }
    }

    async createNewFolderInFolder(parentFolder) {
        console.log('在文件夹中创建新文件夹:', parentFolder.name);
        
        try {
            const folderName = await dialogManager.showNewFolderDialog();
            if (folderName) {
                // 通过IPC请求在指定文件夹中创建文件夹
                if (window.electronIPC) {
                    const folderPath = parentFolder.path + '/' + folderName;
                    window.electronIPC.send('create-folder', folderPath);
                    
                    const handleFolderCreated = (event, createdPath, error) => {
                        if (createdPath === folderPath) {
                            if (error) {
                                console.error('创建文件夹失败:', error);
                                alert('创建文件夹失败: ' + error);
                            } else {
                                console.log('在文件夹', parentFolder.name, '中创建文件夹:', folderName);
                                // 刷新文件树以显示新文件夹
                                this.refresh();
                            }
                            window.electronIPC.ipcRenderer.removeListener('folder-created', handleFolderCreated);
                        }
                    };
                    
                    window.electronIPC.on('folder-created', handleFolderCreated);
                } else {
                    console.log('在文件夹', parentFolder.name, '中创建文件夹:', folderName);
                    // 模拟刷新
                    setTimeout(() => this.refresh(), 500);
                }
            }
        } catch (error) {
            console.error('在文件夹中创建文件夹时出错:', error);
        }
    }

    refresh() {
        console.log('刷新文件管理器');
        this.loadFiles();
    }

    deleteFile(file) {
        console.log('删除文件:', file.name);
        
        // 显示确认对话框
        if (confirm(`确定要删除 "${file.name}" 吗？`)) {
            console.log('用户确认删除文件:', file.name);
            
            // 通过IPC请求删除文件
            if (window.electronIPC) {
                window.electronIPC.send('delete-file', file.path);
                
                const handleFileDeleted = (event, deletedPath, error) => {
                    if (deletedPath === file.path) {
                        if (error) {
                            console.error('删除文件失败:', error);
                            alert('删除失败: ' + error);
                        } else {
                            console.log('文件删除成功:', deletedPath);
                            
                            // 从选择列表中移除
                            this.selectedFiles = this.selectedFiles.filter(f => f.path !== file.path);
                            if (this.selectedFile && this.selectedFile.path === file.path) {
                                this.selectedFile = this.selectedFiles.length > 0 ? this.selectedFiles[0] : null;
                            }
                            this.updateSelectionCounter();
                            
                            // 如果文件在标签页中打开，关闭标签页
                            if (window.tabManager) {
                                window.tabManager.closeTabByFileName(file.name);
                            }
                            
                            // 刷新文件树
                            this.refresh();
                        }
                        window.electronIPC.ipcRenderer.removeListener('file-deleted', handleFileDeleted);
                    }
                };
                
                window.electronIPC.on('file-deleted', handleFileDeleted);
            } else {
                // 模拟删除
                console.log('模拟删除文件:', file.name);
                
                // 从选择列表中移除
                this.selectedFiles = this.selectedFiles.filter(f => f.path !== file.path);
                if (this.selectedFile && this.selectedFile.path === file.path) {
                    this.selectedFile = this.selectedFiles.length > 0 ? this.selectedFiles[0] : null;
                }
                this.updateSelectionCounter();
                
                // 刷新文件树
                setTimeout(() => this.refresh(), 500);
            }
        }
    }
}

// 云空间面板
class CloudPanel {
    constructor() {
        this.isLoggedIn = false;
        this.userInfo = null;
    }

    activate() {
        console.log('激活云空间面板');
        this.loadCloudData();
    }

    loadCloudData() {
        // TODO: 实现云空间数据加载
        console.log('加载云空间数据');
    }

    login() {
        console.log('登录云空间');
        // TODO: 实现登录功能
    }

    logout() {
        console.log('注销云空间');
        // TODO: 实现注销功能
    }

    syncFiles() {
        console.log('同步文件');
        // TODO: 实现文件同步功能
    }
}

// 样例测试器面板
class SampleTester {
    constructor() {
        this.testCases = [];
        this.currentCase = null;
    }

    activate() {
        console.log('激活样例测试器面板');
        this.loadTestCases();
    }

    loadTestCases() {
        // TODO: 实现测试用例加载
        console.log('加载测试用例');
    }

    addTestCase() {
        console.log('添加测试用例');
        // TODO: 实现添加测试用例功能
    }

    runTest(testCase) {
        console.log('运行测试用例:', testCase);
        // TODO: 实现测试用例运行功能
    }

    runAllTests() {
        console.log('运行所有测试用例');
        // TODO: 实现批量测试功能
    }
}

// 代码对拍器面板
class CodeComparer {
    constructor() {
        this.standardCode = '';
        this.testCode = '';
        this.testResults = [];
    }

    activate() {
        console.log('激活代码对拍器面板');
        this.loadComparerData();
    }

    loadComparerData() {
        // TODO: 实现对拍器数据加载
        console.log('加载对拍器数据');
    }

    setStandardCode(code) {
        this.standardCode = code;
        console.log('设置标准代码');
    }

    setTestCode(code) {
        this.testCode = code;
        console.log('设置测试代码');
    }

    startComparison() {
        console.log('开始对拍');
        // TODO: 实现代码对拍功能
    }

    generateTestData() {
        console.log('生成测试数据');
        // TODO: 实现测试数据生成功能
    }
}

// 调试面板
class DebugPanel {
    constructor() {
        this.isActive = false;
    }

    activate() {
        console.log('激活调试面板（开发中模式）');
        this.isActive = true;
        
        // 调试功能开发中，不初始化功能
        console.log('调试面板已激活，显示开发中界面');
    }

    deactivate() {
        this.isActive = false;
        console.log('调试面板已停用');
    }
}

// 账户面板
class AccountPanel {
    constructor() {
        this.user = null;
        this.isLoggedIn = false;
    }

    activate() {
        console.log('激活账户面板');
        this.loadUserInfo();
    }

    loadUserInfo() {
        // TODO: 实现用户信息加载
        console.log('加载用户信息');
    }

    login() {
        console.log('用户登录');
        // TODO: 实现用户登录功能
    }

    logout() {
        console.log('用户注销');
        // TODO: 实现用户注销功能
    }

    updateProfile() {
        console.log('更新用户资料');
        // TODO: 实现用户资料更新功能
    }
}

// 初始化侧边栏管理器
let sidebarManager;
document.addEventListener('DOMContentLoaded', () => {
    sidebarManager = new SidebarManager();
    window.sidebarManager = sidebarManager;
    
    // 初始化时更新按钮状态
    setTimeout(() => {
        sidebarManager.updateFileExplorerButtons();
    }, 100);
    
    console.log('侧边栏管理器已初始化');
});
