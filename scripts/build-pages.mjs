import { copyFile, access, readFile } from 'node:fs/promises';

const adsenseMeta = '<meta name="google-adsense-account" content="ca-pub-4934943702995460"';
const adsenseScript = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4934943702995460';
const adsTxtLine = 'google.com, pub-4934943702995460, DIRECT, f08c47fec0942fa0';

await access('dist/index.html');
await copyFile('worker/index.js', 'dist/_worker.js');
await copyFile('worker/menu-availability.js', 'dist/menu-availability.js');
const [html, adsTxt] = await Promise.all([
  readFile('dist/index.html', 'utf8'),
  readFile('dist/ads.txt', 'utf8'),
]);
if (html.split(adsenseMeta).length !== 2) throw new Error('ADSENSE_META_MISSING_OR_DUPLICATED');
if (adsTxt.trim() !== adsTxtLine) throw new Error('ADS_TXT_INVALID');
if (html.split(adsenseScript).length !== 2) throw new Error('ADSENSE_SCRIPT_MISSING_OR_DUPLICATED');
if (!/<script\s+async\s+src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-4934943702995460"\s+crossorigin="anonymous"><\/script>/.test(html)) throw new Error('ADSENSE_SCRIPT_ATTRIBUTES_INVALID');
if (/<ins[^>]+class="adsbygoogle"/.test(html)) throw new Error('MANUAL_AD_SLOT_NOT_ALLOWED');
console.log('Cloudflare Pages Worker copied to dist/_worker.js');
console.log('Static AdSense ownership and automatic ads code verified');
