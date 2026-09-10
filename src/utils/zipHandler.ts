import JSZip from 'jszip';
import { ExtractedFile, ProjectMetadata } from '../types';

const TEXT_EXTENSIONS = new Set([
  'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'md', 'txt',
  'svg', 'xml', 'yaml', 'yml', 'env', 'gitignore', 'toml', 'sql', 'sh'
]);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'avif'
]);

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts.pop()?.toLowerCase() || '';
  }
  return '';
}

export function isTextFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return TEXT_EXTENSIONS.has(ext);
}

export function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return IMAGE_EXTENSIONS.has(ext);
}

export async function processZipFile(
  fileOrBuffer: File | ArrayBuffer | Blob,
  fileName: string
): Promise<{ files: ExtractedFile[]; metadata: ProjectMetadata; zipInstance: JSZip }> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(fileOrBuffer);

  const files: ExtractedFile[] = [];
  let totalSize = 0;
  let fileCount = 0;
  let hasIndexHtml = false;
  const detectedTech = new Set<string>();

  const entries = Object.keys(loadedZip.files);

  for (const relativePath of entries) {
    const entry = loadedZip.files[relativePath];
    if (entry.dir) continue;

    // Ignore __MACOSX or hidden desktop junk
    if (relativePath.includes('__MACOSX') || relativePath.includes('.DS_Store')) {
      continue;
    }

    fileCount++;
    const ext = getFileExtension(entry.name);
    const shortName = entry.name.split('/').filter(Boolean).pop() || entry.name;

    if (shortName.toLowerCase() === 'index.html') {
      hasIndexHtml = true;
    }

    if (['ts', 'tsx'].includes(ext)) detectedTech.add('TypeScript');
    if (['jsx', 'tsx'].includes(ext)) detectedTech.add('React');
    if (['vue'].includes(ext)) detectedTech.add('Vue');
    if (ext === 'html') detectedTech.add('HTML5');
    if (ext === 'css') detectedTech.add('CSS3');
    if (['js', 'mjs'].includes(ext)) detectedTech.add('JavaScript');
    if (shortName === 'package.json') detectedTech.add('Node.js');
    if (shortName === 'tailwind.config.js' || shortName === 'tailwind.config.ts') detectedTech.add('Tailwind');
    if (['py'].includes(ext)) detectedTech.add('Python');

    let content: string | undefined;
    let blobUrl: string | undefined;

    try {
      if (isTextFile(entry.name)) {
        content = await entry.async('string');
        const size = content.length;
        totalSize += size;
        files.push({
          name: shortName,
          path: relativePath,
          size,
          isDirectory: false,
          content,
          extension: ext,
          modifiedTime: entry.date,
        });
      } else if (isImageFile(entry.name)) {
        const blob = await entry.async('blob');
        totalSize += blob.size;
        blobUrl = URL.createObjectURL(blob);
        files.push({
          name: shortName,
          path: relativePath,
          size: blob.size,
          isDirectory: false,
          blobUrl,
          extension: ext,
          modifiedTime: entry.date,
        });
      } else {
        // Binary generic file
        const blob = await entry.async('blob');
        totalSize += blob.size;
        files.push({
          name: shortName,
          path: relativePath,
          size: blob.size,
          isDirectory: false,
          extension: ext,
          modifiedTime: entry.date,
        });
      }
    } catch (e) {
      console.warn(`Error reading file ${relativePath}`, e);
    }
  }

  // Sort files: directories first by path, then files alphabetically
  files.sort((a, b) => a.path.localeCompare(b.path));

  const metadata: ProjectMetadata = {
    fileName,
    totalSize,
    fileCount,
    hasIndexHtml,
    detectedTech: Array.from(detectedTech),
    mainEntry: files.find(f => f.name.toLowerCase() === 'index.html')?.path,
  };

  return { files, metadata, zipInstance: loadedZip };
}

/**
 * Builds a bundled HTML document for iframe live preview
 * with inline replacement of linked CSS, JS, and image blobs.
 */
