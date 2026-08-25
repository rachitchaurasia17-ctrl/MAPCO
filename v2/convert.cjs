const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3];

let html = fs.readFileSync(inputFile, 'utf-8');

// Extract everything between <x-dc> and </x-dc>
const dcMatch = html.match(/<x-dc>([\s\S]*?)<\/x-dc>/);
if (!dcMatch) {
  console.error('No <x-dc> found');
  process.exit(1);
}
let content = dcMatch[1];

// Extract helmet to a separate variable
let helmetContent = '';
content = content.replace(/<helmet>([\s\S]*?)<\/helmet>/, (match, inner) => {
  helmetContent = inner;
  return '';
});

// Escape existing backticks and ${
content = content.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

// We need to parse nested sc-if and sc-for.
// A simpler way is to replace tags directly:

content = content.replace(/<sc-if\s+value="\{\{\s*([^}]+?)\s*\}\}"[^>]*>/g, '\\${ $1 ? \\`');
content = content.replace(/<\/sc-if>/g, '\\` : \'\' }');

content = content.replace(/<sc-for\s+list="\{\{\s*([^}]+?)\s*\}\}"\s+as="([^"]+)"[^>]*>/g, '\\${ ($1 || []).map($2 => \\`');
content = content.replace(/<\/sc-for>/g, '\\`).join(\'\') }');

// Replace event bindings: onClick="{{ fn }}" -> onClick="${__b(fn)}"
content = content.replace(/on([A-Z]\w+)="\{\{\s*([^}]+?)\s*\}\}"/g, 'on$1="\\${__b($2)}"');

// Strip omFadeIn, omRise, omPop animations to prevent flicker during full DOM re-renders
content = content.replace(/animation:\s*(omFadeIn|omRise|omPop)\s+[^;"]+;?/g, '');

// Replace {{ variable }} with ${ variable }
content = content.replace(/\{\{\s*([^}]+?)\s*\}\}/g, '\\${$1}');

// The return statement in our output file
const output = `// @ts-nocheck
export const globalHead = \`${helmetContent.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\`;

export function renderApp(state: any) {
  const compiler = new Function('props', \`
    with (props) {
      return \\\`${content}\\\`;
    }
  \`);
  
  return compiler(state);
}
`;

fs.writeFileSync(outputFile, output);
console.log('Conversion successful!');
