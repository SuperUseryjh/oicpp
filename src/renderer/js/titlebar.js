// 标题栏管理器
class TitlebarManager {
    constructor() {
        this.titlebar = null;
        this.currentTitle = 'OICPP IDE';
        this.isMaximized = false;
        this.init();
    }

    init() {
        this.setupTitlebar();
        this.setupWindowControls();
        this.setupElectronEvents();
        console.log('标题栏管理器已初始化');
    }

    setupTitlebar() {
        // 创建标题栏元素
        this.titlebar = document.querySelector('.titlebar');
        if (!this.titlebar) {
            this.titlebar = document.createElement('div');
            this.titlebar.className = 'titlebar';
            this.titlebar.innerHTML = `
                <div class="titlebar-left">
                    <div class="titlebar-title">${this.currentTitle}</div>
                </div>
                <div class="titlebar-right">
                    <div class="titlebar-controls">
                        <button class="titlebar-button minimize" title="最小化">
                            <span class="icon">&#x2212;</span>
                        </button>
                        <button class="titlebar-button maximize" title="最大化">
                            <span class="icon">&#x2610;</span>
                        </button>
                        <button class="titlebar-button close" title="关闭">
                            <span class="icon">&#x2715;</span>
                        </button>
                    </div>
                </div>
            `;
            document.body.insertBefore(this.titlebar, document.body.firstChild);
        }
    }

    setupWindowControls() {
        // 检查是否在 Electron 环境中 或者使用 electronIPC 帮助器
        if (!window.electronIPC && typeof require === 'undefined') {
            console.warn('不在 Electron 环境中，跳过窗口控制设置');
            return;
        }
        
        // 等待 DOM 元素创建完成
        setTimeout(() => {
            // 最小化按钮
            const minimizeBtn = document.getElementById('minimize-btn');
            if (minimizeBtn) {
                minimizeBtn.addEventListener('click', () => {
                    console.log('点击最小化按钮');
                    if (window.electronIPC) {
                        window.electronIPC.send('window-minimize');
                    } else if (typeof require !== 'undefined') {
                        const { ipcRenderer } = require('electron');
                        ipcRenderer.send('window-minimize');
                    }
                });
            }

            // 最大化/还原按钮
            const maximizeBtn = document.getElementById('maximize-btn');
            if (maximizeBtn) {
                maximizeBtn.addEventListener('click', () => {
                    console.log('点击最大化按钮, 当前状态:', this.isMaximized);
                    if (window.electronIPC) {
                        if (this.isMaximized) {
                            window.electronIPC.send('window-unmaximize');
                        } else {
                            window.electronIPC.send('window-maximize');
                        }
                    } else if (typeof require !== 'undefined') {
                        const { ipcRenderer } = require('electron');
                        if (this.isMaximized) {
                            ipcRenderer.send('window-unmaximize');
                        } else {
                            ipcRenderer.send('window-maximize');
                        }
                    }
                });
            }

            // 关闭按钮
            const closeBtn = document.getElementById('close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    console.log('点击关闭按钮');
                    if (window.electronIPC) {
                        window.electronIPC.send('window-close');
                    } else if (typeof require !== 'undefined') {
                        const { ipcRenderer } = require('electron');
                        ipcRenderer.send('window-close');
                    }
                });
            }
        }, 100);
    }

    setupElectronEvents() {
        // 使用 electronIPC 帮助器或直接使用 require
        if (window.electronIPC) {
            // 监听窗口最大化状态变化
            window.electronIPC.on('window-maximized', () => {
                console.log('窗口已最大化');
                this.isMaximized = true;
                this.updateMaximizeButton();
            });

            window.electronIPC.on('window-unmaximized', () => {
                console.log('窗口已还原');
                this.isMaximized = false;
                this.updateMaximizeButton();
            });
        } else if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            
            // 监听窗口最大化状态变化
            ipcRenderer.on('window-maximized', () => {
                console.log('窗口已最大化');
                this.isMaximized = true;
                this.updateMaximizeButton();
            });

            ipcRenderer.on('window-unmaximized', () => {
                console.log('窗口已还原');
                this.isMaximized = false;
                this.updateMaximizeButton();
            });
        }
    }

    updateMaximizeButton() {
        const maximizeBtn = document.getElementById('maximize-btn');
        if (maximizeBtn) {
            const svg = maximizeBtn.querySelector('svg path');
            if (svg) {
                if (this.isMaximized) {
                    // 还原图标 - 两个重叠的矩形
                    svg.setAttribute('d', 'M2 2h6v6H2V2zM4 4h6v6H4V4z');
                    maximizeBtn.title = '还原';
                } else {
                    // 最大化图标 - 单个矩形
                    svg.setAttribute('d', 'M2 2h8v8H2V2z');
                    maximizeBtn.title = '最大化';
                }
            }
        }
    }

    setTitle(title) {
        this.currentTitle = title;
        const titleElement = this.titlebar.querySelector('.titlebar-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }
}

// 导出类
window.TitlebarManager = TitlebarManager;
