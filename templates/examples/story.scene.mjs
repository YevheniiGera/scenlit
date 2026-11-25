// story: one person's problem, across the screens it touches. 30 to 45 seconds, wide.
//
// The shape:
//   before    the problem arrives where it really does (an email, a chat), drawn as a component
//   setup     the app finds the answer
//   moment    the product does the work
//   after     the result, where the team hears it
//   end       the change in time ("asked at 9:15, paid by lunch")
// Why: it shows the product in someone's day, not as a list of features. The before makes the after land. The
// times, names and amounts agree on every screen: a viewer notices when they do not.
//
// This runs on a sample invoicing app. Keep the shape; change the pages, names and words to your app. Built-in
// components: email, chat, pull-request, issue, terminal, notification, phone (npx scenlit component list).
export default {
  async run({ card, open, click, select, zoom, state, see }) {
    await card("A customer asks", "where their payment is.");

    await open("component:email", { data: { from: "Kestrel Robotics", subject: "Did our March payment arrive?", body: "Hi Maya, we changed banks last month.\nCan you check whether March went through?", button: "Reply", time: "9:15" } });
    await click("Did our March payment arrive?", { say: "Kestrel is not sure March went through.", sound: { name: "notify", at: "start" } });

    await open("/");
    await select("Status", "Past due");
    await click("Kestrel Robotics");
    await zoom({ selector: "#panel .inv", name: "the late invoice" }, { say: "It did not: twelve days late.", hold: 500 });
    await click("Send reminder", { say: "A reminder goes out, with a link to pay.", sound: "pop" });
    await see("Reminder sent");

    await open("component:chat", { data: { workspace: "Ledgerly", channel: "finance", time1: "9:17", earlier1: "Kestrel asked about March. It never arrived.", time2: "9:18", earlier2: "Sent them a reminder with a pay link.", author: "Ledgerly", time: "11:52", text: "Kestrel Robotics paid INV-2046: $2,400." } });
    await state("message", { say: "Before lunch, it is paid.", sound: "notify" });

    await card("Asked at 9:15.", "Paid by lunch.");
  },
};
