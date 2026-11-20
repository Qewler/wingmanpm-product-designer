# Landing pages that look authored

Mode: **Persuade**. In five seconds a first-time visitor knows what this is, why
it matters to them, and what to do next, and the page looks made by a studio, not
assembled from a kit. Protect real prices, legal terms, and claims. Never invent
logos, quotes, customer counts, or benchmarks. Demonstration data is design
material: author it in full and label it Sample.

## Art direction before layout

Polish without identity loses to a bold page with rough edges. Before any code:

1. **Find the world in the audience's own work.** Identity is won by the object
   the audience already handles, not by a generic family: a guidebook topo for
   climbers, a tachograph disc for a loading dock, a colour-coded file shelf
   for a vet clinic, a time-distance train graph for rail. A ledger notebook
   "would suit any logbook"; a departures board for a feedback tool is
   "borrowed". Write a worksheet (JSON, kept with your working files):
   - `brief`, `mechanism` (the product's mechanism in one sentence), `scene`
     (where the audience is when they need it);
   - `rut`: the page this category always ships, and the brief's literal
     metaphor (a product called Platform is not a station);
   - `candidates`: seven objects, documents, diagrams, tools, signs, or rituals
     the audience handles in its own work or hobby, first idea first. Each has
     `name`, `who` (who handles it, when), `looks` (ground, colours, type voice,
     the one mark that makes it recognisable), `family` (the nearest catalog
     family for form vocabulary, or `none`), and `scores`:
     `native` 0–2 (handled weekly by the audience), `verb` 0–2 (its own verb
     states the promise: posts, itemizes, files, records), `unswappable` 0–2
     (no other industry could front with it), `operable` 0–1 (a part the
     visitor can work: dial, tab, fader, stamp), `silhouette` 0–1 (recognisable
     at 200px: a disc, a wall drawing, a shelf of colour blocks, not rows in a
     box). Score honestly; the first idea is usually the category's obvious one.

   Run `concept <worksheet.json>`. It never deals the first idea or the rut,
   requires 6/8 with native, verb, and unswappable above zero, and names the
   world. If nothing passes, list objects closer to the audience's hands.
2. **Draw the form** for that world: `direction "<the brief>" --world "<world>"
   --family <family>`. Each option adds a composition, colour strategy, type,
   graphic device, and motion; the family supplies ground and faces. Pick the
   option that lets the object **display the product's own output** in the
   object's vocabulary (a dock day traced on the disc, a feedback request
   posted with its revenue). You may swap one axis; say why. Write the promise
   in the object's vocabulary and reuse it for the headline, section names, and
   labels. Do not open the headline with the "Every X, verbed." formula.
3. **Take the grid from the world**: the register's numbered columns, the
   drawing sheet's zones, the receipt's single column. Every section snaps to
   that one grid, so alignment comes from the concept instead of fighting it.
4. **Write five lines** in your working notes (not in the page):
   - **Thesis**: the product's mechanism in one sentence and what the page must prove.
   - **World**: the noun phrase, plus the chosen colour strategy, display and text faces,
     and one material quality.
   - **First viewport**: what sits where, at what scale, and where the primary action is.
   - **Signature**: the one product moment visitors will remember, built as working UI
     and driven by the visitor: one control they operate that changes the product
     scene and proves the thesis, with motion that shows the change. Autoplay alone
     reads as decoration.
   - **Refuse**: name the category default this page will not be.

**The world is the page's material, not a prop in the hero.** A device render
beside a headline, or a serif on a navy band, is a costume. The world is
committed when:

- the product scene is drawn *as* the world's artifact (the demo is the ledger,
  the receipt, the dial), with its real anatomy: columns, perforations, ticks,
  stamps, tabs, labels;
- the page ground, dividers, and section frames are made of the world's
  material (ruled paper, roll edges, enamel, card stock), not a neutral page
  with a themed card on it. Light mode means a light tint of that material
  (manila, ledger buff, enamel, newsprint), never a neutral near-white or pale
  grey; `direction` names the ground for each world;
