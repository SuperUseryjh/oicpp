// C++ 代码补全系统
class CppAutoComplete {
    constructor() {
        this.keywords = [];
        this.builtinFunctions = [];
        this.standardLibrary = [];
        this.userSymbols = [];
        this.snippets = [];
        this.headers = [];
        
        this.initializeData();
    }

    initializeData() {
        // C++ 关键字
        this.keywords = [
            'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor', 'bool', 'break',
            'case', 'catch', 'char', 'char16_t', 'char32_t', 'class', 'compl', 'const', 'constexpr',
            'const_cast', 'continue', 'decltype', 'default', 'delete', 'do', 'double', 'dynamic_cast',
            'else', 'enum', 'explicit', 'export', 'extern', 'false', 'float', 'for', 'friend', 'goto',
            'if', 'inline', 'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'not', 'not_eq',
            'nullptr', 'operator', 'or', 'or_eq', 'private', 'protected', 'public', 'register',
            'reinterpret_cast', 'return', 'short', 'signed', 'sizeof', 'static', 'static_assert',
            'static_cast', 'struct', 'switch', 'template', 'this', 'thread_local', 'throw', 'true',
            'try', 'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void',
            'volatile', 'wchar_t', 'while', 'xor', 'xor_eq'
        ];

        // 内置函数
        this.builtinFunctions = [
            'printf', 'scanf', 'sprintf', 'sscanf', 'fprintf', 'fscanf',
            'fopen', 'fclose', 'fread', 'fwrite', 'fseek', 'ftell',
            'malloc', 'calloc', 'realloc', 'free',
            'memset', 'memcpy', 'memmove', 'memcmp',
            'strlen', 'strcpy', 'strncpy', 'strcat', 'strncat', 'strcmp', 'strncmp',
            'strchr', 'strrchr', 'strstr', 'strspn', 'strcspn', 'strtok',
            'atoi', 'atof', 'atol', 'strtol', 'strtoul', 'strtod',
            'abs', 'labs', 'fabs', 'ceil', 'floor', 'round', 'sqrt', 'pow',
            'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
            'exp', 'log', 'log10', 'rand', 'srand', 'time'
        ];

        // 标准库函数
        this.standardLibrary = [
            // iostream
            'cout', 'cin', 'cerr', 'clog', 'endl', 'ends', 'flush',
            'getline', 'ignore', 'peek', 'putback', 'get', 'put',
            
            // string
            'string', 'length', 'size', 'empty', 'clear', 'append', 'push_back',
            'pop_back', 'insert', 'erase', 'replace', 'substr', 'find', 'rfind',
            'find_first_of', 'find_last_of', 'find_first_not_of', 'find_last_not_of',
            'compare', 'c_str', 'data',
            
            // vector
            'vector', 'push_back', 'pop_back', 'insert', 'erase', 'clear',
            'size', 'empty', 'capacity', 'reserve', 'resize', 'shrink_to_fit',
            'at', 'front', 'back', 'begin', 'end', 'rbegin', 'rend',
            
            // algorithm
            'sort', 'stable_sort', 'partial_sort', 'nth_element',
            'binary_search', 'lower_bound', 'upper_bound', 'equal_range',
            'merge', 'inplace_merge', 'reverse', 'rotate', 'shuffle',
            'min', 'max', 'min_element', 'max_element', 'minmax', 'minmax_element',
            'find', 'find_if', 'find_if_not', 'count', 'count_if',
            'equal', 'mismatch', 'search', 'search_n',
            'copy', 'copy_if', 'copy_n', 'copy_backward', 'move', 'move_backward',
            'fill', 'fill_n', 'generate', 'generate_n', 'transform',
            'replace', 'replace_if', 'replace_copy', 'replace_copy_if',
            'remove', 'remove_if', 'remove_copy', 'remove_copy_if',
            'unique', 'unique_copy', 'partition', 'stable_partition',
            'accumulate', 'inner_product', 'adjacent_difference', 'partial_sum',
            
            // map
            'map', 'multimap', 'insert', 'erase', 'find', 'count',
            'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'clear',
            
            // set
            'set', 'multiset', 'insert', 'erase', 'find', 'count',
            'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'clear',
            
            // queue
            'queue', 'priority_queue', 'push', 'pop', 'front', 'back',
            'empty', 'size', 'top',
            
            // stack
            'stack', 'push', 'pop', 'top', 'empty', 'size',
            
            // pair
            'pair', 'make_pair', 'first', 'second'
        ];

        // 常用头文件
        this.headers = [
            '#include <iostream>',
            '#include <vector>',
            '#include <string>',
            '#include <algorithm>',
            '#include <map>',
            '#include <set>',
            '#include <queue>',
            '#include <stack>',
            '#include <deque>',
            '#include <list>',
            '#include <cmath>',
            '#include <cstdio>',
            '#include <cstdlib>',
            '#include <cstring>',
            '#include <cctype>',
            '#include <climits>',
            '#include <cfloat>',
            '#include <cassert>',
            '#include <ctime>',
            '#include <functional>',
            '#include <numeric>',
            '#include <iterator>',
            '#include <utility>',
            '#include <memory>',
            '#include <fstream>',
            '#include <sstream>',
            '#include <iomanip>',
            '#include <bitset>',
            '#include <unordered_map>',
            '#include <unordered_set>'
        ];

        // 代码片段
        this.snippets = [
            {
                label: 'main',
                insertText: 'int main() {\n    $0\n    return 0;\n}',
                description: 'Main function template'
            },
            {
                label: 'for',
                insertText: 'for (int i = 0; i < $1; i++) {\n    $0\n}',
                description: 'For loop template'
            },
            {
                label: 'while',
                insertText: 'while ($1) {\n    $0\n}',
                description: 'While loop template'
            },
            {
                label: 'if',
                insertText: 'if ($1) {\n    $0\n}',
                description: 'If statement template'
            },
            {
                label: 'ifelse',
                insertText: 'if ($1) {\n    $2\n} else {\n    $0\n}',
                description: 'If-else statement template'
            },
            {
                label: 'class',
                insertText: 'class $1 {\npublic:\n    $1();\n    ~$1();\n    \nprivate:\n    $0\n};',
                description: 'Class template'
            },
            {
                label: 'struct',
                insertText: 'struct $1 {\n    $0\n};',
                description: 'Struct template'
            },
            {
                label: 'vector',
                insertText: 'vector<$1> $2;',
                description: 'Vector declaration'
            },
            {
                label: 'sort',
                insertText: 'sort($1.begin(), $1.end());',
                description: 'Sort container'
            },
            {
                label: 'reverse',
                insertText: 'reverse($1.begin(), $1.end());',
                description: 'Reverse container'
            },
            {
                label: 'unique',
                insertText: '$1.erase(unique($1.begin(), $1.end()), $1.end());',
                description: 'Remove duplicates'
            },
            {
                label: 'binary_search',
                insertText: 'binary_search($1.begin(), $1.end(), $2)',
                description: 'Binary search'
            },
            {
                label: 'lower_bound',
                insertText: 'lower_bound($1.begin(), $1.end(), $2)',
                description: 'Lower bound'
            },
            {
                label: 'upper_bound',
                insertText: 'upper_bound($1.begin(), $1.end(), $2)',
                description: 'Upper bound'
            },
            {
                label: 'fast_io',
                insertText: 'ios_base::sync_with_stdio(false);\ncin.tie(NULL);',
                description: 'Fast I/O optimization'
            },
            {
                label: 'read_input',
                insertText: 'int n;\ncin >> n;\nvector<int> a(n);\nfor (int i = 0; i < n; i++) {\n    cin >> a[i];\n}',
                description: 'Read array input'
            },
            {
                label: 'output_vector',
                insertText: 'for (int i = 0; i < $1.size(); i++) {\n    cout << $1[i] << (i == $1.size() - 1 ? "\\n" : " ");\n}',
                description: 'Output vector elements'
            },
            {
                label: 'debug',
                insertText: '#define debug(x) cerr << #x << " = " << x << endl;',
                description: 'Debug macro'
            },
            {
                label: 'typedef',
                insertText: 'typedef long long ll;\ntypedef vector<int> vi;\ntypedef pair<int, int> pii;',
                description: 'Common typedefs'
            },
            {
                label: 'const',
                insertText: 'const int MOD = 1e9 + 7;\nconst int INF = 1e9;\nconst long long LLINF = 1e18;',
                description: 'Common constants'
            }
        ];
    }

