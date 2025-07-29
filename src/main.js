const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');
const StreamZip = require('node-stream-zip');

// 导入GDB调试器
const GDBDebugger = require('./gdb-debugger');

// 应用程序版本号
const APP_VERSION = '1.0.0-alpha3';

// 获取用户目录中的oicpp.ico路径
function getUserIconPath() {
  const userIconPath = path.join(os.homedir(), '.oicpp', 'oicpp.ico');
  // 如果用户目录中不存在图标文件，使用默认路径作为备用
  if (fs.existsSync(userIconPath)) {
    return userIconPath;
  }
  return path.join(__dirname, '../oicpp.ico');
}

let mainWindow;

// 日志输出到浏览器控制台的辅助函数
function logToConsole(level, ...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  // 输出到主进程控制台
  console[level](...args);
  
  // 发送到渲染进程控制台（增加错误处理）
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    try {
      // 等待渲染进程加载完成
      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', () => {
          sendLogToRenderer(level, message);
        });
      } else {
        sendLogToRenderer(level, message);
      }
    } catch (err) {
      // 如果发送失败，只在主进程输出，不抛出错误
      console.warn('无法发送日志到渲染进程:', err.message);
    }
  }
}

// 发送日志到渲染进程的辅助函数
function sendLogToRenderer(level, message) {
  const safeMessage = message.replace(/'/g, "\\'").replace(/\n/g, '\\n');
  const script = `
    try {
      console.${level}('[主进程] ${safeMessage}');
    } catch(e) {
      console.warn('日志输出失败:', e.message);
    }
  `;
  
  mainWindow.webContents.executeJavaScript(script).catch(err => {
    // 静默处理错误，不影响主要功能
    console.warn('发送日志到渲染进程失败:', err.message);
  });
}

// 获取默认设置
function getDefaultSettings() {
  return {
    compilerPath: '',
    compilerArgs: '-std=c++14 -O2 -static',
    font: 'Monaco',
    fontSize: 14,
    theme: 'dark',
    enableAutoCompletion: false,
    lastUpdateCheck: '1970-01-01',
    pendingUpdate: null, // 待安装的更新信息
    cppTemplate: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    // 在这里编写你的代码
    
    return 0;
}`
  };
}

// 简化的设置配置（只保留必要字段）
let settings = getDefaultSettings();

// 调试相关变量
let debugProcess = null;
let debugSession = null;
let breakpoints = new Map();
let currentOpenFile = null;
let isDebugging = false;

// 查找ConsolePauser.exe的函数
function findConsolePauser() {
  // 使用用户目录下的ConsolePauser.exe
  const userProfilePath = os.homedir();
  const consolePauserPath = path.join(userProfilePath, '.oicpp', 'consolePauser.exe');
  
  if (fs.existsSync(consolePauserPath)) {
    console.log('找到ConsolePauser:', consolePauserPath);
    return consolePauserPath;
  }
  
  console.log('未找到ConsolePauser.exe');
  return null;
}

// 查找编译器可执行文件
function findCompilerExecutable(baseDir) {
  console.log('[查找编译器] 开始在目录中查找:', baseDir);
  
  const commonPaths = [
    'bin/g++.exe',
    'bin/gcc.exe',
    'mingw64/bin/g++.exe',
    'mingw32/bin/g++.exe',
    'x86_64-w64-mingw32/bin/g++.exe',
    'i686-w64-mingw32/bin/g++.exe'
  ];
  
  console.log('[查找编译器] 检查常见路径...');
  for (const relativePath of commonPaths) {
    const fullPath = path.join(baseDir, relativePath);
    console.log('[查找编译器] 检查路径:', fullPath);
    if (fs.existsSync(fullPath)) {
      console.log('[查找编译器] 找到编译器:', fullPath);
      return fullPath;
    }
  }
  
  console.log('[查找编译器] 常见路径未找到，开始递归搜索...');
  
  // 递归搜索
  try {
    const files = walkDir(baseDir);
    console.log('[查找编译器] 搜索到的所有文件数量:', files.length);
    
    const gppFiles = files.filter(file => 
      file.endsWith('g++.exe') || file.endsWith('gcc.exe')
    );
    
    console.log('[查找编译器] 找到的编译器文件:', gppFiles);
    
    if (gppFiles.length > 0) {
      console.log('[查找编译器] 使用第一个找到的编译器:', gppFiles[0]);
      return gppFiles[0];
    }
  } catch (error) {
    console.error('[查找编译器] 搜索编译器可执行文件失败:', error);
  }
  
  console.log('[查找编译器] 未找到任何编译器可执行文件');
  return null;
}

// 递归遍历目录
function walkDir(dir) {
  const files = [];
  
  function walk(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        try {
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            walk(fullPath);
          } else {
            files.push(fullPath);
          }
        } catch (error) {
          console.log('[查找编译器] 跳过无法访问的文件:', fullPath, error.message);
        }
      }
    } catch (error) {
      console.log('[查找编译器] 无法读取目录:', currentDir, error.message);
    }
  }
  
  walk(dir);
  return files;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false  // 允许加载本地文件
    },
    icon: getUserIconPath(),
    frame: false, // 隐藏系统标题栏
    titleBarStyle: 'hidden',
    show: false
  });

  mainWindow.loadFile('src/renderer/index.html');
  
  // 调试模式加载调试页面
  if (process.argv.includes('--debug-monaco')) {
    mainWindow.loadFile('src/renderer/debug.html');
  }
  
  // 加载修复的调试页面
  if (process.argv.includes('--debug-fixed')) {
    mainWindow.loadFile('src/renderer/debug-fixed.html');
  }
  
  // 加载简单测试页面
  if (process.argv.includes('--test-simple')) {
    mainWindow.loadFile('src/renderer/monaco-simple-test.html');
  }
  
  // 开发时打开调试工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // 通知渲染进程设置已加载
    mainWindow.webContents.send('settings-loaded', settings);
    
    // 检查待安装的更新
    checkPendingUpdate();
    
    // 每日自动检查更新
    checkDailyUpdate();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 创建菜单栏
  createMenuBar();

  // 设置窗口控制事件
  setupWindowControls();
  
  // 设置IPC处理
  setupIPC();
  
  // 加载设置
  loadSettings();
}

// 删除模板相关的菜单处理函数，这些不再需要

function createMenuBar() {
  const menuTemplate = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建 C++ 文件',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-cpp-file');
          }
        },
        {
          label: '打开文件',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            openFile();
          }
        },
        {
          label: '打开文件夹',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            openFolder();
          }
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save-file');
          }
        },
        {
          label: '另存为',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            saveAsFile();
          }
        },
        { type: 'separator' },
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('menu-open-settings');
          }
        },
        {
          label: '模板设置',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            openCodeTemplates();
          }
        }
      ]
    },
    {
      label: '运行',
      submenu: [
        {
          label: '调试 (开发中)',
          accelerator: 'F5',
          enabled: false,
          click: () => {
            // 调试功能开发中，暂时禁用
            mainWindow.webContents.send('show-debug-developing-message');
          }
        },
        {
          label: '编译',
          accelerator: 'F9',
          click: () => {
            mainWindow.webContents.send('menu-compile');
          }
        },
        {
          label: '运行',
          accelerator: 'F10',
          click: () => {
            mainWindow.webContents.send('menu-run');
          }
        },
        {
          label: '编译运行',
          accelerator: 'F11',
          click: () => {
            mainWindow.webContents.send('menu-compile-run');
          }
        },
        { type: 'separator' },
        {
          label: '获取测试用例',
          click: () => {
            mainWindow.webContents.send('menu-fetch-test-cases');
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 OICPP IDE',
          click: () => {
            showAboutDialog();
          }
        },
        {
          label: '检查更新',
          click: () => {
            checkForUpdates(true); // true 表示手动检查
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

function setupWindowControls() {
  // 最小化窗口
  ipcMain.on('window-minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  // 最大化/还原窗口
  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  // 单独处理 unmaximize 事件
  ipcMain.on('window-unmaximize', () => {
    if (mainWindow) {
      mainWindow.unmaximize();
    }
  });

  // 关闭窗口
  ipcMain.on('window-close', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });

  // 获取窗口状态
  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // 监听窗口最大化/还原事件
  if (mainWindow) {
    mainWindow.on('maximize', () => {
      mainWindow.webContents.send('window-maximized');
    });
    
    mainWindow.on('unmaximize', () => {
      mainWindow.webContents.send('window-unmaximized');
    });
  }
}

// IPC 处理
function setupIPC() {
  // 处理新建文件请求
  ipcMain.on('request-new-file', (event, fileType) => {
    // TODO: 处理新建文件逻辑
    console.log(`新建文件: ${fileType}`);
  });

  // 处理打开文件请求
  ipcMain.on('request-open-file', (event, filePath) => {
    // TODO: 处理打开文件逻辑
    console.log(`打开文件: ${filePath}`);
  });

  // 处理保存文件请求
  ipcMain.on('request-save-file', (event, filePath, content) => {
    // TODO: 处理保存文件逻辑
    console.log(`保存文件: ${filePath}`);
  });

  // 处理设置更新
  ipcMain.on('update-settings', (event, newSettings) => {
    settings = { ...settings, ...newSettings };
    // TODO: 保存设置到文件
    console.log('更新设置:', settings);
  });

  // 设置更新处理
  ipcMain.on('settings-updated', (event, settingsType, newSettings) => {
    updateSettings(settingsType, newSettings);
  });

  // 获取设置
  ipcMain.handle('get-settings', (event, settingsType) => {
    // 忽略 settingsType，总是返回完整设置
    return settings;
  });

  // 获取用户图标路径
  ipcMain.handle('get-user-icon-path', () => {
    return getUserIconPath();
  });

  // 获取所有设置
  ipcMain.handle('get-all-settings', () => {
    return settings;
  });

  // 获取顶级设置字段（现在就是所有设置）
  ipcMain.handle('get-top-level-settings', () => {
    return settings;
  });

  // 更新设置
  ipcMain.handle('update-top-level-settings', (event, newSettings) => {
    return updateSettings(null, newSettings);
  });

  // 重置设置到默认值
  ipcMain.handle('reset-settings', (settingsType) => {
    // 忽略 settingsType，总是重置所有设置
    return resetSettings();
  });

  // 获取系统信息
  ipcMain.handle('get-system-info', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      homedir: os.homedir(),
      tmpdir: os.tmpdir()
    };
  });

  // 显示打开对话框
  ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  });

  // 显示保存对话框  
  ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
  });

  // 显示消息框
  ipcMain.handle('show-message-box', async (event, options) => {
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
  });

  // 编译相关IPC
  ipcMain.on('compile-code', (event, code, options) => {
    compileCode(code, options).then(result => {
      event.reply('compile-result', result);
    }).catch(error => {
      event.reply('compile-error', error.message);
    });
  });

  // 调试相关IPC
  ipcMain.on('start-debug', (event, filePath, options) => {
    startDebugSession(filePath, options).then(result => {
      event.reply('debug-started', result);
    }).catch(error => {
      event.reply('debug-error', error.message);
    });
  });

  ipcMain.on('stop-debug', (event) => {
    stopDebugSession().then(result => {
      event.reply('debug-stopped', result);
    }).catch(error => {
      event.reply('debug-error', error.message);
    });
  });

  ipcMain.on('debug-step-over', (event) => {
    sendDebugCommand('step').then(result => {
      event.reply('debug-output', { message: '步过执行', type: 'debug' });
    }).catch(error => {
      event.reply('debug-error', error.message);
    });
  });

  ipcMain.on('debug-step-into', (event) => {
    sendDebugCommand('stepi').then(result => {
      event.reply('debug-output', { message: '步入执行', type: 'debug' });
    }).catch(error => {
      event.reply('debug-error', error.message);
    });
  });

  ipcMain.on('debug-step-out', (event) => {
    sendDebugCommand('finish').then(result => {
      event.reply('debug-output', { message: '步出执行', type: 'debug' });
    }).catch(error => {
      event.reply('debug-error', error.message);
    });
  });

  ipcMain.on('debug-continue', (event) => {
    console.log('[主进程] 收到继续执行命令');
    sendDebugCommand('continue').then(result => {
      console.log('[主进程] 继续执行命令发送成功');
      event.reply('debug-output', { message: '继续执行', type: 'debug' });
    }).catch(error => {
      console.error('[主进程] 继续执行命令失败:', error);
      event.reply('debug-error', error.message);
    });
  });

  // 手动启动程序
  ipcMain.on('debug-run', (event) => {
    console.log('[主进程] 收到手动启动程序命令');
    if (gdbDebugger && gdbDebugger.isRunning) {
      gdbDebugger.run().then(() => {
        console.log('[主进程] 程序手动启动成功');
        event.reply('debug-output', { message: '程序已启动', type: 'debug' });
        
        // 通知前端程序开始运行
        if (mainWindow) {
          mainWindow.webContents.send('debug-running');
        }
      }).catch(error => {
        console.error('[主进程] 手动启动程序失败:', error);
        event.reply('debug-error', error.message);
      });
    } else {
      event.reply('debug-error', '调试器未运行');
    }
  });

  ipcMain.on('debug-send-input', (event, input) => {
    sendDebugInput(input).then(result => {
      event.reply('debug-output', { message: `输入已发送: ${input}`, type: 'input' });
    }).catch(error => {
      event.reply('debug-error', error.message);
    });
  });

  ipcMain.on('debug-add-breakpoint', (event, breakpoint) => {
    console.log('[主进程] 收到添加断点请求:', breakpoint);
    addBreakpoint(breakpoint).then(result => {
      console.log('[主进程] 断点添加成功:', result);
      event.reply('debug-output', { message: `断点已设置: ${breakpoint.file}:${breakpoint.line}`, type: 'info' });
      // 同时发送断点设置成功的事件
      event.reply('debug-breakpoint-set', { 
        file: breakpoint.file, 
        line: breakpoint.line,
        success: true 
      });
    }).catch(error => {
      console.error('[主进程] 断点添加失败:', error);
      event.reply('debug-error', error.message);
      event.reply('debug-breakpoint-set', { 
        file: breakpoint.file, 
        line: breakpoint.line,
        success: false,
        error: error.message 
      });
    });
  });

  ipcMain.on('debug-remove-breakpoint', (event, breakpoint) => {
    console.log('[主进程] 收到移除断点请求:', breakpoint);
    removeBreakpoint(breakpoint).then(result => {
      console.log('[主进程] 断点移除成功:', result);
      event.reply('debug-output', { message: `断点已移除: ${breakpoint.file}:${breakpoint.line}`, type: 'info' });
      // 同时发送断点移除成功的事件
      event.reply('debug-breakpoint-removed', { 
        file: breakpoint.file, 
        line: breakpoint.line,
        success: true 
      });
    }).catch(error => {
      console.error('[主进程] 断点移除失败:', error);
      event.reply('debug-error', error.message);
      event.reply('debug-breakpoint-removed', { 
        file: breakpoint.file, 
        line: breakpoint.line,
        success: false,
        error: error.message 
      });
    });
  });

  ipcMain.on('debug-request-variables', (event) => {
    getDebugVariables().then(variables => {
      event.reply('debug-variables-updated', variables);
    }).catch(error => {
      event.reply('debug-error', error.message);
    });
  });

  ipcMain.on('debug-request-callstack', (event) => {
    getDebugCallStack().then(callStack => {
      event.reply('debug-callstack-updated', callStack);
    }).catch(error => {
      event.reply('debug-error', error.message);
    });
  });

  ipcMain.on('debug-goto-frame', (event, frame) => {
    // 在编辑器中跳转到指定的源码位置
    if (mainWindow) {
      mainWindow.webContents.send('goto-source-location', frame);
    }
  });

  // 添加监视变量
  ipcMain.on('debug-add-watch', (event, variableName) => {
    if (gdbDebugger && gdbDebugger.isRunning) {
      gdbDebugger.addWatchVariable(variableName).then(result => {
        event.reply('debug-output', { message: `已添加监视变量: ${variableName}`, type: 'info' });
      }).catch(error => {
        event.reply('debug-error', error.message);
      });
    } else {
      event.reply('debug-error', '调试器未运行');
    }
  });

  // 移除监视变量
  ipcMain.on('debug-remove-watch', (event, variableName) => {
    if (gdbDebugger && gdbDebugger.isRunning) {
      gdbDebugger.removeWatchVariable(variableName).then(result => {
        event.reply('debug-output', { message: `已移除监视变量: ${variableName}`, type: 'info' });
      }).catch(error => {
        event.reply('debug-error', error.message);
      });
    } else {
      event.reply('debug-error', '调试器未运行');
    }
  });

  // 刷新变量
  ipcMain.on('debug-refresh-variables', (event) => {
    if (gdbDebugger && gdbDebugger.isRunning) {
      gdbDebugger.updateVariables().then(result => {
        const variables = gdbDebugger.getVariables();
        event.reply('debug-variables-updated', {
          local: variables.local || {},
          global: variables.global || {},
          watches: variables.watches || {}
        });
      }).catch(error => {
        event.reply('debug-error', error.message);
      });
    } else {
      event.reply('debug-error', '调试器未运行');
    }
  });

  // 展开变量
  ipcMain.on('debug-expand-variable', (event, variableName) => {
    if (gdbDebugger && gdbDebugger.isRunning) {
      gdbDebugger.expandVariable(variableName).then(result => {
        event.reply('debug-output', { message: `已展开变量: ${variableName}`, type: 'info' });
      }).catch(error => {
        event.reply('debug-error', error.message);
      });
    } else {
      event.reply('debug-error', '调试器未运行');
    }
  });

  // 折叠变量
  ipcMain.on('debug-collapse-variable', (event, variableName) => {
    if (gdbDebugger && gdbDebugger.isRunning) {
      gdbDebugger.collapseVariable(variableName).then(result => {
        event.reply('debug-output', { message: `已折叠变量: ${variableName}`, type: 'info' });
      }).catch(error => {
        event.reply('debug-error', error.message);
      });
    } else {
      event.reply('debug-error', '调试器未运行');
    }
  });

  ipcMain.handle('get-current-file', () => {
    // 返回当前在编辑器中打开的文件
    // 这里需要与编辑器部分集成
    return currentOpenFile;
  });

  ipcMain.handle('get-breakpoints', () => {
    // 返回当前设置的断点
    return Array.from(breakpoints.entries());
  });

  // 文件操作 IPC 处理程序
  ipcMain.on('open-file-dialog', () => {
    openFile();
  });

  ipcMain.on('open-folder-dialog', () => {
    openFolder();
  });

  ipcMain.on('save-file', (event, content) => {
    // TODO: 实现保存文件逻辑
    console.log('保存文件请求:', content);
  });

  ipcMain.on('save-file-as', (event, content) => {
    saveAsFile();
  });

  // 临时文件管理
  // 确保临时文件目录存在
  const tempDir = path.join(os.homedir(), '.oicpp', 'codeTemp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 保存临时文件
  ipcMain.handle('save-temp-file', async (event, filePath, content) => {
    try {
      const tempPath = path.join(os.homedir(), filePath);
      const tempDir = path.dirname(tempPath);
      
      // 确保目录存在
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(tempPath, content, 'utf8');
      console.log('临时文件保存成功:', tempPath);
      return true;
    } catch (error) {
      console.error('保存临时文件失败:', error);
      throw error;
    }
  });

  // 加载临时文件
  ipcMain.handle('load-temp-file', async (event, filePath) => {
    try {
      const tempPath = path.join(os.homedir(), filePath);
      if (fs.existsSync(tempPath)) {
        const content = fs.readFileSync(tempPath, 'utf8');
        console.log('临时文件加载成功:', tempPath);
        return content;
      } else {
        console.log('临时文件不存在:', tempPath);
        return null;
      }
    } catch (error) {
      console.error('加载临时文件失败:', error);
      throw error;
    }
  });

  // 删除临时文件
  ipcMain.handle('delete-temp-file', async (event, filePath) => {
    try {
      const tempPath = path.join(os.homedir(), filePath);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        console.log('临时文件删除成功:', tempPath);
      } else {
        console.log('临时文件不存在，无需删除:', tempPath);
      }
      return true;
    } catch (error) {
      console.error('删除临时文件失败:', error);
      throw error;
    }
  });

  // 改进文件保存处理
  ipcMain.handle('save-file', async (event, filePath, content) => {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('文件保存成功:', filePath);
      return true;
    } catch (error) {
      console.error('保存文件失败:', error);
      throw error;
    }
  });

  // 另存为文件
  ipcMain.handle('save-as-file', async (event, content) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: '另存为',
        defaultPath: 'untitled.cpp',
        filters: [
          { name: 'C++ Files', extensions: ['cpp', 'cc', 'cxx', 'c++'] },
          { name: 'C Files', extensions: ['c'] },
          { name: 'Header Files', extensions: ['h', 'hpp', 'hxx'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content, 'utf8');
        console.log('文件另存为成功:', result.filePath);
        return result.filePath;
      }
      return null;
    } catch (error) {
      console.error('另存为文件失败:', error);
      throw error;
    }
  });

  // 读取目录内容
  ipcMain.on('read-directory', async (event, dirPath) => {
    try {
      const items = await readDirectory(dirPath);
      event.reply('directory-read', dirPath, items);
    } catch (error) {
      console.error('读取目录失败:', error);
      event.reply('directory-read-error', dirPath, error.message);
    }
  });

  // 读取文件内容
  ipcMain.on('read-file-content', async (event, filePath) => {
    try {
      const content = await readFileContent(filePath);
      console.log(`读取文件 ${filePath}，内容长度: ${content.length}`);
      console.log(`文件内容前100字符: "${content.substring(0, 100)}"`);
      event.reply('file-content-read', filePath, content, null);
    } catch (error) {
      console.error('读取文件失败:', error);
      event.reply('file-content-read', filePath, null, error.message);
    }
  });

  // 重命名文件
  ipcMain.on('rename-file', async (event, oldPath, newName) => {
    try {
      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, newName);
      
      // 检查新文件名是否已存在
      if (fs.existsSync(newPath)) {
        throw new Error('文件名已存在');
      }
      
      fs.renameSync(oldPath, newPath);
      event.reply('file-renamed', oldPath, newPath, null);
      console.log('文件重命名成功:', oldPath, '->', newPath);
    } catch (error) {
      console.error('重命名文件失败:', error);
      event.reply('file-renamed', oldPath, null, error.message);
    }
  });

  // 删除文件
  ipcMain.on('delete-file', async (event, filePath) => {
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
      event.reply('file-deleted', filePath, null);
      console.log('文件删除成功:', filePath);
    } catch (error) {
      console.error('删除文件失败:', error);
      event.reply('file-deleted', filePath, error.message);
    }
  });

  // 创建文件
  ipcMain.on('create-file', async (event, filePath, content = '') => {
    try {
      // 确保目录存在
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // 检查文件是否已存在
      if (fs.existsSync(filePath)) {
        throw new Error('文件已存在');
      }
      
      fs.writeFileSync(filePath, content, 'utf8');
      event.reply('file-created', filePath, null);
      console.log('文件创建成功:', filePath);
    } catch (error) {
      console.error('创建文件失败:', error);
      event.reply('file-created', filePath, error.message);
    }
  });

  // 创建文件夹
  ipcMain.on('create-folder', async (event, folderPath) => {
    try {
      // 检查文件夹是否已存在
      if (fs.existsSync(folderPath)) {
        throw new Error('文件夹已存在');
      }
      
      fs.mkdirSync(folderPath, { recursive: true });
      event.reply('folder-created', folderPath, null);
      console.log('文件夹创建成功:', folderPath);
    } catch (error) {
      console.error('创建文件夹失败:', error);
      event.reply('folder-created', folderPath, error.message);
    }
  });

  // 复制/移动文件
  ipcMain.on('paste-file', async (event, sourcePath, targetDir, operation) => {
    try {
      const fileName = path.basename(sourcePath);
      const targetPath = path.join(targetDir, fileName);
      
      // 检查目标文件是否已存在
      if (fs.existsSync(targetPath)) {
        throw new Error('目标位置已存在同名文件');
      }
      
      if (operation === 'copy') {
        // 复制文件
        const stat = fs.statSync(sourcePath);
        if (stat.isDirectory()) {
          copyDirectorySync(sourcePath, targetPath);
        } else {
          fs.copyFileSync(sourcePath, targetPath);
        }
      } else if (operation === 'cut') {
        // 移动文件
        fs.renameSync(sourcePath, targetPath);
      }
      
      event.reply('file-pasted', sourcePath, targetPath, operation, null);
      console.log(`文件${operation === 'copy' ? '复制' : '移动'}成功:`, sourcePath, '->', targetPath);
    } catch (error) {
      console.error(`${operation === 'copy' ? '复制' : '移动'}文件失败:`, error);
      event.reply('file-pasted', sourcePath, null, operation, error.message);
    }
  });

  // 检查文件是否存在
  ipcMain.on('check-file-exists', async (event, filePath) => {
    try {
      const exists = fs.existsSync(filePath);
      event.reply('file-exists-result', filePath, exists);
      console.log('检查文件存在:', filePath, exists);
    } catch (error) {
      console.error('检查文件存在失败:', error);
      event.reply('file-exists-result', filePath, false);
    }
  });

  // 移动文件
  ipcMain.on('move-file', async (event, sourcePath, targetPath) => {
    try {
      // 检查源文件是否存在
      if (!fs.existsSync(sourcePath)) {
        throw new Error('源文件不存在');
      }
      
      // 确保目标目录存在
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // 执行移动操作
      fs.renameSync(sourcePath, targetPath);
      
      event.reply('file-moved', sourcePath, targetPath);
      console.log('文件移动成功:', sourcePath, '->', targetPath);
    } catch (error) {
      console.error('移动文件失败:', error);
      event.reply('file-move-error', sourcePath, error.message);
    }
  });

  // 更新设置（异步版本）
  ipcMain.handle('update-settings', (event, settingsType, newSettings) => {
    // 如果只传了一个参数，那么第一个参数就是newSettings
    if (typeof settingsType === 'object' && newSettings === undefined) {
      newSettings = settingsType;
      settingsType = null;
    }
    return updateSettings(settingsType, newSettings);
  });

  // 导出设置
  ipcMain.handle('export-settings', async () => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: '导出设置',
        defaultPath: 'oicpp-settings.json',
        filters: [
          { name: 'JSON文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, JSON.stringify(settings, null, 2), 'utf8');
        return { success: true, filePath: result.filePath };
      }
      
      return { success: false, message: '用户取消操作' };
    } catch (error) {
      console.error('导出设置失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 导入设置
  ipcMain.handle('import-settings', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: '导入设置',
        filters: [
          { name: 'JSON文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const importedSettings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // 验证导入的设置格式
        const defaultSettings = getDefaultSettings();
        settings = mergeSettings(defaultSettings, importedSettings);
        
        // 保存合并后的设置
        saveSettings();
        
        // 通知渲染进程设置已更新
        if (mainWindow) {
          mainWindow.webContents.send('settings-imported', settings);
        }
        
        return { success: true, settings };
      }
      
      return { success: false, message: '用户取消操作' };
    } catch (error) {
      console.error('导入设置失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 编译文件
  ipcMain.handle('compile-file', async (event, options) => {
    try {
      const result = await compileFile(options);
      return result;
    } catch (error) {
      throw error;
    }
  });

  // 运行可执行文件
  ipcMain.handle('run-executable', async (event, options) => {
    try {
      await runExecutable(options);
      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  // 检查文件是否存在
  ipcMain.handle('check-file-exists', async (event, filePath) => {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  });

  // 打开编译器设置
  ipcMain.handle('open-compiler-settings', async (event) => {
    openCompilerSettings();
    return { success: true };
  });

  // 打开编辑器设置
  ipcMain.handle('open-editor-settings', async (event) => {
    openEditorSettings();
    return { success: true };
  });

  // 打开模板设置
  ipcMain.on('open-template-settings', () => {
    openCodeTemplates();
  });

  // 手动检查更新
  ipcMain.on('check-updates-manual', () => {
    logToConsole('log', '[IPC] 收到渲染进程的手动检查更新请求');
    checkForUpdates(true); // true 表示手动检查
  });

  // 检查GDB可用性
  ipcMain.handle('check-gdb-availability', async () => {
    return checkGDBAvailability();
  });

  // 获取当前平台
  ipcMain.handle('get-platform', async () => {
    return process.platform === 'win32' ? 'windows' : 
           process.platform === 'darwin' ? 'macos' : 'linux';
  });

  // 获取用户主目录
  ipcMain.handle('get-user-home', async () => {
    return os.homedir();
  });

  // 获取已下载的编译器版本
  ipcMain.handle('get-downloaded-compilers', async (event, { url, platform }) => {
    try {
      const testCases = await fetchTestCasesFromUrl(url, platform);
      return { success: true, testCases };
    } catch (error) {
      console.error('获取测试用例失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 下载编译器
  ipcMain.handle('download-compiler', async (event, { url, version, name }) => {
    console.log('[编译器下载] 开始下载请求:', { url, version, name });
    
    return new Promise(async (resolve) => {
      const userHome = os.homedir();
      const compilersDir = path.join(userHome, '.oicpp', 'Compilers');
      const versionDir = path.join(compilersDir, version);
      
      console.log('[编译器下载] 目录路径:', { compilersDir, versionDir });
      
      // 确保目录存在
      if (!fs.existsSync(compilersDir)) {
        fs.mkdirSync(compilersDir, { recursive: true });
        console.log('[编译器下载] 创建编译器目录:', compilersDir);
      }
      
      if (fs.existsSync(versionDir)) {
        console.log('[编译器下载] 版本目录已存在:', versionDir);
        resolve({ success: false, error: '该版本已存在' });
        return;
      }

      // 下载进度相关变量
      let backgroundDownload = false;
      let downloadCompleted = false;
      let progressWindow = null;

      try {
        console.log('[编译器下载] 创建进度窗口...');
        
        // 创建临时HTML文件用于进度显示
        const tmpDir = path.join(os.tmpdir(), 'oicpp-compiler-download');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }

        const htmlFile = path.join(tmpDir, 'compiler-progress.html');
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>下载编译器</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 30px;
            background: #252526;
            color: #cccccc;
            font-size: 14px;
            line-height: 1.5;
        }
        h3 {
            color: #4fc3f7;
            margin-bottom: 30px;
            font-weight: 400;
            font-size: 18px;
        }
        #status {
            font-size: 14px;
            margin-bottom: 20px;
            color: #cccccc;
            min-height: 20px;
        }
        #progress-container {
            background: #3c3c3c;
            border-radius: 4px;
            padding: 2px;
            margin: 20px 0;
            border: 1px solid #464647;
        }
        #progress-bar {
            background: linear-gradient(90deg, #0e639c, #1177bb);
            height: 16px;
            border-radius: 2px;
            width: 0%;
            transition: width 0.2s ease;
            position: relative;
        }
        #progress-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 11px;
            font-weight: 500;
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        }
        #speed {
            font-size: 12px;
            color: #9cdcfe;
            margin-top: 10px;
            text-align: center;
        }
    </style>
</head>
<body>
    <h3>正在下载编译器: ${name} ${version}</h3>
    <div id="status">准备开始下载...</div>
    <div id="progress-container">
        <div id="progress-bar">
            <div id="progress-text">0%</div>
        </div>
    </div>
    <div id="speed"></div>
</body>
</html>`;

        fs.writeFileSync(htmlFile, htmlContent, 'utf8');
        console.log('[编译器下载] HTML文件已创建:', htmlFile);

        // 创建进度窗口
        progressWindow = new BrowserWindow({
          width: 500,
          height: 400,
          show: false,
          resizable: false,
          parent: BrowserWindow.getFocusedWindow(),
          modal: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        });

        console.log('[编译器下载] 进度窗口已创建');

        // 设置窗口关闭处理
        progressWindow.on('close', (event) => {
          console.log('[编译器下载] 进度窗口关闭事件, downloadCompleted:', downloadCompleted);
          
          if (!backgroundDownload && !downloadCompleted) {
            const choice = dialog.showMessageBoxSync(progressWindow, {
              type: 'question',
              title: '后台下载',
              message: '是否在后台继续下载编译器？',
              detail: '关闭此窗口后，下载将在后台继续进行。',
              buttons: ['后台下载', '取消下载'],
              defaultId: 0
            });

            if (choice === 0) {
              backgroundDownload = true;
              console.log('[编译器下载] 用户选择后台下载编译器');
            } else {
              console.log('[编译器下载] 用户取消编译器下载');
              event.preventDefault();
              resolve({ success: false, error: '用户取消下载' });
              return;
            }
          }

          // 清理临时文件
          try {
            if (fs.existsSync(htmlFile)) {
              fs.unlinkSync(htmlFile);
              console.log('[编译器下载] 临时HTML文件已清理');
            }
          } catch (error) {
            console.log('[编译器下载] 清理临时文件失败:', error.message);
          }
        });

        // 加载HTML文件
        progressWindow.loadFile(htmlFile);

        // 等待页面加载完成
        progressWindow.webContents.once('did-finish-load', () => {
          progressWindow.show();
          updateProgress('开始下载编译器...');
        });

        // 监听页面加载错误
        progressWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
          console.error('[编译器下载] 页面加载失败:', errorCode, errorDescription);
        });

        // 更新进度函数 - 优化性能，减少DOM操作
        function updateProgress(message, percent = null, speed = null) {
          try {
            if (!backgroundDownload && progressWindow && !progressWindow.isDestroyed()) {
              // 只在有显著变化时更新DOM，避免频繁操作
              progressWindow.webContents.executeJavaScript(`
                (function() {
                  try {
                    const statusElement = document.getElementById('status');
                    const progressBar = document.getElementById('progress-bar');
                    const progressText = document.getElementById('progress-text');
                    const speedElement = document.getElementById('speed');
                    
                    if (statusElement) {
                      statusElement.textContent = ${JSON.stringify(message)};
                    }
                    
                    if (progressBar && progressText && ${percent !== null}) {
                      const percentValue = Math.round(${percent});
                      progressBar.style.width = percentValue + '%';
                      progressText.textContent = percentValue + '%';
                    }
                    
                    if (speedElement && ${speed !== null}) {
                      speedElement.textContent = ${JSON.stringify(speed)};
                    }
                    
                    return true;
                  } catch (error) {
                    return false;
                  }
                })()
              `).catch(() => {
                // 静默处理错误
              });
            }
          } catch (error) {
            // 静默处理错误，不影响下载流程
          }
        }

        // 开始下载
        updateProgress(`开始下载编译器: ${name} ${version}`);
        
        const fileResponse = await fetch(url);
        
        if (!fileResponse.ok) {
          throw new Error(`下载失败: HTTP ${fileResponse.status}`);
        }

        // 从URL中检测文件格式
        const urlParts = url.split('.');
        const fileExtension = urlParts[urlParts.length - 1].toLowerCase();
        
        // 获取文件总大小
        const contentLength = fileResponse.headers.get('content-length');
        const totalSize = contentLength ? parseInt(contentLength) : 0;
        
        const tempFile = path.join(compilersDir, `${version}.${fileExtension}`);
        
        const writer = fs.createWriteStream(tempFile);
        
        let downloadedSize = 0;
        let totalDownloaded = 0; // 总累计下载量
        let lastProgressUpdate = 0;
        let startTime = Date.now();

        // 设置下载进度监控 - 优化性能
        const reader = fileResponse.body.getReader();
        
        const pump = async () => {
          const { done, value } = await reader.read();
          
          if (done) {
            writer.end();
            return;
          }
          
          downloadedSize += value.length;
          totalDownloaded += value.length;
          writer.write(value);
          
          // 大幅减少进度更新频率，避免性能问题
          const now = Date.now();
          if (totalSize > 0) {
            const percent = (totalDownloaded / totalSize) * 100;
            
            // 只在进度变化超过5%或时间超过1秒时更新
            if (percent - lastProgressUpdate >= 5 || now - startTime > 1000) {
              const elapsed = (now - startTime) / 1000;
              const speed = downloadedSize / elapsed;
              const speedText = speed > 1024 * 1024 
                ? `${(speed / 1024 / 1024).toFixed(1)} MB/s`
                : `${(speed / 1024).toFixed(0)} KB/s`;
              
              const sizeText = `${(totalDownloaded / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB`;
              
              updateProgress(`下载中... ${sizeText}`, percent, speedText);
              lastProgressUpdate = percent;
              startTime = now; // 重置时间基准，用于计算瞬时速度
              downloadedSize = 0; // 重置增量下载量，用于计算瞬时速度
            }
          } else {
            // 文件大小未知时，每2秒或每5MB更新一次
            if (now - startTime > 2000 || downloadedSize > 5 * 1024 * 1024) {
              const elapsed = (now - startTime) / 1000;
              const speed = downloadedSize / elapsed;
              const speedText = speed > 1024 * 1024 
                ? `${(speed / 1024 / 1024).toFixed(1)} MB/s`
                : `${(speed / 1024).toFixed(0)} KB/s`;
              
              const sizeText = `${(totalDownloaded / 1024 / 1024).toFixed(1)}MB`;
              updateProgress(`下载中... ${sizeText}`, null, speedText);
              lastProgressUpdate = now;
              startTime = now;
              downloadedSize = 0;
            }
          }
          
          return pump();
        };

        await pump();

        updateProgress('下载完成，开始解压...', 100);

        // 等待文件���入完成
        await new Promise((resolve) => {
          writer.on('finish', resolve);
          writer.on('error', resolve);
        });

        // 根据文件扩展名选择解压方法
        if (fileExtension === '7z' || fileExtension === 'zip') {
          // 使用node-stream-zip解压7z和zip文件
          const zip = new StreamZip.async({ file: tempFile });
          
          try {
            // 确保目标目录存在
            if (!fs.existsSync(versionDir)) {
              fs.mkdirSync(versionDir, { recursive: true });
            }
            
            // 解压所有文件
            await zip.extract(null, versionDir);
            
            // 关闭zip文件
            await zip.close();
          } catch (extractError) {
            throw extractError;
          }
        } else {
          throw new Error(`不支持的文件格式: ${fileExtension}`);
        }

        // 删除临时文件
        fs.unlinkSync(tempFile);

        updateProgress('解压完成，查找编译器可执行文件...');

        // 查找编译器可执行文件
        const compilerPath = findCompilerExecutable(versionDir);

        downloadCompleted = true;
        updateProgress('编译器安装完成！');

        const result = { 
          success: true, 
          compilerPath: compilerPath || path.join(versionDir, 'bin', 'g++.exe')
        };

        // 延迟关闭进度窗口但立即返回结果
        if (!backgroundDownload && progressWindow && !progressWindow.isDestroyed()) {
          setTimeout(() => {
            if (progressWindow && !progressWindow.isDestroyed()) {
              progressWindow.close();
            }
          }, 2000); // 2秒后关闭
        }
        
        resolve(result);

      } catch (error) {
        downloadCompleted = true;
        
        if (!backgroundDownload && progressWindow && !progressWindow.isDestroyed()) {
          updateProgress(`下载失败: ${error.message}`);
          setTimeout(() => {
            if (progressWindow && !progressWindow.isDestroyed()) {
              progressWindow.close();
            }
          }, 3000);
        }
        
        resolve({ success: false, error: error.message });
      }
    });
  });

  // 选择编译器
  ipcMain.handle('select-compiler', async (event, version) => {
    console.log('[选择编译器] 开始选择编译器，版本:', version);
    try {
      const userHome = os.homedir();
      const versionDir = path.join(userHome, '.oicpp', 'Compilers', version);
      console.log('[选择编译器] 检查版本目录:', versionDir);
      
      if (!fs.existsSync(versionDir)) {
        console.log('[选择编译器] 版本目录不存在');
        return { success: false, error: '编译器版本不存在' };
      }
      
      console.log('[选择编译器] 版本目录存在，查找编译器可执行文件');
      const compilerPath = findCompilerExecutable(versionDir);
      console.log('[选择编译器] 查找结果:', compilerPath);
      
      if (!compilerPath) {
        console.log('[选择编译器] 未找到编译器可执行文件');
        return { success: false, error: '未找到编译器可执行文件' };
      }
      
      // 更新设置中的编译器路径
      settings.compilerPath = compilerPath;
      saveSettings();
      
      console.log('[选择编译器] 选择成功，已更新设置，编译器路径:', compilerPath);
      return { success: true, compilerPath };
    } catch (error) {
      console.error('[选择编译器] 发生错误:', error);
      return { success: false, error: error.message };
    }
  });
}

