import http from 'http';

// A bare minimum valid JPG image buffer (1x1 pixel)
const jpgHex = 'ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc40014010100000000000000000000000000000000ffc40020110100000000000000000000000000000000ffda000c03010002110311003f00f07fa28a28003fffd9';
const imageBuffer = Buffer.from(jpgHex, 'hex');

console.log("📸 [ESP SIMULATOR] Taking picture...");
console.log(`📡 [ESP SIMULATOR] Uploading image (${imageBuffer.length} bytes) to server...`);

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'application/octet-stream',
    'Content-Length': imageBuffer.length
  }
};

const req = http.request(options, (res) => {
  let responseBody = '';
  res.on('data', chunk => responseBody += chunk);
  res.on('end', () => {
    console.log(`✅ [ESP SIMULATOR] Server Responded HTTP ${res.statusCode}: ${responseBody}`);
  });
});

req.on('error', (e) => {
  console.error(`❌ [ESP SIMULATOR] Failed to upload: ${e.message}`);
});

req.write(imageBuffer);
req.end();
