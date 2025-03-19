# Vercel Configuration for Frontend Deployment

This document provides instructions for configuring and deploying the frontend chatbot interface to Vercel.

## Prerequisites

1. Create a Vercel account at [vercel.com](https://vercel.com) if you don't already have one
2. Deploy the backend to Heroku first (following the instructions in `heroku-config.md`)
3. Note the URL of your Heroku app (e.g., `https://your-app-name.herokuapp.com`)

## Configuration Steps

### 1. Prepare your project for deployment

Ensure your project has the following files:
- `package.json` with Next.js dependencies and build scripts
- `pages/index.js` and `pages/_app.js` 
- CSS files in the styles directory
- `.env.local` with the correct API URL

### 2. Deploy to Vercel

#### Option 1: Deploy using Vercel CLI

```bash
# Install Vercel CLI if you haven't already
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from the frontend directory
cd /path/to/frontend
vercel
```

Follow the prompts to configure your project.

#### Option 2: Deploy using Vercel Dashboard (Recommended)

1. Push your code to a GitHub repository
2. Log in to the Vercel dashboard
3. Click "New Project"
4. Import your GitHub repository
5. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: (leave blank if your Next.js files are at the root)
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

6. Add environment variables:
   - Click "Environment Variables"
   - Add `NEXT_PUBLIC_API_URL` with the value of your Heroku app URL

7. Click "Deploy"

### 3. Configure custom domain (Optional)

1. In the Vercel dashboard, go to your project
2. Click on "Domains"
3. Add your custom domain
4. Follow the instructions to configure DNS settings

### 4. Verify deployment

After deployment, Vercel will provide a URL for your application (e.g., `https://e-commerce-chatbot-demo.vercel.app`).

Visit this URL to verify that your frontend is working correctly and can communicate with the backend.

## Updating the API URL

If you need to update the API URL (e.g., if you redeploy the backend with a different name):

1. In the Vercel dashboard, go to your project
2. Click on "Settings" > "Environment Variables"
3. Update the `NEXT_PUBLIC_API_URL` value
4. Redeploy your application

## Troubleshooting

### Frontend can't connect to backend

If the frontend can't connect to the backend:
- Verify that the `NEXT_PUBLIC_API_URL` is correct
- Check that CORS is properly configured on the backend
- Ensure the backend is running and not in sleep mode

### Build errors

If you encounter build errors:
- Check the Vercel deployment logs
- Verify that all dependencies are correctly listed in `package.json`
- Ensure there are no syntax errors in your code

### Styling issues

If the styling doesn't look right:
- Verify that all CSS files are correctly imported
- Check for any CSS conflicts
- Inspect the page using browser developer tools

## Continuous Deployment

Vercel automatically sets up continuous deployment from your GitHub repository. Any changes pushed to the main branch will trigger a new deployment.

To disable automatic deployments:
1. Go to your project in the Vercel dashboard
2. Click on "Settings" > "Git"
3. Disable "Auto Deploy"
