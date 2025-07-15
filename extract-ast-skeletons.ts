// Reminder: Run `npm install ts-morph` and ensure types are available.
import * as fs from 'fs';
import * as path from 'path';
import { ClassDeclaration, EnumDeclaration, FunctionDeclaration, InterfaceDeclaration, Node, Project, TypeAliasDeclaration, VariableStatement } from 'ts-morph';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configurable
const SRC_DIR = path.join(__dirname, 'src');
const CONFIG_FILES = [
    'wrangler.toml',
    'package.json',
    'tsconfig.json',
    'next.config.ts',
    'tailwind.config.js',
];
const OUTPUT_MD = 'CODEBASE_SKELETON.md';
const CONFIG_LINES = 15;
const IGNORE_PATTERNS = [
    '__tests__', '__mocks__', 'node_modules', '.next', '.open-next', '.wrangler', 'scripts', 'test-data', 'tests', 'public',
    '.d.ts', '.map', '.json', '.snap', '.md', '.css', '.scss', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.mp3', '.wav', '.zip', '.gz', '.tar', '.tgz', '.lock',
    '.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx',
];

function shouldIgnore(fileOrDir: string): boolean {
    return IGNORE_PATTERNS.some(pattern => fileOrDir.includes(pattern));
}

function getDirectoryTree(dir: string, prefix = ''): string {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile());
    const folders = entries.filter(e => e.isDirectory());
    let tree = '';
    for (const folder of folders) {
        if (shouldIgnore(folder.name)) continue;
        tree += `${prefix}- ${folder.name}/\n`;
        tree += getDirectoryTree(path.join(dir, folder.name), prefix + '  ');
    }
    for (const file of files) {
        if (shouldIgnore(file.name)) continue;
        tree += `${prefix}- ${file.name}\n`;
    }
    return tree;
}

function getConfigFileSkeleton(filePath: string): string {
    if (!fs.existsSync(filePath)) return '_File not found._';
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').slice(0, CONFIG_LINES);
    return '```' + path.extname(filePath).replace('.', '') + '\n' + lines.join('\n') + '\n```';
}

function getJsDocText(node: Node): string | null {
    const jsDocs = (node as any).getJsDocs?.() || [];
    if (jsDocs.length === 0) return null;
    // Concatenate all JSDoc blocks (usually only one)
    return jsDocs.map((doc: any) => '/**' + (doc.getInnerText ? '\n' + doc.getInnerText() + '\n' : '') + '*/').join('\n');
}

function getFunctionSignature(fn: FunctionDeclaration): string {
    const jsDoc = getJsDocText(fn);
    const name = fn.getName() || '(anonymous)';
    const params = fn.getParameters().map(p => p.getText()).join(', ');
    const retType = fn.getReturnType().getText(fn);
    let out = '';
    if (jsDoc) out += jsDoc + '\n';
    out += `export function ${name}(${params})${retType ? `: ${retType}` : ''}`;
    return out;
}

function getClassSkeleton(cls: ClassDeclaration): string {
    const jsDoc = getJsDocText(cls);
    let out = '';
    if (jsDoc) out += jsDoc + '\n';
    out += `export class ${cls.getName()}`;
    // Only include public (or no modifier) methods
    const methods = cls.getMethods().filter(m => {
        const scope = m.getScope();
        return scope === 'public' || scope === undefined; // undefined means no modifier, which is public in TS
    });
    if (methods.length === 0) return out;
    out += '\n';
    for (const m of methods) {
        const mJsDoc = getJsDocText(m);
        if (mJsDoc) out += mJsDoc + '\n';
        const params = m.getParameters().map(p => p.getText()).join(', ');
        const retType = m.getReturnType().getText(m);
        out += `  ${m.getName()}(${params})${retType ? `: ${retType}` : ''}\n`;
    }
    return out.trim();
}

function getInterfaceSkeleton(intf: InterfaceDeclaration): string {
    const jsDoc = getJsDocText(intf);
    let out = '';
    if (jsDoc) out += jsDoc + '\n';
    out += `export interface ${intf.getName()} {`;
    const props = intf.getProperties();
    for (const p of props) {
        const pJsDoc = getJsDocText(p);
        if (pJsDoc) out += '\n  ' + pJsDoc.replace(/\n/g, '\n  ') + '\n';
        out += `  ${p.getText()}`;
    }
    out += '\n}';
    return out;
}

