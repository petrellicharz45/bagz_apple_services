# Home Header Redesign

## Goal
Update the top header of the Home screen to match the provided SHEIN-like UI mockup, introducing a reusable custom header component.

## Architecture & Layout
- **Component File**: Create a new reusable layout file `app/src/main/res/layout/layout_custom_header.xml`.
- **Structure**: 
  - A horizontal layout (e.g., `ConstraintLayout` or `LinearLayout`).
  - Left side: Mail icon (`ic_mail`), Calendar icon (`ic_calendar`).
  - Middle: Search bar (expanding to fill space, maintaining current rounded design with search/camera icons).
  - Right side: Heart/Wishlist icon (`ic_heart`).
- **Integration**: Use `<include>` tag in `fragment_home.xml` to replace the existing hardcoded search bar.

## Assets Needed
Generate standard Material Design vector drawables in `app/src/main/res/drawable/`:
1. `ic_mail_outline.xml`
2. `ic_calendar_outline.xml`
3. `ic_heart_outline.xml`

## Scope
This design is limited strictly to the top row (Icons + Search Bar). The tab layout immediately below it remains as-is in `fragment_home.xml` for now.
