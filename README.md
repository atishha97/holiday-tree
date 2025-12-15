# Holiday Ornament Message Board 🎄

A persistent, real-time holiday tree where users can hang ornaments and leave messages. Built with Vue.js, Tailwind CSS, and Firebase.

## Features
- **Real-time Persistence**: Ornaments and messages are stored in Firebase Firestore.
- **Drag & Drop**: Intuitive interface to decorate the tree.
- **Owner Controls**: Tree creators can rearrange and remove ornaments.
- **Authentication**: Google Sign-In support.

## Project Structure
This is a static web application. 
- `index.html`: Main entry point.
- `app.js`: Application logic (Vue 3).
- `assets/`: Images and fonts.

## Deployment (GitHub Pages)

This project is ready for GitHub Pages!

1.  **Push to GitHub**:
    ```bash
    git init
    git add .
    git commit -m "Initial deploy"
    git branch -M main
    # Create a new repo on GitHub, then run:
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
    git push -u origin main
    ```

2.  **Enable GitHub Pages**:
    - Go to your Repository Settings > Pages.
    - Select `main` branch as the source.
    - Save.

3.  **Update Firebase Auth**:
    - Go to Firebase Console > Authentication > Settings.
    - Add your new GitHub Pages domain (e.g., `yourname.github.io`) to "Authorized Domains".
