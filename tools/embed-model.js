// 把 model.glb 内嵌为 js/model-data.js（file:// 兜底加载用）
const fs = require('fs');
const ROOT = 'E:/ZCODE/xue-Concert';
const buf = fs.readFileSync(ROOT + '/model.glb');
const b64 = buf.toString('base64');
const out = 'window.__KOB_MODEL_B64="' + b64 + '";\n';
fs.writeFileSync(ROOT + '/js/model-data.js', out);
console.log('embedded bytes=' + buf.length + ' b64chars=' + b64.length);
