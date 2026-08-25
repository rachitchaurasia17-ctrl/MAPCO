const fs = require('fs');
const path = require('path');

const inputHtmlPath = path.resolve('C:\\Users\\rachi_l35wosr\\OneDrive\\Desktop\\MAPCO\\Dealer Dashboardnew.dc.html');
const templateOutPath = path.resolve('./src/apps/dealer/template.ts');
const logicOutPath = path.resolve('./src/apps/dealer/logic.ts');

const htmlContent = fs.readFileSync(inputHtmlPath, 'utf8');

// Extract x-dc content
const startTag = '<x-dc>';
const endTag = '</x-dc>';
const startIndex = htmlContent.indexOf(startTag);
const endIndex = htmlContent.lastIndexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find <x-dc> tags!");
    process.exit(1);
}

const xdcContent = htmlContent.substring(startIndex + startTag.length, endIndex);
let tsContent = `// Auto-generated from HTML\n`;
tsContent += `export const getTemplate = () => \`${xdcContent.replace(/\\/g, '\\\\').replace(/\`/g, '\\`').replace(/\\$/g, '\\$')}\`;\n`;

fs.writeFileSync(templateOutPath, tsContent);
console.log(`Successfully generated ${templateOutPath}`);

// Extract JS logic
const scriptStartStr = 'class Component extends DCLogic {';
const scriptStartIdx = htmlContent.indexOf(scriptStartStr);
if (scriptStartIdx !== -1) {
    // Find the end of the script tag manually by looking for </script>
    const rest = htmlContent.substring(scriptStartIdx);
    const scriptEndIdx = rest.indexOf('</script>');
    if (scriptEndIdx !== -1) {
        let jsLogic = rest.substring(0, scriptEndIdx).trim();
        
        let logicTs = `// @ts-nocheck\nimport { DCLogic, Router } from '../../framework/dc';\n\n`;
        logicTs += `export ${jsLogic}\n`;
        
        fs.writeFileSync(logicOutPath, logicTs);
        console.log(`Successfully generated ${logicOutPath}`);
    } else {
        console.error("Could not find </script> after Component logic!");
    }
} else {
    console.error("Could not find class Component extends DCLogic!");
}