// 新增的获取测试用例函数
async function fetchTestCasesFromUrl(url, platform) {
  if (platform === 'Atcoder') {
    try {
      const response = await axios.get(url);
      const htmlContent = response.data;

      const testCases = [];
      const regex = /<pre id="pre-sample(\d+)">([\s\S]*?)<\/pre>/g;
      let match;
      const extractedPreTags = [];

      while ((match = regex.exec(htmlContent)) !== null) {
        extractedPreTags.push({
          id: parseInt(match[1]),
          content: match[2].trim()
        });
      }

      // 按照id排序，确保输入输出配对正确
      extractedPreTags.sort((a, b) => a.id - b.id);

      for (let i = 0; i < extractedPreTags.length; i += 2) {
        if (i + 1 < extractedPreTags.length) {
          testCases.push({
            input: extractedPreTags[i].content,
            output: extractedPreTags[i + 1].content
          });
        }
      }
      return testCases;
    } catch (error) {
      throw new Error(`无法从URL获取或解析HTML: ${error.message}`);
    }
  } else {
    throw new Error(`不支持的平台: ${platform}`);
  }
}

// 读取文件内容

// 读取文件内容
async function readFileContent(filePath) {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      throw new Error('文件不存在');
    }
    
    // 检查是否是二进制文件
    const buffer = fs.readFileSync(filePath);
    const isBinary = buffer.some(byte => byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13));
    
    if (isBinary) {
      throw new Error('不支持的二进制文件');
    }
    
    return buffer.toString('utf8');
  } catch (error) {
    throw error;
  }
}

