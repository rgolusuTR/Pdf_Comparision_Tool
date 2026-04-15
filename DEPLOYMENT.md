# Deployment Guide

This guide provides step-by-step instructions to deploy the PDF Comparison Tool to a live URL.

## Option 1: Deploy to Vercel (Recommended for Next.js)

Vercel is the recommended platform for Next.js applications and offers free hosting.

### Steps:

1. **Go to Vercel**: Visit [https://vercel.com](https://vercel.com)

2. **Sign Up/Login**: 
   - Click "Sign Up" or "Login"
   - Choose "Continue with GitHub" to connect your GitHub account

3. **Import Project**:
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Find and select `rgolusuTR/Pdf_Comparision_Tool`
   - Click "Import"

4. **Configure Project**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `.next` (auto-filled)
   - **Install Command**: `npm install` (auto-filled)

5. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes for the build to complete

6. **Get Your URL**:
   - Once deployed, you'll receive a URL like: `https://pdf-comparision-tool.vercel.app`
   - You can also set up a custom domain if desired

### Automatic Deployments

After the initial setup, Vercel will automatically deploy:
- Every push to the `main` branch
- Every pull request (as a preview deployment)

---

## Option 2: Deploy to Netlify

Netlify is another excellent option for hosting Next.js applications.

### Steps:

1. **Go to Netlify**: Visit [https://www.netlify.com](https://www.netlify.com)

2. **Sign Up/Login**: 
   - Click "Sign Up" or "Login"
   - Choose "GitHub" to connect your account

3. **Import Project**:
   - Click "Add new site" → "Import an existing project"
   - Choose "GitHub"
   - Select `rgolusuTR/Pdf_Comparision_Tool`

4. **Configure Build Settings**:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
   - Click "Deploy site"

5. **Get Your URL**:
   - You'll receive a URL like: `https://pdf-comparision-tool.netlify.app`

---

## Option 3: GitHub Pages (Static Export)

For GitHub Pages, you need to export the Next.js app as static HTML.

### Steps:

1. **Update `next.config.mjs`** to add static export:
   ```javascript
   const nextConfig = {
     output: 'export',
     images: {
       unoptimized: true,
     },
   };
   ```

2. **Build the static site**:
   ```bash
   npm run build
   ```

3. **Deploy to GitHub Pages**:
   - Go to your repository settings
   - Navigate to "Pages"
   - Select source: "GitHub Actions" or "Deploy from a branch"
   - Select branch: `main` and folder: `/out`

4. **Your URL will be**: `https://rgolusutr.github.io/Pdf_Comparision_Tool/`

---

## Recommended: Vercel Deployment

**Vercel is the best option** because:
- ✅ Built by the creators of Next.js
- ✅ Zero configuration needed
- ✅ Automatic deployments on git push
- ✅ Free SSL certificates
- ✅ Global CDN
- ✅ Serverless functions support
- ✅ Free tier is generous

**Expected URL**: `https://pdf-comparision-tool.vercel.app` (or similar)

---

## After Deployment

Once deployed, update the README.md with your live URL:

```markdown
## Live Demo

🔗 **[View Live Application](https://your-app-url.vercel.app)**
```

---

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Ensure Node.js version is compatible (v18+)
- Review build logs for specific errors

### App Doesn't Load
- Check browser console for errors
- Verify all environment variables are set (if any)
- Ensure PDF.js worker files are properly loaded

### Performance Issues
- Enable Next.js Image Optimization
- Use Vercel's Edge Network
- Implement lazy loading for heavy components