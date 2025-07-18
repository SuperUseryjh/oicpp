// Electron 帮助模块 - 统一 IPC 管理
(function() {
    'use strict';
    
    // 检查是否在 Electron 环境中
    const isElectron = typeof window !== 'undefined' && window.process && window.process.versions && window.process.versions.electron;
    
    if (isElectron) {
        // 在 Electron 中导入 IPC 模块
        const { ipcRenderer } = require('electron');
        
        // 创建全局 IPC 管理器
        window.electronIPC = {
            ipcRenderer: ipcRenderer,
            
            // 便捷方法
            send: (channel, ...args) => ipcRenderer.send(channel, ...args),
            invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
            on: (channel, listener) => ipcRenderer.on(channel, listener),
            once: (channel, listener) => ipcRenderer.once(channel, listener),
            removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
            removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
        };
        
        // 创建 electronAPI 用于文件操作
        window.electronAPI = {
            openFile: () => ipcRenderer.send('open-file-dialog'),
            openFolder: () => ipcRenderer.send('open-folder-dialog'),
            saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
            saveAsFile: (content) => ipcRenderer.invoke('save-as-file', content),
            showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
            showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
            // 临时文件操作
            saveTempFile: (filePath, content) => ipcRenderer.invoke('save-temp-file', filePath, content),
            loadTempFile: (filePath) => ipcRenderer.invoke('load-temp-file', filePath),
            deleteTempFile: (filePath) => ipcRenderer.invoke('delete-temp-file', filePath),
            // 设置相关API
            getAllSettings: () => ipcRenderer.invoke('get-all-settings'),
            getSettings: () => ipcRenderer.invoke('get-settings'),
            updateSettings: (newSettings) => ipcRenderer.invoke('update-top-level-settings', newSettings),
            resetSettings: () => ipcRenderer.invoke('reset-settings'),
            exportSettings: () => ipcRenderer.invoke('export-settings'),
            importSettings: () => ipcRenderer.invoke('import-settings'),
            // 打开设置窗口
            openCompilerSettings: () => ipcRenderer.invoke('open-compiler-settings'),
            openEditorSettings: () => ipcRenderer.invoke('open-editor-settings'),
            // 编译器管理
            getPlatform: () => ipcRenderer.invoke('get-platform'),
            getUserHome: () => ipcRenderer.invoke('get-user-home'),
            getDownloadedCompilers: () => ipcRenderer.invoke('get-downloaded-compilers'),
            downloadCompiler: (config) => ipcRenderer.invoke('download-compiler', config),
            selectCompiler: (version) => ipcRenderer.invoke('select-compiler', version),
            // 获取用户图标路径
            getUserIconPath: () => ipcRenderer.invoke('get-user-icon-path')
        };
        
        console.log('Electron IPC 管理器已初始化');
        console.log('Electron API 已初始化');
    } else {
        // 在非 Electron 环境中创建模拟对象
        window.electronIPC = {
            ipcRenderer: null,
            send: () => console.warn('Not in Electron environment'),
            invoke: () => Promise.resolve(),
            on: () => {},
            once: () => {},
            removeListener: () => {},
            removeAllListeners: () => {}
        };
        
        window.electronAPI = {
            openFile: () => console.warn('打开文件功能需要在 Electron 环境中运行'),
            openFolder: () => console.warn('打开文件夹功能需要在 Electron 环境中运行'),
            saveFile: () => console.warn('保存文件功能需要在 Electron 环境中运行'),
            saveAsFile: () => console.warn('另存为功能需要在 Electron 环境中运行'),
            showOpenDialog: () => Promise.resolve({ canceled: true, message: '需要在 Electron 环境中运行' }),
            showSaveDialog: () => Promise.resolve({ canceled: true, message: '需要在 Electron 环境中运行' }),
            // 临时文件操作（模拟）
            saveTempFile: () => Promise.resolve(),
            loadTempFile: () => Promise.resolve(null),
            deleteTempFile: () => Promise.resolve(),
            // 设置相关API（模拟）
            getAllSettings: () => Promise.resolve({}),
            getSettings: () => Promise.resolve({}),
            updateSettings: () => Promise.resolve({ success: true }),
            resetSettings: () => Promise.resolve({ success: true }),
            exportSettings: () => Promise.resolve({ success: false, message: '需要在 Electron 环境中运行' }),
            importSettings: () => Promise.resolve({ success: false, message: '需要在 Electron 环境中运行' }),
            // 打开设置窗口（模拟）
            openCompilerSettings: () => console.warn('打开编译器设置需要在 Electron 环境中运行'),
            openEditorSettings: () => console.warn('打开编辑器设置需要在 Electron 环境中运行'),
            // 编译器管理（模拟）
            getPlatform: () => Promise.resolve('windows'),
            getUserHome: () => Promise.resolve('C:\\Users\\User'),
            getDownloadedCompilers: () => Promise.resolve([]),
            downloadCompiler: () => Promise.resolve({ success: false, error: '需要在 Electron 环境中运行' }),
            selectCompiler: () => Promise.resolve({ success: false, error: '需要在 Electron 环境中运行' }),
            // 获取用户图标路径（模拟）
            getUserIconPath: () => Promise.resolve('../../oicpp.ico')
        };
        
        console.warn('非 Electron 环境，使用模拟 IPC');
    }
    
})();
