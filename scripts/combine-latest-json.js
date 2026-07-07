const fs = require('fs');
const path = require('path');

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY; // "owner/repo"
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;
  const tag = `v${version}`;

  if (!token || !repo) {
    console.error('GITHUB_TOKEN and GITHUB_REPOSITORY environment variables are required.');
    process.exit(1);
  }

  console.log(`Fetching release info for tag ${tag} from repo ${repo}...`);

  // Fetch release info from GitHub API
  const releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'tauri-updater-combiner'
  };

  const res = await fetch(releaseUrl, { headers });
  if (!res.ok) {
    console.error(`Failed to fetch release info: ${res.statusText}`);
    process.exit(1);
  }

  const release = await res.json();
  const assets = release.assets;
  console.log(`Found ${assets.length} assets in release ${tag}.`);

  // Helper to find asset signature
  async function fetchSignatureContent(sigAsset) {
    const sigRes = await fetch(sigAsset.browser_download_url, { headers });
    if (!sigRes.ok) {
      throw new Error(`Failed to download signature from ${sigAsset.browser_download_url}`);
    }
    const text = await sigRes.text();
    return text.trim();
  }

  const platforms = {};

  // Find files and signatures
  for (const asset of assets) {
    const name = asset.name;
    const url = asset.browser_download_url;

    // Skip signature files themselves when finding installers
    if (name.endsWith('.sig')) continue;

    // Find signature asset
    const sigAsset = assets.find(a => a.name === `${name}.sig`);
    if (!sigAsset) {
      console.log(`No signature file found for asset: ${name}`);
      continue;
    }

    let platformKey = null;

    if (name.includes('x64-setup.exe') || name.includes('x86_64-setup.exe') || name.includes('x64_setup.exe')) {
      platformKey = 'windows-x86_64';
    } else if (name.includes('x86-setup.exe') || name.includes('i686-setup.exe') || name.includes('x86_setup.exe')) {
      platformKey = 'windows-i686';
    } else if (name.includes('x64.app.tar.gz') || name.includes('x86_64.app.tar.gz')) {
      platformKey = 'darwin-x86_64';
    } else if (name.includes('aarch64.app.tar.gz') || name.includes('arm64.app.tar.gz')) {
      platformKey = 'darwin-aarch64';
    }

    if (platformKey) {
      console.log(`Processing platform: ${platformKey} for asset ${name}...`);
      try {
        const signature = await fetchSignatureContent(sigAsset);
        platforms[platformKey] = {
          signature,
          url
        };
        // Also support nsis variants for windows
        if (platformKey === 'windows-x86_64') {
          platforms['windows-x86_64-nsis'] = { signature, url };
        } else if (platformKey === 'windows-i686') {
          platforms['windows-i686-nsis'] = { signature, url };
        }
      } catch (err) {
        console.error(`Error fetching signature for ${name}:`, err);
      }
    }
  }

  // Construct latest.json
  const latestJson = {
    version,
    notes: `Release ${version}`,
    pub_date: new Date().toISOString(),
    platforms
  };

  const outPath = path.join(process.cwd(), 'latest.json');
  fs.writeFileSync(outPath, JSON.stringify(latestJson, null, 2));
  console.log(`Generated latest.json at ${outPath}:`, latestJson);

  // Upload/overwrite latest.json in the release
  const existingLatestAsset = assets.find(a => a.name === 'latest.json');
  if (existingLatestAsset) {
    console.log(`Deleting existing latest.json asset (${existingLatestAsset.id})...`);
    const delRes = await fetch(`https://api.github.com/repos/${repo}/releases/assets/${existingLatestAsset.id}`, {
      method: 'DELETE',
      headers
    });
    if (!delRes.ok) {
      console.error(`Failed to delete existing latest.json: ${delRes.statusText}`);
    }
  }

  // Upload new latest.json
  console.log('Uploading new latest.json to release...');
  const uploadUrl = release.upload_url.replace('{?name,label}', '?name=latest.json');
  const uploadHeaders = {
    ...headers,
    'Content-Type': 'application/json',
    'Content-Length': fs.statSync(outPath).size
  };

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: uploadHeaders,
    body: fs.readFileSync(outPath)
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    console.error(`Failed to upload latest.json: ${uploadRes.statusText}`, errorText);
    process.exit(1);
  }

  console.log('Successfully uploaded combined latest.json to GitHub Release!');
}

main().catch(err => {
  console.error('Fatal error combining latest.json:', err);
  process.exit(1);
});
