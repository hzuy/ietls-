/**
 * Singleton bridge so non-React code (Axios interceptors) can control the progress bar.
 * React component subscribes via useEffect and wires the real start/done functions.
 */
const progressBridge = {
  _start: null,
  _done: null,
  start() { this._start?.() },
  done()  { this._done?.() },
  register(start, done) {
    this._start = start
    this._done = done
  },
}

export default progressBridge