- the signature control is a part of the artifact the visitor operates: the
  folder shelf is the record picker, the tape labels are the channel names, the
  fader is the mix. A demo drawn as a framed app panel next to the world is a
  costume, even for developer tools: the local UI wears the world's material;
- the artifact carries a human trace from that world, used as its labels:
  marker on tape, a pencil tick, a rubber stamp, a hand-filled form. It labels
  the object; headings stay in the display face;
- every standard part (how it works, pricing, FAQ, footer) takes a form from
  the world: a rate schedule, a price tag, a spec plate, margin notes, the end
  of the roll;
- the display face could have been printed on that artifact (signage, stencil,
  dot-matrix, typewriter, engraving, ledger heads), and the text face reads like
  the artifact's own body: a serif for clauses and columns in document worlds, a
  plain grotesk for instruments and panels. A neutral sans alone on a white
  sheet is a theme, not a world.

One world, no borrowed motifs: a patch bay does not grow sprocket holes, screw
heads, and receipts. Torn edges, perforations, and barcodes belong only to a
printout world; elsewhere they are the default "material" costume.

The concept frames the product; it never buries it. Keep the product's output
legible, two graphic devices at most, and every control obvious. Judges punish a
memorable concept that hides the product as hard as a forgettable page.

Never build these, whatever the palette (`direction` prints them too):

- **Split-straddle**: a two-line headline on the left, the lede and two buttons
  in a right column, and a framed app window straddling a full-bleed band below.
- **Centered stack**: a centered headline and buttons over a centered screenshot,
  then three equal icon cards.
- **Headline left, object right**: a big headline with lede and buttons on the
  left and a product card, device render, or document on the right, whatever
  the colours. Set the headline on, inside, or across the artifact instead.
- **Accent last line**: the last line or word of the headline switched to the
  accent colour. Emphasis comes from the world (a stamp, an underline rule, a
  printed total), not a colour swap.
- **Headline stack**: a giant full-width headline, then a row with the lede on
  the left and buttons on the right, then the demo panel below. Compose the fold
  from the world: the headline in the artifact's header, the action where the
  artifact puts its own (the total line, the stamp, the switch).
- **Split headline**: a headline broken in two with a product band, card, or
  strip laid between its lines (the gate fails `split-headline`). The headline
  is one block; the scene comes after it or behind it.
- **Pale panel**: a giant headline at top left on a pale grey or off-white page
  over a framed app panel, whatever the world (the gate warns `neutral-ground`).
- **The section kit**: numbered how-it-works rows, rounded pricing cards with
  one dark recommended plan, a plain chevron FAQ list, and a two-column footer
  in sequence. Keep their behaviour; give them the world's form.

## First viewport

- One `h1`, at most 8 words, in the product's own language. Ban: unlock, supercharge,
  seamless, revolutionize, effortless, next-generation, all-in-one, "AI-powered".
- One supporting sentence of at most 20 words. Two actions at most, the same height
  (40–48px), primary filled and secondary quiet. 35 words is the ceiling for all
  copy in the first viewport outside the product scene.
- Show the product working in the first viewport: an HTML scene with real-looking
  Sample data that shows input, transformation, and outcome. Wrap it in
  `<figure data-demo aria-label="…">` so its UI text counts as product, not copy.
  Not a screenshot, not a dashboard collage, not floating cards.
- One element at an extreme scale: the headline at 9vw or more, or the artifact
  cropping off the viewport edge. The headline is always the largest text in the
  first viewport; a total, price, or counter inside the artifact stays smaller
  than it (the gate fails `outsized-display`). Line-height 0.9–1.05, tracking
  −0.02 to −0.05em, `text-wrap: balance`. Break lines where the meaning breaks.
  A cropped artifact starts on the content grid and loses a decisive share (a
  quarter or more) off one edge, never a sliver that reads as an overflow.
