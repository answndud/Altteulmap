# AltteulMap DESIGN.md

## 1. Intent
- AltteulMap is a Korea-focused map product for finding budget-friendly neighborhood places and understanding representative prices quickly.
- The interface must feel like a credible utility product first, and a warm local discovery service second.
- The product should feel trustworthy enough that a user will reuse it before lunch, before running errands, or when comparing essential services nearby.

## 2. Reference Basis
- Live product reviewed: `https://altteulmap.altteul-lab.workers.dev/`
- `pbakaus/impeccable` is the reference for typography hierarchy, contrast discipline, spacing systems, motion timing, responsive behavior, and UX-writing rigor.
- `getdesign.md` and `VoltAgent/awesome-design-md` are the reference for how to structure an AI-agent-readable design document: plain language, explicit tokens, explicit component rules, explicit anti-patterns.
- Do not cargo-cult the visual styles of those references. Use them as craft and documentation references, not as brand references.

## 3. Product Personality
- Core feeling: `practical`, `trustworthy`, `clear`, `local`, `price-aware`
- Secondary feeling: `warm`, `human`, `grounded`
- This product should feel like:
  - a real map utility
  - a well-run local service
  - a structured price finder
- This product must not feel like:
  - a template dashboard
  - a lifestyle beige blog
  - a playful startup landing page
  - a civic-government relic
  - a card-stacked AI-generated app

## 4. Design Principles
- Map first. The first screen must clearly be a map product, not a landing page with a map buried below.
- Price first. Representative price is a primary visual signal, not tertiary metadata.
- Trust before charm. Clarity, recency, and verification cues matter more than decorative styling.
- One surface depth at a time. Avoid cards inside cards inside cards.
- Fewer, stronger choices. Use fewer sizes, fewer radii, fewer surface treatments, and more deliberate contrast.
- Warmth through material and tone, not through beige-on-beige contrast loss.
- Mobile must feel intentionally adapted, not desktop squeezed into a sheet.

## 5. Visual System

### 5.1 Color
- Use tinted neutrals, not pure grayscale.
- Base neutrals:
  - `--bg-canvas: #f4f1ec`
  - `--bg-surface: #fffdf9`
  - `--bg-subtle: #f0ebe4`
  - `--border-subtle: #ddd3c6`
  - `--border-strong: #b7a996`
  - `--text-strong: #171411`
  - `--text-primary: #2a241f`
  - `--text-secondary: #62584d`
  - `--text-tertiary: #897d70`
- Brand accent:
  - `--accent-600: #b55a2b`
  - `--accent-700: #97461d`
  - `--accent-050: #fbf0e8`
  - `--accent-100: #f4dfd2`
- Semantic colors:
  - success: deep jade, not neon green
  - warning: baked amber
  - error: muted brick red
  - info: steel blue
- Category marker colors:
  - food: terracotta
  - 생활서비스: slate blue
  - 장보기/생활용품: moss green
  - 건강: jade green
  - 업무/학습: indigo
- Cluster color:
  - neutral ivory shell + warm stone core + dark ink text
- Contrast rule:
  - never place medium gray text on tinted backgrounds
  - selected states must differ in background, border, and text, not just one dimension

### 5.2 Typography
- Use a fixed application scale, not fluid type, following `impeccable` guidance for app UIs.
- Recommended families:
  - UI: `IBM Plex Sans KR`
  - Numeric/data accents: `IBM Plex Mono`
- Use tabular numerals for prices, counts, and stats.
- Scale:
  - `xs: 12/18`
  - `sm: 14/20`
  - `base: 16/24`
  - `lg: 20/28`
  - `xl: 28/36`
  - `2xl: 36/44`
- Roles:
  - eyebrow/meta: `xs`
  - supporting UI and badges: `sm`
  - body and forms: `base`
  - section titles: `lg`
  - page titles: `xl`
- Rules:
  - no crowd of adjacent sizes like 14, 15, 16, 18
  - page titles and section titles need stronger contrast in size and spacing
  - price numerals should be semibold monospace or tabular sans treatment

### 5.3 Spacing
- Use a 4pt base scale per `impeccable spatial-design`.
- Tokens:
  - `4, 8, 12, 16, 24, 32, 48, 64`
- Vertical rhythm:
  - body text and form rows align to 24px rhythm
  - section gaps should not collapse into arbitrary values
- Use `gap`, not stacked `space-y-*` utilities as the default relationship tool.

### 5.4 Radius
- Radius system:
  - `sm: 10px`
  - `md: 14px`
  - `lg: 18px`
  - `xl: 24px`
- Buttons: `14px`
- Cards and sheets: `18px`
- Inputs: `14px`
- Avoid `30px+` random rounded corners unless it is a deliberate bottom-sheet edge or map bubble.