async function readDirectory(dirPath) {
  const items = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // 跳过隐藏文件（以.开头的文件）
      if (entry.name.startsWith('.')) {
        continue;
      }
      
      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          type: 'folder',
          path: fullPath,
          children: [] // 延迟加载子目录
        });
      } else if (entry.isFile()) {
        // 只显示支持的文件类型
        const ext = path.extname(entry.name).toLowerCase();
        const supportedExts = ['.cpp', '.c', '.h', '.hpp', '.cc', '.cxx', '.txt', '.md', '.json'];
        
        if (supportedExts.includes(ext) || !ext) {
          items.push({
            name: entry.name,
            type: 'file',
            path: fullPath,
            extension: ext
          });
        }
      }
    }
    
    // 排序：文件夹在前，文件在后，按名称排序
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
  } catch (error) {
    console.error('读取目录失败:', error);
    throw error;
  }
  
  return items;
}

// 递归复制目录的辅助函数
function copyDirectorySync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 文件操作函数
async function openFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'C++ Files', extensions: ['cpp', 'cxx', 'cc', 'c'] },
      { name: 'Text Files', extensions: ['txt', 'in', 'out'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      // 检查是否是二进制文件
      const buffer = fs.readFileSync(filePath);
      const isBinary = buffer.some(byte => byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13));
      
      if (isBinary) {
        mainWindow.webContents.send('file-open-binary', path.basename(filePath));
      } else {
        const content = buffer.toString('utf8');
        mainWindow.webContents.send('file-opened', {
          fileName: path.basename(filePath),
          filePath: filePath,
          content: content
        });
      }
    } catch (error) {
      console.error('打开文件失败:', error);
      dialog.showErrorBox('错误', `无法打开文件: ${error.message}`);
    }
  }
}

