#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const [slug, title, author] = process.argv.slice(2);
if (!slug || !title?.trim() || !author?.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: node create-book.cjs book-slug "책 제목" "저자"');
  process.exit(1);
}
const destination = path.join(__dirname, '..', slug);
if (fs.existsSync(destination)) {
  console.error('이미 있는 폴더입니다. 기존 발표를 덮어쓰지 않았습니다: ' + destination);
  process.exit(1);
}
const escapeHTML = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const html = fs.readFileSync(path.join(__dirname, 'starter.html'), 'utf8')
  .replaceAll('{{TITLE}}', escapeHTML(title))
  .replaceAll('{{AUTHOR}}', escapeHTML(author));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'starter-book.json'), 'utf8'));
config.title = title;
config.author = author;
fs.mkdirSync(path.join(destination, 'assets'), {recursive: true});
fs.writeFileSync(path.join(destination, 'index.html'), html);
fs.writeFileSync(path.join(destination, 'book.js'), '// Draft: complete content and verify sources before adding to the catalog.\nwindow.PresenceBook = ' + JSON.stringify(config, null, 2) + ';\n');
fs.writeFileSync(path.join(destination, '발표원고.md'), '# ' + title + '\n\n' + author + ' 지음\n\n초안: book.js의 introduction·slideNotes와 원고를 함께 작성하세요. 원문·판본·쪽수를 확인한 후 카탈로그에 등록하세요.\n');
fs.writeFileSync(path.join(destination, 'assets', 'README.md'), '# 장면 에셋\n\n../../shared/ASSET_GUIDE.md의 구도와 명명 규칙에 따라 책마다 새로운 에셋을 제작하세요. 제목/본문은 이미지에 굽지 않고 HTML로 유지합니다.\n');
console.log('초안 생성: ' + destination);
console.log('카탈로그에는 아직 등록하지 않았습니다. 콘텐츠·출처·3개 화면 크기 검증을 마친 뒤 등록하세요.');
