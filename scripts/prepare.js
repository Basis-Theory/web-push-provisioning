const fs = require('fs');
const distPackage = require('../package.json');

// remove not required fields
delete distPackage.devDependencies;
delete distPackage.targets;
delete distPackage.source;
delete distPackage.targets;
delete distPackage.alias;
delete distPackage['size-limit'];

// use only required temporary script in dist
distPackage.scripts = {
  postversion: 'cd .. && node ./scripts/bump.js',
};

// include all 'dist/*' files, but bundles
distPackage.files = ['*', '!*.bundle.js'];

// updates source flags removing 'dist' path
['main', 'module', 'types'].forEach((prop) => {
  distPackage[prop] = distPackage[prop].replace('dist/', '');
});

fs.mkdirSync('./dist', { recursive: true });
fs.copyFileSync('./README.md', './dist/README.md');
fs.copyFileSync('./LICENSE', './dist/LICENSE');
fs.writeFileSync(
  './dist/package.json',
  JSON.stringify(distPackage, undefined, 2)
);