async function openFolder() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];
    mainWindow.webContents.send('folder-opened', folderPath);
  }
}

async function saveAsFile() {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'C++ Files', extensions: ['cpp'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled) {
    mainWindow.webContents.send('file-save-as', result.filePath);
  }
}

// 设置窗口
let compilerSettingsWindow = null;
let editorSettingsWindow = null;
let codeTemplatesWindow = null;

function openCompilerSettings() {
  if (compilerSettingsWindow) {
    compilerSettingsWindow.focus();
    return;
  }

  compilerSettingsWindow = new BrowserWindow({
    width: 600,
    height: 500,
    parent: mainWindow,
    modal: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: '编译器设置',
    icon: getUserIconPath()
  });

  compilerSettingsWindow.loadFile('src/renderer/settings/compiler.html');

  compilerSettingsWindow.on('closed', () => {
    compilerSettingsWindow = null;
  });
}

function openEditorSettings() {
  if (editorSettingsWindow) {
    editorSettingsWindow.focus();
    return;
  }

  editorSettingsWindow = new BrowserWindow({
    width: 600,
    height: 500,
    parent: mainWindow,
    modal: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: '编辑器设置',
    icon: getUserIconPath()
  });

  editorSettingsWindow.loadFile('src/renderer/settings/editor.html');

  editorSettingsWindow.on('closed', () => {
    editorSettingsWindow = null;
  });
}

// 代码模板设置窗口
function openCodeTemplates() {
  if (codeTemplatesWindow) {
    codeTemplatesWindow.focus();
    return;
  }

  codeTemplatesWindow = new BrowserWindow({
    width: 700,
    height: 600,
    parent: mainWindow,
    modal: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: '代码模板设置',
    icon: getUserIconPath()
  });

  codeTemplatesWindow.loadFile('src/renderer/settings/templates.html');

  codeTemplatesWindow.on('closed', () => {
    codeTemplatesWindow = null;
  });
}

// 删除模板相关函数

function showAboutDialog() {
  const buildTime = '2025年7月16日 15:50:31'; // 硬编码编译时间
  
  const choice = dialog.showMessageBoxSync(mainWindow, {
    type: 'info',
    title: '关于 OICPP IDE',
    message: 'OICPP IDE',
    detail: `版本: ${APP_VERSION}\n构建时间: ${buildTime}\n开发者: mywwzh\n\n一个专为 OI 选手设计的集成开发环境\n\n主要功能:\n• 代码编辑与语法高亮\n• 智能自动补全\n• 一键编译运行\n• 多编译器支持\n• 项目文件管理`,
    buttons: ['确定', '检查更新'],
    icon: getUserIconPath()
  });
  
  // 如果用户点击了"检查更新"按钮
  if (choice === 1) {
    checkForUpdates(true); // true 表示手动检查
  }
}

