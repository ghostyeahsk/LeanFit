const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MINI_ROOT = path.join(ROOT, 'miniprogram');

test('project.config.json and app.json are valid JSON with all referenced pages existing', () => {
  const projectConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'));
  assert.equal(projectConfig.miniprogramRoot, 'miniprogram/');
  assert.equal(projectConfig.cloudfunctionRoot, 'cloudfunctions/');

  const appJson = JSON.parse(fs.readFileSync(path.join(MINI_ROOT, 'app.json'), 'utf8'));
  assert.ok(Array.isArray(appJson.pages) && appJson.pages.length >= 5);

  appJson.pages.forEach((pageRoute) => {
    ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
      const fullPath = path.join(MINI_ROOT, `${pageRoute}.${ext}`);
      assert.ok(fs.existsSync(fullPath), `Missing page file: ${fullPath}`);
    });

    // 验证页面 JSON 合法，且声明的自定义组件均存在
    const pageJsonPath = path.join(MINI_ROOT, `${pageRoute}.json`);
    const pageJson = JSON.parse(fs.readFileSync(pageJsonPath, 'utf8'));
    if (pageJson.usingComponents) {
      Object.values(pageJson.usingComponents).forEach((compRelPath) => {
        const compBase = path.resolve(path.dirname(pageJsonPath), compRelPath);
        ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
          assert.ok(fs.existsSync(`${compBase}.${ext}`), `Missing component file: ${compBase}.${ext}`);
        });
      });
    }
  });
});

test('all cloudfunctions have valid package.json and index.js', () => {
  ['login', 'syncProfile', 'submitCheckin'].forEach((fn) => {
    const fnDir = path.join(ROOT, 'cloudfunctions', fn);
    const pkg = JSON.parse(fs.readFileSync(path.join(fnDir, 'package.json'), 'utf8'));
    assert.equal(pkg.main, 'index.js');
    assert.ok(fs.existsSync(path.join(fnDir, 'index.js')));
  });
});
