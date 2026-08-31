const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const modelsDir = path.join(process.cwd(), 'src/models');
const srcDir = path.join(process.cwd(), 'src');

function findTypes(dir) {
    let types = [];
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            types = types.concat(findTypes(fullPath));
        } else if (file.isFile() && fullPath.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const regex = /^export\s+(type|interface)\s+(\w+)/gm;
            let match;
            while ((match = regex.exec(content)) !== null) {
                types.push({ name: match[2], file: fullPath });
            }
        }
    }
    return types;
}

const exportedTypes = findTypes(modelsDir);
const results = [];

for (const type of exportedTypes) {
    try {
        // ripgrep to find files containing the exact word, excluding src/models
        // we use -l to just get filenames
        const cmd = `rg -l "\\b${type.name}\\b" src/ -g '!src/models/**'`;
        const output = execSync(cmd, { encoding: 'utf8' }).trim();
        const files = output.split('\n').filter(Boolean);
        
        if (files.length === 1) {
            // Also check if it's actually imported, to avoid false positives (e.g. if the word matches a variable name)
            const targetFileContent = fs.readFileSync(files[0], 'utf8');
            const importRegex = new RegExp(`import\\s+.*\\b${type.name}\\b.*\\s+from`, 'g');
            if (importRegex.test(targetFileContent)) {
                results.push({
                    type: type.name,
                    sourceModel: path.relative(process.cwd(), type.file),
                    targetFile: files[0]
                });
            }
        }
    } catch (e) {
        // ripgrep exits with 1 if no match found
    }
}

console.log(JSON.stringify(results, null, 2));
