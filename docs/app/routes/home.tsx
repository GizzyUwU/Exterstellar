import { useEffect, useState } from "react";
import { motion } from "motion/react";
import logo from "/ExterstellarLogo.png";
import MobileParserModule from "device-detector-js/dist/parsers/device/mobiles.js";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

export function meta() {
  return [
    { title: "Exterstellar" },
    {
      name: "description",
      content: "Browser extension for Stardance.",
    },
  ];
}

function multipleBoxShadow(n: number): string {
  const rand = () => Math.floor(Math.random() * 2000);
  let value = `${rand()}px ${rand()}px #FFF`;
  for (let i = 2; i <= n; i++) {
    value += `, ${rand()}px ${rand()}px #FFF`;
  }
  return value;
}

export default function Home() {
  const [browser, setBrowser] = useState({
    name: "Chrome",
    disabled: false,
  });
  const [logoSrc, setLogoSrc] = useState(logo);
  const [showScroll, setShowScroll] = useState(true);

  const MobileParser = (MobileParserModule as any).default;
  let meClicks = 0;

  useEffect(() => {
    const small = multipleBoxShadow(700);
    const medium = multipleBoxShadow(200);
    const big = multipleBoxShadow(100);

    const style = document.createElement("style");
    style.id = "stars-style";
    style.textContent = `
      #stars {box-shadow:${small};}
      #stars2 {box-shadow:${medium};}
      #stars3 {box-shadow:${big};}
      #stars::after {box-shadow:${small};}
      #stars2::after {box-shadow:${medium};}
      #stars3::after {box-shadow:${big};}
    `;
    document.head.appendChild(style);
    return () => document.getElementById("stars-style")?.remove();
  }, []);

  useEffect(() => {
    const lenis = new Lenis();

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const result = new MobileParser().parse(userAgent);
    if (result && result.type) {
      setBrowser({
        name: "Mobile",
        disabled: true,
      });
      return;
    }

    if (userAgent.includes("firefox")) {
      setBrowser({
        name: "Firefox",
        disabled: false,
      });
    } else if (
      userAgent.includes("safari") &&
      !userAgent.includes("chrome")
    ) {
      setBrowser({
        name: "Safari",
        disabled: true,
      });
    } else if (userAgent.includes("ladybird")) {
      setBrowser({
        name: "Ladybird",
        disabled: true,
      });
    }
  }, []);

  useEffect(() => {
    function handleScroll() {
      setShowScroll(window.scrollY < 120);
    }

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function monopolyEasteregg() {
    if (meClicks >= 5) {
      setLogoSrc("/monopolies/StardanceUtilsLogoReal.png");
      meClicks -= 1;
    } else {
      setLogoSrc("/ExterstellarLogo.png");
      meClicks += 1;
    }
  }

  return (
    <div className="flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div id="stars" />
        <div id="stars2" />
        <div id="stars3" />
      </div>

      <div className="relative flex flex-col gap-10 min-h-screen justify-center px-6">
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-neutral-300"
        >
          Brought to you by{" "}
          <a
            href="https://flux3tor.xyz/"
            target="_blank"
            className="underline underline-offset-4"
          >
            Flux3tor
          </a>{" "}
          and{" "}
          <a
            href="https://hackclub.enterprise.slack.com/archives/C08RSTCKW2X"
            target="_blank"
            className="underline underline-offset-4"
          >
            Sabio
          </a>
        </motion.p>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            viewport={{ once: true }}
            className="flex justify-end pr-[5dvw]"
          >
            <motion.button
              whileHover={
                !browser.disabled
                  ? {
                      scale: 1.04,
                      backgroundColor: "var(--color-white)",
                      color: "var(--color-black)",
                      borderColor: "transparent",
                    }
                  : {}
              }
              transition={{ duration: 0.25 }}
              disabled={browser.disabled}
              className={browser.disabled ? "opacity-50 cursor-not-allowed" : ""}
            >
              {browser.disabled
                ? `Unavailable for ${browser.name}`
                : `Install for ${browser.name}`}
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            viewport={{ once: true }}
            className="relative flex justify-center"
          >
            <div className="absolute w-[24rem] h-[24rem] rounded-full bg-white/[0.05] blur-3xl" />

            <motion.img
              src={logoSrc}
              alt="Exterstellar Logo"
              className="w-[40dvw] h-auto relative z-10"
              onClick={monopolyEasteregg}
              id="exterstellarLogo"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 1.2 }}
            viewport={{ once: true }}
            className="flex justify-start pl-[5dvw]"
          >
            <motion.a
              whileHover={{
                scale: 1.04,
                backgroundColor: "var(--color-white)",
                color: "var(--color-black)",
                borderColor: "transparent",
              }}
              transition={{ duration: 0.25 }}
              href="https://github.com/Team-Exterstellar/Exterstellar"
              target="_blank"
              className="btn !no-underline hover:!no-underline visited:!no-underline active:!no-underline"
            >
              View Source
            </motion.a>
          </motion.div>
        </div>

        <motion.div
          animate={{
            opacity: showScroll ? [0.15, 0.45, 0.15] : 0,
          }}
          transition={{
            duration: 2.4,
            repeat: showScroll ? Infinity : 0,
          }}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-neutral-600 text-[11px] tracking-[0.3em] pointer-events-none"
        >
          <span>SCROLL</span>

          <div className="w-24 h-px bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />
        </motion.div>
      </div>

      <div className="flex flex-col items-center pt-28 pb-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
          className="flex flex-col items-center gap-7 max-w-4xl"
        >
          <div className="border border-neutral-700 px-3 py-1 text-xs text-neutral-400 bg-neutral-950/40 rounded-full">
            Early Development • Built for Stardance
          </div>

          <h1 className="text-5xl font-semibold tracking-tight text-center">
            Exterstellar
          </h1>

          <div className="flex flex-col gap-6 text-center leading-8 text-neutral-300 text-lg">
            <p>
              Exterstellar is a browser extension for Stardance.
            </p>

            <p>
              Built as the successor to Spicetown, a project we previously made
              for Flavortown, Exterstellar carries that same spirit into
              Stardance while growing into something of its own.
            </p>

            <p>
              The goal is not to change what already works. It is to make
              Stardance feel more complete with additions that feel useful,
              thoughtful, and natural to have around.
            </p>

            <p>
              Development is still early and Exterstellar continues to evolve as
              new ideas, experiments, and improvements are explored.
            </p>
          </div>

          <p className="text-sm text-neutral-500 text-center">
            Follow development in{" "}
            <a
              href="https://hackclub.enterprise.slack.com/archives/C08RSTCKW2X"
              target="_blank"
              className="underline underline-offset-4"
            >
              #exterstellar
            </a>
          </p>
        </motion.div>
      </div>
      
      <div className="flex flex-col items-center px-6 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
          className="flex flex-col gap-24 w-full max-w-6xl"
        >
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="border border-neutral-700 px-3 py-1 text-xs text-neutral-400 bg-neutral-950/40 rounded-full">
              Plugins
            </div>

            <h2 className="text-4xl font-semibold">
              What ships with Exterstellar
            </h2>

            <p className="text-neutral-400 max-w-2xl leading-7">
              Exterstellar ships with plugins designed to improve the Stardance
              experience while keeping everything familiar and easy to use.
            </p>
          </div>

          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4 text-center items-center">
              <h3 className="text-3xl font-medium">
                Better Sidebar
              </h3>

              <p className="text-neutral-400 max-w-2xl leading-7">
                Simplifies and redesigns the Stardance sidebar with a cleaner and
                more focused layout.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800 overflow-hidden max-w-5xl mx-auto">
              <img
                src="/plugins/better-sidebar.png"
                alt="Better Sidebar Plugin"
                className="w-full"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto items-start">
              <div className="flex flex-col gap-3">
                <p className="text-center text-sm text-neutral-500 tracking-wide">
                  BEFORE
                </p>

                <div className="rounded-2xl border border-neutral-800 overflow-hidden">
                  <img
                    src="/plugins/better-sidebar-before.png"
                    alt="Better Sidebar Before"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-center text-sm text-neutral-500 tracking-wide">
                  AFTER
                </p>

                <div className="rounded-2xl border border-neutral-800 overflow-hidden">
                  <img
                    src="/plugins/better-sidebar-after.png"
                    alt="Better Sidebar After"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4 text-center items-center">
              <h3 className="text-3xl font-medium">
                Custom Font
              </h3>

              <p className="text-neutral-400 max-w-2xl leading-7">
                Apply fonts from Google Fonts or your own system across Stardance.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              <div className="flex flex-col gap-3">
                <p className="text-center text-sm text-neutral-500 tracking-wide">
                  GOOGLE FONTS
                </p>

                <div className="rounded-2xl border border-neutral-800 overflow-hidden">
                  <img
                    src="/plugins/custom-font-google.png"
                    alt="Google Fonts"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-center text-sm text-neutral-500 tracking-wide">
                  SYSTEM FONTS
                </p>

                <div className="rounded-2xl border border-neutral-800 overflow-hidden">
                  <img
                    src="/plugins/custom-font-system.png"
                    alt="System Fonts"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            </div>

            <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4 text-center items-center">
              <h3 className="text-3xl font-medium">
                Custom Scrollbar
              </h3>

              <p className="text-neutral-400 max-w-2xl leading-7">
                Style Stardance scrollbars with multiple color options.
              </p>
            </div>

            <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-10 items-center max-w-6xl mx-auto">
              {/* Plugin UI */}
              <div className="rounded-2xl border border-neutral-800 overflow-hidden">
                <img
                  src="/plugins/custom-scrollbar.png"
                  alt="Custom Scrollbar Plugin"
                  className="w-full"
                />
              </div>

              {/* Result */}
              <div className="flex flex-col gap-5 items-center">
                <p className="text-center text-sm text-neutral-500 tracking-wide">
                  DEFAULT → LAVENDER
                </p>

                <div className="flex items-center gap-5">
                  <div className="flex flex-col gap-2 items-center">
                    <span className="text-xs text-neutral-500 tracking-wide">
                      DEFAULT
                    </span>

                    <div className="rounded-2xl border border-neutral-800 overflow-hidden p-4">
                      <img
                        src="/plugins/custom-scrollbar-default.png"
                        alt="Default Scrollbar"
                        className="h-[260px] object-contain"
                      />
                    </div>
                  </div>

                  <div className="text-neutral-600 text-xl">
                    →
                  </div>

                  <div className="flex flex-col gap-2 items-center">
                    <span className="text-xs text-neutral-500 tracking-wide">
                      LAVENDER
                    </span>

                    <div className="rounded-2xl border border-neutral-800 overflow-hidden p-4">
                      <img
                        src="/plugins/custom-scrollbar-lavender.png"
                        alt="Lavender Scrollbar"
                        className="h-[260px] object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4 text-center items-center">
              <h3 className="text-3xl font-medium">
                Sidebar Reorder
              </h3>

              <p className="text-neutral-400 max-w-2xl leading-7">
                Drag and drop sidebar items into any order you want.
              </p>
            </div>
            
            <div className="rounded-2xl border border-neutral-800 overflow-hidden max-w-3xl mx-auto">
              <img
                src="/plugins/sidebar-reorder.png"
                alt="Sidebar Reorder"
                className="w-full"
              />
            </div>

            <div className="rounded-2xl border border-neutral-800 overflow-hidden max-w-5xl mx-auto">
              <img
                src="/plugins/sidebar-reorder-demo.gif"
                alt="Sidebar Reorder Demo"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4 text-center items-center">
              <h3 className="text-3xl font-medium">
                Sidebar Hotkeys
              </h3>

              <p className="text-neutral-400 max-w-2xl leading-7">
                Instantly navigate Stardance using customizable keyboard shortcuts and optional sidebar key hints.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800 overflow-hidden max-w-3xl mx-auto">
             <img
              src="/plugins/sidebar-hotkeys.png"
              alt="Sidebar Hotkeys"
              className="w-full"
            />
            </div>

            <div className="rounded-2xl border border-neutral-800 overflow-hidden max-w-5xl mx-auto">
              <img
                src="/plugins/sidebar-hotkeys-demo.gif"
                alt="Sidebar Hotkeys Demo"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4 text-center items-center">
              <h3 className="text-3xl font-medium">
                Devlog Formatter
              </h3>

              <p className="text-neutral-400 max-w-2xl leading-7">
                Adds a markdown formatting toolbar to the Stardance devlog editor.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800 overflow-hidden max-w-2xl mx-auto">
              <img
                src="/plugins/devlog-formatter.png"
                alt="Devlog Formatter"
                className="w-full"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              <div className="flex flex-col gap-3">
                <p className="text-center text-sm text-neutral-500 tracking-wide">
                  WITHOUT LABELS
                </p>

                <div className="rounded-2xl border border-neutral-800 overflow-hidden">
                  <img
                    src="/plugins/devlog-formatter-without-labels.png"
                    alt="Without Labels"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-center text-sm text-neutral-500 tracking-wide">
                  WITH LABELS
                </p>

                <div className="rounded-2xl border border-neutral-800 overflow-hidden">
                  <img
                    src="/plugins/devlog-formatter-with-labels.png"
                    alt="With Labels"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4 text-center items-center">
              <h3 className="text-3xl font-medium">
                Comment Markdown
              </h3>

              <p className="text-neutral-400 max-w-2xl leading-7">
                Brings markdown formatting support to Stardance comments.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800 overflow-hidden max-w-3xl mx-auto">
             <img
              src="/plugins/comment-markdown.png"
              alt="Comment Markdown"
              className="w-full"
            />
            </div>

            <div className="rounded-2xl border border-neutral-800 overflow-hidden max-w-5xl mx-auto">
              <img
                src="/plugins/comment-markdown-demo.png"
                alt="Comment Markdown Demo"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4 text-center items-center">
              <h3 className="text-3xl font-medium">
                Oneko
              </h3>

              <p className="text-neutral-400 max-w-2xl leading-7">
                Brings the classic cursor-following cat to Stardance.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800 overflow-hidden max-w-3xl mx-auto">
              <img
                src="/plugins/oneko.png"
                alt="Oneko"
                className="w-full"
              />
            </div>

            <div className="rounded-2xl border border-neutral-800 overflow-hidden max-w-5xl mx-auto">
              <img
                src="/plugins/oneko-demo.gif"
                alt="Oneko Demo"
                className="w-full"
              />
            </div>
          </div>
        </motion.div>
      </div>

      <footer className="border-t border-neutral-900/80 px-6 py-8 text-center text-sm text-neutral-400">
        <p>Exterstellar • Built for Stardance</p>

        <p className="mt-2">
          Made by{" "}
          <a
            href="https://flux3tor.xyz/"
            target="_blank"
            className="underline underline-offset-4"
          >
            Flux3tor
          </a>{" "}
          and{" "}
          <a
            href="https://hackclub.enterprise.slack.com/archives/C08RSTCKW2X"
            target="_blank"
            className="underline underline-offset-4"
          >
            Sabio
          </a>
        </p>
      </footer>
    </div>
  );
}