# Admin Panel Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold the SvelteKit admin app under `admin/` using the official CLI and install dependencies.

**Architecture:** Use the SvelteKit skeleton template with TypeScript, ESLint, and Prettier enabled. Keep the generated output as-is with no extra libraries or config changes.

**Tech Stack:** SvelteKit, TypeScript, ESLint, Prettier, npm.

---

### Task 1: Scaffold SvelteKit admin app

**Files:**
- Create: `admin/`

**Step 1: Scaffold the app**

Run: `npm create svelte@latest admin`
Expected: Interactive prompts appear; choose Skeleton, TypeScript, ESLint, Prettier, and no additional libraries. `admin/` is created.

**Step 2: Install dependencies**

Run: `npm --prefix admin install`
Expected: `admin/node_modules` created without errors.

**Step 3: Verify scaffold (basic)**

Run: `ls admin`
Expected: Standard SvelteKit files like `src/`, `package.json`, and `svelte.config.js` exist.

**Step 4: Commit**

```bash
git add admin
git commit -m "chore: scaffold admin dashboard app"
```