### 5.5 Borders and Elevation
- Border-first system. Shadows are secondary.
- Standard border: `1px solid var(--border-subtle)`
- Active border: `1.5px or 2px solid` accent or strong neutral
- Elevation scale:
  - `surface`: none or `0 1px 2px rgba(23,20,17,0.04)`
  - `overlay`: `0 8px 24px rgba(23,20,17,0.10)`
  - `modal/sheet`: `0 16px 40px rgba(23,20,17,0.16)`
- If a shadow is visually obvious, reduce it.

### 5.6 Motion
- Use `impeccable` timing rules:
  - `120ms` for tap/hover feedback
  - `220ms` for chip/filter/state changes
  - `320ms` for drawers, sheets, and panel transitions
- Easing:
  - enter: `cubic-bezier(0.16, 1, 0.3, 1)`
  - exit: `cubic-bezier(0.7, 0, 0.84, 0)`
- Animate `opacity` and `transform` only.
- No bounce, elastic, or playful overshoot.

## 6. Layout and Responsive Rules

### 6.1 Desktop
- The map page is the homepage.
- Above the fold layout:
  - header
  - compact search/filter control bar
  - map/list shell
- Use a 12-column layout.
- Desktop map shell target split:
  - map: 8 columns
  - list: 4 columns
- The map must remain visually dominant even when list or detail is open.
- Detail on desktop should open as a right rail or split panel, not as a blocking modal.

### 6.2 Mobile
- Mobile is not a compressed desktop.
- Top area should contain:
  - header
  - one compact search field
  - one filter entry point
- Map should start within the first viewport.
- List should open as a bottom sheet with clear close, drag handle, and visible top context.
- When a place is selected, the detail sheet should stop below the browser top chrome and preserve map awareness.
- The mobile sheet must use safe-area padding.

### 6.3 Container Behavior
- Use container queries for cards and list cells where practical.
- Card layouts should adapt to their container width, not only viewport width.

## 7. Information Architecture

### 7.1 Global Navigation
- Keep the public header lean:
  - logo
  - search entry
  - 장소 등록
  - 북마크
  - auth/profile
- Admin entry should not live as equal-weight primary nav in public mode. Put it behind profile/admin utility.
- Remove duplicate CTA clusters from page bodies when the header already owns the action.

### 7.2 Homepage / Map Exploration
- The homepage is not a marketing page.
- Above the fold:
  - compact value statement only if needed
  - search bar
  - filter bar
  - map/list shell
- Move trending/recommended content below the core map shell or behind a tab.
- Do not place explanatory prose above the main interaction area.

### 7.3 Filter Architecture
- Stop presenting 18 categories as a flat chip wall.
- Use two levels:
  - primary groups: `전체`, `요식업`, `생활서비스`, `장보기/생활용품`, `건강`, `업무/학습`
  - optional subcategory refinement inside a drawer/panel
- On desktop, show top groups inline and subcategories in a secondary collapsible tray.
- On mobile, use a filter drawer with active selections summarized in one line.
- Active filters must always remain visible as removable tokens.

### 7.4 Search UX
- One search field, one scope selector, one refresh action.
- Scope should be a segmented control, not duplicated radio/chip blocks.
- `현재 지도에서 찾기` action appears only when the viewport is dirty.
- Search placeholder should reference real use cases:
  - `김밥, 세탁소, 프린트, 약국`
- Search results must show the current context in one concise status row.

### 7.5 Map and List Relationship
- Marker mode must remain exclusive:
  - overview = clusters only
  - focused/search = place markers only
- List and map must always reference the same result set.
- The list should not read like a second-class appendix. It is the verification layer for what the map is showing.
- On desktop, list cards should be scan-friendly and price-led.
- On mobile, list should be opened on demand and closed easily.

### 7.6 Place Card Structure
- Order:
  - representative price
  - place name
  - category + district
  - trust row: updated date, verified status, reactions if needed
- Price block must be the visual anchor.
- Use one secondary action row only:
  - bookmark
  - share
- Remove placeholder skeleton buttons that reserve action space when unnecessary.

### 7.7 Place Detail
- Top block:
  - representative price
  - place name
  - category and district
  - updated date and verification state
- Mid block:
  - price items
  - report new price
  - address and map context
- Lower block:
  - comments
  - report issue
- Generic labels like `상세 정보` should not consume the first visible space.
- On mobile, the first visible content must be price + name, not a generic drawer header.

## 8. Component Rules

### 8.1 Buttons
- Primary button:
  - solid accent
  - medium weight
  - 44px minimum height
- Secondary button:
  - neutral surface with border
- Tertiary button:
  - text only, used sparingly
- Never mix multiple button aesthetics on the same screen.

### 8.2 Chips and Segmented Controls
- Chips are rectangular rounded controls, not candy pills.
- Default:
  - white surface
  - subtle border
  - dark text
- Active:
  - accent background or accent-tinted background
  - strong border
  - dark or white text with real contrast