function getTypeAliasSkeleton(type: TypeAliasDeclaration): string {
    const jsDoc = getJsDocText(type);
    let out = '';
    if (jsDoc) out += jsDoc + '\n';
    out += `export type ${type.getName()} = ${type.getTypeNode()?.getText() || ''}`;
    return out;
}

function getEnumSkeleton(enm: EnumDeclaration): string {
    const jsDoc = getJsDocText(enm);
    let out = '';
    if (jsDoc) out += jsDoc + '\n';
    out += `export enum ${enm.getName()} { ... }`;
    return out;
}

function getVariableSkeleton(vs: VariableStatement): string {
    const jsDoc = getJsDocText(vs);
    let out = '';
    if (jsDoc) out += jsDoc + '\n';
    out += vs.getDeclarations().map(d => `export ${d.getText()}`).join('\n');
    return out;
}

function getExportedSkeletons(filePath: string, project: Project): string | null {
    const sourceFile = project.addSourceFileAtPathIfExists(filePath);
    if (!sourceFile) return null;
    let skeleton = '';
    // Summarize imports
    const imports = sourceFile.getImportDeclarations();
    if (imports.length > 0) {
        const importNames = imports.map(imp => imp.getModuleSpecifierValue()).filter((v, i, arr) => arr.indexOf(v) === i);
        skeleton += `Imports: ${importNames.join(', ')}\n`;
    }
    // Only exported top-level declarations
    let hasExports = false;
    for (const child of sourceFile.getStatements()) {
        if (Node.isFunctionDeclaration(child) && child.isExported()) {
            skeleton += getFunctionSignature(child) + '\n';
            hasExports = true;
        } else if (Node.isClassDeclaration(child) && child.isExported()) {
            skeleton += getClassSkeleton(child) + '\n';
            hasExports = true;
        } else if (Node.isInterfaceDeclaration(child) && child.isExported()) {
            skeleton += getInterfaceSkeleton(child) + '\n';
            hasExports = true;
        } else if (Node.isTypeAliasDeclaration(child) && child.isExported()) {
            skeleton += getTypeAliasSkeleton(child) + '\n';
            hasExports = true;
        } else if (Node.isEnumDeclaration(child) && child.isExported()) {
            skeleton += getEnumSkeleton(child) + '\n';
            hasExports = true;
        } else if (Node.isVariableStatement(child) && child.isExported()) {
            skeleton += getVariableSkeleton(child) + '\n';
            hasExports = true;
        }
    }
    return hasExports ? '```typescript\n' + skeleton.trim() + '\n```' : null;
}

function walkAndExtract(dir: string, rel = '', out: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (shouldIgnore(entry.name)) continue;
        const absPath = path.join(dir, entry.name);
        const relPath = path.join(rel, entry.name);
        if (entry.isDirectory()) {
            walkAndExtract(absPath, relPath, out);
        } else if (
            entry.isFile() &&
            (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
            !shouldIgnore(entry.name)
        ) {
            out.push(relPath);
        }
    }
    return out;
}

async function main() {
    const start = Date.now();
    console.log('Starting dense codebase skeleton extraction...');

    let md = '# Codebase Directory Tree\n\n';
    md += '```\n' + getDirectoryTree(SRC_DIR) + '```\n\n';
    console.log('Directory tree extracted.');

    md += '# Config File Skeletons\n\n';
    for (const configFile of CONFIG_FILES) {
        console.log(`Processing config file: ${configFile}`);
        md += `## ${configFile}\n`;
        md += getConfigFileSkeleton(path.join(__dirname, configFile)) + '\n\n';
        console.log(`Finished config file: ${configFile}`);
    }

    md += '# Source File Dense AST Skeletons\n\n';
    const tsFiles = walkAndExtract(SRC_DIR);
    console.log(`Found ${tsFiles.length} TypeScript files to process.`);
    const project = new Project({ tsConfigFilePath: path.join(__dirname, 'tsconfig.json') });
    let processed = 0;
    let filesWithExports = 0;
    for (const file of tsFiles) {
        console.log(`Processing src/${file} (${++processed}/${tsFiles.length})`);
        const skeleton = getExportedSkeletons(path.join(SRC_DIR, file), project);
        if (skeleton) {
            md += `## src/${file}\n`;
            md += skeleton + '\n\n';
            filesWithExports++;
        }
    }

    fs.writeFileSync(OUTPUT_MD, md, 'utf-8');
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Wrote dense codebase skeleton to ${OUTPUT_MD}`);
    console.log(`Processed ${tsFiles.length} TypeScript files, ${filesWithExports} with exports, in ${elapsed} seconds.`);
}

main(); 