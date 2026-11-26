// Hello world - main process part (runs once when RL Career Hub+ starts).
// Everything you wrap on hub.engine here only runs for saves that picked this addon.
module.exports = function (hub) {
  const engine = hub.engine;

  // 1. Wrap a game function: keep the original, call it, then do your thing.
  const advance = engine.advance;
  engine.advance = function (state, rand, mode) {
    const before = state.currentDate;
    const result = advance.apply(this, arguments);
    if (state.currentDate !== before) {
      const data = hub.data(state); // saved with the career: state.hubPlusData["hello-world"]
      data.days = (data.days || 0) + 1;
    }
    return result;
  };

  // 2. Send your data to the game window: it ends up in S (the game's snapshot) on every refresh.
  hub.onSnapshot((snap, state) => {
    snap.helloWorld = { days: hub.data(state).days || 0 };
  });

  // 3. An action the game window can call: hubPlus.call("hello-world", "reset")
  hub.action("reset", (payload, state) => {
    hub.data(state).days = 0;
    return { done: true }; // the save is written after the action (return { save: false } to skip it)
  });

  hub.log("ready");
};
