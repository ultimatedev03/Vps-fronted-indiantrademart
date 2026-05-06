import fs from 'fs';
import path from 'path';

function resolveFrontendDir() {
  const override = String(process.env.FRONTEND_DIR || '').trim();
  const candidates = [
    override ? path.resolve(process.cwd(), override) : null,
    process.cwd(),
    path.join(process.cwd(), 'frontend'),
  ].filter(Boolean);

  return (
    candidates.find((candidate) => fs.existsSync(path.join(candidate, 'src')) && fs.existsSync(path.join(candidate, 'public'))) ||
    process.cwd()
  );
}

function walkFiles(rootDir, allowedExtensions = new Set()) {
  const results = [];

  if (!fs.existsSync(rootDir)) return results;

  const visit = (currentDir) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (allowedExtensions.size > 0 && !allowedExtensions.has(ext)) continue;
      results.push(fullPath);
    }
  };

  visit(rootDir);
  return results;
}

function scanPagesForHelmet(pagesDir) {
  const pages = [];

  // Find all JSX/TSX files in src/pages directory
  const pageFiles = walkFiles(pagesDir, new Set(['.jsx', '.tsx']));

  for (const file of pageFiles) {
    const content = fs.readFileSync(file, 'utf8');

    // Check if file contains Helmet
    if (content.includes('<Helmet') || content.includes('Helmet>')) {
      const relativePath = path.relative(pagesDir, file);
      const urlPath = relativePath
        .replace(/\.(jsx|tsx)$/, '')
        .replace(/index$/, '')
        .replace(/\\/g, '/');

      // Extract title and description
      const titleMatch = content.match(/<title>(.*?)<\/title>/);
      const descMatch = content.match(/name="description"\s+content="(.*?)"/);

      pages.push({
        path: `/${urlPath}`,
        title: titleMatch ? titleMatch[1] : '',
        description: descMatch ? descMatch[1] : ''
      });
    }
  }

  return pages;
}

function extractRoutesFromApp(appJsxPath) {
  const routes = [];

  if (!fs.existsSync(appJsxPath)) {
    console.warn(`⚠️  App file not found: ${appJsxPath}`);
    return routes;
  }

  const content = fs.readFileSync(appJsxPath, 'utf8');

  // Simple regex to find Route components
  const routeMatches = content.matchAll(/<Route\s+path="([^"]+)"\s+element/g);

  for (const match of routeMatches) {
    routes.push(match[1]);
  }

  return routes;
}

function generateLlmsTxt(pages, routes) {
  let llmsContent = `# Indian Trade Mart - Website Guide for AI\n\n`;
  llmsContent += `This file provides information about the Indian Trade Mart website structure and content for AI crawlers.\n\n`;

  llmsContent += `## Website Overview\n\n`;
  llmsContent += `Indian Trade Mart is a B2B marketplace platform connecting buyers and suppliers across India.\n\n`;

  llmsContent += `## Main Sections\n\n`;
  llmsContent += `### Key Pages\n\n`;

  // Helmet pages (if found)
  for (const page of pages) {
    llmsContent += `- ${page.path}`;
    if (page.title) llmsContent += ` - ${page.title}`;
    if (page.description) llmsContent += ` (${page.description})`;
    llmsContent += `\n`;
  }

  llmsContent += `\n### Application Routes\n\n`;
  const uniqueRoutes = [...new Set(routes)].filter(route =>
    !pages.some(page => page.path === route)
  );

  for (const route of uniqueRoutes) {
    llmsContent += `- ${route}\n`;
  }

  llmsContent += `\n## Important Notes\n\n`;
  llmsContent += `- Directory pages follow the pattern: /directory/{service}-in-{city}-{state}\n`;
  llmsContent += `- Vendor profiles: /directory/vendor/{vendorSlug}\n`;
  llmsContent += `- Product pages: /product/{productSlug}\n`;

  return llmsContent;
}

function main() {
  const frontendDir = resolveFrontendDir();
  const pagesDir = path.join(frontendDir, 'src', 'pages');
  const appJsxPath = path.join(frontendDir, 'src', 'App.jsx');

  console.log('🤖 Generating llms.txt...');

  // Scan pages for Helmet components
  const pages = fs.existsSync(pagesDir) ? scanPagesForHelmet(pagesDir) : [];
  if (pages.length === 0) {
    console.warn('⚠️  No pages with Helmet components found. Generating minimal llms.txt (build will continue).');
  }

  // Extract routes from App.jsx
  const routes = extractRoutesFromApp(appJsxPath);

  // Generate llms.txt content
  const llmsContent = generateLlmsTxt(pages, routes);

  // Write to public directory
  const publicDir = path.join(frontendDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const llmsPath = path.join(publicDir, 'llms.txt');
  fs.writeFileSync(llmsPath, llmsContent);

  console.log(`✅ Generated llms.txt with ${pages.length} pages and ${routes.length} routes`);
  console.log(`📍 Location: ${llmsPath}`);
}

main();
