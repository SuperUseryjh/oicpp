// 设置初始化脚本
(function() {
    'use strict';
    
    // 等待 DOM 加载完成和 electron API 可用
    document.addEventListener('DOMContentLoaded', async function() {
        try {
            // 等待一小段时间确保 electron API 已准备好
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (window.electronAPI && window.electronAPI.getAllSettings) {
                // 加载设置
                const settings = await window.electronAPI.getAllSettings();
                console.log('启动时加载的设置:', settings);
                
                // 应用设置到界面
                applySettingsToUI(settings);
                
                // 监听设置变化
                if (window.electronIPC && window.electronIPC.on) {
                    window.electronIPC.on('settings-changed', (event, settingsType, newSettings) => {
                        console.log('收到设置变化通知:', newSettings);
                        applySettingsToUI(newSettings);
                    });
                    
                    window.electronIPC.on('settings-loaded', (event, allSettings) => {
                        console.log('收到设置加载完成通知:', allSettings);
                        applySettingsToUI(allSettings);
                    });
                    
                    window.electronIPC.on('settings-reset', (event, allSettings) => {
                        console.log('收到设置重置通知:', allSettings);
                        applySettingsToUI(allSettings);
                    });
                    
                    window.electronIPC.on('settings-imported', (event, allSettings) => {
                        console.log('收到设置导入通知:', allSettings);
                        applySettingsToUI(allSettings);
                    });
                }
            }
        } catch (error) {
            console.error('设置初始化失败:', error);
        }
    });
    
    // 应用设置到界面
    function applySettingsToUI(settings) {
        if (!settings) return;
        
        // 应用主题
        if (settings.theme) {
            document.documentElement.setAttribute('data-theme', settings.theme);
            document.body.className = document.body.className.replace(/theme-\w+/, '') + ' theme-' + settings.theme;
        }
        
        // 应用字体设置
        if (settings.font || settings.fontSize) {
            const fontFamily = settings.font || 'Consolas';
            const fontSize = settings.fontSize || 14;
            
            // 应用到编辑器区域
            const editorElements = document.querySelectorAll('.monaco-editor, .editor-container, .code-editor');
            editorElements.forEach(element => {
                if (settings.font) {
                    element.style.fontFamily = fontFamily;
                }
                if (settings.fontSize) {
                    element.style.fontSize = fontSize + 'px';
                }
            });
            
            // 更新 CSS 变量
            document.documentElement.style.setProperty('--editor-font-family', fontFamily);
            document.documentElement.style.setProperty('--editor-font-size', fontSize + 'px');
        }
        
        // 触发自定义事件，通知其他组件设置已更新
        const event = new CustomEvent('settings-applied', {
            detail: settings
        });
        document.dispatchEvent(event);
    }
    
    // 导出全局函数供其他脚本使用
    window.applySettings = applySettingsToUI;
    
    // 提供获取当前设置的便捷函数
    window.getCurrentSettings = async function() {
        try {
            if (window.electronAPI && window.electronAPI.getAllSettings) {
                return await window.electronAPI.getAllSettings();
            }
            return {};
        } catch (error) {
            console.error('获取当前设置失败:', error);
            return {};
        }
    };
    
    // 提供更新设置的便捷函数
    window.updateSettings = async function(newSettings) {
        try {
            if (window.electronAPI && window.electronAPI.updateSettings) {
                const result = await window.electronAPI.updateSettings(newSettings);
                if (result.success) {
                    console.log('设置更新成功');
                    return true;
                } else {
                    console.error('设置更新失败:', result.error);
                    return false;
                }
            }
            return false;
        } catch (error) {
            console.error('更新设置失败:', error);
            return false;
        }
    };
    
    console.log('设置初始化脚本已加载');
})();
