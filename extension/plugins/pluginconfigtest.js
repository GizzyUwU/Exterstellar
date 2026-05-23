Exterstellar.register({
  id: "pluginconfigtest",
  name: "plugin config test",
  description: "testtesttesttest",
  author: "sabio",
  config: [
    {
      key: "message",
      label: "Message",
      type: "text",
      default: "nothing provided",
      placeholder: "something"
    }
  ],

  start() {
    const cfg = Exterstellar.getConfig("pluginconfigtest");
    const message = cfg.message?.trim() || "something";

    console.log(message);
  }
});