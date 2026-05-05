const https = require('https');

const urls = [
  'https://m.vk.com/pervie_vagay/wall',
  'https://m.vk.com/club223483226/wall'
];

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
};

urls.forEach(testUrl => {
  https.get(testUrl, options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`URL: ${testUrl}`);
      console.log(`Status: ${res.statusCode}`);
      console.log(`Length: ${data.length}`);
      
      // Ищем признаки постов
      const hasPosts = data.includes('wall_post') || data.includes('post_text');
      console.log(`Has posts: ${hasPosts}`);
      
      if (data.includes('login') || data.includes('auth')) {
        console.log('Redirected to login');
      }
      console.log('---');
    });
  });
});
