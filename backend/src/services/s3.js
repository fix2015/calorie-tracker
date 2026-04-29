const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 80;

let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_S3_REGION || 'eu-central-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

function isS3Configured() {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET);
}

/**
 * Resize image and upload to S3.
 * Returns the public S3 URL.
 * Falls back to local storage if S3 is not configured.
 */
async function uploadImage(filePath) {
  const buffer = fs.readFileSync(filePath);

  // Resize with sharp — fit within 1200x1200, preserve aspect ratio
  const resized = await sharp(buffer)
    .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  if (!isS3Configured()) {
    // Fallback: overwrite local file with resized version
    fs.writeFileSync(filePath, resized);
    return null; // signal caller to use local path
  }

  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_S3_REGION || 'eu-central-1';
  const key = `uploads/${crypto.randomUUID()}.jpg`;

  await getS3Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: resized,
    ContentType: 'image/jpeg',
  }));

  // Clean up local file after S3 upload
  fs.unlink(filePath, () => {});

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

module.exports = { uploadImage, isS3Configured };
