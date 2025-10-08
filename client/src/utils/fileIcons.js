// File type icons mapping
export const getFileIcon = (fileName) => {
    if (!fileName) return '📄';
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const iconMap = {
        // JavaScript & TypeScript
        'js': '🟨',
        'jsx': '⚛️',
        'ts': '🔷',
        'tsx': '⚛️',
        'mjs': '🟨',
        
        // Python
        'py': '🐍',
        'pyw': '🐍',
        'pyc': '🐍',
        
        // Java
        'java': '☕',
        'class': '☕',
        'jar': '☕',
        
        // C/C++
        'c': '🔵',
        'cpp': '🔵',
        'cxx': '🔵',
        'cc': '🔵',
        'h': '🔵',
        'hpp': '🔵',
        
        // C#
        'cs': '🟣',
        
        // Rust
        'rs': '🦀',
        
        // Go
        'go': '🐹',
        
        // PHP
        'php': '🐘',
        
        // Ruby
        'rb': '💎',
        
        // Swift
        'swift': '🦉',
        
        // Kotlin
        'kt': '🟠',
        'kts': '🟠',
        
        // Dart
        'dart': '🎯',
        
        // HTML & CSS
        'html': '🌐',
        'htm': '🌐',
        'css': '🎨',
        'scss': '🎨',
        'sass': '🎨',
        'less': '🎨',
        
        // JSON & XML
        'json': '📋',
        'xml': '📋',
        'yaml': '📋',
        'yml': '📋',
        
        // Markdown & Text
        'md': '📝',
        'txt': '📄',
        'rtf': '📄',
        
        // Images
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'gif': '🖼️',
        'svg': '🖼️',
        'ico': '🖼️',
        'webp': '🖼️',
        
        // Videos
        'mp4': '🎬',
        'avi': '🎬',
        'mov': '🎬',
        'wmv': '🎬',
        'flv': '🎬',
        'webm': '🎬',
        
        // Audio
        'mp3': '🎵',
        'wav': '🎵',
        'flac': '🎵',
        'aac': '🎵',
        'ogg': '🎵',
        
        // Archives
        'zip': '📦',
        'rar': '📦',
        '7z': '📦',
        'tar': '📦',
        'gz': '📦',
        
        // Documents
        'pdf': '📕',
        'doc': '📘',
        'docx': '📘',
        'xls': '📗',
        'xlsx': '📗',
        'ppt': '📙',
        'pptx': '📙',
        
        // Config files
        'env': '⚙️',
        'config': '⚙️',
        'conf': '⚙️',
        'ini': '⚙️',
        'toml': '⚙️',
        
        // Database
        'sql': '🗄️',
        'db': '🗄️',
        'sqlite': '🗄️',
        
        // Shell scripts
        'sh': '🐚',
        'bash': '🐚',
        'zsh': '🐚',
        'fish': '🐚',
        'ps1': '🐚',
        'bat': '🐚',
        'cmd': '🐚',
        
        // Docker
        'dockerfile': '🐳',
        
        // Git
        'gitignore': '🚫',
        'gitattributes': '🔧',
        
        // Package managers
        'package.json': '📦',
        'yarn.lock': '🧶',
        'package-lock.json': '🔒',
        'composer.json': '🎼',
        'requirements.txt': '📋',
        'cargo.toml': '📦',
        'go.mod': '📦',
        'pom.xml': '📦',
        
        // README files
        'readme.md': '📖',
        'readme.txt': '📖',
        'readme': '📖',
    };
    
    // Check for specific filenames first
    const lowerFileName = fileName.toLowerCase();
    if (iconMap[lowerFileName]) {
        return iconMap[lowerFileName];
    }
    
    // Then check by extension
    if (extension && iconMap[extension]) {
        return iconMap[extension];
    }
    
    // Default file icon
    return '📄';
};

export const getFolderIcon = (folderName) => {
    const lowerName = folderName?.toLowerCase();
    
    const folderIconMap = {
        'node_modules': '📚',
        'src': '📁',
        'public': '🌐',
        'assets': '🎨',
        'images': '🖼️',
        'img': '🖼️',
        'css': '🎨',
        'js': '🟨',
        'components': '⚛️',
        'pages': '📄',
        'utils': '🔧',
        'helpers': '🔧',
        'lib': '📚',
        'libs': '📚',
        'vendor': '📦',
        'build': '🏗️',
        'dist': '📦',
        'out': '📦',
        'bin': '⚙️',
        'config': '⚙️',
        'configs': '⚙️',
        'test': '🧪',
        'tests': '🧪',
        '__tests__': '🧪',
        'spec': '🧪',
        'docs': '📚',
        'documentation': '📚',
        'examples': '💡',
        'demo': '💡',
        'scripts': '📜',
        'tools': '🔧',
        'migrations': '🔄',
        'seeds': '🌱',
        'fixtures': '🔧',
        'mocks': '🎭',
        'stubs': '🎭',
        '.git': '🔧',
        '.vscode': '💙',
        '.idea': '💡',
        'temp': '🗂️',
        'tmp': '🗂️',
        'cache': '💾',
        'logs': '📋',
        'uploads': '📤',
        'downloads': '📥',
    };
    
    return folderIconMap[lowerName] || '📁';
};