- Reading order is headline, sentence, primary action, then the scene. The
  primary action sits directly under the sentence on the headline's left edge,
  or where the artifact puts its own action (the total line, the stamp), within
  a short glance of the headline: never in the opposite corner or below the
  scene (the gate fails `cta-far`).
- The composition comes from the chosen direction, not from habit. If the fold
  could swap logos with another product built from this skill, choose again.

## Page arc

Use five to seven sections. Each section does one job and has one `h2` of at
most 7 words, at most one sentence of at most 22 words, then the artifact itself.
Body copy for the whole page stays at or under 450 words. Never stack an `h2`,
an `h3`, a paragraph, and bullets.

The arc has these jobs; the chosen direction decides their shapes:

1. **Hero**: the thesis and the working scene.
2. **How it works**: one interactive sequence that drives the same product frame
   or object. Never three equal icon cards.
3. **Depth**: two or three capabilities at different scales, each shown by its
   own small product scene, specimen, or annotated detail.
4. **Trust**: real facts only: integrations, security posture, license, docs, repository.
5. **Pricing**, then a **FAQ**, then a closing action and the footer. These may
   take the world's materials (a price tag, a ledger line, a spec plate) as long
   as the parts below still hold.

At 390px, recompose: the headline sets at `clamp` minimum 2.5rem, actions go
full width, and the product scene shows one pane at a time with every control
inside the frame and at least 40px tall. Data tables become labelled stacks;
pricing becomes one full-width block per plan. Nothing is truncated or clipped,
including labels inside the product scene: wrap them, abbreviate them on
purpose, or reveal them on selection. A scroll-driven stage becomes a stepper
on phones, never a long empty panel. On desktop too, a sticky column never
leaves the other column with gaps taller than its content.

Pace the scroll: a dense section earns a quiet one; alternate full-bleed bands,
narrow reading columns, and wide grids. At least two sections break the
container (full bleed, an overlap, a sticky stage, or a cropped object), and
section shapes vary; seven stacked "heading over centered content" blocks read
as a template. Use one spacing scale (4px base). Section
padding is `clamp(4rem, 9vw, 8rem)`, with more space above a heading than below it.

## Parts

These are behaviour contracts. Their look comes from the world.

- **Nav**: 60–64px tall. Logo, at most 5 links, and one action at the same height
  as the secondary button. It is sticky and gains a border or surface only after
  scrolling. On mobile a menu button opens a sheet with every link and the action.
  The hero clears it by at least 0.4× the headline size. Logo, links, and action
  share one vertical centre (the gate warns `nav-misalign`).
- **Pricing**: one block per plan the brief gives (do not invent tiers), with
  actions aligned on a common baseline (`display:flex; flex-direction:column`
  and `margin-top:auto`). Emphasize the recommended plan with contrast, not
  scale. Prices use `tabular-nums`. At most 5 inclusions per plan.
- **FAQ**: a disclosure list with rows of at least 56px, real `button`
  triggers with `aria-expanded`, and height animated with
  `grid-template-rows: 0fr → 1fr`. Answers are at most 40 words.
- **Code** (developer tools): a palette-derived syntax theme. The copy button shows a
  "Copied" state for 1.5s with an `aria-live` announcement. Tabs are a segmented
  control.
- **Footer**: compact and muted, with 2–4 link columns and small legal text.

## Type and color

