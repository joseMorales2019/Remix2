const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace value={variable} with value={Number.isNaN(variable) ? '' : variable} for known numeric inputs
  // we will replace the `parseFloat` and `parseInt` in onChange, but we need to supply type `any` to avoid TS error if we do `''`
  content = content.replace(/parseFloat\(e\.target\.value\)/g, "e.target.value === '' ? '' as any : parseFloat(e.target.value)");
  content = content.replace(/parseInt\(e\.target\.value\)/g, "e.target.value === '' ? '' as any : parseInt(e.target.value)");

  fs.writeFileSync(filePath, content);
}

['pages/Admin.tsx', 'pages/ProjectsView.tsx', 'pages/Games.tsx'].forEach(file => {
  if (fs.existsSync(file)) {
    fixFile(file);
  } else if (fs.existsSync('src/' + file)) {
    fixFile('src/' + file);
  }
});
