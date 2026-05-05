const https = require('https');

const url = 'https://m.vk.com/pervie_vagay/wall';

const options = {
  hostname: 'm.vk.com',
  path: '/pervie_vagay/wall',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  }
};

https.get(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Ищем классы, связанные с постами
    const classes = data.match(/class="[^"]*post[^"]*"/gi);
    console.log('Post-related classes:', classes ? classes.slice(0, 20) : 'None');
    
    // Ищем wall_post
    const wallPosts = data.match(/wall_post[^"]*/gi);
    console.log('Wall post classes:', wallPosts ? wallPosts.slice(0, 20) : 'None');
    
    // Ищем текст
    const textMatches = data.match(/text[^"]*"[^>]*>[^<]+/gi);
    console.log('Text elements:', textMatches ? textMatches.slice(0, 10) : 'None');
    
    // Сохраним фрагмент для анализа
    const idx = data.indexOf('wall_post');
    if (idx > 0) {
      console.log('\nHTML around wall_post:');
      console.log(data.substring(idx - 100, idx + 500));
    }
  });
});
