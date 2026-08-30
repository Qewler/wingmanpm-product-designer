# Forms and Onboarding

Forms collect a decision, not a pile of fields. Preserve field meaning,
requiredness, validation rules, permissions, legal consent, and submission
effects. Record the four design axes before and after; form work usually changes
Density and Warmth more than Expression or Motion.

## `forms` / `form`

1. Order fields by the user's mental model and the system dependency order.
2. Use visible labels. Put format guidance and constraints near the relevant
   field; placeholders are examples, not labels.
3. Choose controls that match the value. Do not replace familiar native input
   behavior with a decorative custom control without a functional need.
4. Preserve entered values after validation or network failure.
5. Associate errors with fields, summarize multi-field failure near submission,
   and move focus only when it helps recovery.
6. Make pending, saved, unsaved, disabled, read-only, permission, offline,
   conflict, and success states unambiguous.
7. Separate destructive, reversible, and final actions. Do not make Cancel and
   Submit visually equivalent.

Use progressive disclosure only when hidden fields are conditional or truly
advanced. Do not hide required information or make users discover why a submit
button is disabled.

## `onboarding` / `activate`

Optimize for the first real outcome, not checklist completion.

- Establish the user's goal and available context before asking for setup that
  can be discovered from the product or repository.
- Break setup at meaningful save points. Show what is complete, what remains,
  why a step matters, and whether it can be skipped or resumed.
- Use realistic labeled sample data only when it teaches the real interaction;
  provide a clear path to replace or remove it.
- Let users explore safely before connecting irreversible or external actions.
- Explain permissions at the point of use and request only the needed scope.
- Give empty states a next action and enough context to predict its result.
- Celebrate the first useful outcome briefly, then return control.

Do not use a tour to explain a confusing layout. Repair the layout. Avoid long
mandatory carousels, fake progress, and setup that exists only to collect data.

## Verification

Test keyboard and touch completion, autofill, password managers where relevant,
long labels, localized formats, validation timing, duplicate submit protection,
network interruption, resume behavior, permissions, and screen-reader status
announcements. Consequential completion always gets a clear confirmation.
