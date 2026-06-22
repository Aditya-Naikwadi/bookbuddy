const fs = require('fs');
const path = require('path');

const sectionsDir = path.join(__dirname, 'src', 'sections');

fs.readdirSync(sectionsDir).forEach(file => {
  if (file.endsWith('.tsx')) {
    const filePath = path.join(sectionsDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    content = content.replace(/\.\.\/\.\.\/hooks/g, '../hooks');
    content = content.replace(/\.\.\/\.\.\/utils/g, '../utils');
    fs.writeFileSync(filePath, content);
  }
});
