#include <Windows.h>
#include <Psapi.h>
#include <stdio.h>
#include <conio.h>
#include <iostream>

// 设置控制台编码为UTF-8
void SetupConsole() {
    SetConsoleOutputCP(65001);
    SetConsoleCP(65001);
}

int main(int argc, char *argv[])
{
    SetupConsole();
    
    if (argc < 2) {
        printf("用法：\n%s <文件名> <参数>\n请按任意键继续...", argv[0]);
        _getch();
        return -1;
    }
    
    CHAR Command[MAX_PATH * 2] = {0};
    strcpy_s(Command, sizeof(Command), argv[1]);
    
    // 添加其他参数
    for (int i = 2; i < argc; i++) {
        strcat_s(Command, sizeof(Command), " ");
        strcat_s(Command, sizeof(Command), argv[i]);
    }
    
    // 设置控制台标题
    SetConsoleTitleA(Command);
    
    STARTUPINFOA StartupInfo = {0};
    PROCESS_INFORMATION ProcessInfo = {0};
    PROCESS_MEMORY_COUNTERS ProcessMemoryCounters = {0};
    LARGE_INTEGER StartingTime, EndingTime, Frequency;
    DWORD ReturnValue;
    
    StartupInfo.cb = sizeof(StartupInfo);
    
    
    if (!CreateProcessA(NULL, Command, NULL, NULL, FALSE, 0, NULL, NULL, &StartupInfo, &ProcessInfo)) {
        DWORD error = GetLastError();
        printf("\n无法启动进程：%s\n错误代码: %d\n请按任意键继续...", Command, error);
        _getch();
        return -1;
    }
    
    QueryPerformanceFrequency(&Frequency);
    QueryPerformanceCounter(&StartingTime);
    
    // 等待进程完成
    WaitForSingleObject(ProcessInfo.hProcess, INFINITE);
    
    QueryPerformanceCounter(&EndingTime);
    GetProcessMemoryInfo(ProcessInfo.hProcess, &ProcessMemoryCounters, sizeof(ProcessMemoryCounters));
    GetExitCodeProcess(ProcessInfo.hProcess, &ReturnValue);
    
    CloseHandle(ProcessInfo.hProcess);
    CloseHandle(ProcessInfo.hThread);
    
    LONGLONG ExecutionTime = (EndingTime.QuadPart - StartingTime.QuadPart) * 1000000 / Frequency.QuadPart;
    
    printf("\n-----------------------------------------------");
    printf("\n执行时间：%lld.%03lld ms", ExecutionTime / 1000, ExecutionTime % 1000);
    printf("\n峰值内存使用：%u KB", (unsigned)(ProcessMemoryCounters.PeakWorkingSetSize >> 10));
    printf("\n程序返回值：%u (0x%X)", ReturnValue, ReturnValue);
    printf("\n请按任意键继续...");
    _getch();
    
    return 0;
}
