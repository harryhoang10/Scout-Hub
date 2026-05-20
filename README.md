<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c182f757-618a-4f68-89fd-0458ea2c603e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Start the app, then add your Gemini API key in `Cài đặt`. The key is stored in browser `localStorage`, not bundled into the frontend build.
3. If you use TikTok metrics, add one or many RapidAPI keys in `Cài đặt` (one key per line). The app will rotate keys automatically when one key hits quota.
4. Use cached scraping for repeated checks, or enable `Làm mới dữ liệu` in the extractor when you need fresh profile data.
5. Run the app:
   `npm run dev`
