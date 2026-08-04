const fs = require('fs');

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  const replacements = [
    /value=\{selectedProject\.summary_amount\}/g,
    /value=\{selectedProject\.model_equity\}/g,
    /value=\{selectedProject\.model_pre_money\}/g,
    /value=\{selectedProject\.model_post_money\}/g,
    /value=\{newProject\.summary_amount\}/g,
    /value=\{newProject\.model_equity\}/g,
    /value=\{newProject\.model_pre_money\}/g,
    /value=\{newProject\.model_post_money\}/g,
    /value=\{editProject\.summary_amount\}/g,
    /value=\{editProject\.model_equity\}/g,
    /value=\{editProject\.model_pre_money\}/g,
    /value=\{editProject\.model_post_money\}/g,
  ];

  replacements.forEach(regex => {
    content = content.replace(regex, (match) => {
      const variable = match.substring(7, match.length - 1);
      return `value={Number.isNaN(${variable} as any) ? '' : ${variable}}`;
    });
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
};

fixFile('./pages/Admin.tsx');
fixFile('./pages/ProjectsView.tsx');
