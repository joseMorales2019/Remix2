const fs = require('fs');

const fixGames = () => {
  const filePath = './pages/Games.tsx';
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('const safeJSONParse')) {
    content = content.replace(/(import .*\n(?:import .*\n)*)/, (match) => {
      return match + `\nconst safeJSONParse = (str: any, fallback: any = null) => { try { return JSON.parse(str); } catch(e) { return fallback; } };\n`;
    });
    
    content = content.replace(/JSON\.parse\(/g, 'safeJSONParse(');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
};

fixGames();
