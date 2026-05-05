const fs = require('fs');
const html = fs.readFileSync('debug_vk_output.html', 'utf-8');

// Ищем pi_text в HTML
let idx = 0;
let count = 0;
while ((idx = html.indexOf('pi_text', idx + 1)) !== -1 && count < 5) {
  count++;
  console.log(`\n=== pi_text #${count} at ${idx} ===`);
  
  // Ищем начало div
  const divStart = html.lastIndexOf('<div', idx);
  console.log(html.substring(divStart, divStart + 400));
  console.log('---');
}

// Ищем wall_item в HTML части (после </style>)
const styleEnd = html.indexOf('</style>') + 8;
let wallIdx = 0;
let wallCount = 0;
while ((wallIdx = html.indexOf('wall_item', wallIdx + 1)) !== -1 && wallIdx > styleEnd && wallCount < 3) {
  wallCount++;
  console.log(`\n=== wall_item HTML #${wallCount} at ${wallIdx} ===`);
  
  const divStart = html.lastIndexOf('<div', wallIdx);
  console.log(html.substring(divStart, divStart + 500));
  console.log('---');
}