export function buildPreviewDoc(files: ExtractedFile[], activeHtmlPath?: string): string {
  const htmlFile = activeHtmlPath 
    ? files.find(f => f.path === activeHtmlPath)
    : files.find(f => f.name.toLowerCase() === 'index.html') || files.find(f => f.extension === 'html');

  if (!htmlFile || !htmlFile.content) {
    return `<!DOCTYPE html>
<html>
<head><style>body{font-family:sans-serif;padding:30px;color:#666;text-align:center;}</style></head>
<body>
  <h3>No HTML entry file found</h3>
  <p>Select an HTML file from the explorer to preview it.</p>
</body>
</html>`;
  }

  let html = htmlFile.content;

  // Create a map of paths to files
  const fileMap = new Map<string, ExtractedFile>();
  for (const f of files) {
    fileMap.set(f.path, f);
    fileMap.set(f.name, f);
  }

  // Replace <link rel="stylesheet" href="..."> with inline styles
  html = html.replace(/<link\s+[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (match, cssPath) => {
    const cleanPath = cssPath.replace(/^\.?\//, '');
    const found = fileMap.get(cleanPath) || files.find(f => f.path.endsWith(cleanPath));
    if (found && found.content) {
      return `<style>/* Inlined from ${cleanPath} */\n${found.content}\n</style>`;
    }
    return match;
  });

  // Replace <script src="..."> with inline scripts if found
  html = html.replace(/<script\s+[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/gi, (match, jsPath) => {
    const cleanPath = jsPath.replace(/^\.?\//, '');
    const found = fileMap.get(cleanPath) || files.find(f => f.path.endsWith(cleanPath));
    if (found && found.content) {
      return `<script>/* Inlined from ${cleanPath} */\n${found.content}\n</script>`;
    }
    return match;
  });

  // Replace images with blob URLs if available
  html = html.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi, (match, imgSrc) => {
    const cleanPath = imgSrc.replace(/^\.?\//, '');
    const found = fileMap.get(cleanPath) || files.find(f => f.path.endsWith(cleanPath));
    if (found && found.blobUrl) {
      return match.replace(imgSrc, found.blobUrl);
    }
    return match;
  });

  return html;
}

/**
 * Creates a sample demo zip file in memory for instant testing
 */
export async function createDemoZip(): Promise<{ blob: Blob; fileName: string }> {
  const zip = new JSZip();

  const htmlContent = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>माई डेमो ऐप (Demo Web App)</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="card">
    <div class="badge">डेमो एप्लिकेशन</div>
    <h1>नमस्ते! आपका ऐप तैयार है 🎉</h1>
    <p>यह ZIP फ़ाइल से एक्सट्रैक्ट किया गया एक लाइव डेमो प्रोजेक्ट है। आप इसका कोड देख सकते हैं और इसमें बदलाव कर सकते हैं।</p>
    
    <div class="interactive-box">
      <div class="counter-display">
        <span>क्लिक्स की संख्या:</span>
        <strong id="counter-val">0</strong>
      </div>
      <div class="btn-row">
        <button id="btn-add">+ जोड़ें</button>
        <button id="btn-reset" class="btn-outline">रीसेट</button>
      </div>
    </div>

    <div class="status-note">
      💡 <b>टिप:</b> कोड एडिटर टैब में जाकर <code>style.css</code> या <code>script.js</code> को एडिट करें और बदलाव तुरंत देखें!
    </div>
  </div>

  <script src="script.js"></script>
</body>
</html>`;

  const cssContent = `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body {
  background: #f1f5f9;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.card {
  background: #ffffff;
  max-width: 480px;
  width: 100%;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
}

.badge {
  display: inline-block;
  background: #e0e7ff;
  color: #4338ca;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 9999px;
  margin-bottom: 16px;
}

h1 {
  color: #0f172a;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 12px;
  line-height: 1.3;
}

p {
  color: #475569;
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 24px;
}

.interactive-box {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.counter-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  color: #334155;
  margin-bottom: 16px;
}

.counter-display strong {
  font-size: 28px;
  color: #2563eb;
}

.btn-row {
  display: flex;
  gap: 12px;
}

button {
  flex: 1;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

button:hover {
  background: #1d4ed8;
}

.btn-outline {
  background: transparent;
  color: #64748b;
  border: 1px solid #cbd5e1;
}

.btn-outline:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.status-note {
  font-size: 13px;
  color: #64748b;
  background: #fef3c7;
  border: 1px solid #fde68a;
  padding: 12px 14px;
  border-radius: 8px;
  line-height: 1.5;
}`;

  const jsContent = `let count = 0;
const counterEl = document.getElementById('counter-val');
const btnAdd = document.getElementById('btn-add');
const btnReset = document.getElementById('btn-reset');

if (btnAdd && counterEl) {
  btnAdd.addEventListener('click', () => {
    count++;
    counterEl.textContent = count;
  });
}

if (btnReset && counterEl) {
  btnReset.addEventListener('click', () => {
    count = 0;
    counterEl.textContent = count;
  });
}`;

  const readmeContent = `# Demo Web Project
इस प्रोजेक्ट में शामिल हैं:
- index.html: मुख्य वेबपेज
- style.css: स्टाइलिंग और लेआउट
- script.js: इंटरएक्टिव काउंटर लॉजिक

आप फ़ाइल एडिटर में जाकर इनमें कोई भी बदलाव कर सकते हैं और संशोधित ZIP डाउनलोड कर सकते हैं!`;

  zip.file('index.html', htmlContent);
  zip.file('style.css', cssContent);
  zip.file('script.js', jsContent);
  zip.file('README.md', readmeContent);

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, fileName: 'demo-sample-app.zip' };
}

/**
 * Downloads the modified files as a newly zipped archive
 */
export async function exportModifiedZip(files: ExtractedFile[], zipName: string) {
  const zip = new JSZip();

  for (const f of files) {
    if (f.content !== undefined) {
      zip.file(f.path, f.content);
    } else if (f.blobUrl) {
      try {
        const resp = await fetch(f.blobUrl);
        const blob = await resp.blob();
        zip.file(f.path, blob);
      } catch (e) {
        console.warn(`Could not fetch blob for ${f.path}`, e);
      }
    }
  }

  const generatedBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(generatedBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = zipName.replace(/\.zip$/i, '') + '-updated.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}
