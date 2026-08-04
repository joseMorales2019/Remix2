import fs from 'fs';
import path from 'path';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/parseFloat\(e\.target\.value\)/g, "(e.target.value === '' ? '' as any : parseFloat(e.target.value))");
  content = content.replace(/parseInt\(e\.target\.value\)/g, "(e.target.value === '' ? '' as any : parseInt(e.target.value))");

  fs.writeFileSync(filePath, content);
}

['Admin.tsx', 'ProjectsView.tsx', 'Games.tsx'].forEach(file => {
  const p = path.join(process.cwd(), 'pages', file);
  if (fs.existsSync(p)) {
    fixFile(p);
  }
});
