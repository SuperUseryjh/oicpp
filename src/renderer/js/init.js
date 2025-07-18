// 应用初始化脚本
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 加载完成，开始初始化应用...');
    
    // 设置用户目录中的图标路径
    setUserIconPath();
    
    // 初始化顺序很重要
    initializeApp();
});

// 设置用户目录中的图标路径
async function setUserIconPath() {
    try {
        const userIconPath = await window.electronAPI.getUserIconPath();
        const appIcon = document.getElementById('app-icon');
        if (appIcon) {
            appIcon.src = userIconPath;
        }
    } catch (error) {
        console.warn('无法加载用户目录中的图标，使用默认图标:', error);
    }
}

async function initializeApp() {
    try {
        // 1. 首先初始化标题栏管理器
        console.log('初始化标题栏管理器...');
        window.titlebarManager = new TitlebarManager();
        
        // 2. 初始化侧边栏管理器
        console.log('初始化侧边栏管理器...');
        window.sidebarManager = new SidebarManager();
        
        // 3. 初始化标签页管理器
        console.log('初始化标签页管理器...');
        window.tabManager = new TabManager();
        
        // 4. 初始化自研编辑器
        console.log('初始化自研编辑器...');
        // 编辑器管理器将在主应用中创建
        
        // 6. 最后初始化主应用
        console.log('初始化主应用...');
        window.oicppApp = new OICPPApp();
        await window.oicppApp.init();
        
        // 8. 设置默认文件
        setupDefaultContent();
        
        console.log('应用初始化完成！');
        
    } catch (error) {
        console.error('应用初始化失败:', error);
        showErrorMessage('应用初始化失败: ' + error.message);
    }
}

function setupDefaultContent() {
    // 显示欢迎页面而不是默认的 C++ 文件
    setTimeout(function() {
        try {
            if (window.tabManager && typeof window.tabManager.getTabCount === 'function' && window.tabManager.getTabCount() === 0) {
                console.log('显示欢迎页面...');
                if (typeof window.tabManager.showWelcomePage === 'function') {
                    window.tabManager.showWelcomePage();
                } else {
                    console.error('showWelcomePage 方法不存在');
                }
            }
        } catch (error) {
            console.error('显示欢迎页面时出错:', error);
            // 作为备用方案，创建一个默认的C++文件
            if (window.tabManager && typeof window.tabManager.createNewCppFile === 'function') {
                window.tabManager.createNewCppFile();
            }
        }
    }, 1000); // 延迟1秒确保所有组件都已加载
}

function showErrorMessage(message) {
    // 创建错误提示
    var errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: Arial, sans-serif;
        max-width: 400px;
        text-align: center;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // 5秒后自动移除
    setTimeout(function() {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
    
    // 点击移除
    errorDiv.addEventListener('click', function() {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    });
}

// 添加全局错误处理
window.addEventListener('error', function(e) {
    console.error('全局错误:', e.error);
    showErrorMessage('发生错误: ' + e.error.message);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('未处理的 Promise 拒绝:', e.reason);
    showErrorMessage('异步错误: ' + e.reason);
});

// 导出初始化函数供其他脚本使用
window.initializeApp = initializeApp;
