// product-demo: the film on a landing page or in a sales email. 25 to 40 seconds, wide.
//
// The shape:
//   hook      the viewer's problem, as the question they already have (not the product's name)
//   setup     straight to the page that answers it: quick, few words
//   moment    the one thing to remember: closer (zoom), slower (hold), heard (sound)
//   payoff    what it does for someone, even outside the app (an email the customer gets)
//   next      what to do now, with a button
// Why: a stranger knows in three seconds whether this is for them, and leaves remembering one moment.
//
// This runs on a sample invoicing app. Keep the shape; change the pages, names and words to your app. On a real app,
// show sample data (mock, replace) rather than real customers, and only what the product really does.
export default {
  format: "demo",
  async run({ card, open, select, click, zoom, see }) {
    await card("Who owes you", "money right now?");

    await open("/");
    await select("Status", "Past due", { say: "Two customers are behind." });
    await click("Kestrel Robotics");

    await zoom({ selector: "#panel .inv", name: "the late invoice" }, { say: "Twelve days late on $2,400.", hold: 600 });
    await click("Send reminder", { say: "One click reminds them, with a link to pay.", sound: "success", hold: 800 });
    await see("Reminder sent");

    // the payoff: what the customer gets, drawn as a component. Only what the product really does: a reminder with a
    // link to pay, not a payment it cannot promise
    await open("component:email", { data: { from: "Ledgerly", subject: "Your $2,400 invoice is 12 days late", preview: "Pay in one click with the link inside.", time: "9:31", body: "Hi Kestrel Robotics, your March invoice for $2,400 is 12 days late. You can pay it now with the link below.", button: "Pay $2,400" } });
    await click("Your $2,400 invoice is 12 days late");
    await zoom({ testid: "mail", name: "the reminder" }, { say: "Kestrel gets it, with a link to pay.", hold: 1000 });

    await card("Get paid", "without chasing.", { url: "https://ledgerly.example", button: "Start free" });
  },
};