- Every family has one job you can name: display (the world's voice), text
  (reading), and at most one data face (mono or typewriter for the artifact's
  own values and metadata). Three families is the ceiling, and only one of them
  is ever set large in a viewport. Use the pair from the chosen direction.
- Character faces (dot-matrix, pixel, stencil, typewriter at display size) set
  the h1 and one signature line on the artifact, nothing else. Section heads,
  prices, times, counts, and every sentence use the text face, so numbers stay
  legible. A persuade page never sets its body copy in mono.
- Training-data defaults signal that nobody chose: Inter or DM Sans as display,
  Space Grotesk, Plus Jakarta Sans, Instrument Sans or Serif, Fraunces,
  Playfair. Use the display face's axes (width, optical size, weight) to make
  the extreme-scale moment feel drawn, not just enlarged.
- Body text is 16–18px with line-height 1.5–1.6, a measure of at most 68ch, and
  muted text at a contrast of at least 4.5:1.
- Apply the direction's colour strategy at page scale, with hues taken from the
  world. A white page with one blue button is the category default. Choose light
  or dark from the visitor's real scene.
- Avoid the AI clusters unless the brief asks for one: cream with a serif and
  terracotta; near-black with a neon glow; editorial hairlines with italic serif and
  mono labels; purple-blue gradient mesh with glass cards.

## Motion

Make one authored moment from the direction's motion signature, tied to the
signature control. If anything plays by itself, give it a pause control; every
moment has a complete static end state under `prefers-reduced-motion`. Content is visible by
default; never leave content at `opacity: 0` waiting for an observer. Section
reveals, if any, move 12px over 400ms, once. Hovers take 120–180ms with an
exponential ease-out.

## Banned here (enforced by the gate)

Eyebrow or kicker labels above headings. Gradient text. Emoji as icons. Three
equal icon cards as a section. Stat strips of invented numbers. Testimonials,
logo clouds, or avatars without real sources. Nested cards. Thick one-sided accent
borders. Section numbers (01/02/03) that carry no sequence. Headings deeper than
`h3`. A heading followed directly by a smaller heading.

## Verify

Run the gate with `--mode persuade` (see [minimum craft](craft.md)) and fix
every failure. Then look at 1440px and 390px:

1. Read only the headings: do they tell the story?
2. Read only the actions: is the next step obvious?
3. Cover the logo: could this page be a competitor's? If yes, the world and the
   signature are not committed yet.
4. Squint at the fold: is the headline the biggest thing, the primary action
   right beside it, and does the world read before any word does?
5. Read the type: does each family have one job, and is every price, time, and
   sentence set in the text face?

### Rubric review (last step, every landing page)

Judges compare pages side by side on hierarchy, typography, copy, component
polish, alignment, interaction, responsive behaviour, and identity, and they
open every dialog and menu. Review the page the same way before you finish.
If the host can start a fresh subagent, give it only the brief, screenshots of
the 1440 first viewport, the full 1440 page and the full 390 page, and this
section, and ask for the three changes that would most improve each category;
otherwise do it yourself from the screenshots, not from memory of the code.
Fix what it finds, then rerun the gate. These lost real comparisons:

- **Identity**: a world any industry could use (a generic ledger, notebook,
  board, or dashboard); a navy-and-amber or pale-grey "SaaS" look; a concept
  that lives in the hero and is gone by the pricing section.
- **Hierarchy**: a headline split by a band or card; an element larger than the
  headline; actions far from the headline; a fold that splits attention three
  ways (headline, form, and diagram side by side at equal weight).
- **Typography**: a character face on section heads, prices, or body; three
  voices in one viewport (display, split-flap, and handwriting); every section
  head as the same all-caps banner; extra-wide caps on every heading.
- **Alignment**: an artifact cropped at the viewport edge with labels cut (only
  a plain object may bleed: a disc, a folder, never a board or table); ruled
  lines that do not sit on the text baselines; a narrow column that leaves the
  1440 canvas empty; folder tabs or headings that wander off the content edge.
- **Polish**: a success or error panel visible before its state (a `[hidden]`
  box overridden by `display:grid`), a disabled button that renders as a blank
  block, a nav band whose colour clashes with the hero, controls that shift the
  layout when used.
- **Responsive**: pricing actions squeezed into narrow columns at 390, a menu
  button that is not at the edge, a legend item wrapping alone.

Pricing, signup, and login actions are product workflows, with complete pending,
failure, and success behavior.
