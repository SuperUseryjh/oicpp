// 自定义对话框组件
class DialogManager {
    constructor() {
        this.currentDialog = null;
        this.createDialogContainer();
    }

    createDialogContainer() {
        // 创建对话框容器
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.id = 'dialog-overlay';
        overlay.style.display = 'none';
        
        const dialog = document.createElement('div');
        dialog.className = 'dialog-container';
        dialog.id = 'dialog-container';
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    showInputDialog(title, defaultValue = '', placeholder = '') {
        return new Promise((resolve, reject) => {
            const overlay = document.getElementById('dialog-overlay');
            const container = document.getElementById('dialog-container');
            
            container.innerHTML = `
                <div class="dialog-header">
                    <h3>${title}</h3>
                    <button class="dialog-close" onclick="dialogManager.hideDialog()">&times;</button>
                </div>
                <div class="dialog-body">
                    <input type="text" id="dialog-input" placeholder="${placeholder}" value="${defaultValue}" />
                </div>
                <div class="dialog-footer">
                    <button class="dialog-btn dialog-btn-cancel" onclick="dialogManager.hideDialog()">取消</button>
                    <button class="dialog-btn dialog-btn-confirm" onclick="dialogManager.confirmDialog()">确定</button>
                </div>
            `;
            
            overlay.style.display = 'flex';
            
            // 聚焦输入框
            const input = document.getElementById('dialog-input');
            input.focus();
            input.select();
            
            // 回车键确认
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.confirmDialog();
                } else if (e.key === 'Escape') {
                    this.hideDialog();
                }
            });
            
            // 保存当前对话框的 resolve 函数
            this.currentDialog = {
                resolve: resolve,
                reject: reject
            };
        });
    }

    showConfirmDialog(title, message) {
        return new Promise((resolve, reject) => {
            const overlay = document.getElementById('dialog-overlay');
            const container = document.getElementById('dialog-container');
            
            container.innerHTML = `
                <div class="dialog-header">
                    <h3>${title}</h3>
                    <button class="dialog-close" onclick="dialogManager.hideDialog()">&times;</button>
                </div>
                <div class="dialog-body">
                    <p>${message}</p>
                </div>
                <div class="dialog-footer">
                    <button class="dialog-btn dialog-btn-cancel" onclick="dialogManager.cancelDialog()">取消</button>
                    <button class="dialog-btn dialog-btn-confirm" onclick="dialogManager.confirmDialog()">确定</button>
                </div>
            `;
            
            overlay.style.display = 'flex';
            
            // 保存当前对话框的 resolve 函数
            this.currentDialog = {
                resolve: resolve,
                reject: reject
            };
        });
    }

    confirmDialog() {
        if (!this.currentDialog) return;
        
        const input = document.getElementById('dialog-input');
        const result = input ? input.value : true;
        
        this.currentDialog.resolve(result);
        this.hideDialog();
    }

    cancelDialog() {
        if (!this.currentDialog) return;
        
        this.currentDialog.resolve(null);
        this.hideDialog();
    }

    hideDialog() {
        const overlay = document.getElementById('dialog-overlay');
        overlay.style.display = 'none';
        this.currentDialog = null;
    }

    showGotoLineDialog() {
        return this.showInputDialog('跳转到行号', '1', '请输入行号');
    }

    showNewFileDialog() {
        return this.showInputDialog('新建文件', 'untitled.cpp', '请输入文件名');
    }

    showNewFolderDialog() {
        return this.showInputDialog('新建文件夹', 'new-folder', '请输入文件夹名');
    }
}

// 创建全局对话框管理器
let dialogManager;
document.addEventListener('DOMContentLoaded', () => {
    dialogManager = new DialogManager();
});