// 检查更新相关函数
async function checkForUpdates(isManual = false) {
  try {
    logToConsole('log', '开始检查更新...');
    logToConsole('log', '检查类型:', isManual ? '手动检查' : '自动检查');
    
    const response = await fetch('https://oicpp.mywwzh.top/api/checkUpdate');
    logToConsole('log', '请求更新API状态码:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const updateInfo = await response.json();
    logToConsole('log', '更新信息:', updateInfo);
    
    // 获取当前版本和最新版本
    const currentVersion = APP_VERSION; // 当前程序版本
    const latestVersion = updateInfo.latestVersion;
    const description = updateInfo.description || '';
    
    logToConsole('log', '当前版本:', currentVersion);
    logToConsole('log', '最新版本:', latestVersion);
    
    // 使用版本比较函数确定是否需要更新
    const hasUpdate = compareVersions(currentVersion, latestVersion);
    
    if (hasUpdate) {
      logToConsole('log', '发现新版本:', latestVersion);
      
      // 格式化更新描述，将 \n 转换为真正的换行
      const formattedDescription = description.replace(/\\n/g, '\n');
      
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${latestVersion}`,
        detail: formattedDescription || `有新版本 ${latestVersion} 可用，是否立即更新？`,
        buttons: ['立即更新', '稍后更新'],
        defaultId: 0,
        width: 500 // 增加对话框宽度以更好显示更新内容
      });
      
      if (choice === 0) {
        logToConsole('log', '用户选择立即更新');
        downloadAndInstallUpdate(updateInfo);
      } else {
        logToConsole('log', '用户选择稍后更新');
      }
    } else {
      logToConsole('log', '当前已是最新版本');
      if (isManual) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '检查更新',
          message: '当前已是最新版本',
          detail: `您当前使用的版本 ${currentVersion} 已是最新版本。`
        });
      }
    }
  } catch (error) {
    logToConsole('error', '检查更新失败:', error);
    if (isManual) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: '检查更新失败',
        message: '无法连接到更新服务器',
        detail: '请检查网络连接或稍后重试。'
      });
    }
  }
}

// 下载并安装更新
async function downloadAndInstallUpdate(updateInfo = null) {
  try {
    logToConsole('log', '=== 开始下载安装程序 ===');
    
    // 获取最新版本信息（从updateInfo中获取，如果没有则重新检查）
    let latestVersion = updateInfo?.latestVersion;
    if (!latestVersion) {
      logToConsole('log', '未提供版本信息，重新获取最新版本...');
      try {
        const versionResponse = await fetch('https://oicpp.mywwzh.top/api/checkUpdate');
        if (versionResponse.ok) {
          const versionInfo = await versionResponse.json();
          latestVersion = versionInfo.latestVersion;
          logToConsole('log', '获取到最新版本:', latestVersion);
        }
      } catch (error) {
        logToConsole('error', '获取版本信息失败，使用当前版本作为参数:', error.message);
        latestVersion = APP_VERSION;
      }
    }
    
    if (!latestVersion) {
      throw new Error('无法获取版本信息');
    }
    
    // 获取更新文件列表（现在只包含安装程序）
    logToConsole('log', `正在获取更新文件列表 (版本: ${latestVersion})...`);
    const filelistResponse = await fetch(`https://oicpp.mywwzh.top/api/getUpdateFilelist?version=${encodeURIComponent(latestVersion)}`);
    logToConsole('log', '文件列表API状态码:', filelistResponse.status);
    
    if (!filelistResponse.ok) {
      throw new Error(`获取文件列表失败: ${filelistResponse.status}`);
    }
    
    const filelist = await filelistResponse.json();
    logToConsole('log', '获取到文件列表:', filelist);
    
    if (!filelist || !filelist.files || filelist.files.length === 0) {
      throw new Error('未找到安装程序文件');
    }
    
    // 获取安装程序信息（应该只有一个.exe文件）
    const installerFile = filelist.files.find(file => file.name.endsWith('.exe'));
    if (!installerFile) {
      throw new Error('未找到安装程序文件');
    }
    
    logToConsole('log', '找到安装程序:', installerFile.name);
    
    // 检查用户目录中的安装程序是否已存在且版本匹配
    const userOicppDir = path.join(os.homedir(), '.oicpp');
    const installerPath = path.join(userOicppDir, installerFile.name);
    
    // 确保用户目录存在
    if (!fs.existsSync(userOicppDir)) {
      fs.mkdirSync(userOicppDir, { recursive: true });
    }
    
    let needDownload = true;
    
    // 检查是否已下载过相同版本的安装程序
    if (fs.existsSync(installerPath)) {
      try {
        const crypto = require('crypto');
        const existingFileBuffer = fs.readFileSync(installerPath);
        const existingMd5 = crypto.createHash('md5').update(existingFileBuffer).digest('hex');
        
        if (existingMd5 === installerFile.md5) {
          logToConsole('log', '安装程序已存在且MD5匹配，跳过下载');
          needDownload = false;
        } else {
          logToConsole('log', '安装程序已存在但MD5不匹配，需要重新下载');
        }
      } catch (error) {
        logToConsole('log', '检查现有安装程序时出错，将重新下载:', error.message);
      }
    }
    
    // 定义变量用于整个函数作用域
    let backgroundDownload = false; // 标记是否在后台下载
    let downloadCompleted = false; // 标记下载是否已完成
    let progressWindow = null; // 进度窗口引用
    
    if (needDownload) {
      // 创建临时HTML文件用于进度显示
      const tmpDir = path.join(os.tmpdir(), 'oicpp-progress');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const htmlFile = path.join(tmpDir, 'progress.html');
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>下载更新</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 30px;
            background: #252526;
            color: #cccccc;
            font-size: 14px;
            line-height: 1.5;
        }
        h3 {
            color: #4fc3f7;
            margin-bottom: 30px;
            font-weight: 400;
            font-size: 18px;
        }
        #status {
            font-size: 14px;
            margin-bottom: 20px;
            color: #cccccc;
            min-height: 20px;
        }
        #progress-container {
            background: #3c3c3c;
            border-radius: 4px;
            padding: 2px;
            margin: 20px 0;
            border: 1px solid #464647;
        }
        #progress-bar {
            background: linear-gradient(90deg, #0e639c, #1177bb);
            height: 16px;
            border-radius: 2px;
            width: 0%;
            transition: width 0.2s ease;
            position: relative;
        }
        #progress-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 11px;
            font-weight: 500;
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        }
        #speed {
            font-size: 12px;
            color: #9cdcfe;
            margin-top: 10px;
            text-align: center;
        }
        .info {
            color: #858585;
            font-size: 12px;
            margin-top: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <h3>正在下载 OICPP IDE 安装程序</h3>
    <div id="status">准备开始下载...</div>
    <div id="progress-container">
        <div id="progress-bar">
            <div id="progress-text">0%</div>
        </div>
    </div>
    <div id="speed"></div>
    <p class="info">可以关闭此窗口在后台下载</p>
</body>
</html>`;

      // 写入HTML文件
      fs.writeFileSync(htmlFile, htmlContent, 'utf8');
      
      // 显示下载进度窗口
      progressWindow = new BrowserWindow({
        width: 500,
        height: 400,
        parent: mainWindow,
        modal: false,
        show: false,
        resizable: true,
        minimizable: false,
        maximizable: false,
        closable: true,
        title: '下载更新',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false
        }
      });

      // 处理窗口关闭事件
      progressWindow.on('close', (event) => {
        // 只有在下载未完成且不是后台下载时才询问
        if (!backgroundDownload && !downloadCompleted) {
          // 询问用户是否要后台下载
          const choice = dialog.showMessageBoxSync(progressWindow, {
            type: 'question',
            title: '后台下载',
            message: '是否在后台继续下载？',
            detail: '关闭此窗口后，下载将在后台继续进行。下载完成后会自动提示您。',
            buttons: ['后台下载', '取消下载'],
            defaultId: 0
          });

          if (choice === 0) {
            backgroundDownload = true;
            logToConsole('log', '用户选择后台下载');
          } else {
            // 用户选择取消下载
            logToConsole('log', '用户取消下载');
            event.preventDefault(); // 阻止窗口关闭
            return;
          }
        }
        
        // 清理临时文件
        try {
          if (fs.existsSync(htmlFile)) {
            fs.unlinkSync(htmlFile);
            logToConsole('log', '已清理临时HTML文件');
          }
        } catch (error) {
          logToConsole('log', '清理临时文件失败:', error.message);
        }
      });

      // 加载HTML文件
      progressWindow.loadFile(htmlFile);

      // 等待页面加载完成
      progressWindow.webContents.once('did-finish-load', () => {
        progressWindow.show();
        logToConsole('log', '已显示下载进度窗口');
        updateProgress('页面加载完成，开始下载...');
      });

      // 添加加载错误处理
      progressWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        logToConsole('error', '页面加载失败:', errorCode, errorDescription);
      });

      // 更新进度 - 优化性能
      function updateProgress(message, percent = null, speed = null) {
        try {
          if (!backgroundDownload && progressWindow && !progressWindow.isDestroyed()) {
            // 减少DOM操作频率，提升性能
            progressWindow.webContents.executeJavaScript(`
              try {
                const statusElement = document.getElementById('status');
                const progressBar = document.getElementById('progress-bar');
                const progressText = document.getElementById('progress-text');
                const speedElement = document.getElementById('speed');
                
                if (statusElement) {
                  statusElement.textContent = ${JSON.stringify(message)};
                }
                
                if (progressBar && progressText && ${percent !== null}) {
                  const percentValue = Math.round(${percent});
                  progressBar.style.width = percentValue + '%';
                  progressText.textContent = percentValue + '%';
                }
                
                if (speedElement && ${speed !== null}) {
                  speedElement.textContent = ${JSON.stringify(speed)};
                }
                
                true; // 返回成功
              } catch (error) {
                false; // 返回失败
              }
            `).catch(() => {
              // 静默处理错误
            });
          }
        } catch (error) {
          // 静默处理错误，不影响下载流程
        }
      }

      // 下载安装程序
      updateProgress(`开始下载安装程序: ${installerFile.name}`);
      
      const fileResponse = await fetch(installerFile.downloadUrl);
      
      if (!fileResponse.ok) {
        throw new Error(`下载安装程序失败 (状态码: ${fileResponse.status})`);
      }

      // 获取文件总大小并设置下载进度监控
      const contentLength = fileResponse.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength) : 0;
      
      if (totalSize > 0) {
        updateProgress(`文件大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      }

      const reader = fileResponse.body.getReader();
      const chunks = [];
      let receivedLength = 0;
      let startTime = Date.now();
      let lastUpdate = 0;
      let lastReceivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        if (totalSize > 0) {
          const progress = (receivedLength / totalSize) * 100;
          const now = Date.now();
          
          // 减少更新频率，只在进度变化超过5%或时间超过1秒时更新
          if (progress - lastUpdate >= 5 || now - startTime > 1000) {
            const elapsed = (now - startTime) / 1000;
            const intervalDownloaded = receivedLength - lastReceivedLength;
            const speed = intervalDownloaded / elapsed;
            const speedText = speed > 1024 * 1024 
              ? `${(speed / 1024 / 1024).toFixed(1)} MB/s`
              : `${(speed / 1024).toFixed(0)} KB/s`;
            
            const receivedMB = (receivedLength / 1024 / 1024).toFixed(1);
            const totalMB = (totalSize / 1024 / 1024).toFixed(1);
            updateProgress(`已下载: ${receivedMB}MB / ${totalMB}MB`, progress, speedText);
            lastUpdate = progress;
            lastReceivedLength = receivedLength;
            startTime = now;
          }
        }
      }

      updateProgress('下载完成，正在保存文件...', 100);

      // 合并所有数据块
      const fileBuffer = new Uint8Array(receivedLength);
      let position = 0;
      for (let chunk of chunks) {
        fileBuffer.set(chunk, position);
        position += chunk.length;
      }
      
      // 保存到用户目录
      fs.writeFileSync(installerPath, fileBuffer);
      updateProgress(`文件保存完成`);
      
      // 验证MD5
      if (installerFile.md5) {
        updateProgress('正在验证文件完整性...');
        const crypto = require('crypto');
        const downloadedMd5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
        if (downloadedMd5 !== installerFile.md5) {
          throw new Error(`文件完整性校验失败`);
        }
        updateProgress('文件完整性校验通过');
      }

      updateProgress('下载完成！安装程序已准备就绪');
      
      // 标记下载已完成
      downloadCompleted = true;
      
      // 延迟关闭进度窗口
      setTimeout(() => {
        if (!backgroundDownload && progressWindow && !progressWindow.isDestroyed()) {
          progressWindow.close();
        }
      }, 1500);
    }
    
    // 记录安装程序信息到设置中
    settings.pendingUpdate = {
      version: latestVersion,
      installerPath: installerPath,
      installerName: installerFile.name,
      downloadTime: new Date().toISOString()
    };
    saveSettings();
    
    // 询问是否立即安装
    const dialogTitle = backgroundDownload ? '后台下载完成' : '安装程序已准备就绪';
    const dialogMessage = backgroundDownload ? 
      '后台下载已完成' : 
      '更新安装程序下载完成';
    const dialogDetail = backgroundDownload ?
      `安装程序已在后台下载完成。\n\n是否立即运行安装程序？\n\n选择"稍后安装"将在下次启动时再次提醒。` :
      `安装程序已下载到用户目录。\n\n是否立即运行安装程序？\n\n选择"稍后安装"将在下次启动时再次提醒。`;
    
    const installChoice = dialog.showMessageBoxSync(mainWindow, {
      type: 'info',
      title: dialogTitle,
      message: dialogMessage,
      detail: dialogDetail,
      buttons: ['立即安装', '稍后安装'],
      defaultId: 0
    });

    if (installChoice === 0) {
      logToConsole('log', '用户选择立即安装');
      
      // 确保进度窗口关闭
      if (progressWindow && !progressWindow.isDestroyed()) {
        progressWindow.close();
      }
      
      runInstaller(installerPath);
      
      // 清除待安装更新标记
      delete settings.pendingUpdate;
      saveSettings();
    } else {
      logToConsole('log', '用户选择稍后安装，将在下次启动时提醒');
      
      // 确保进度窗口关闭
      if (progressWindow && !progressWindow.isDestroyed()) {
        progressWindow.close();
      }
      
      // 如果是后台下载完成，显示通知
      if (backgroundDownload) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '更新提醒',
          message: '安装程序已准备就绪',
          detail: '安装程序将在下次启动 OICPP IDE 时提醒您安装。',
          buttons: ['知道了']
        });
      }
    }

  } catch (error) {
    // 标记下载出错，避免关闭窗口时弹出后台下载询问
    downloadCompleted = true;
    
    logToConsole('error', '下载安装程序失败:', error);
    logToConsole('error', '错误详情:', error.message);
    logToConsole('error', '错误堆栈:', error.stack);
    
    // 如果是后台下载出错，也要通知用户
    if (backgroundDownload) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: '后台下载失败',
        message: '后台下载安装程序时出错',
        detail: `下载过程中出现错误：\n\n${error.message}\n\n请稍后手动检查更新重试。`,
        buttons: ['确定']
      });
    } else {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: '更新失败',
        message: '安装程序下载失败',
        detail: error.message || '下载过程中出现错误，请稍后重试。'
      });
    }
    
    // 如果有进度窗口，确保关闭它
    if (progressWindow && !progressWindow.isDestroyed()) {
      try {
        progressWindow.close();
      } catch (closeError) {
        logToConsole('log', '关闭进度窗口时出错:', closeError.message);
      }
    }
  }
}

