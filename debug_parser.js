const https = require('https');

const options = {
  hostname: 'm.vk.com',
  path: '/pervie_vagay/wall',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive'
  }
};

https.get(options, res => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('\nLength:', d.length);
    console.log('First 200 chars:', d.substring(0, 200));
  });
}).on('error', err => {
  console.log('Error:', err.message);
});
