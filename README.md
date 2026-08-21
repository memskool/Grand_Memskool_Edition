# Memskool_02

Hey, broo 🤗, hope Ur good. I need u to help build a master platform called Memskool. It's an eschool system. I'll be providing prompts that u can follow and build, let's begin: Project Name: Memskool. 

Goal: Build a Google-product-level digital education ecosystem. We are using Next.js, Tailwind CSS, and Supabase. 

For this first phase, build the foundational architecture, authentication, and the core UI shell. 

1. Initialize a clean, modern, minimalist UI (think Google Workspace or Material Design 3). 

2. Set up Supabase Authentication with distinct user roles: Student, Teacher, Parent, and Admin.

3. Create a unified responsive sidebar navigation with the following items: Dashboard, Locker, Missed Work, Virtual Classroom, Library, Assessments, Dream School, and Settings.

4. Build customized dashboard landing pages for each of the 4 roles. 

   - Students should see a summary of upcoming classes, pending assignments, and recent locker additions.

   - Teachers should see their daily timetable, pending grading, and active classes.

   - Parents should see their child's attendance summary and weekly performance report.

5. Set up the foundational Supabase database schema (Profiles, Classes, Subjects) and ensure Row Level Security (RLS) is configured so users only see their own data.

Write clean, modular components. Do not mock data with static arrays—set up the actual database connections and state management.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4b439e00-05c5-4bfd-a8e9-8d6922926738).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
