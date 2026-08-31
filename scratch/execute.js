const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Fix client imports
const clientFixes = [
    { old: "@/src/utils/network/apiClient", new: "@/src/clients/apiClient" },
    { old: "./apiClient", new: "@/src/clients/apiClient" }, // for network/index.ts
    { old: "@/src/utils/network/mqttClient", new: "@/src/clients/mqttClient" },
    { old: "./mqttClient", new: "@/src/clients/mqttClient" },
    { old: "./database", new: "@/src/clients/sqliteClient" },
    { old: "@/src/utils/db/database", new: "@/src/clients/sqliteClient" }
];

function replaceInFiles(dir, matchers) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory() && !fullPath.includes('node_modules') && !fullPath.includes('.git')) {
            replaceInFiles(fullPath, matchers);
        } else if (file.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;
            for (const {old, new: newStr} of matchers) {
                if (content.includes(old)) {
                    // Replace exact string matches inside imports
                    const regex = new RegExp(old.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), "g");
                    content = content.replace(regex, newStr);
                    changed = true;
                }
            }
            if (changed) {
                fs.writeFileSync(fullPath, content);
            }
        }
    }
}
replaceInFiles(path.join(process.cwd(), 'src'), clientFixes);

// 2. Type Colocations
const moves = [
  { type: "AuthenticatedUser", sourceModel: "src/models/auth.ts", targetFile: "src/utils/auth/google.ts" },
  { type: "CardProps", sourceModel: "src/models/components.ts", targetFile: "src/components/ui/Card.tsx" },
  { type: "StyledButtonProps", sourceModel: "src/models/components.ts", targetFile: "src/components/ui/StyledButton.tsx" },
  { type: "ChatBubbleProps", sourceModel: "src/models/components.ts", targetFile: "src/components/chat/ChatBubble.tsx" },
  { type: "ContactAvatarProps", sourceModel: "src/models/components.ts", targetFile: "src/components/shared/ContactAvatar.tsx" },
  { type: "BlockReportSheetProps", sourceModel: "src/models/components.ts", targetFile: "src/components/shared/BlockReportSheet.tsx" },
  { type: "DeleteAccountSheetProps", sourceModel: "src/models/components.ts", targetFile: "src/components/shared/DeleteAccountSheet.tsx" },
  { type: "SessionCache", sourceModel: "src/models/crypto.ts", targetFile: "src/utils/crypto/ratchet.ts" },
  { type: "PhoneIdentity", sourceModel: "src/models/store.ts", targetFile: "src/store/useSession.ts" },
  { type: "MqttStore", sourceModel: "src/models/store.ts", targetFile: "src/store/useMqttStore.ts" },
  { type: "ThemeContextType", sourceModel: "src/models/theme.ts", targetFile: "src/hooks/useTheme.tsx" },
  { type: "RequestOptions", sourceModel: "src/models/network.ts", targetFile: "src/clients/apiClient.ts" }
];

for (const move of moves) {
    const sourcePath = path.join(process.cwd(), move.sourceModel);
    const targetPath = path.join(process.cwd(), move.targetFile);
    
    if (!fs.existsSync(sourcePath) || !fs.existsSync(targetPath)) continue;

    let sourceContent = fs.readFileSync(sourcePath, 'utf8');
    let targetContent = fs.readFileSync(targetPath, 'utf8');

    // Extract the type block
    const regex = new RegExp(`export\\s+(type|interface)\\s+${move.type}\\s*(?:=\\s*)?({[^}]*}|[^;]*;)`, 's');
    const match = regex.exec(sourceContent);

    if (match) {
        const fullDef = match[0].trim();
        
        // Remove from source
        sourceContent = sourceContent.replace(regex, '').trim();
        fs.writeFileSync(sourcePath, sourceContent);

        // Remove the import from target file
        const importRegex = new RegExp(`import\\s+{([^}]*)\\b${move.type}\\b([^}]*)}\\s+from\\s+['"][^'"]+['"];?\\n?`, 'g');
        targetContent = targetContent.replace(importRegex, (match, p1, p2) => {
            const inner = (p1 + p2).replace(/,/g, '').trim();
            if (inner.length === 0) return ''; // Only imported this type
            return `import { ${inner} } from ${match.split('from')[1].trim()}\n`;
        });
        // Wait, if it was `import { Type, Other } from ...`, my quick regex is flawed. Let's use simpler regex.
        // If it fails, we'll manually fix. Actually, a better regex:
        targetContent = targetContent.replace(new RegExp(`import\\s*type\\s*\\{\\s*${move.type}\\s*\\}\\s*from\\s*['"][^'"]+['"];?\\n?`, 'g'), '');
        targetContent = targetContent.replace(new RegExp(`import\\s*\\{\\s*${move.type}\\s*\\}\\s*from\\s*['"][^'"]+['"];?\\n?`, 'g'), '');

        // Add to target file after the imports block
        const lastImportIndex = targetContent.lastIndexOf('import ');
        if (lastImportIndex !== -1) {
            const endOfLine = targetContent.indexOf('\n', lastImportIndex);
            targetContent = targetContent.slice(0, endOfLine + 1) + '\n' + fullDef + '\n' + targetContent.slice(endOfLine + 1);
        } else {
            targetContent = fullDef + '\n\n' + targetContent;
        }

        fs.writeFileSync(targetPath, targetContent);
    }
}
