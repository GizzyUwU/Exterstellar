// temporary module :3

Exterstellar.register({
  id: "uwu",
  name: "UwU mrrp",
  description: "OwO",
  author: "furryfemboy123",
  start() {
    const quip = QUIPS[Math.floor(Math.random() * QUIPS.length)];
    console.log("%c[Exterstellar | UwU mrrp]", "color: #7c3aed; font-weight: bold;", quip);
  }
});

const QUIPS = [
  "meow",
  "mrrp",
  "uwu",
  "owo",
  ":3",
];