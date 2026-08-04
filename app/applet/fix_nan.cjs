const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/parseFloat\(e\.target\.value\)/g, "e.target.value === '' ? '' as any : parseFloat(e.target.value)");
  content = content.replace(/parseInt\(e\.target\.value\)/g, "e.target.value === '' ? '' as any : parseInt(e.target.value)");

  fs.writeFileSync(filePath, content);
}

['src/pages/Admin.tsx', 'src/pages/ProjectsView.tsx', 'src/pages/Games.tsx', 'pages/Admin.tsx', 'pages/ProjectsView.tsx', 'pages/Games.tsx'].forEach(file => {
  const p = path.join(process.cwd(), file);
  if (fs.existsSync(p)) {
    fixFile(p);
  }
});
