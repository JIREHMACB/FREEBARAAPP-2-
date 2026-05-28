export const uploadToCloudinary = async (base64Data: string, folder = 'freebara'): Promise<string> => {
  if (!process.env.CLOUDINARY_URL)
    return `https://picsum.photos/seed/${Date.now()}/400/400`;
  const url       = new URL(process.env.CLOUDINARY_URL);
  const apiKey    = url.username;
  const apiSecret = url.password;
  const cloudName = url.hostname;
  const auth      = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const body      = new URLSearchParams({ file: base64Data, upload_preset: 'freebara', folder });
  const resp      = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json() as any;
  if (!data.secure_url) throw new Error('Upload Cloudinary échoué: ' + JSON.stringify(data));
  return data.secure_url;
};