// 运行安装程序
function runInstaller(installerPath) {
  try {
    logToConsole('log', '准备运行安装程序:', installerPath);
    
    if (!fs.existsSync(installerPath)) {
      throw new Error('安装程序文件不存在');
    }
    
    const { shell } = require('electron');
    
    // 使用系统默认方式打开安装程序
    shell.openExternal(installerPath).then((success) => {
      if (success) {
        logToConsole('log', '安装程序已启动');
        
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '安装程序已启动',
          message: '更新安装程序正在运行',
          detail: 'OICPP IDE 将关闭以允许安装程序更新文件。\n\n请按照安装程序的提示完成更新。',
          buttons: ['确定']
        });
        
        // 延迟退出，确保安装程序启动
        setTimeout(() => {
          app.quit();
        }, 2000);
      } else {
        throw new Error('无法启动安装程序');
      }
    }).catch((error) => {
      throw error;
    });
    
  } catch (error) {
    logToConsole('error', '运行安装程序失败:', error);
    
    let errorDetail = `错误信息: ${error.message}\n\n`;
    errorDetail += `安装程序位置: ${installerPath}\n\n`;
    errorDetail += '您可以手动运行安装程序来完成更新。';
    
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: '无法启动安装程序',
      message: '自动启动安装程序失败',
      detail: errorDetail,
      buttons: ['打开安装程序所在文件夹', '确定']
    }).then((result) => {
      if (result.response === 0) {
        const { shell } = require('electron');
        shell.showItemInFolder(installerPath);
      }
    });
  }
}

// 检查待安装的更新
function checkPendingUpdate() {
  if (settings.pendingUpdate) {
    const pendingUpdate = settings.pendingUpdate;
    logToConsole('log', '发现待安装的更新:', pendingUpdate);
    
    // 检查安装程序文件是否仍存在
    if (fs.existsSync(pendingUpdate.installerPath)) {
      // 延迟显示提示，避免影响启动
      setTimeout(() => {
        const installChoice = dialog.showMessageBoxSync(mainWindow, {
          type: 'info',
          title: '发现待安装的更新',
          message: `您有一个待安装的更新 (版本 ${pendingUpdate.version})`,
          detail: `安装程序已准备就绪。\n\n是否现在运行安装程序？`,
          buttons: ['立即安装', '稍后提醒', '取消此更新'],
          defaultId: 0
        });

        if (installChoice === 0) {
          // 立即安装
          logToConsole('log', '用户选择立即安装待更新版本');
          runInstaller(pendingUpdate.installerPath);
          
          // 清除待安装更新标记
          delete settings.pendingUpdate;
          saveSettings();
        } else if (installChoice === 2) {
          // 取消此更新
          logToConsole('log', '用户取消此更新');
          
          // 删除安装程序文件
          try {
            fs.unlinkSync(pendingUpdate.installerPath);
            logToConsole('log', '已删除安装程序文件');
          } catch (error) {
            logToConsole('log', '删除安装程序文件失败:', error.message);
          }
          
          // 清除待安装更新标记
          delete settings.pendingUpdate;
          saveSettings();
        }
        // 如果选择"稍后提醒"，则不做任何操作，保持待安装状态
      }, 3000); // 3秒后显示提示
    } else {
      // 安装程序文件不存在，清除标记
      logToConsole('log', '待安装的安装程序文件不存在，清除标记');
      delete settings.pendingUpdate;
      saveSettings();
    }
  }
}

// 每日自动检查更新
function checkDailyUpdate() {
  const lastCheckDate = settings.lastUpdateCheck || '1970-01-01';
  const today = new Date().toISOString().split('T')[0];
  
  logToConsole('log', '检查每日更新...');
  logToConsole('log', '上次检查日期:', lastCheckDate);
  logToConsole('log', '今天日期:', today);
  
  if (lastCheckDate !== today) {
    logToConsole('log', '需要检查更新 - 上次检查不是今天');
    // 延迟检查，避免影响启动速度
    setTimeout(() => {
      logToConsole('log', '开始执行每日自动检查更新');
      checkForUpdates(false); // false 表示自动检查
    }, 5000);
    
    // 更新检查日期
    settings.lastUpdateCheck = today;
    saveSettings();
    logToConsole('log', '已更新检查日期到:', today);
  } else {
    logToConsole('log', '今天已检查过更新，跳过');
  }
}

// 获取设置文件路径
function getSettingsPath() {
  const settingsDir = path.join(os.homedir(), '.oicpp');
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  return path.join(settingsDir, 'settings.json');
}

// 合并设置
function mergeSettings(defaultSettings, userSettings) {
  const result = JSON.parse(JSON.stringify(defaultSettings));
  
  function merge(target, source) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
          }
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }
  
  merge(result, userSettings);
  return result;
}

// 加载设置
function loadSettings() {
  try {
    const settingsPath = getSettingsPath();
    
    // 初始化默认设置
    settings = getDefaultSettings();
    
    if (fs.existsSync(settingsPath)) {
      const savedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      // 只保留需要的字段
      const validKeys = ['compilerPath', 'compilerArgs', 'font', 'fontSize', 'theme', 'enableAutoCompletion', 'cppTemplate'];
      
      for (const key of validKeys) {
        if (savedSettings[key] !== undefined) {
          settings[key] = savedSettings[key];
        }
      }
      
      console.log('设置加载成功:', settings);
    } else {
      console.log('设置文件不存在，使用默认设置');
      // 保存默认设置
      saveSettings();
    }
    
  } catch (error) {
    console.error('加载设置失败:', error);
    // 如果加载失败，使用默认设置并保存
    settings = getDefaultSettings();
    saveSettings();
  }
}

// 合并设置
function mergeSettings(defaultSettings, userSettings) {
  const result = JSON.parse(JSON.stringify(defaultSettings));
  const validKeys = ['compilerPath', 'compilerArgs', 'font', 'fontSize', 'theme', 'enableAutoCompletion', 'cppTemplate'];
  
  for (const key of validKeys) {
    if (userSettings[key] !== undefined) {
      result[key] = userSettings[key];
    } else {
      result[key] = defaultSettings[key];
    }
  }
  
  return result;
}

// 保存设置
function saveSettings() {
  try {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log('设置保存成功:', settingsPath);
  } catch (error) {
    console.error('保存设置失败:', error);
  }
}

// 迁移旧设置文件
function migrateOldSettings() {
  try {
    const settingsDir = path.join(os.homedir(), '.oicpp');
    let migrated = false;
    
    // 迁移编译器设置
    const compilerPath = path.join(settingsDir, 'compiler.json');
    if (fs.existsSync(compilerPath)) {
      const compilerSettings = JSON.parse(fs.readFileSync(compilerPath, 'utf8'));
      settings.compiler = { ...settings.compiler, ...compilerSettings };
      migrated = true;
      console.log('已迁移编译器设置');
    }
    
    // 迁移编辑器设置
    const editorPath = path.join(settingsDir, 'editor.json');
    if (fs.existsSync(editorPath)) {
      const editorSettings = JSON.parse(fs.readFileSync(editorPath, 'utf8'));
      settings = { ...settings, ...editorSettings };
      migrated = true;
      console.log('已迁移编辑器设置');
    }
    
    // 如果进行了迁移，保存新的统一设置文件并删除旧文件
    if (migrated) {
      saveSettings();
      console.log('设置迁移完成，保存统一设置文件');
      
      // 可选：删除旧的设置文件（注释掉以保留备份）
      // try {
      //   if (fs.existsSync(compilerPath)) fs.unlinkSync(compilerPath);
      //   if (fs.existsSync(editorPath)) fs.unlinkSync(editorPath);
      //   console.log('已清理旧的设置文件');
      // } catch (error) {
      //   console.warn('清理旧设置文件时出错:', error);
      // }
    }
    
  } catch (error) {
    console.error('迁移旧设置失败:', error);
  }
}

// 更新设置
function updateSettings(settingsType, newSettings) {
  try {
    console.log('updateSettings 被调用，参数:', { settingsType, newSettings });
    
    // 直接更新设置（忽略 settingsType，因为现在是扁平结构）
    const validKeys = ['compilerPath', 'compilerArgs', 'font', 'fontSize', 'theme', 'enableAutoCompletion', 'cppTemplate'];
    
    for (const key in newSettings) {
      if (validKeys.includes(key)) {
        console.log(`更新设置键: ${key} = ${newSettings[key]}`);
        settings[key] = newSettings[key];
      } else {
        console.log(`忽略无效键: ${key}`);
      }
    }
    
    // 保存到文件
    saveSettings();
    
    // 通知主窗口设置已更新
    if (mainWindow) {
      mainWindow.webContents.send('settings-changed', null, settings);
    }
    
    console.log('设置已更新:', settings);
    return { success: true };
  } catch (error) {
    console.error('更新设置失败:', error);
    return { success: false, error: error.message };
  }
}

