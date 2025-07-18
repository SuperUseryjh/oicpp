// 设置管理器 - 统一管理所有应用设置
class SettingsManager {
    constructor() {
        this.settings = {
            compiler: {
                compilerPath: '',
                compilerOptions: '-std=c++14 -O2 -static',
                installPath: ''
            },
            editor: {
                font: 'Consolas, "Courier New", monospace',
                fontSize: 14,
                theme: 'dark',
                tabSize: 4,
                wordWrap: false,
                lineNumbers: true,
                autoCompletion: true,
                bracketMatching: true,
                highlightCurrentLine: true
            },
            templates: {
                cppTemplate: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    // 在这里编写你的代码
    
    return 0;
}`,
                cTemplate: `#include <stdio.h>
#include <stdlib.h>

int main() {
    // 在这里编写你的代码
    
    return 0;
}`,
                customTemplates: []
            },
            general: {
                autoSave: false,
                autoSaveInterval: 5000,
                showWelcomeScreen: true,
                language: 'zh-cn'
            }
        };
        
        this.callbacks = new Map(); // 设置变化回调
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        try {
            // 加载设置
            await this.loadSettings();
            
            // 设置IPC监听器
            this.setupIPC();
            
            this.isInitialized = true;
            console.log('设置管理器初始化完成');
        } catch (error) {
            console.error('设置管理器初始化失败:', error);
        }
    }

    setupIPC() {
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                
                // 监听设置变化
                ipcRenderer.on('settings-changed', (event, settingsType, newSettings) => {
                    this.handleSettingsChange(settingsType, newSettings);
                });
                
                // 监听所有设置变化
                ipcRenderer.on('all-settings-changed', (event, allSettings) => {
                    this.handleAllSettingsChange(allSettings);
                });
                
            } catch (error) {
                console.warn('IPC设置监听器初始化失败:', error);
            }
        }
    }

    async loadSettings() {
        try {
            if (typeof require !== 'undefined') {
                const { ipcRenderer } = require('electron');
                const allSettings = await ipcRenderer.invoke('get-all-settings');
                if (allSettings) {
                    this.settings = this.mergeSettings(this.settings, allSettings);
                    console.log('从主进程加载设置成功:', this.settings);
                    return;
                }
            }
            
            // 兼容性：从localStorage加载
            const savedSettings = localStorage.getItem('oicpp-all-settings');
            if (savedSettings) {
                this.settings = this.mergeSettings(this.settings, JSON.parse(savedSettings));
                console.log('从localStorage加载设置成功:', this.settings);
            }
            
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    mergeSettings(defaultSettings, savedSettings) {
        const merged = JSON.parse(JSON.stringify(defaultSettings));
        
        for (const key in savedSettings) {
            if (savedSettings.hasOwnProperty(key)) {
                if (typeof savedSettings[key] === 'object' && savedSettings[key] !== null && !Array.isArray(savedSettings[key])) {
                    merged[key] = { ...merged[key], ...savedSettings[key] };
                } else {
                    merged[key] = savedSettings[key];
                }
            }
        }
        
        return merged;
    }

    handleSettingsChange(settingsType, newSettings) {
        if (this.settings[settingsType]) {
            this.settings[settingsType] = { ...this.settings[settingsType], ...newSettings };
        } else {
            this.settings[settingsType] = newSettings;
        }
        
        // 保存到localStorage
        localStorage.setItem('oicpp-all-settings', JSON.stringify(this.settings));
        
        // 触发回调
        this.triggerCallbacks(settingsType, newSettings);
        
        console.log(`设置已更新: ${settingsType}`, newSettings);
    }

    handleAllSettingsChange(allSettings) {
        this.settings = this.mergeSettings(this.settings, allSettings);
        
        // 保存到localStorage
        localStorage.setItem('oicpp-all-settings', JSON.stringify(this.settings));
        
        // 触发所有回调
        for (const settingsType in allSettings) {
            this.triggerCallbacks(settingsType, allSettings[settingsType]);
        }
        
        console.log('所有设置已更新:', this.settings);
    }

    triggerCallbacks(settingsType, newSettings) {
        const typeCallbacks = this.callbacks.get(settingsType);
        if (typeCallbacks) {
            typeCallbacks.forEach(callback => {
                try {
                    callback(newSettings);
                } catch (error) {
                    console.error(`设置回调执行失败 (${settingsType}):`, error);
                }
            });
        }
        
        // 触发全局回调
        const globalCallbacks = this.callbacks.get('*');
        if (globalCallbacks) {
            globalCallbacks.forEach(callback => {
                try {
                    callback(settingsType, newSettings);
                } catch (error) {
                    console.error('全局设置回调执行失败:', error);
                }
            });
        }
    }

    // 注册设置变化回调
    onSettingsChange(settingsType, callback) {
        if (!this.callbacks.has(settingsType)) {
            this.callbacks.set(settingsType, []);
        }
        this.callbacks.get(settingsType).push(callback);
        
        // 如果已经初始化，立即调用回调
        if (this.isInitialized && settingsType !== '*' && this.settings[settingsType]) {
            try {
                callback(this.settings[settingsType]);
            } catch (error) {
                console.error('设置回调立即执行失败:', error);
            }
        }
    }

    // 移除设置变化回调
    offSettingsChange(settingsType, callback) {
        const callbacks = this.callbacks.get(settingsType);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    // 获取设置
    getSettings(settingsType) {
        if (settingsType) {
            return this.settings[settingsType] || {};
        }
        return this.settings;
    }

    // 更新设置
    async updateSettings(settingsType, newSettings) {
        try {
            if (typeof require !== 'undefined') {
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('settings-updated', settingsType, newSettings);
            } else {
                // 直接更新本地设置
                this.handleSettingsChange(settingsType, newSettings);
            }
        } catch (error) {
            console.error('更新设置失败:', error);
        }
    }

    // 重置设置
    async resetSettings(settingsType) {
        try {
            if (typeof require !== 'undefined') {
                const { ipcRenderer } = require('electron');
                const result = await ipcRenderer.invoke('reset-settings', settingsType);
                return result;
            } else {
                // 本地重置
                const defaultSettings = this.getDefaultSettings();
                if (settingsType) {
                    this.handleSettingsChange(settingsType, defaultSettings[settingsType]);
                    return { success: true, settings: defaultSettings[settingsType] };
                } else {
                    this.handleAllSettingsChange(defaultSettings);
                    return { success: true, settings: defaultSettings };
                }
            }
        } catch (error) {
            console.error('重置设置失败:', error);
            return { success: false, error: error.message };
        }
    }

    getDefaultSettings() {
        return {
            compiler: {
                compilerPath: '',
                compilerOptions: '-std=c++14 -O2 -static',
                installPath: ''
            },
            editor: {
                font: 'Consolas, "Courier New", monospace',
                fontSize: 14,
                theme: 'dark',
                tabSize: 4,
                wordWrap: false,
                lineNumbers: true,
                autoCompletion: true,
                bracketMatching: true,
                highlightCurrentLine: true
            },
            templates: {
                cppTemplate: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    // 在这里编写你的代码
    
    return 0;
}`,
                cTemplate: `#include <stdio.h>
#include <stdlib.h>

int main() {
    // 在这里编写你的代码
    
    return 0;
}`,
                customTemplates: []
            },
            general: {
                autoSave: false,
                autoSaveInterval: 5000,
                showWelcomeScreen: true,
                language: 'zh-cn'
            }
        };
    }
}

// 全局设置管理器实例
if (typeof window !== 'undefined') {
    window.settingsManager = new SettingsManager();
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsManager;
}
