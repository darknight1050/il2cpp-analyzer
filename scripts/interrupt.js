// Graceful interruption for the long running maintenance scripts.
//
// These runs can take hours, so stopping one must not mean losing the progress
// made so far. Instead of dying mid-batch, the loop finishes the batch it is on
// and then exits, printing the id to resume from. A second signal gives up and
// exits immediately, for when something is genuinely stuck.
//
// Note that `docker compose run` makes node PID 1, where the kernel applies no
// default signal disposition - without a handler like this one (or an init
// process) SIGINT is simply ignored and Ctrl+C does nothing.

let interrupted = false;

const onSignal = (signal) => {
  if (interrupted) {
    console.error(`\nSecond ${signal} - exiting immediately.`);
    process.exit(130);
  }
  interrupted = true;
  console.error(
    `\n${signal} received - finishing the current batch, then stopping. ` +
      `Press Ctrl+C again to stop right away.`,
  );
};

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => onSignal(signal));
}

const isInterrupted = () => interrupted;

module.exports = { isInterrupted };