- Scope selector should be a true segmented control, not a chip row pretending to be one.

### 8.3 Cards
- Cards exist only when content needs a shared boundary.
- No nested cards.
- If a page already uses a bounded main surface, internal sections should mostly use dividers and spacing.

### 8.4 Form Controls
- Inputs:
  - 48px minimum height
  - left-aligned text
  - muted border, strong focus ring
- Labels stay outside the field.
- Helper text is one line and specific.
- Errors answer:
  - what is wrong
  - how to fix it
- Do not wrap every field in its own decorative box.

### 8.5 Badges
- Use badges for:
  - verified
  - updated recently
  - source/trust metadata
- Badges should be compact and semantic, not ornamental.

### 8.6 Icons
- Use a consistent 1.75-2px stroke icon set.
- Avoid mixing playful filled icons with rigid outline icons.
- Map-specific icons can be slightly heavier for legibility.

### 8.7 Map Pins
- Cluster:
  - neutral, non-category-coded
  - circular, high legibility number
- Place pin:
  - category-coded
  - white outline or halo
  - selected state expands or brightens, but does not become a different language
- If price is shown in-marker, only selected marker gets an expanded price label.

### 8.8 Empty / Loading / Error States
- Loading:
  - skeletons or lightweight placeholders
  - no generic “불러오는 중” repeated across multiple layers
- Empty:
  - explain whether there are no results in this map, this search, or this category
  - offer one next step
- Error:
  - say what failed
  - say whether retrying helps
  - give one clear recovery action

## 9. Submission Flow

### 9.1 Goal
- Contribution should feel like helping the map stay useful, not like filling an operations console.

### 9.2 Flow Structure
- Step 1: place basics
  - 장소 이름
  - 카테고리
  - 주소
  - 지역
- Step 2: representative price
  - one required price item
  - label + amount + unit
- Step 3: optional detail
  - more price items
  - note
  - when checked
  - how the price was confirmed

### 9.3 Progressive Disclosure
- Show one required price item first.
- `가격 더 추가` reveals additional rows.
- Advanced details stay collapsed by default.

### 9.4 Representative Price Input
- The first item defines the representative price candidate.
- Make that explicit in UI copy:
  - `가장 먼저 보이는 가격`
  - `사용자가 가장 빠르게 판단할 가격`
- Use category-aware examples.

### 9.5 Multiple Price Items
- Treat extra items as supportive detail, not equal-weight required data.
- Add/remove row pattern:
  - simple
  - inline
  - no card nesting per row

### 9.6 Validation and Helper Text
- Keep helper copy short and concrete.
- Examples:
  - `도로명 주소 기준으로 적어주세요`
  - `가격은 숫자만 입력`
  - `대표 메뉴나 가장 많이 찾는 서비스를 먼저 적어주세요`
- Error copy should be direct:
  - `가격을 입력해주세요`
  - `주소가 너무 짧습니다`

### 9.7 Trust-Building Metadata
- Optional metadata fields:
  - 확인 시점
  - 확인 방법: `현장 메뉴판`, `영수증`, `직접 이용`
  - 메모
- Submission success state should explain:
  - what was received
  - what happens next
  - what will appear after review

## 10. Copy Tone
- Tone is grounded, practical, and observant.
- Use Korean product language, not admin jargon.
- Prefer action + object labels:
  - `장소 등록`
  - `가격 추가`
  - `이 지역 다시 찾기`
  - `가격 보기`
- Avoid vague labels:
  - `상세`
  - `확인`
  - `제출`
  - `완료`
- Do not over-explain obvious actions.
- Do not use hype language or friendly filler.

## 11. Do / Don’t

### Do
- Keep the first viewport map-dominant.
- Make price the strongest repeated element in cards and details.
- Use fewer surfaces with stronger hierarchy.
- Group categories into a usable taxonomy.
- Use explicit state changes for selected filters.
- Keep mobile overlays visibly dismissible.
- Use tabular numerals and strong date/trust metadata.

### Don’t
- Don’t stack large rounded cards inside large rounded cards.
- Don’t rely on beige-on-beige contrast.
- Don’t mix cluster markers and place markers in the same view mode.
- Don’t make every page start with explanatory copy.
- Don’t treat submission like an admin CRUD form.
- Don’t show the same CTA in header and page body with equal weight.
- Don’t use decorative gradients as a substitute for hierarchy.

## 12. Implementation Rules For AI Agents
- Build tokens first, then layout primitives, then page components.
- Replace one-off utility clusters with semantic component classes or tokenized variants.
- Standardize spacing before color tuning.
- Remove duplicate surfaces before adding any new visual flourish.
- When redesigning a page, start by deleting non-essential copy and nested wrappers.
- Every new component must declare:
  - density
  - hierarchy role
  - mobile behavior
  - empty/error/loading behavior
- If a design choice is ambiguous, prefer clarity and trust over delight.