    // 获取补全建议
    getSuggestions(prefix, context) {
        const suggestions = [];
        console.log('getSuggestions 被调用，prefix:', prefix, 'context:', context);
        
        // 头文件补全 - 优先处理，支持任何地方输入 <
        if (prefix.startsWith('<') || context.afterInclude || context.isIncludeLine) {
            console.log('触发头文件补全逻辑');
            const commonHeaders = [
                '<iostream>', '<vector>', '<string>', '<algorithm>', '<map>', '<set>',
                '<queue>', '<stack>', '<deque>', '<list>', '<cmath>', '<cstdio>',
                '<cstdlib>', '<cstring>', '<cctype>', '<climits>', '<cfloat>',
                '<cassert>', '<ctime>', '<functional>', '<numeric>', '<iterator>',
                '<utility>', '<memory>', '<fstream>', '<sstream>', '<iomanip>',
                '<bitset>', '<unordered_map>', '<unordered_set>'
            ];
            
            commonHeaders.forEach(header => {
                let shouldAdd = false;
                
                if (prefix.startsWith('<')) {
                    // 输入了 <，匹配剩余部分
                    const searchTerm = prefix.substring(1).toLowerCase();
                    const headerContent = header.substring(1, header.length - 1).toLowerCase();
                    if (headerContent.includes(searchTerm) || headerContent.startsWith(searchTerm) || searchTerm === '') {
                        shouldAdd = true;
                        console.log(`匹配到头文件: ${header}, searchTerm: ${searchTerm}`);
                    }
                } else if (context.afterInclude || context.isIncludeLine) {
                    // 在 #include 后面
                    if (prefix === '' || header.toLowerCase().includes(prefix.toLowerCase())) {
                        shouldAdd = true;
                    }
                }
                
                if (shouldAdd) {
                    suggestions.push({
                        text: header,
                        type: 'header',
                        priority: 15,
                        description: 'Standard header'
                    });
                }
            });
        } else {
            console.log('未触发头文件补全逻辑');
        }
        
        // 关键字补全
        this.keywords.forEach(keyword => {
            if (keyword.startsWith(prefix)) {
                suggestions.push({
                    text: keyword,
                    type: 'keyword',
                    priority: 10
                });
            }
        });

        // 内置函数补全
        this.builtinFunctions.forEach(func => {
            if (func.startsWith(prefix)) {
                suggestions.push({
                    text: func,
                    type: 'function',
                    priority: 8
                });
            }
        });

        // 标准库函数补全
        this.standardLibrary.forEach(func => {
            if (func.startsWith(prefix)) {
                suggestions.push({
                    text: func,
                    type: 'method',
                    priority: 8
                });
            }
        });

        // 代码片段补全
        this.snippets.forEach(snippet => {
            if (snippet.label.startsWith(prefix)) {
                suggestions.push({
                    text: snippet.insertText,
                    type: 'snippet',
                    priority: 7,
                    description: snippet.description
                });
            }
        });

        // 用户定义的符号
        this.userSymbols.forEach(symbol => {
            if (symbol.name.startsWith(prefix)) {
                suggestions.push({
                    text: symbol.name,
                    type: symbol.type,
                    priority: 6,
                    detail: symbol.detail || symbol.name
                });
            }
        });

        // 根据优先级排序
        suggestions.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return a.text.localeCompare(b.text);
        });

        console.log(`getSuggestions 返回 ${suggestions.length} 个建议:`, suggestions.map(s => `${s.text}(${s.type})`));
        return suggestions;
    }

    // 分析代码，提取用户定义的符号
    analyzeCode(code) {
        this.userSymbols = [];
        
        // 提取函数定义 - 改进正则表达式
        const functionRegex = /(?:^|\n)\s*(?:static\s+|inline\s+|virtual\s+)?(?:const\s+)?(\w+(?:\s*\*)*)\s+(\w+)\s*\([^)]*\)\s*(?:\{|;)/gm;
        let match;
        while ((match = functionRegex.exec(code)) !== null) {
            const returnType = match[1].trim();
            const functionName = match[2];
            if (!this.keywords.includes(functionName) && !this.keywords.includes(returnType)) {
                this.userSymbols.push({
                    name: functionName,
                    type: 'function',
                    detail: `${returnType} ${functionName}(...)`
                });
            }
        }

        // 提取变量定义 - 改进匹配
        const variableRegex = /(?:^|\n|\{|\;)\s*(?:static\s+|const\s+|volatile\s+)*(?:int|long|float|double|char|string|bool|auto|unsigned|signed|short|void\s*\*|std::\w+|vector|map|set|queue|stack|pair)\s*(?:\*|\&)*\s+(\w+)(?:\s*=|\s*;|\s*,|\s*\[)/gm;
        while ((match = variableRegex.exec(code)) !== null) {
            const varName = match[1];
            if (!this.keywords.includes(varName)) {
                this.userSymbols.push({
                    name: varName,
                    type: 'variable',
                    detail: 'User variable'
                });
            }
        }

        // 提取类和结构体定义
        const classRegex = /(?:class|struct)\s+(\w+)/gm;
        while ((match = classRegex.exec(code)) !== null) {
            this.userSymbols.push({
                name: match[1],
                type: 'class',
                detail: 'User defined class/struct'
            });
        }

        // 提取枚举定义
        const enumRegex = /enum\s+(?:class\s+)?(\w+)/gm;
        while ((match = enumRegex.exec(code)) !== null) {
            this.userSymbols.push({
                name: match[1],
                type: 'enum',
                detail: 'User defined enum'
            });
        }

        // 提取成员函数和成员变量
        const memberRegex = /(\w+)\.(\w+)|(\w+)->(\w+)/gm;
        while ((match = memberRegex.exec(code)) !== null) {
            const memberName = match[2] || match[4];
            if (memberName && !this.keywords.includes(memberName)) {
                this.userSymbols.push({
                    name: memberName,
                    type: 'property',
                    detail: 'Member function/variable'
                });
            }
        }

        // 提取宏定义
        const macroRegex = /#define\s+(\w+)/gm;
        while ((match = macroRegex.exec(code)) !== null) {
            this.userSymbols.push({
                name: match[1],
                type: 'constant',
                detail: 'Macro definition'
            });
        }

        // 去重
        const uniqueSymbols = new Map();
        this.userSymbols.forEach(symbol => {
            const key = `${symbol.name}_${symbol.type}`;
            if (!uniqueSymbols.has(key)) {
                uniqueSymbols.set(key, symbol);
            }
        });
        this.userSymbols = Array.from(uniqueSymbols.values());
    }

    // 智能代码补全
    getSmartSuggestions(prefix, line, column, code) {
        const context = this.getContext(line, column, code);
        const suggestions = this.getSuggestions(prefix, context);
        
        // 根据上下文调整建议
        if (context.afterInclude) {
            return suggestions.filter(s => s.type === 'module' || s.type === 'header');
        }
        
        if (context.inString) {
            return [];
        }
        
        if (context.afterDot || context.afterArrow) {
            return suggestions.filter(s => s.type === 'method' || s.type === 'property');
        }
        
        return suggestions;
    }

    // 获取上下文信息
    getContext(line, column, code) {
        const lines = code.split('\n');
        const currentLine = lines[line - 1] || '';
        const beforeCursor = currentLine.substring(0, column - 1);
        
        // 检查是否在 #include 后面 - 改进检测逻辑
        const isIncludeLine = /^\s*#include/.test(currentLine);
        const includeMatch = beforeCursor.match(/#include\s+(.*)$/);
        const afterInclude = isIncludeLine && (
            /^\s*#include\s*$/.test(beforeCursor) ||  // #include 后面只有空格
            /^\s*#include\s+[<"][^>"]*$/.test(beforeCursor) ||  // #include <partial 或 "partial
            /^\s*#include\s+[^<"]*$/.test(beforeCursor)  // #include 后面没有 < 或 "
        );
        
        return {
            afterInclude: afterInclude,
            afterDot: /\.\w*$/.test(beforeCursor),
            afterArrow: /->\w*$/.test(beforeCursor),
            inString: this.isInString(beforeCursor),
            inComment: this.isInComment(beforeCursor),
            inFunction: this.isInFunction(line, code),
            inClass: this.isInClass(line, code),
            isIncludeLine: isIncludeLine
        };
    }

    // 检查是否在字符串中
    isInString(text) {
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            
            if (char === '"' || char === "'") {
                inString = !inString;
            }
        }
        
        return inString;
    }

    // 检查是否在注释中
    isInComment(text) {
        const singleLineComment = text.indexOf('//');
        if (singleLineComment !== -1) {
            return true;
        }
        
        // 简单的多行注释检查
        const multiLineStart = text.lastIndexOf('/*');
        const multiLineEnd = text.lastIndexOf('*/');
        
        return multiLineStart !== -1 && (multiLineEnd === -1 || multiLineStart > multiLineEnd);
    }

    // 检查是否在函数中
    isInFunction(line, code) {
        const lines = code.split('\n');
        let braceCount = 0;
        let inFunction = false;
        
        for (let i = 0; i < Math.min(line, lines.length); i++) {
            const currentLine = lines[i];
            
            // 检查函数定义
            if (/\w+\s*\([^)]*\)\s*\{/.test(currentLine)) {
                inFunction = true;
            }
            
            // 计算大括号
            for (const char of currentLine) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }
            
            if (braceCount === 0 && inFunction) {
                inFunction = false;
            }
        }
        
        return inFunction;
    }

    // 检查是否在类中
    isInClass(line, code) {
        const lines = code.split('\n');
        let braceCount = 0;
        let inClass = false;
        
        for (let i = 0; i < Math.min(line, lines.length); i++) {
            const currentLine = lines[i];
            
            // 检查类定义
            if (/(?:class|struct)\s+\w+.*\{/.test(currentLine)) {
                inClass = true;
            }
            
            // 计算大括号
            for (const char of currentLine) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }
            
            if (braceCount === 0 && inClass) {
                inClass = false;
            }
        }
        
        return inClass;
    }

    // 添加自定义补全项
    addCustomSuggestion(name, type, priority = 5) {
        this.userSymbols.push({
            name: name,
            type: type,
            priority: priority
        });
    }

    // 移除自定义补全项
    removeCustomSuggestion(name) {
        this.userSymbols = this.userSymbols.filter(s => s.name !== name);
    }

    // 清空用户符号
    clearUserSymbols() {
        this.userSymbols = [];
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CppAutoComplete;
} else {
    window.CppAutoComplete = CppAutoComplete;
}
