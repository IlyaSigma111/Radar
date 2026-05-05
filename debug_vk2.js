const https = require('https');

https.get({
  hostname: 'm.vk.com',
  path: '/pervie_vagay/wall',
  headers: {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Ищем HTML-блоки постов, а не CSS
    const htmlIdx = data.indexOf('<div', data.indexOf('</style>'));
    if (htmlIdx === -1) {
      console.log('No HTML after </style>');
      // Проверяем структуру
      const styleEnd = data.indexOf('</style>');
      console.log('</style> at:', styleEnd);
      console.log('HTML after style:', data.substring(styleEnd, styleEnd + 500));
    } else {
      console.log('HTML starts at:', htmlIdx);
      
      // Ищем pi_text в HTML части
      const textIdx = data.indexOf('pi_text', htmlIdx);
      if (textIdx > 0) {
        console.log('\nFound pi_text in HTML at:', textIdx);
        console.log(data.substring(textIdx - 50, textIdx + 300));
      } else {
        console.log('No pi_text found in HTML');
      }
    }
    
    // Сохраняем для анализа
    const fs = require('fs');
    fs.writeFileSync('debug_vk_output.html', data);
    console.log('\nSaved full HTML to debug_vk_output.html');
  });
});
