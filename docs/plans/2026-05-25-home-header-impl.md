# Home Header Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a reusable custom header layout with Mail, Calendar, and Heart icons alongside the search bar for the Home Screen.

**Architecture:** We will create standard Android vector drawables for the new icons, define a new `layout_custom_header.xml` layout, and `<include>` it inside `fragment_home.xml`.

**Tech Stack:** Android XML Layouts, Vector Drawables.

---

### Task 1: Create Icon Assets

**Files:**
- Create: `app/src/main/res/drawable/ic_mail_outline.xml`
- Create: `app/src/main/res/drawable/ic_calendar_outline.xml`
- Create: `app/src/main/res/drawable/ic_heart_outline.xml`

**Step 1: Write Vector Drawables**
Create the XML files for the three Material Design icons (Mail, Calendar, Favorite/Heart).

**Step 2: Commit**
```bash
git add app/src/main/res/drawable/ic_*.xml
git commit -m "feat: add mail, calendar, and heart outline icons"
```

### Task 2: Create Custom Header Layout

**Files:**
- Create: `app/src/main/res/layout/layout_custom_header.xml`

**Step 1: Write Layout XML**
Create `layout_custom_header.xml` using a horizontal `LinearLayout` containing:
- Mail ImageView
- Calendar ImageView
- The existing Search Bar layout logic (copied from `fragment_home.xml`)
- Heart ImageView

**Step 2: Commit**
```bash
git add app/src/main/res/layout/layout_custom_header.xml
git commit -m "feat: create custom header layout component"
```

### Task 3: Integrate Custom Header into Home Fragment

**Files:**
- Modify: `app/src/main/res/layout/fragment_home.xml`

**Step 1: Update Home Fragment Layout**
Replace the hardcoded `searchBarContainer` inside `homeHeader` with an `<include layout="@layout/layout_custom_header" />`.

**Step 2: Verify Build**
Run: `./gradlew assembleDebug`
Expected: Build successful (PASS)

**Step 3: Commit**
```bash
git add app/src/main/res/layout/fragment_home.xml
git commit -m "refactor: use custom header in home fragment"
```
