const fs = require('fs');
const path = require('path');
const https = require('https');

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

const dir = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
          // handle redirects
          https.get(response.headers.location, (res) => {
              if (res.statusCode === 200) {
                  res.pipe(file);
                  file.on('finish', () => file.close(resolve));
              } else {
                 fs.unlink(dest, () => reject(`Redirect failed ${url}`)); 
              }
          })
      }
      else {
        fs.unlink(dest, () => reject(`Failed to download ${url} (status: ${response.statusCode})`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err.message));
    });
  });
}

async function main() {
  console.log('Starting model downloads...');
  for (const file of files) {
    console.log(`Downloading ${file}...`);
    try {
      await download(baseUrl + file, path.join(dir, file));
      console.log(`Successfully downloaded ${file}`);
    } catch (e) {
      console.error(e);
    }
  }
}

main();
