/**
 * Serverless Upload Endpoint: /api/upload-bill
 * Uploads invoice images directly to Cloudflare R2 bucket via S3 API
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const endpoint = process.env.R2_ACCOUNT_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error('R2 configuration missing in environment variables');
    return res.status(500).json({
      error: 'R2 storage credentials are not fully configured in environment variables (R2_ACCOUNT_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).'
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // ignore
      }
    }
    const { image, imageBase64, fileName } = body || {};
    const rawImage = image || imageBase64;

    if (!rawImage || typeof rawImage !== 'string') {
      return res.status(400).json({ error: 'Missing image or imageBase64 payload in request body.' });
    }

    // Strip base64 data URL prefix if present
    const base64Data = rawImage.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const sanitizedFileName = (fileName || 'bill.jpg')
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    const key = `bills/${Date.now()}-${sanitizedFileName}`;

    const s3 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg'
      })
    );

    const cleanDomain = (publicDomain || '').replace(/\/$/, '');
    const url = cleanDomain.startsWith('http')
      ? `${cleanDomain}/${key}`
      : `https://${cleanDomain}/${key}`;

    return res.status(200).json({
      success: true,
      url,
      key
    });
  } catch (err) {
    console.error('R2 Upload Error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to upload image to Cloudflare R2'
    });
  }
}
