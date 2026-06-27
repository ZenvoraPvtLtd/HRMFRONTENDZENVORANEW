const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\user1\\Downloads\\zenvora hrm\\zenvora hrm\\frontend\\src\\features\\candidateDashboard';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

const candidateDashboardFiles = files.map(f => f.replace('.tsx', ''));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace ./common/XYZ with ./XYZ
  if (content.includes('./common/')) {
    content = content.replace(/\.\/common\//g, './');
    changed = true;
  }

  // Replace ../XYZ with ./XYZ if XYZ is in candidateDashboard
  const newContent = content.replace(/from\s+['"]\.\.\/([^'"]+)['"]/g, (match, p1) => {
    if (candidateDashboardFiles.includes(p1)) {
      changed = true;
      return `from "./${p1}"`;
    }
    return match;
  });
  content = newContent;

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
}