// 重置设置
function resetSettings(settingsType = null) {
  try {
    // 重置所有设置（忽略 settingsType，因为现在是扁平结构）
    settings = getDefaultSettings();
    
    // 保存设置
    saveSettings();
    
    // 通知主窗口设置已更新
    if (mainWindow) {
     
      mainWindow.webContents.send('settings-reset', settings);
    }
    
    console.log('所有设置已重置为默认值');
    return { success: true, settings };
  } catch (error) {
    console.error('重置设置失败:', error);
    return { success: false, error: error.message };
  }
}

// 导出设置
function exportSettings(filePath) {
  try {
    const exportData = {
      version: '1.0.0-alpha3',
      timestamp: new Date().toISOString(),
      settings: settings
    };
    
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');
    console.log('设置已导出到:', filePath);
    return { success: true };
  } catch (error) {
    console.error('导出设置失败:', error);
    return { success: false, error: error.message };
  }
}

// 导入设置
function importSettings(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('设置文件不存在');
    }
    
    const importData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!importData.settings) {
      throw new Error('无效的设置文件格式');
    }
    
    // 只导入有效的字段
    const validKeys = ['compilerPath', 'compilerArgs', 'font', 'fontSize', 'theme', 'enableAutoCompletion', 'cppTemplate'];
    const defaultSettings = getDefaultSettings();
    
    for (const key of validKeys) {
      if (importData.settings[key] !== undefined) {
        settings[key] = importData.settings[key];
      } else {
        settings[key] = defaultSettings[key];
      }
    }
    
    saveSettings();
    
    // 通知主窗口设置已更新
    if (mainWindow) {
      mainWindow.webContents.send('settings-imported', settings);
    }
    
    console.log('设置已导入自:', filePath);
    return { success: true, settings: settings };
  } catch (error) {
    console.error('导入设置失败:', error);
    return { success: false, error: error.message };
  }
}

// 编译文件函数
async function compileFile(options) {
  const { spawn } = require('child_process');
  const path = require('path');
  
  const { inputFile, outputFile, compilerPath, compilerArgs, workingDirectory } = options;
  
  return new Promise((resolve, reject) => {
    console.log('开始编译文件:', inputFile);
    console.log('编译器路径:', compilerPath);
    console.log('编译参数:', compilerArgs);
    console.log('输出文件:', outputFile);
    
    // 检查编译器是否存在
    if (!fs.existsSync(compilerPath)) {
      reject(new Error(`编译器不存在: ${compilerPath}`));
      return;
    }
    
    // 检查源文件是否存在
    if (!fs.existsSync(inputFile)) {
      reject(new Error(`源文件不存在: ${inputFile}`));
      return;
    }
    
    // 构建编译命令参数
    const args = [
      ...compilerArgs.split(' ').filter(arg => arg.trim()),
      '-o', outputFile,
      inputFile
    ];
    
    console.log('编译命令:', compilerPath, args.join(' '));
    
    // 执行编译
    const compiler = spawn(compilerPath, args, {
      cwd: workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    compiler.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    compiler.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    compiler.on('close', (code) => {
      console.log('编译完成，退出码:', code);
      console.log('标准输出:', stdout);
      console.log('标准错误:', stderr);
      
      const result = {
        success: code === 0,
        exitCode: code,
        stdout: stdout,
        stderr: stderr,
        warnings: [],
        errors: []
      };
      
      // 解析编译输出
      if (stderr) {
        const lines = stderr.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.toLowerCase().includes('warning')) {
            result.warnings.push(line);
          } else if (line.toLowerCase().includes('error') || code !== 0) {
            result.errors.push(line);
          }
        }
      }
      
      if (code === 0) {
        console.log('编译成功');
        resolve(result);
      } else {
        console.log('编译失败');
        resolve(result); // 不要reject，让前端处理编译错误
      }
    });
    
    compiler.on('error', (error) => {
      console.error('编译进程启动失败:', error);
      reject(new Error(`编译器启动失败: ${error.message}`));
    });
  });
}

// 运行可执行文件函数
async function runExecutable(options) {
  const { spawn } = require('child_process');
  const path = require('path');
  
  const { executablePath, workingDirectory } = options;
  
  return new Promise((resolve, reject) => {
    console.log('运行可执行文件:', executablePath);
    console.log('工作目录:', workingDirectory);
    
    // 检查可执行文件是否存在
    if (!require('fs').existsSync(executablePath)) {
      reject(new Error(`可执行文件不存在: ${executablePath}`));
      return;
    }
    
    console.log('=== 程序运行开始 ===');
    console.log('可执行文件路径:', executablePath);
    console.log('工作目录:', workingDirectory);
    
    // Windows下只使用ConsolePauser.exe启动程序
    let command, args, spawnOptions;
    if (process.platform === 'win32') {
      // 查找ConsolePauser.exe的路径
      const consolePauserPath = findConsolePauser();
      
      if (!consolePauserPath) {
        console.log('错误: 未找到ConsolePauser.exe');
        reject(new Error('未找到ConsolePauser.exe，无法启动程序。请确保ConsolePauser.exe已正确安装。'));
        return;
      }
      
      console.log('找到ConsolePauser:', consolePauserPath);
      
      // 使用cmd start在新窗口中启动ConsolePauser
      command = 'cmd';
      const absoluteExePath = path.resolve(executablePath);
      const absoluteConsolePauserPath = path.resolve(consolePauserPath);
      
      console.log('绝对路径 - ConsolePauser:', absoluteConsolePauserPath);
      console.log('绝对路径 - 可执行文件:', absoluteExePath);
      
      args = ['/c', `start "程序运行" "${absoluteConsolePauserPath}" "${absoluteExePath}"`];
      spawnOptions = {
        cwd: workingDirectory,
        detached: true,
        stdio: 'ignore',
        shell: true
      };
    } else {
      // Linux/Mac 使用终端启动
      const terminalCommands = [
        'gnome-terminal', 
        'konsole', 
        'xterm', 
        'x-terminal-emulator'
      ];
      
      command = terminalCommands[0]; // 默认使用gnome-terminal
      args = [
        '--', 
        'bash', 
        '-c', 
        `cd "${workingDirectory}" && "${executablePath}"; echo "程序执行完成，按回车键继续..."; read`
      ];
      spawnOptions = {
        detached: true,
        stdio: 'ignore'
      };
    }
    
    console.log('执行命令:', command);
    console.log('命令参数:', args);
    console.log('完整命令:', args[1]);
    console.log('=== 开始执行 ===');
    
    try {
      // 创建新的控制台窗口运行程序
      const child = spawn(command, args, spawnOptions);
      
      child.unref(); // 允许父进程退出而不等待子进程
      
      // 监听错误事件
      child.on('error', (error) => {
        console.log('启动失败:', error.message);
        reject(new Error(`启动程序失败: ${error.message}`));
      });
      
      // 监听spawn事件，确认进程启动成功
      child.on('spawn', () => {
        console.log('程序启动成功！');
        resolve({ success: true, message: '程序已在新窗口启动' });
      });
      
      // 如果没有错误和spawn事件，设置超时返回成功
      setTimeout(() => {
        if (!child.killed) {
          console.log('程序启动中...');
          resolve({ success: true, message: '程序启动中...' });
        }
      }, 1000);
      
    } catch (error) {
      console.log('创建子进程失败:', error.message);
      reject(new Error(`创建子进程失败: ${error.message}`));
    }
  });
}

// 版本比较辅助函数
function compareVersions(currentVersion, latestVersion) {
  // 简单的版本比较，将来可以扩展为更复杂的语义版本比较
  if (!latestVersion || !currentVersion) {
    return false;
  }
  
  // 如果版本号完全相同，则无需更新
  if (currentVersion === latestVersion) {
    return false;
  }
  
  // 移除版本号中的非数字字符进行简单比较
  const cleanCurrent = currentVersion.replace(/[^\d.]/g, '');
  const cleanLatest = latestVersion.replace(/[^\d.]/g, '');
  
  const currentParts = cleanCurrent.split('.').map(Number);
  const latestParts = cleanLatest.split('.').map(Number);
  
  // 补齐版本号位数
  const maxLength = Math.max(currentParts.length, latestParts.length);
  while (currentParts.length < maxLength) currentParts.push(0);
  while (latestParts.length < maxLength) latestParts.push(0);
  
  // 逐位比较
  for (let i = 0; i < maxLength; i++) {
    if (latestParts[i] > currentParts[i]) {
      return true; // 有新版本
    } else if (latestParts[i] < currentParts[i]) {
      return false; // 当前版本更新
    }
  }
  
  // 如果数字版本相同，但字符串不同（如 alpha, beta 等后缀），则认为有更新
  return currentVersion !== latestVersion;
}

// 应用启动和生命周期事件处理
app.whenReady().then(() => {
  createWindow();
  
  // macOS 特殊处理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 设置安全策略
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    // 限制新窗口的创建
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });

  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // 只允许导航到本地文件
    if (parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });
});

console.log('OICPP IDE 主进程启动完成');

// ==================== GDB可用性检查 ====================

// 检查GDB是否可用
async function checkGDBAvailability() {
  return new Promise((resolve) => {
    console.log('[主进程] 检查GDB可用性...');
    
    const { spawn } = require('child_process');
    const testProcess = spawn('gdb', ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let hasError = false;

    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      hasError = true;
    });

    testProcess.on('close', (code) => {
      if (code === 0 && output.includes('GNU gdb') && !hasError) {
        const versionLine = output.split('\n')[0];
        console.log('[主进程] GDB可用，版本:', versionLine);
        resolve({
          available: true,
          version: versionLine,
          message: `GDB可用: ${versionLine}`
        });
      } else {
        console.log('[主进程] GDB不可用，退出码:', code);
        resolve({
          available: false,
          message: 'GDB调试器未安装或不可用。请安装GDB调试器以使用调试功能。'
        });
      }
    });

    testProcess.on('error', (error) => {
      console.log('[主进程] GDB检查出错:', error.message);
      resolve({
        available: false,
        message: `GDB调试器不可用: ${error.message}。请安装GDB调试器以使用调试功能。`
      });
    });

    // 设置超时
    setTimeout(() => {
      testProcess.kill();
      resolve({
        available: false,
        message: 'GDB检查超时。请确保GDB调试器已正确安装。'
      });
    }, 5000);
  });
}

// ==================== 调试功能实现 ====================

// 全局调试器实例
let gdbDebugger = null;

