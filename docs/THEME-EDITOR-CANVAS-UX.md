# Store Designer Canvas UX Roadmap

## Goal

Move Store Designer toward a Shopify-like editing model, but keep it simpler and easier for our project. The canvas should be the primary place to select, add, and edit storefront content. The left panel should only show focused controls for the selected page, section, block, or global style.

## Current Problems

- Editing is scattered between Settings, sidebars, page customizers, and preview controls.
- Adding sections is too detached from the canvas position where the section will appear.
- Text editing should happen directly on the visible title/subtitle where possible.
- Alignment and spacing controls must change the real preview, not only save data.
- Footer/template placement needs to be obvious in both the canvas and left outline.

## UX Principles

1. Canvas first: click visible content to edit it.
2. Contextual left panel: show only controls for the selected item.
3. Boundary add actions: add buttons appear where new sections will be inserted.
4. Simple controls first: text, alignment, width, padding, color, and typography before advanced CSS.
5. One page picker: pages are selected from Store Designer, not hunted through Settings.
6. Preview must honor controls immediately.

## Implemented Now

- Searchable page picker in the Store Designer top bar.
- Inline canvas editing component for section title/subtitle text.
- Inline editing wired through hero, promo banners, trust/value props, countdown, product rows, category sections, newsletter, content grids, brand showcase, and recently viewed preview headings.
- Selected section left-panel controls for title, subtitle, alignment, and padding.
- Alignment and padding applied to the preview frame and supported section headings.
- Canvas boundary buttons between rendered sections:
  - Add section here
  - Add footer section here
- Footer-added sections receive `placement: footer` and render in the footer zone.
- Left outline separates template sections from footer sections.
- Left outline and preview canvas have insertion controls between every section row.
- Header editing follows a block model: announcement bar, logo, menu/category bar, and search/account/cart actions.
- Header preview click targets open the matching left-panel controls instead of one mixed header panel.
- Template/footer section reordering stays inside the correct placement group.
- Add Section dialog now describes the insertion target.

## Section Integration Contract

Every section component that shows editable text should support these props:

```jsx
onInlineFieldChange(sectionId, field, value)
onInlineFieldCommit()
```

Use `CanvasEditableText` for visible text fields:

```jsx
<CanvasEditableText
  section={section}
  field="title"
  preview={preview}
  onInlineFieldChange={onInlineFieldChange}
  onInlineFieldCommit={onInlineFieldCommit}
  variant="h6"
>
  {section.title || Products}
</CanvasEditableText>
```

## Next Work

- Add true block-level editing for footer blocks and rich text blocks.
- Add drag reorder directly on the canvas.
- Add width/max-width controls that affect section content containers.
- Replace the floating title/subtitle mini-form with block-aware controls for nested items.
- Add safe undo milestones for canvas text editing without saving every keystroke.
