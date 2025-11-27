#!/usr/bin/env node

/**
 * Script to add .js extensions to all relative imports in TypeScript files
 * This is required for ESM compatibility in Node.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(__dirname, '../src');

function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Pattern to match relative imports: from "../something" or from "./something"
  // But exclude node_modules, @types, and already have .js extensions
  const importPattern = /from\s+['"](\.\.?\/[^'"]+)(?<!\.js)['"]/g;
  
  const newContent = content.replace(importPattern, (match, importPath) => {
    // Skip if it's a directory import (ends with /) or already has extension
    if (importPath.endsWith('/') || importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return match;
    }
    
    // Skip type-only imports that might not need extensions
    // But for ESM, we need .js for all relative imports
    modified = true;
    return match.replace(importPath, importPath + '.js');
  });
  
  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return true;
  }
  
  return false;
}

// Main execution
console.log('🔍 Finding TypeScript files...');
const tsFiles = findTsFiles(srcDir);
console.log(`📁 Found ${tsFiles.length} TypeScript files`);

console.log('🔧 Fixing imports...');
let fixedCount = 0;

tsFiles.forEach(file => {
  if (fixImports(file)) {
    fixedCount++;
    console.log(`  ✓ Fixed: ${path.relative(srcDir, file)}`);
  }
});

console.log(`\n✅ Fixed ${fixedCount} files`);
console.log('💡 Run "npm run build" to verify the changes');