// 启动调试会话
async function startDebugSession(filePath, options = {}) {
    try {
        console.log('[主进程] 开始调试会话:', filePath);
        console.log('[主进程] 调试选项:', options);
        
        // 检查是否已有调试会话在运行
        if (isDebugging || (gdbDebugger && gdbDebugger.isRunning)) {
            console.log('[主进程] 停止当前调试会话...');
            await stopDebugSession();
            // 等待一下确保完全停止
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            throw new Error(`源文件不存在: ${filePath}`);
        }
        
        // 生成可执行文件路径
        const executablePath = filePath.replace(/\.(cpp|cc|cxx|c)$/i, '.exe');
        console.log('[主进程] 可执行文件路径:', executablePath);
        
        // 检查可执行文件是否存在
        if (!fs.existsSync(executablePath)) {
            throw new Error(`可执行文件不存在: ${executablePath}。请先编译代码（需要包含-g参数）。`);
        }
        
        // 检查可执行文件是否包含调试信息
        try {
            const { spawn } = require('child_process');
            const objdumpProcess = spawn('objdump', ['-h', executablePath], { stdio: 'pipe' });
            let hasDebugInfo = false;
            
            objdumpProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('.debug_info') || output.includes('.debug_line')) {
                    hasDebugInfo = true;
                }
            });
            
            await new Promise((resolve) => {
                objdumpProcess.on('close', resolve);
                setTimeout(resolve, 2000); // 2秒超时
            });
            
            if (!hasDebugInfo) {
                console.warn('[主进程] 警告：可执行文件可能不包含调试信息');
            }
        } catch (error) {
            console.warn('[主进程] 无法检查调试信息:', error.message);
        }
        
        // 创建新的调试器实例
        console.log('[主进程] 创建GDB调试器实例...');
        gdbDebugger = new GDBDebugger();
        
        // 设置调试器事件监听
        setupDebuggerEvents();
        
        // 启动调试器
        console.log('[主进程] 启动GDB调试器...');
        await gdbDebugger.start(executablePath, filePath);
        
        // 设置断点
        let hasBreakpoints = false;
        if (options.breakpoints && options.breakpoints.length > 0) {
            console.log('[主进程] 设置断点:', options.breakpoints);
            for (const breakpoint of options.breakpoints) {
                try {
                    if (typeof breakpoint === 'object' && breakpoint.line) {
                        await gdbDebugger.setBreakpoint(filePath, breakpoint.line);
                        console.log(`[主进程] 断点设置成功: ${filePath}:${breakpoint.line}`);
                        hasBreakpoints = true;
                    } else if (typeof breakpoint === 'number') {
                        await gdbDebugger.setBreakpoint(filePath, breakpoint);
                        console.log(`[主进程] 断点设置成功: ${filePath}:${breakpoint}`);
                        hasBreakpoints = true;
                    }
                } catch (error) {
                    console.warn('[主进程] 设置断点失败:', error.message);
                }
            }
        }
        
        // 调试模式下总是等待用户操作，不自动运行程序
        console.log('[主进程] 调试器已就绪，等待用户操作...');
        console.log(`[主进程] 已设置断点数量: ${hasBreakpoints ? '有断点' : '无断点'}`);
        
        // 通知前端调试器已准备就绪，等待操作
        if (mainWindow) {
            mainWindow.webContents.send('debug-ready-waiting', {
                hasBreakpoints: hasBreakpoints,
                message: hasBreakpoints ? 
                    '调试器已启动，程序已加载断点，点击继续执行开始调试' : 
                    '调试器已启动，程序已准备就绪，点击继续执行开始运行'
            });
        }
        
        isDebugging = true;
        currentOpenFile = filePath;
        
        console.log('[主进程] 调试会话启动成功');
        return {
            success: true,
            file: filePath,
            executable: executablePath,
            process: gdbDebugger.gdbProcess ? gdbDebugger.gdbProcess.pid : null
        };
        
    } catch (error) {
        console.error('[主进程] 启动调试会话失败:', error);
        isDebugging = false;
        if (gdbDebugger) {
            try {
                await gdbDebugger.stop();
            } catch (stopError) {
                console.error('[主进程] 停止调试器失败:', stopError);
            }
        }
        gdbDebugger = null;
        
        // 通知渲染进程调试启动失败
        if (mainWindow) {
            mainWindow.webContents.send('debug-error', error.message);
        }
        
        throw error;
    }
}

// 停止调试会话
async function stopDebugSession() {
    try {
        console.log('停止调试会话');
        
        if (gdbDebugger && gdbDebugger.isRunning) {
            await gdbDebugger.stop();
        }
        
        isDebugging = false;
        gdbDebugger = null;
        currentOpenFile = null;
        
        console.log('调试会话已停止');
        return { success: true };
        
    } catch (error) {
        console.error('停止调试会话失败:', error);
        isDebugging = false;
        gdbDebugger = null;
        throw error;
    }
}

// 设置调试器事件监听
function setupDebuggerEvents() {
    if (!gdbDebugger) return;
    
    console.log('[主进程] 设置调试器事件监听...');
    
    gdbDebugger.on('started', (data) => {
        console.log('[主进程] 调试器已启动:', data);
        if (mainWindow) {
            mainWindow.webContents.send('debug-started', data);
        }
    });
    
    gdbDebugger.on('stopped', (data) => {
        console.log('[主进程] 程序已停止:', data);
        if (mainWindow) {
            mainWindow.webContents.send('debug-stopped', data);
            
            // 只在程序暂停（断点或单步）时更新变量和调用栈，程序退出时不更新
            if (data.reason !== 'exited-normally' && data.reason !== 'exited' && !data.reason?.includes('exit')) {
                console.log('[主进程] 程序暂停，更新变量和调用栈');
                setTimeout(() => {
                    if (gdbDebugger && gdbDebugger.isRunning && !gdbDebugger.programExited) {
                        getDebugVariables().then(variables => {
                            mainWindow.webContents.send('debug-variables-updated', variables);
                        }).catch(error => {
                            console.warn('[主进程] 获取变量失败:', error);
                        });
                        
                        getDebugCallStack().then(callStack => {
                            mainWindow.webContents.send('debug-callstack-updated', callStack);
                        }).catch(error => {
                            console.warn('[主进程] 获取调用栈失败:', error);
                        });
                    }
                }, 500);
            } else {
                console.log('[主进程] 程序已退出，跳过变量和调用栈更新');
            }
        }
    });
    
    gdbDebugger.on('running', () => {
        console.log('[主进程] 程序正在运行...');
        if (mainWindow) {
            mainWindow.webContents.send('debug-running');
        }
    });
    
    gdbDebugger.on('error', (error) => {
        console.error('[主进程] 调试器错误:', error);
        if (mainWindow) {
            mainWindow.webContents.send('debug-error', error);
        }
    });
    
    gdbDebugger.on('exited', (data) => {
        console.log('[主进程] 调试器进程退出:', data);
        isDebugging = false;
        if (mainWindow) {
            mainWindow.webContents.send('debug-stopped', { 
                exitCode: data.code,
                signal: data.signal,
                reason: 'exited'
            });
        }
    });
    
    gdbDebugger.on('breakpoint-set', (data) => {
        console.log('[主进程] 断点已设置:', data);
        if (mainWindow) {
            mainWindow.webContents.send('debug-breakpoint-set', data);
        }
    });
    
    gdbDebugger.on('breakpoint-removed', (data) => {
        console.log('[主进程] 断点已移除:', data);
        if (mainWindow) {
            mainWindow.webContents.send('debug-breakpoint-removed', data);
        }
    });

    gdbDebugger.on('breakpoint-hit', (data) => {
        console.log('[主进程] 断点命中:', data);
        if (mainWindow) {
            mainWindow.webContents.send('debug-breakpoint-hit', data);
        }
    });
    
    gdbDebugger.on('variables-updated', (data) => {
        console.log('[主进程] 变量已更新');
        if (mainWindow) {
            mainWindow.webContents.send('debug-variables-updated', data);
        }
    });
    
    gdbDebugger.on('callstack-updated', (data) => {
        console.log('[主进程] 调用栈已更新');
        if (mainWindow) {
            mainWindow.webContents.send('debug-callstack-updated', data);
        }
    });

    gdbDebugger.on('program-exited', (data) => {
        console.log('[主进程] 程序退出事件:', data);
        if (mainWindow) {
            mainWindow.webContents.send('debug-program-exited', data);
            // 稍后发送调试停止事件
            setTimeout(() => {
                mainWindow.webContents.send('debug-stopped', {
                    reason: 'program-exited',
                    exitCode: data.exitCode
                });
            }, 100);
        }
    });
    
    console.log('[主进程] 调试器事件监听已设置完成');
}

// 发送调试命令
async function sendDebugCommand(command) {
    if (!gdbDebugger || !gdbDebugger.isRunning) {
        throw new Error('调试器未运行');
    }
    
    try {
        console.log(`[主进程] 执行调试命令: ${command}`);
        
        switch (command) {
            case 'continue':
                // 如果是第一次继续执行，先运行程序
                try {
                    await gdbDebugger.run();
                    console.log('[主进程] 程序已启动');
                    
                    // 通知前端程序开始运行
                    if (mainWindow) {
                        mainWindow.webContents.send('debug-running');
                    }
                } catch (error) {
                    // 如果程序已经在运行，使用continue命令
                    console.log('[主进程] 程序可能已在运行，使用continue命令');
                    await gdbDebugger.continue();
                }
                break;
            case 'step':
                await gdbDebugger.stepOver();
                break;
            case 'stepi':
                await gdbDebugger.stepInto();
                break;
            case 'finish':
                await gdbDebugger.stepOut();
                break;
            default:
                throw new Error(`未知的调试命令: ${command}`);
        }
        
        return { success: true };
        
    } catch (error) {
        console.error('[主进程] 发送调试命令失败:', error);
        throw error;
    }
}

// 发送调试输入
async function sendDebugInput(input) {
    if (!gdbDebugger || !gdbDebugger.isRunning) {
        throw new Error('调试器未运行');
    }
    
    try {
        await gdbDebugger.sendInput(input);
        return { success: true };
        
    } catch (error) {
        console.error('发送调试输入失败:', error);
        throw error;
    }
}

// 添加断点
async function addBreakpoint(breakpoint) {
    console.log('[主进程] 添加断点:', breakpoint);
    
    if (!gdbDebugger || !gdbDebugger.isRunning) {
        throw new Error('调试器未运行');
    }
    
    try {
        // 检查断点参数
        if (!breakpoint.file || !breakpoint.line) {
            throw new Error('断点参数不完整');
        }
        
        await gdbDebugger.setBreakpoint(breakpoint.file, breakpoint.line);
        
        // 存储断点信息
        const breakpointKey = `${breakpoint.file}:${breakpoint.line}`;
        breakpoints.set(breakpointKey, {
            file: breakpoint.file,
            line: breakpoint.line,
            enabled: true
        });
        
        console.log('[主进程] 断点添加成功:', breakpointKey);
        return { success: true, file: breakpoint.file, line: breakpoint.line };
        
    } catch (error) {
        console.error('[主进程] 添加断点失败:', error);
        throw error;
    }
}

// 移除断点
async function removeBreakpoint(breakpoint) {
    console.log('[主进程] 移除断点:', breakpoint);
    
    if (!gdbDebugger || !gdbDebugger.isRunning) {
        throw new Error('调试器未运行');
    }
    
    try {
        // 检查断点参数
        if (!breakpoint.file || !breakpoint.line) {
            throw new Error('断点参数不完整');
        }
        
        const breakpointKey = `${breakpoint.file}:${breakpoint.line}`;
        
        // 查找断点编号
        const gdbBreakpoints = gdbDebugger.getBreakpoints();
        let breakpointNumber = null;
        
        for (const bp of gdbBreakpoints) {
            if (bp.file === breakpoint.file && bp.line === breakpoint.line) {
                breakpointNumber = bp.number;
                break;
            }
        }
        
        if (breakpointNumber) {
            await gdbDebugger.removeBreakpoint(breakpointNumber);
            console.log(`[主进程] 移除断点 #${breakpointNumber}: ${breakpointKey}`);
        } else {
            console.warn(`[主进程] 未找到断点: ${breakpointKey}`);
        }
        
        // 从本地记录中移除
        breakpoints.delete(breakpointKey);
        
        console.log('[主进程] 断点移除成功:', breakpointKey);
        return { success: true, file: breakpoint.file, line: breakpoint.line };
        
    } catch (error) {
        console.error('[主进程] 移除断点失败:', error);
        throw error;
    }
}

// 获取调试变量
async function getDebugVariables() {
    if (!gdbDebugger || !gdbDebugger.isRunning) {
        throw new Error('调试器未运行');
    }
    
    try {
        await gdbDebugger.updateVariables();
        const variables = gdbDebugger.getVariables();
        
        return {
            local: variables.local || {},
            global: variables.global || {},
            watches: variables.watches || {}
        };
        
    } catch (error) {
        console.error('获取调试变量失败:', error);
        throw error;
    }
}

// 获取调用堆栈
async function getDebugCallStack() {
    if (!gdbDebugger || !gdbDebugger.isRunning) {
        throw new Error('调试器未运行');
    }
    
    try {
        await gdbDebugger.updateCallStack();
        return gdbDebugger.getCallStack();
        
    } catch (error) {
        console.error('获取调用堆栈失败:', error);
        throw error;
    }
}
