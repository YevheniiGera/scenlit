// The cards of a scene: its opening (which names the film) and its end, from the scene's fields, title() and end(), or
// card() said where it decides what it is.
// card(): where it is said decides what it is. Before the app shows (nothing but backgrounds before it): the opening
// card, which also names the film. After the last step that shows the app: the end card. Anywhere else: a chapter.
// title() and end() say it outright, and then a card is never taken for them. Returns the steps, cards placed.
const STAGE = ["card", "background"]; // steps that do not show the app
export function placeCards(steps, cards) {
  const shows = (s) => !STAGE.includes(s.kind), first = steps.findIndex(shows), last = steps.findLastIndex(shows);
  const lastCard = steps.findLastIndex((s) => s.kind === "card");
  return steps.flatMap((s, i) => {
    if (s.kind !== "card") return [s];
    const { opened, ...step } = s;
    if (!cards.title && !opened && (first < 0 || i < first)) { cards.title = { lead: s.card.lead, key: s.card.key }; return []; }
    if (!cards.end && i === lastCard && i > last) { cards.end = s.card; return []; }
    return [{ ...step, kind: "chapter", card: { lead: s.card.lead, key: s.card.key } }];
  });
}
// A scene with the cards its run() said (in `capture`), else its own (`declared`: as the scene file has them), else
// none: a film without an opening card starts in the app and is named after the scene; without an end card it ends
// on its last picture. `none` marks the missing one; its words are empty, so everything that reads them still can.
export function withCards(scene, capture) {
  const own = scene.declared ?? { title: scene.title, end: scene.end };
  const title = capture?.title ?? own.title ?? { lead: "", key: scene.name, none: true };
  const end = capture?.end ? { ...own.end, ...capture.end } : own.end ?? { lead: "", key: "", none: true };
  return { ...scene, declared: own, title, end };
}
